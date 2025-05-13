pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
let currentFileContent = '';
let fileName = '';
let fileType = '';

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const documentContent = document.getElementById('documentContent');
const summarizeBtn = document.getElementById('summarizeBtn');
const summaryArea = document.getElementById('summaryArea');
const spinner = document.getElementById('spinner');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = 'rgba(52, 152, 219, 0.3)';
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});
fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFile(fileInput.files[0]);
    }
});
summarizeBtn.addEventListener('click', generateSummary);

async function handleFile(file) {
    fileName = file.name;
    fileType = fileName.split('.').pop().toLowerCase();

    fileInfo.innerHTML = `
        <strong>Tệp:</strong> ${fileName}<br>
        <strong>Kích thước:</strong> ${formatFileSize(file.size)}<br>
        <strong>Loại:</strong> ${fileType.toUpperCase()}
    `;

    documentContent.innerHTML = '<p>Đang đọc tài liệu...</p>';

    try {
        if (fileType === 'pdf') {
            await handlePdfFile(file);
        } else if (fileType === 'doc' || fileType === 'docx') {
            await handleDocFile(file);
        } else {
            documentContent.innerHTML = '<p class="error">Loại tệp không được hỗ trợ. Vui lòng dùng PDF, DOC hoặc DOCX.</p>';
            return;
        }

        summarizeBtn.disabled = false;
    } catch (error) {
        console.error('Lỗi khi đọc tệp:', error);
        documentContent.innerHTML = `<p class="error">Lỗi khi đọc tệp: ${error.message}</p>`;
    }
}

async function handlePdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    let content = '';
    const pagesToProcess = Math.min(numPages, 20);

    for (let i = 1; i <= pagesToProcess; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map(item => item.str);
        content += textItems.join(' ') + '\n\n';
    }

    if (numPages > 20) {
        content += `\n[...Tài liệu có ${numPages} trang, chỉ hiển thị 20 trang đầu tiên...]\n`;
    }

    documentContent.innerHTML = `<p>${content.replace(/\n/g, '<br>')}</p>`;
    currentFileContent = content;
}

async function handleDocFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const content = result.value;

    documentContent.innerHTML = `<p>${content.replace(/\n/g, '<br>')}</p>`;
    currentFileContent = content;
}

async function generateSummary() {
    spinner.style.display = 'inline';
    summaryArea.innerHTML = '<p>Đang tạo bản tóm tắt...</p>';
    summarizeBtn.disabled = true;

    try {
        if (!currentFileContent || currentFileContent.trim() === '') {
            throw new Error('Không có nội dung để tóm tắt. Vui lòng tải lên tệp hợp lệ trước.');
        }

        const maxChars = 10000;
        const truncatedContent = currentFileContent.length > maxChars 
            ? currentFileContent.substring(0, maxChars) + '...[nội dung đã bị cắt bớt]' 
            : currentFileContent;

        const response = await fetch('/api/summarize/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ content: truncatedContent })
        });

        const data = await response.json();

        if (response.ok && data.summary) {
            summaryArea.innerHTML = `<p>${data.summary.replace(/\n/g, '<br>')}</p>`;
        } else {
            throw new Error(data.error || 'Đã xảy ra lỗi không xác định.');
        }
    } catch (error) {
        console.error('Lỗi khi tạo bản tóm tắt:', error);
        summaryArea.innerHTML = `<p class="error">Lỗi: ${error.message}</p>`;
    } finally {
        spinner.style.display = 'none';
        summarizeBtn.disabled = false;
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}