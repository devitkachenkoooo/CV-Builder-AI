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
      
      // Створюємо тимчасовий div для PDF - робимо його точно як A4 сторінка
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 210mm;
        height: 297mm;
        background: white;
        color: #333;
        overflow: hidden;
        visibility: visible;
        opacity: 1;
        padding: 15mm;
        box-sizing: border-box;
        font-family: 'Segoe UI', 'Arial', sans-serif;
        font-size: 12px;
        line-height: 1.4;
        z-index: 999998;
        border: 1px solid #ddd;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-radius: 4px;
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
      
      // Чекаємо 3 секунди для завантаження шрифтів і стилів
      await new Promise<void>(resolve => setTimeout(resolve, 3000));

      progress.textContent = 'Preparing PDF generation...';
      
      // Перевіряємо розміри після завантаження
      console.log('TempDiv dimensions after font load:', {
        scrollWidth: tempDiv.scrollWidth,
        scrollHeight: tempDiv.scrollHeight,
        offsetWidth: tempDiv.offsetWidth,
        offsetHeight: tempDiv.offsetHeight
      });

      progress.textContent = 'Rendering content...';
      
      progress.textContent = 'Generating PDF file...';

      // Використовуємо jsPDF для створення текстового PDF
      const doc = new jsPDF({ 
        orientation: 'portrait', 
        unit: 'mm', 
        format: 'a4' 
      });
      
      console.log('Using jsPDF method for text-based PDF');
      console.log('TempDiv content before PDF:', tempDiv.innerHTML.substring(0, 500));
      
      progress.textContent = 'Generating text-based PDF...';
      
      await new Promise<void>((resolve, reject) => {
        try {
          doc.html(tempDiv, {
            x: 0,
            y: 0,
            width: 210, // Ширина A4 в mm
            windowWidth: 210, // Вікно також A4 в mm
            autoPaging: 'slice',
            html2canvas: {
              scale: 2, // Краща якість
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              logging: false,
              width: 794, // 210mm в px
              height: 1123, // 297mm в px
            },
            callback: function(doc) {
              console.log('jsPDF callback executed');
              console.log('PDF created successfully');
              
              // Перевіряємо чи є контент в PDF
              const pageCount = doc.internal.pages.length - 1; // pages[0] is empty
              console.log('PDF page count:', pageCount);
              
              if (pageCount > 0) {
                doc.save('resume.pdf');
                console.log('PDF saved successfully with text content');
                resolve();
              } else {
                console.warn('PDF appears to be empty, trying alternative approach');
                reject(new Error('Generated PDF appears to be empty'));
              }
            },
          });
        } catch (e) {
          console.error('jsPDF error:', e);
          reject(e);
        }
      }).catch(async (error: Error) => {
        console.warn('jsPDF.html() failed, trying manual text extraction:', error);
        
        progress.textContent = 'Extracting text content manually...';
        
        // Fallback: витягуємо текст і створюємо PDF вручну
        const textContent = tempDiv.innerText || tempDiv.textContent || '';
        
        if (textContent.trim().length > 0) {
          console.log('Extracted text length:', textContent.length);
          console.log('Text preview:', textContent.substring(0, 200));
          
          // Створюємо новий документ
          const textDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          
          // Додаємо текст
          const lines = textContent.split('\n');
          let yPosition = 20;
          
          textDoc.setFontSize(12);
          
          for (const line of lines) {
            if (yPosition > 280) { // Нова сторінка якщо потрібно
              textDoc.addPage();
              yPosition = 20;
            }
            
            if (line.trim()) {
              textDoc.text(line.trim(), 20, yPosition);
              yPosition += 7;
            }
          }
          
          textDoc.save('resume.pdf');
          console.log('PDF saved with extracted text content');
        } else {
          throw new Error('No content found to generate PDF');
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
