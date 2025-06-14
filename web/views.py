import os
import json
from io import BytesIO
import traceback
from collections import defaultdict
from PIL import Image,ImageEnhance
# import cv2
# import numpy as np
from langdetect import detect, DetectorFactory
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
import google.generativeai as genai
from docx import Document
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from PyPDF2 import PdfReader # While imported, it's not used in extract_text_from_file
import pdfplumber
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
DetectorFactory.seed = 0

def summarizer_page(request):
    """
    Trang tóm tắt văn bản.
    """
    return render(request, 'summarizer.html')

@csrf_exempt
def summarize_text(request):
    """
    Hàm xử lý yêu cầu tóm tắt văn bản.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Phương thức không được hỗ trợ'}, status=405)

    try:
        body = json.loads(request.body)
        content = body.get('content', '').strip()
        detected_language = body.get('detected_language')

        if not content:
            return JsonResponse({'error': 'Không có nội dung để tóm tắt'}, status=400)
        if not detected_language:
            try:
                detected_language = detect(content)
            except:
                detected_language = 'unknown'

        language_map = {
                'vi': 'tiếng Việt',
                'en': 'English',
                'fr': 'French',
                'de': 'German',
                'ja': 'Japanese',
                'zh-cn': 'Chinese',
                'unknown': 'ngôn ngữ gốc'
            }
        language_name = language_map.get(detected_language, 'ngôn ngữ gốc')

        prompt = f"""Bạn là một trợ lý AI thông minh. Hãy tóm tắt văn bản sau bằng đúng ngôn ngữ gốc của nó, hiện đang được phát hiện là **{language_name}**.
            Yêu cầu:
            - Tóm tắt phải sử dụng đúng ngôn ngữ của văn bản gốc: {language_name}.
            - Chỉ nêu các ý chính, loại bỏ chi tiết rườm rà.
            - Tóm tắt trong 2 trang word
            - Tổng hợp tất cả số liệu 
            Văn bản cần tóm tắt:
            {content}
            """

        # Lấy API key từ biến môi trường
        api_key = os.getenv("GEMINI_API_KEY")

        # Kiểm tra xem API key có tồn tại không
        if not api_key:
            return JsonResponse({'error': 'Không tìm thấy API key'}, status=500)

        genai.configure(api_key=api_key)

        model = genai.GenerativeModel('gemini-1.5-flash')

        response = model.generate_content(prompt)

        return JsonResponse({'summary': response.text})

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)

def export_summary(request):
    """
    Hàm xử lý yêu cầu xuất bản tóm tắt.
    """
    if request.method == "POST":
        summary_text = request.POST.get("summary", "")
        export_format = request.POST.get("format", "")

        if export_format == "docx":
            buffer = BytesIO()
            doc = Document()
            for line in summary_text.split("\n"):
                doc.add_paragraph(line)
            doc.save(buffer)
            buffer.seek(0)
            return HttpResponse(
                buffer,
                content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                headers={'Content-Disposition': 'attachment; filename="tom_tat.docx"'}
            )

    return HttpResponse("Yêu cầu không hợp lệ", status=400)

@csrf_exempt
def extract_text_from_file(request):
    """
    Nhận file PDF hoặc DOCX, trích xuất văn bản và dữ liệu từ bảng.
    """
    if request.method != "POST":
        return JsonResponse({'error': 'Phương thức không được hỗ trợ'}, status=405)

    try:
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return JsonResponse({'error': 'Không có file nào được tải lên'}, status=400)
        if 'summary_result' in request.session:
            del request.session['summary_result']

        filename = uploaded_file.name.lower()
        content = ""

        if filename.endswith('.pdf'):
            with pdfplumber.open(uploaded_file) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_content = ""
                    # Cố gắng trích xuất từ ngữ
                    words = page.extract_words()
                    if words:
                        lines = defaultdict(list)
                        for word in words:
                            top_rounded = round(word['top'] / 2) * 2
                            lines[top_rounded].append((word['x0'], word['text']))

                        sorted_lines = sorted(lines.items(), key=lambda x: x[0])
                        all_lines = []
                        for _, line_words in sorted_lines:
                            sorted_words = sorted(line_words, key=lambda x: x[0])
                            line_text = " ".join(w for _, w in sorted_words)
                            all_lines.append(line_text.strip())

                        paragraph = " ".join(all_lines)
                        page_content += f"[{i+1}]\n{paragraph}\n\n"
                        print(f"DEBUG: Page {i+1} - pdfplumber extracted text.") # Debugging
                    else:
                        # Dùng OCR nếu không có văn bản
                        print(f"DEBUG: Page {i+1} - pdfplumber found no text, attempting OCR.") # Debugging
                        try:
                            pil_image = page.to_image(resolution=300).original.convert("RGB")

                            # Thay thế OpenCV bằng PIL/Pillow
                            try:
                                # Chuyển sang grayscale
                                gray_image = pil_image.convert('L')
                                
                                # Tăng độ tương phản để cải thiện OCR
                                enhancer = ImageEnhance.Contrast(gray_image)
                                enhanced_image = enhancer.enhance(1.5)
                                
                                # Tăng độ sắc nét
                                sharpness_enhancer = ImageEnhance.Sharpness(enhanced_image)
                                processed_image = sharpness_enhancer.enhance(2.0)
                                
                                # OCR với ảnh đã xử lý
                                ocr_text = pytesseract.image_to_string(processed_image, lang="eng+vie")
                                
                            except Exception as pil_e:
                                print(f"DEBUG: PIL processing failed: {pil_e}, using original image for OCR")
                                # Fallback: OCR trực tiếp từ ảnh gốc
                                ocr_text = pytesseract.image_to_string(pil_image, lang="eng+vie")
                            
                            if ocr_text.strip():
                                page_content += f"[{i+1} - OCR]\n{ocr_text.strip()}\n\n"
                                print(f"DEBUG: Page {i+1} - OCR successful, extracted {len(ocr_text.strip().split())} words.") # Debugging
                            else:
                                print(f"DEBUG: Page {i+1} - OCR returned empty text.") # Debugging
                                
                        except Exception as ocr_e:
                            print(f"ERROR: Page {i+1} - OCR failed: {ocr_e}") # Debugging OCR errors
                            page_content += f"[{i+1} - OCR Error] Could not extract text.\n\n"

                    # Trích xuất bảng (nếu có)
                    tables = page.extract_tables()
                    if tables:
                        print(f"DEBUG: Page {i+1} - Tables found.") # Debugging
                        for table in tables:
                            for row in table:
                                row_text = "\t".join(cell if cell else "" for cell in row)
                                page_content += row_text + "\n"
                            page_content += "\n"
                    else:
                        print(f"DEBUG: Page {i+1} - No tables found.") # Debugging

                    content += page_content

        elif filename.endswith('.docx'):
            doc = Document(uploaded_file)

            # Trích xuất văn bản đoạn văn
            for para in doc.paragraphs:
                content += para.text + "\n"

            # Trích xuất bảng
            for table in doc.tables:
                for row in table.rows:
                    row_data = [cell.text.strip() for cell in row.cells]
                    content += "\t".join(row_data) + "\n"

        else:
            return JsonResponse({'error': 'Chỉ hỗ trợ các file PDF hoặc DOCX'}, status=400)

        if not content.strip():
            return JsonResponse({'error': 'Không thể trích xuất nội dung từ tệp. Đảm bảo tệp không trống hoặc bị lỗi hình ảnh.'}, status=400)


        return JsonResponse({'content': content})

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)
