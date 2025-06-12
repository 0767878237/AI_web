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
const exportDocxBtn = document.getElementById('exportDocxBtn');

// Set PDF.js worker source
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.toggle('active');
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
        mobileMenu.classList.remove('active');
    }
});

// Close mobile menu when window is resized to desktop
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        document.getElementById('mobileMenu').classList.remove('active');
    }
});

document.addEventListener("DOMContentLoaded", function () {
    // Enhanced upload area click handler
    uploadArea.addEventListener("click", function () {
        fileInput.click();
    });

    // Enhanced drag and drop with modern UI feedback
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // File input change handler
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });

    // Enhanced summarize button with loading state
    summarizeBtn.addEventListener('click', function() {
        // Update button to loading state
        this.innerHTML = `
            <div class="loading-spinner"></div>
            Đang tạo tóm tắt...
        `;
        this.disabled = true;
        generateSummary();
    });

    // Enhanced export functionality
    const exportForm = document.getElementById('exportDocxForm');
    if (exportForm) {
        exportForm.addEventListener('submit', function(e) {
            // Add loading state to export button
            exportDocxBtn.innerHTML = `
                <div class="loading-spinner"></div>
                Đang xuất...
            `;
            exportDocxBtn.disabled = true;
            
            // Reset button after a delay (form will redirect)
            setTimeout(() => {
                exportDocxBtn.innerHTML = `
                    <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    📝 Xuất DOCX
                `;
                exportDocxBtn.disabled = false;
            }, 3000);
        });
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + U to trigger file upload
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            fileInput.click();
        }
        
        // Ctrl/Cmd + Enter to generate summary
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!summarizeBtn.disabled && currentFileContent) {
                summarizeBtn.click();
            }
        }
    });
});

async function handleFile(file) {
    summaryArea.innerHTML = '';
    exportDocxBtn.disabled = true;
    const summaryDocxInput = document.getElementById('summaryDocxInput');
    if (summaryDocxInput) {
        summaryDocxInput.value = '';
    }
    fileName = file.name;
    fileType = fileName.split('.').pop().toLowerCase();

    showFileInfo(file);

    documentContent.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            Đang đọc tài liệu...
        </div>
    `;

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/extract-text/', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.content) {
            documentContent.innerHTML = `
                <div class="content-text">
                    ${data.content.replace(/\n/g, '<br>')}
                </div>
            `;
            currentFileContent = data.content;
            summarizeBtn.disabled = false;
            resetSummarizeButton();
        } else {
            throw new Error(data.error || 'Đã xảy ra lỗi khi đọc nội dung file');
        }

    } catch (error) {
        console.error('Lỗi khi đọc tệp:', error);
        documentContent.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <p><strong>❌ Lỗi khi đọc tệp</strong></p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function showFileInfo(file) {
    const fileNameElement = document.getElementById('fileName');
    const fileSizeElement = document.getElementById('fileSize');
    
    if (fileNameElement && fileSizeElement) {
        fileNameElement.textContent = file.name;
        fileSizeElement.textContent = formatFileSize(file.size);
        fileInfo.style.display = 'block';
    } else {
        // Fallback for original structure
        fileInfo.innerHTML = `
            <div class="file-info-content">
                <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10,9 9,9 8,9"/>
                </svg>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${formatFileSize(file.size)}</p>
                </div>
            </div>
        `;
        fileInfo.style.display = 'block';
    }
}

async function generateSummary() {
    // Show spinner and update summary area
    spinner.style.display = 'block';
    summaryArea.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            Đang tạo bản tóm tắt...
        </div>
    `;

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
            // Display summary with better formatting
            summaryArea.innerHTML = `
                <div class="content-text">
                    ${data.summary.replace(/\n/g, '<br>')}
                </div>
            `;

            // Enable export button and sync hidden input
            const summaryDocxInput = document.getElementById('summaryDocxInput');
            if (summaryDocxInput) {
                summaryDocxInput.value = data.summary;
            }
            exportDocxBtn.disabled = false;

            // Show success message
            showSuccessMessage('Tóm tắt đã được tạo thành công!');

        } else {
            throw new Error(data.error || 'Đã xảy ra lỗi không xác định.');
        }
    } catch (error) {
        console.error('Lỗi khi tạo bản tóm tắt:', error);
        summaryArea.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <p><strong>❌ Lỗi khi tạo bản tóm tắt</strong></p>
                <p>${error.message}</p>
            </div>
        `;
    } finally {
        // Hide spinner and reset button
        spinner.style.display = 'none';
        resetSummarizeButton();
    }
}

function resetSummarizeButton() {
    summarizeBtn.innerHTML = `
        <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/>
            <polyline points="9,11 12,14 15,11"/>
            <line x1="12" y1="14" x2="12" y2="2"/>
        </svg>
        Tạo bản tóm tắt
    `;
    summarizeBtn.disabled = false;
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

// Add visual feedback for successful operations
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #047857 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(successDiv)) {
                document.body.removeChild(successDiv);
            }
        }, 300);
    }, 3000);
}