"""views.py: Chứa các hàm xử lý yêu cầu từ người dùng."""
import os
import json
from io import BytesIO
import traceback
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
import google.generativeai as genai
from docx import Document
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from PyPDF2 import PdfReader
import pdfplumber
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

        if not content:
            return JsonResponse({'error': 'Không có nội dung để tóm tắt'}, status=400)

        prompt = f"""Nhiệm vụ: Tóm tắt văn bản sau theo ngôn ngữ gốc một cách ngắn gọn, chỉ giữ lại các ý chính.
        Yêu cầu: Tạo một bản tóm tắt không quá 5000 từ, bám sát nội dung gốc.
        Văn bản cần tóm tắt:

        {content}
        """

        # Lấy API key từ biến môi trường
        api_key = os.getenv("GEMINI_API_KEY")

        # Kiểm tra xem API key có tồn tại không
        if not api_key:
            return JsonResponse({'error': 'Không tìm thấy API key'}, status=500)

        genai.configure(api_key=api_key)

        # Directly use the recommended model
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

        # if export_format == "pdf":
        #     buffer = BytesIO()
        #     doc = SimpleDocTemplate(buffer, pagesize=A4)
        #     styles = getSampleStyleSheet()
        #     story = []

        #     for line in summary_text.split("\n"):
        #         story.append(Paragraph(line, styles["Normal"]))
        #         story.append(Spacer(1, 12))

        #     doc.build(story)
        #     buffer.seek(0)
        #     return HttpResponse(
        #         buffer,
        #         content_type='application/pdf',
        #         headers={'Content-Disposition': 'attachment; filename="tom_tat.pdf"'}
        #     )

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
                max_pages = min(len(pdf.pages), 20)
                for i in range(max_pages):
                    page = pdf.pages[i]
                    text = page.extract_text()
                    if text:
                        content += f"[Trang {i+1}]\n{text}\n\n"
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            row_text = "\t".join(cell if cell else "" for cell in row)
                            content += row_text + "\n"
                        content += "\n"

                if len(pdf.pages) > 20:
                    content += f"[...Tài liệu có {len(pdf.pages)} trang, chỉ hiển thị 20 trang đầu tiên...]\n"

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

        return JsonResponse({'content': content})

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)
