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
  console.log('createPdfModal called with HTML length:', html.length);
  
  // Створюємо модальне вікно, яке закриває всю сторінку
  const modal = document.createElement('div');
  modal.id = 'pdf-generation-modal';
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
    padding: 40px;
    border-radius: 12px;
    text-align: center;
    color: white;
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

  // Створюємо текстові елементи
  const title = document.createElement('h2');
  title.textContent = 'Generating PDF';
  title.style.cssText = `
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 10px;
    color: #1f2937;
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Please wait while we create your resume...';
  subtitle.style.cssText = `
    font-size: 16px;
    color: #6b7280;
    margin: 0 0 20px;
  `;

  const progress = document.createElement('p');
  progress.textContent = 'Preparing document...';
  progress.style.cssText = `
    font-size: 14px;
    color: #3b82f6;
    margin: 0;
    font-weight: 500;
  `;

  // Додаємо елементи до контенту
  modalContent.appendChild(spinner);
  modalContent.appendChild(title);
  modalContent.appendChild(subtitle);
  modalContent.appendChild(progress);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Додаємо CSS для анімації
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Створюємо iframe для PDF
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    border: none;
    z-index: 999998;
    background: white;
  `;
  
  console.log('Creating iframe for PDF generation');
  
  // Встановлюємо HTML контент в iframe
  document.body.appendChild(iframe);
  
  iframe.onload = () => {
    console.log('Iframe loaded, setting up content');
    
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Cannot access iframe document');
      }
      
      console.log('Writing HTML to iframe');
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      
      // Чекаємо завантаження стилів
      setTimeout(() => {
        console.log('Starting PDF generation');
        progress.textContent = 'Generating PDF file...';
        
        // Використовуємо html2pdf.js в iframe
        const script = iframeDoc.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
          console.log('html2pdf.js loaded, generating PDF');
          
          if (iframe.contentWindow && 'html2pdf' in iframe.contentWindow) {
            (iframe.contentWindow as any).html2pdf().from(iframeDoc.body).set({
              margin: 10,
              filename: 'resume.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).save().then(() => {
              console.log('PDF saved successfully, cleaning up');
              
              // Cleanup
              iframe.remove();
              modal.remove();
              style.remove();
            }).catch((error: any) => {
              console.error('PDF generation error:', error);
              // Cleanup on error
              iframe.remove();
              modal.remove();
              style.remove();
            });
          } else {
            console.error('html2pdf not available in iframe');
            // Cleanup on error
            iframe.remove();
            modal.remove();
            style.remove();
          }
        };
        iframeDoc.head.appendChild(script);
      }, 2000);
    } catch (error) {
      console.error('Iframe setup error:', error);
      // Cleanup on error
      iframe.remove();
      modal.remove();
      style.remove();
    }
  };
  
  // Встановлюємо src для iframe
  console.log('Setting iframe src to about:blank');
  iframe.src = 'about:blank';
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
    
    // Створюємо модальне вікно генерації і чекаємо на завершення
    await new Promise<void>((resolve, reject) => {
      // Створюємо модальне вікно
      createPdfModal(html);
      
      // Слухаємо коли модальне вікно закриється (означає завершення)
      const checkModal = setInterval(() => {
        const modal = document.getElementById('pdf-generation-modal');
        if (!modal) {
          clearInterval(checkModal);
          resolve();
        }
      }, 500);
      
      // Таймаут на випадок проблем
      setTimeout(() => {
        clearInterval(checkModal);
        reject(new Error('PDF generation timeout'));
      }, 30000); // 30 секунд
    });
    
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
    
    // Створюємо модальне вікно генерації і чекаємо на завершення
    await new Promise<void>((resolve, reject) => {
      // Створюємо модальне вікно
      createPdfModal(html);
      
      // Слухаємо коли модальне вікно закриється (означає завершення)
      const checkModal = setInterval(() => {
        const modal = document.getElementById('pdf-generation-modal');
        if (!modal) {
          clearInterval(checkModal);
          resolve();
        }
      }, 500);
      
      // Таймаут на випадок проблем
      setTimeout(() => {
        clearInterval(checkModal);
        reject(new Error('PDF generation timeout'));
      }, 30000); // 30 секунд
    });
    
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
