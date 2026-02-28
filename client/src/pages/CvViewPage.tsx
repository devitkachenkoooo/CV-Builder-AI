import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Loader2, Mail, Phone, Linkedin, MapPin, Calendar, Award, Briefcase, GraduationCap, User, FileText, CheckCircle } from "lucide-react";
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
  const [scale, setScale] = useState(1);
  const [iframeHeight, setIframeHeight] = useState('297mm');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // 210mm is approximately 794px at 96 DPI
        const cvWidthPx = 794;
        const padding = 32; // Total horizontal padding in the container
        const availableWidth = containerWidth - padding;

        if (availableWidth < cvWidthPx) {
          setScale(availableWidth / cvWidthPx);
        } else {
          setScale(1);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    // Also update scale after a short delay to ensure layout is ready
    const timer = setTimeout(updateScale, 100);

    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer);
    };
  }, []);

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    try {
      if (iframe.contentWindow) {
        // Give it a small delay for content to render
        setTimeout(() => {
          if (iframe.contentWindow) {
            const body = iframe.contentWindow.document.body;
            const html = iframe.contentWindow.document.documentElement;
            const height = Math.max(
              body.scrollHeight, body.offsetHeight,
              html.clientHeight, html.scrollHeight, html.offsetHeight
            );
            setIframeHeight(`${height}px`);
          }
        }, 100);
      }
    } catch (err) {
      console.error("Could not access iframe content for height calculation:", err);
      // Fallback to default A4 height if cross-origin or other error
      setIframeHeight('297mm');
    }
  };

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
    <div className="min-h-screen bg-gray-100">
      {/* Modern Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleGoBack}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-medium">Назад</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-gray-300" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900">Переглядач CV</h1>
                <p className="text-sm text-gray-500">{cvData.template?.name || 'Professional CV'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Генерація...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Завантажити PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CV Viewer Container */}
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* CV Frame */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Toolbar */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="text-sm text-gray-500 font-medium">
                A4 Format (210 × 297 mm)
              </div>
            </div>

            {/* CV Content - Scale Container */}
            <div
              ref={containerRef}
              className="bg-gray-100 p-4 sm:p-8 flex justify-center overflow-hidden"
              style={{ minHeight: '500px' }}
            >
              <div
                className="transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top center',
                  width: '210mm',
                  height: `calc(${iframeHeight} * ${scale})`,
                }}
              >
                <div
                  className="bg-white shadow-lg relative"
                  style={{
                    width: '210mm',
                    minWidth: '210mm',
                    height: iframeHeight,
                    minHeight: '297mm'
                  }}
                >
                  {pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      onLoad={handleIframeLoad}
                      className="w-full h-full border-0 absolute top-0 left-0"
                      style={{
                        width: '210mm',
                        height: iframeHeight
                      }}
                      title="Generated CV HTML"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white">
                      <div className="text-center p-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">CV не доступне</h3>
                        <p className="text-gray-500">Файл CV ще не згенеровано або виникла помилка</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Info Section */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Формат</h3>
              </div>
              <p className="text-gray-600 text-sm">Стандарт A4, готовий до друку</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Статус</h3>
              </div>
              <p className="text-gray-600 text-sm">Згенеровано успішно</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Створено</h3>
              </div>
              <p className="text-gray-600 text-sm">
                {new Date(cvData.createdAt).toLocaleString('uk-UA', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </div>
      </main>

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
            
            .bg-gray-100 {
              background: white !important;
            }
            
            .shadow-2xl {
              box-shadow: none !important;
            }
            
            .rounded-xl {
              border-radius: 0 !important;
            }
            
            @page {
              margin: 0;
              size: A4;
            }
          }
        `
      }} />
    </div>
  );
}
