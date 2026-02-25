import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFOptions {
  filename?: string;
  elementId: string;
  hideElements?: string[];
}

export async function generatePDF({ 
  filename = 'resume.pdf', 
  elementId, 
  hideElements = ['.no-print', '.print-hidden'] 
}: PDFOptions): Promise<void> {
  try {
    // Get the element to convert
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }

    // Hide elements that shouldn't appear in PDF
    const elementsToHide = document.querySelectorAll(hideElements.join(','));
    const originalDisplays: string[] = [];
    
    elementsToHide.forEach((el, index) => {
      originalDisplays[index] = (el as HTMLElement).style.display;
      (el as HTMLElement).style.display = 'none';
    });

    // Show loading state
    const loadingToast = document.createElement('div');
    loadingToast.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    loadingToast.textContent = 'Generating PDF...';
    document.body.appendChild(loadingToast);

    // Generate canvas from HTML
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: true,
      windowWidth: 800, // A4 width approximation
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Restore hidden elements
    elementsToHide.forEach((el, index) => {
      (el as HTMLElement).style.display = originalDisplays[index];
    });

    // Remove loading toast
    document.body.removeChild(loadingToast);

    // Create PDF with A4 dimensions
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // A4 dimensions: 210mm x 297mm
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate image dimensions to fit A4
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth * 0.95, pdfHeight / imgHeight * 0.95);
    
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10; // 10mm top margin

    // Add image to PDF
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

    // Save the PDF
    pdf.save(filename);
    
    console.log(`[PDF] Successfully generated: ${filename}`);
  } catch (error) {
    console.error('[PDF] Error generating PDF:', error);
    throw error;
  }
}

// Alternative function for direct HTML to PDF (text-based)
export async function generateTextPDF({ 
  filename = 'resume.pdf', 
  elementId 
}: { filename?: string; elementId: string }): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }

    // Create PDF with A4 dimensions
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Get HTML content
    const htmlContent = element.innerHTML;
    
    // Add HTML content to PDF
    pdf.html(htmlContent, {
      callback: function(doc) {
        doc.save(filename);
      },
      x: 10,
      y: 10,
      width: 190, // A4 width minus margins
      windowWidth: 800,
      autoPaging: 'text',
    });
    
    console.log(`[PDF] Successfully generated text-based PDF: ${filename}`);
  } catch (error) {
    console.error('[PDF] Error generating text-based PDF:', error);
    throw error;
  }
}
