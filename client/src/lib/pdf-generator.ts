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
    background: #f3f4f6;
    padding: 0 !important;
    margin: 0 !important;
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
      
      console.log('Writing HTML to iframe, HTML length:', html.length);
      console.log('HTML preview:', html.substring(0, 200) + '...');
      
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      
      console.log('HTML written to iframe successfully');
      
      // Чекаємо завантаження стилів
      setTimeout(() => {
        console.log('Starting PDF generation after style loading');
        progress.textContent = 'Generating PDF file...';
        
        // Перевіряємо чи є контент в iframe
        const iframeBody = iframeDoc.body;
        console.log('Iframe body content length:', iframeBody?.innerHTML?.length || 0);
        
        // Прибираємо padding з body в iframe
        if (iframeBody) {
          iframeBody.style.padding = '0';
          iframeBody.style.margin = '0';
          iframeBody.style.backgroundColor = 'transparent';
          console.log('Removed padding and margin from iframe body');
        }
        
        if (!iframeBody || iframeBody.innerHTML.length === 0) {
          console.error('Iframe body is empty');
          progress.textContent = 'No content to generate PDF';
          
          // Cleanup on error
          setTimeout(() => {
            iframe.remove();
            modal.remove();
            style.remove();
          }, 2000);
          return;
        }
        
        // Використовуємо html2pdf.js в iframe
        const script = iframeDoc.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        
        script.onerror = () => {
          console.error('Failed to load html2pdf.js script');
          progress.textContent = 'Failed to load PDF library';
          // Cleanup on error
          setTimeout(() => {
            iframe.remove();
            modal.remove();
            style.remove();
          }, 2000);
        };
        
        script.onload = () => {
          console.log('html2pdf.js loaded successfully');
          console.log('Checking html2pdf availability in iframe:', 'html2pdf' in (iframe.contentWindow || {}));
          
          if (iframe.contentWindow && 'html2pdf' in iframe.contentWindow) {
            console.log('Starting PDF generation with html2pdf');
            progress.textContent = 'Generating PDF file...';
            
            // Створюємо контейнер для CV контенту
            const cvContainer = iframeDoc.querySelector('.cv-container') || 
                               iframeDoc.querySelector('.resume') || 
                               iframeDoc.querySelector('[data-cv]') ||
                               iframeDoc.body;
            
            console.log('CV container found:', !!cvContainer);
            console.log('CV container tag:', cvContainer?.tagName);
            console.log('CV container classes:', cvContainer?.className);
            
            if (!cvContainer) {
              console.error('CV container not found, using body as fallback');
            }
            
            const targetElement = cvContainer || iframeDoc.body;
            
            try {
              (iframe.contentWindow as any).html2pdf().from(targetElement).set({
            margin: 0, // Прибираємо відступ, оскільки він є на сторінці CV
            filename: 'resume.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2, 
              useCORS: true, 
              allowTaint: true,
              letterRendering: true,
              backgroundColor: 'rgba(255, 255, 255, 0)', // Прозорий фон
              logging: false,
              ignoreElements: ['canvas', 'svg'],
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          }).save().then(() => {
              console.log('PDF saved successfully, cleaning up');
              progress.textContent = 'PDF downloaded successfully!';

              // Cleanup після успішного збереження
              setTimeout(() => {
                iframe.remove();
                modal.remove();
                style.remove();
              }, 1000);
            }).catch((error: any) => {
              console.error('PDF generation error:', error);
                progress.textContent = 'PDF downloaded successfully!';
                
                // Cleanup після успішного збереження
                setTimeout(() => {
                  iframe.remove();
                  modal.remove();
                  style.remove();
                }, 1000);
              }).catch((error: any) => {
                console.error('PDF generation error:', error);
                progress.textContent = 'PDF generation failed';
                
                // Cleanup on error
                setTimeout(() => {
                  iframe.remove();
                  modal.remove();
                  style.remove();
                }, 2000);
              });
            } catch (genError) {
              console.error('Error during PDF generation:', genError);
              progress.textContent = 'PDF generation failed';
              
              // Cleanup on error
              setTimeout(() => {
                iframe.remove();
                modal.remove();
                style.remove();
              }, 2000);
            }
          } else {
            console.error('html2pdf not available in iframe after loading');
            progress.textContent = 'PDF library not available';
            
            // Cleanup on error
            setTimeout(() => {
              iframe.remove();
              modal.remove();
              style.remove();
            }, 2000);
          }
        };
        
        console.log('Appending html2pdf.js script to iframe head');
        iframeDoc.head.appendChild(script);
        
        // Fallback: якщо html2pdf не завантажиться через 10 секунд
        setTimeout(() => {
          const contentWindow = iframe.contentWindow;
          if (contentWindow && !('html2pdf' in contentWindow)) {
            console.error('html2pdf.js failed to load within timeout');
            progress.textContent = 'PDF generation failed - trying alternative';
            
            // Простий fallback - відкриваємо HTML в новій вкладці
            const newWindow = window.open();
            if (newWindow) {
              newWindow.document.write(html);
              newWindow.document.close();
              progress.textContent = 'Opened CV in new tab - print to PDF';
              
              setTimeout(() => {
                iframe.remove();
                modal.remove();
                style.remove();
              }, 3000);
            } else {
              progress.textContent = 'Failed to open new tab';
              setTimeout(() => {
                iframe.remove();
                modal.remove();
                style.remove();
              }, 2000);
            }
          }
        }, 10000);
      }, 2000);
    } catch (error) {
      console.error('Iframe setup error:', error);
      progress.textContent = 'Failed to setup PDF generation';
      
      // Cleanup on error
      setTimeout(() => {
        iframe.remove();
        modal.remove();
        style.remove();
      }, 2000);
    }
  };
  
  iframe.onerror = () => {
    console.error('Iframe failed to load');
    progress.textContent = 'Failed to load PDF generator';
    
    // Cleanup on error
    setTimeout(() => {
      iframe.remove();
      modal.remove();
      style.remove();
    }, 2000);
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
