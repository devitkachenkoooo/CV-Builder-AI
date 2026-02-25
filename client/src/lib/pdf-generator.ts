import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';

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
    background: rgba(0, 0, 0, 1);
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
      
      // Дебагінг: перевіряємо HTML
      console.log('PDF HTML content length:', html.length);
      console.log('PDF HTML preview:', html.substring(0, 200) + '...');
      
      // Створюємо тимчасовий div для PDF - робимо його видимим для завантаження шрифтів
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 800px;
        height: auto;
        background: white;
        color: black;
        overflow: visible;
        visibility: visible;
        opacity: 1;
        padding: 20px;
        box-sizing: border-box;
        font-family: 'Segoe UI', 'Arial', sans-serif;
        z-index: 999998;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      `;
      tempDiv.innerHTML = html;
      document.body.appendChild(tempDiv);

      // Дебагінг: перевіряємо розміри контенту
      console.log('TempDiv dimensions:', {
        scrollWidth: tempDiv.scrollWidth,
        scrollHeight: tempDiv.scrollHeight,
        offsetWidth: tempDiv.offsetWidth,
        offsetHeight: tempDiv.offsetHeight
      });

      progress.textContent = 'Loading fonts and styles...';
      
      // Чекаємо 3 секунди для завантаження шрифтів і стилів (тепер вони точно завантажаться)
      await new Promise<void>(resolve => setTimeout(resolve, 3000));

      progress.textContent = 'Preparing PDF generation...';
      
      // Тепер ховаємо tempDiv за екран
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.transform = 'none';
      
      // Знову перевіряємо розміри
      console.log('TempDiv dimensions after hiding:', {
        scrollWidth: tempDiv.scrollWidth,
        scrollHeight: tempDiv.scrollHeight,
        offsetWidth: tempDiv.offsetWidth,
        offsetHeight: tempDiv.offsetHeight
      });

      progress.textContent = 'Rendering content...';
      
      progress.textContent = 'Generating PDF file...';

      // Використовуємо jsPDF як основний метод
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      console.log('Using jsPDF method');
      
      await new Promise<void>((resolve, reject) => {
        try {
          doc.html(tempDiv, {
            x: 10,
            y: 10,
            width: 190,
            windowWidth: 800,
            autoPaging: 'text',
            callback: function(doc) {
              console.log('jsPDF callback executed');
              doc.save('resume.pdf');
              console.log('PDF saved successfully with jsPDF');
              resolve();
            },
          });
        } catch (e) {
          console.error('jsPDF error:', e);
          reject(e);
        }
      });
      
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
    console.log('Fetching PDF content from URL:', url);
    
    // Fetch HTML content from URL
    const response = await fetch(url);
    console.log('Fetch response status:', response.status);
    console.log('Fetch response headers:', response.headers);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log('Fetched HTML length:', html.length);
    console.log('Fetched HTML preview:', html.substring(0, 300) + '...');
    
    if (!html || html.trim().length === 0) {
      throw new Error('Empty HTML content received');
    }
    
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
