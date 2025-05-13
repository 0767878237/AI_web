import os
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.shortcuts import render
import google.generativeai as genai

@csrf_exempt
def summarize_text(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Phương thức không được hỗ trợ'}, status=405)

    try:
        body = json.loads(request.body)
        content = body.get('content', '').strip()

        if not content:
            return JsonResponse({'error': 'Không có nội dung để tóm tắt'}, status=400)

        prompt = f"""Nhiệm vụ: Tóm tắt văn bản sau một cách ngắn gọn, chỉ giữ lại các ý chính.
        Yêu cầu: Tạo một bản tóm tắt không quá 1000 từ, bám sát nội dung gốc.
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
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)

def summarizer_page(request):
    return render(request, 'summarizer.html')