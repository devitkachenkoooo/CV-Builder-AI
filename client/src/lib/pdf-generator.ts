import html2pdf from 'html2pdf.js';

interface PdfFromUrlOptions {
  url: string;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
  onLoadingChange?: (loading: boolean) => void; // Callback для кнопки
}

interface PdfFromElementOptions {
  element: HTMLElement;
  filename?: string;
  windowWidth?: number;
  contentWidthMm?: number;
  onLoadingChange?: (loading: boolean) => void; // Callback для кнопки
}

// Функція для створення модального вікна генерації PDF
function createPdfModal(html: string): void {
  // Створюємо модальне вікно, яке закриває всю сторінку
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  // Створюємо контент модального вікна
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 40px;
    max-width: 400px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  `;

  // Створюємо індикатор завантаження
  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 60px;
    height: 60px;
    border: 4px solid #e5e7eb;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  `;

  // Додаємо CSS анімацію
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Створюємо текстові елементи
  const title = document.createElement('h2');
  title.textContent = 'Generating PDF';
  title.style.cssText = `
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 8px 0;
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Creating your resume PDF...';
  subtitle.style.cssText = `
    font-size: 16px;
    color: #6b7280;
    margin: 0 0 20px 0;
  `;

  const progress = document.createElement('div');
  progress.style.cssText = `
    font-size: 14px;
    color: #9ca3af;
    margin: 0;
  `;

  // Збираємо модальне вікно
  modalContent.appendChild(spinner);
  modalContent.appendChild(title);
  modalContent.appendChild(subtitle);
  modalContent.appendChild(progress);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Функція для генерації PDF
  const generatePdf = async () => {
    try {
      progress.textContent = 'Preparing document...';
      
      // Створюємо тимчасовий div для PDF
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: fixed;
        left: -9999px;
        width: 800px;
        height: auto;
        background: white;
        color: black;
        overflow: visible;
        visibility: visible;
        opacity: 1;
      `;
      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);

      progress.textContent = 'Rendering content...';
      
      // Чекаємо 500мс для підвантаження стилів
      await new Promise<void>(resolve => setTimeout(resolve, 500));

      progress.textContent = 'Generating PDF file...';

      // Налаштування html2pdf.js
      const options = {
        margin: 10,
        filename: 'resume.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          windowWidth: 800,
          backgroundColor: '#ffffff',
          logging: false,
          height: tempDiv.scrollHeight,
          width: tempDiv.scrollWidth,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      // Генерація PDF
      await html2pdf().set(options).from(tempDiv).save();
      
      // Cleanup
      tempDiv.remove();
      
      // Показуємо успішне завершення
      progress.textContent = 'PDF downloaded successfully!';
      spinner.style.display = 'none';
      title.textContent = 'Success!';
      subtitle.textContent = 'Your resume has been downloaded.';
      
      // Закриваємо модальне вікно через 1.5 секунди
      setTimeout(() => {
        modal.remove();
        style.remove();
      }, 1500);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Показуємо помилку
      spinner.style.display = 'none';
      title.textContent = 'Error';
      subtitle.textContent = 'Failed to generate PDF';
      progress.textContent = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Додаємо кнопку закриття
      const closeButton = document.createElement('button');
      closeButton.textContent = 'Close';
      closeButton.style.cssText = `
        background: #3b82f6;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 20px;
        font-size: 14px;
      `;
      closeButton.onclick = () => {
        modal.remove();
        style.remove();
      };
      modalContent.appendChild(closeButton);
    }
  };

  // Запускаємо генерацію
  generatePdf();
}

export async function generatePdfFromElement(options: PdfFromElementOptions): Promise<void> {
  const { element, onLoadingChange } = options;
  
  // Показуємо лоадер на кнопці
  if (onLoadingChange) {
    onLoadingChange(true);
  }

  try {
    // Отримуємо HTML з елемента
    const html = element.outerHTML;
    
    // Створюємо модальне вікно генерації
    createPdfModal(html);
    
    // Даємо час для відкриття модального вікна
    await new Promise<void>(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.error('Error generating PDF from element:', error);
    throw error;
  } finally {
    // Прибираємо лоадер з кнопки
    if (onLoadingChange) {
      onLoadingChange(false);
    }
  }
}

export async function generatePdfFromUrl(options: PdfFromUrlOptions): Promise<void> {
  const { url, onLoadingChange } = options;

  // Показуємо лоадер на кнопці
  if (onLoadingChange) {
    onLoadingChange(true);
  }

  try {
    // Fetch HTML content from URL
    const response = await fetch(url);
    const html = await response.text();
    
    // Створюємо модальне вікно генерації
    createPdfModal(html);
    
    // Даємо час для відкриття модального вікна
    await new Promise<void>(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.error('Error generating PDF from URL:', error);
    throw error;
  } finally {
    // Прибираємо лоадер з кнопки
    if (onLoadingChange) {
      onLoadingChange(false);
    }
  }
}
