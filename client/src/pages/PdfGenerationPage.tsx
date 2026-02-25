import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import html2pdf from 'html2pdf.js';

export default function PdfGenerationPage() {
  const { html } = useParams();
  const [status, setStatus] = useState<'loading' | 'generating' | 'completed' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!html) {
      setStatus('error');
      setError('No HTML content provided');
      return;
    }

    const generatePdf = async () => {
      try {
        setStatus('generating');
        
        // Декодуємо HTML з URL
        const decodedHtml = decodeURIComponent(html);
        
        // Створюємо тимчасовий div
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '800px';
        tempDiv.style.height = 'auto';
        tempDiv.style.background = 'white';
        tempDiv.style.color = 'black';
        tempDiv.style.overflow = 'visible';
        tempDiv.style.visibility = 'visible';
        tempDiv.style.opacity = '1';
        tempDiv.innerHTML = decodedHtml;

        document.body.appendChild(tempDiv);

        // Чекаємо 500мс для підвантаження стилів
        await new Promise<void>(resolve => setTimeout(resolve, 500));

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
        
        setStatus('completed');
        
        // Закриваємо вкладку через 2 секунди
        setTimeout(() => {
          window.close();
        }, 2000);
        
      } catch (err) {
        console.error('Error generating PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate PDF');
        setStatus('error');
      }
    };

    generatePdf();
  }, [html]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Preparing PDF Generation</h2>
              <p className="text-gray-600">Setting up the document...</p>
            </>
          )}
          
          {status === 'generating' && (
            <>
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Generating PDF</h2>
              <p className="text-gray-600">Creating your resume PDF...</p>
            </>
          )}
          
          {status === 'completed' && (
            <>
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">PDF Generated Successfully!</h2>
              <p className="text-gray-600 mb-4">Your resume has been downloaded.</p>
              <p className="text-sm text-gray-500">This window will close automatically...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button 
                onClick={() => window.close()}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                Close Window
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
