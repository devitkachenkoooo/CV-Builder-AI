import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Loader2, Mail, Phone, Linkedin, MapPin, Calendar, Award, Briefcase, GraduationCap, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, buildUrl } from "@shared/routes";
import { GeneratedCvResponse } from "@shared/schema";
import { generatePdfFromUrl } from "@/lib/pdf-generator";

interface CvData {
  personalInfo: {
    name: string;
    title: string;
    email: string;
    phone: string;
    linkedin?: string;
    location?: string;
  };
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    duration: string;
    description: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location: string;
    duration: string;
  }>;
  skills: string[];
}

export default function CvViewPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cvData, setCvData] = useState<GeneratedCvResponse | null>(null);
  const [parsedCvData, setParsedCvData] = useState<CvData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    const fetchCvData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/resumes/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("CV not found");
          } else {
            setError("Failed to load CV");
          }
          return;
        }

        const data = await response.json();
        setCvData(data);
        setPdfUrl(data.pdfUrl);
      } catch (err) {
        console.error("Error fetching CV:", err);
        setError("Failed to load CV");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCvData();
  }, [id, toast]);

  const handleDownloadPDF = async () => {
    console.log('CvViewPage handleDownloadPDF called');
    console.log('cvData:', cvData);
    console.log('pdfUrl:', pdfUrl);
    
    if (!cvData?.id || !pdfUrl) {
      console.error('Missing cvData.id or pdfUrl:', { cvDataId: cvData?.id, pdfUrl });
      toast({
        title: "Помилка завантаження",
        description: "Дані CV не завантажено. Спробуйте ще раз.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsGeneratingPdf(true);
      
      console.log('Calling generatePdfFromUrl with:', pdfUrl);

      await generatePdfFromUrl({
        url: pdfUrl,
        filename: `cv-${cvData.id}.pdf`,
        windowWidth: 800,
        contentWidthMm: 190,
      });
      
      toast({
        title: "PDF згенеровано! 🎉",
        description: "Ваше CV успішно завантажено.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Помилка генерації PDF",
        description: "Не вдалося згенерувати PDF. Спробуйте ще раз.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGoBack = () => {
    setLocation("/my-resumes");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Завантаження вашого CV...</p>
        </div>
      </div>
    );
  }

  if (error || !cvData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-4">CV не знайдено</h1>
          <p className="text-muted-foreground mb-6">{error || "CV, яке ви шукаєте, не існує або не вдалося завантажити."}</p>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад до моїх CV
          </button>
        </div>
      </div>
    );
  }

  // Check if CV is still being generated
  if (cvData.status !== "complete") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-4">CV все ще генерується</h1>
          <p className="text-muted-foreground mb-6">
            Ваше CV генерується. Поточний статус: {cvData.status}
          </p>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад до моїх CV
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating Action Bar */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 print:hidden">
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-lg shadow-lg hover:shadow-xl transition-shadow"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        <button
          onClick={handleDownloadPDF}
          disabled={isGeneratingPdf}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50"
        >
          {isGeneratingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Генерація PDF...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Завантажити PDF
            </>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="min-h-screen bg-slate-50 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* A4 Document Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white shadow-xl rounded-lg overflow-hidden print:shadow-none print:rounded-none"
            style={{ 
              minHeight: '297mm',
              width: '100%',
              maxWidth: '210mm' // A4 width constraint
            }}
          >
            {pdfUrl ? (
              <div id="cv-content" className="w-full p-16">
                <iframe
                  src={pdfUrl}
                  className="w-full h-screen"
                  style={{ minHeight: '842px' }}
                  title="Generated CV HTML"
                />
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">CV not available</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Print Optimization Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body {
              background: white !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            .print\\:hidden {
              display: none !important;
            }
            
            .bg-slate-50 {
              background: white !important;
            }
            
            .shadow-xl {
              box-shadow: none !important;
            }
            
            .rounded-lg {
              border-radius: 0 !important;
            }
            
            @page {
              margin: 0;
              size: A4;
            }
          }
        `
      }} />
    </>
  );
}
