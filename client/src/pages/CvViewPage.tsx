import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Loader2, FileText, CheckCircle, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, buildUrl } from "@shared/routes";
import { GeneratedCvResponse } from "@shared/schema";
import { generatePdfFromUrl } from "@/lib/pdf-generator";
import { usePollingJob } from "@/hooks/use-generate";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const AI_EDIT_PROMPT_MIN_LENGTH = 10;
const AI_EDIT_PROMPT_MAX_LENGTH = 1000;

export default function CvViewPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [cvData, setCvData] = useState<GeneratedCvResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isSubmittingAiEdit, setIsSubmittingAiEdit] = useState(false);
  const [scale, setScale] = useState(1);
  const [iframeHeight, setIframeHeight] = useState("297mm");

  const containerRef = useRef<HTMLDivElement>(null);
  const lastFailedMessageRef = useRef<string | null>(null);
  const syncedTerminalStatusRef = useRef<string | null>(null);

  const fetchCvData = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/resumes/${id}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError("CV not found");
        } else {
          setError("Failed to load CV");
        }
        return;
      }

      const data: GeneratedCvResponse = await response.json();
      setCvData(data);
      setPdfUrl(data.pdfUrl || null);
    } catch (err) {
      console.error("Error fetching CV:", err);
      setError("Failed to load CV");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCvData();
  }, [fetchCvData]);

  const pollingInitialStatus = cvData?.status || "complete";
  const { data: polledJob } = usePollingJob(cvData?.id || 0, pollingInitialStatus);

  useEffect(() => {
    if (!polledJob) return;

    setCvData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: polledJob.status,
        progress: polledJob.progress ?? prev.progress,
        errorMessage: polledJob.errorMessage ?? prev.errorMessage,
        pdfUrl: polledJob.pdfUrl ?? prev.pdfUrl,
        template: polledJob.template || prev.template,
      };
    });

    if (polledJob.pdfUrl) {
      setPdfUrl(polledJob.pdfUrl);
    }

    if (polledJob.status === "complete" || polledJob.status === "failed") {
      if (syncedTerminalStatusRef.current !== polledJob.status) {
        syncedTerminalStatusRef.current = polledJob.status;
        fetchCvData();
      }
    } else {
      syncedTerminalStatusRef.current = null;
    }
  }, [polledJob, fetchCvData]);

  useEffect(() => {
    if (!cvData || cvData.status !== "failed") return;

    const errorMessage = cvData.errorMessage || "AI edit failed. Please try again.";
    if (lastFailedMessageRef.current === errorMessage) return;

    lastFailedMessageRef.current = errorMessage;
    toast({
      title: "AI editing failed",
      description: errorMessage,
      variant: "destructive",
    });
  }, [cvData, toast]);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const cvWidthPx = 794;
      const padding = 32;
      const availableWidth = containerWidth - padding;
      setScale(availableWidth < cvWidthPx ? availableWidth / cvWidthPx : 1);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    const timer = setTimeout(updateScale, 100);

    return () => {
      window.removeEventListener("resize", updateScale);
      clearTimeout(timer);
    };
  }, []);

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    try {
      if (!iframe.contentWindow) return;

      setTimeout(() => {
        if (!iframe.contentWindow) return;

        const body = iframe.contentWindow.document.body;
        const html = iframe.contentWindow.document.documentElement;
        const height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        );
        setIframeHeight(`${height}px`);
      }, 100);
    } catch (err) {
      console.error("Could not access iframe content for height calculation:", err);
      setIframeHeight("297mm");
    }
  };

  const handleDownloadPDF = async () => {
    if (!cvData?.id || !pdfUrl) {
      toast({
        title: "Download failed",
        description: "CV file is not ready yet.",
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
        title: "PDF generated",
        description: "Your CV has been downloaded successfully.",
      });
    } catch (downloadError) {
      console.error("Error generating PDF:", downloadError);
      toast({
        title: "PDF generation failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSubmitAiEdit = async () => {
    if (!cvData) return;

    const trimmedPrompt = aiPrompt.replace(/\u0000/g, "").trim();
    if (trimmedPrompt.length < AI_EDIT_PROMPT_MIN_LENGTH) {
      toast({
        title: "Prompt is too short",
        description: `Please enter at least ${AI_EDIT_PROMPT_MIN_LENGTH} characters.`,
        variant: "destructive",
      });
      return;
    }

    if (trimmedPrompt.length > AI_EDIT_PROMPT_MAX_LENGTH) {
      toast({
        title: "Prompt is too long",
        description: `Please keep it under ${AI_EDIT_PROMPT_MAX_LENGTH} characters.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingAiEdit(true);
      const url = buildUrl(api.resumes.aiEdit.path, { id: cvData.id });
      const response = await fetch(url, {
        method: api.resumes.aiEdit.method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      if (!response.ok) {
        let message = "Failed to start AI edit";
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.message === "string" && errorBody.message) {
            message = errorBody.message;
          }
        } catch {
          // Ignore JSON parse errors
        }

        toast({
          title: "AI edit rejected",
          description: message,
          variant: "destructive",
        });
        return;
      }

      setCvData((prev) =>
        prev
          ? {
              ...prev,
              status: "processing",
              progress: "AI is editing your CV...",
              errorMessage: null,
            }
          : prev
      );

      setIsAiDialogOpen(false);
      setAiPrompt("");
      toast({
        title: "AI edit started",
        description: "Your CV is being updated. Please wait...",
      });
    } catch (submitError) {
      console.error("AI edit submit error:", submitError);
      toast({
        title: "AI edit failed",
        description: "Could not send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingAiEdit(false);
    }
  };

  const handleGoBack = () => {
    setLocation("/my-resumes");
  };

  if (isLoading && !cvData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your CV...</p>
        </div>
      </div>
    );
  }

  if (error || !cvData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-4">CV not found</h1>
          <p className="text-muted-foreground mb-6">{error || "Could not load this CV."}</p>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to my CVs
          </button>
        </div>
      </div>
    );
  }

  const isProcessing = cvData.status === "pending" || cvData.status === "processing";
  const isFailed = cvData.status === "failed";
  const canEditWithAi = !isProcessing && !isSubmittingAiEdit;
  const statusLabel = isProcessing ? "Processing" : isFailed ? "Failed" : "Completed";

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleGoBack}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-medium">Back</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-gray-300" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-semibold text-gray-900">CV Viewer</h1>
                <p className="text-sm text-gray-500">{cvData.template?.name || "Professional CV"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAiDialogOpen(true)}
                disabled={!canEditWithAi}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Edit with AI</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf || isProcessing || !pdfUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="text-sm text-gray-500 font-medium">A4 Format (210 x 297 mm)</div>
            </div>

            <div
              ref={containerRef}
              className="bg-gray-100 p-4 sm:p-8 flex justify-center overflow-hidden"
              style={{ minHeight: "500px" }}
            >
              <div
                className="transition-transform duration-200 ease-out"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                  width: "210mm",
                  height: `calc(${iframeHeight} * ${scale})`,
                }}
              >
                <div
                  className="bg-white shadow-lg relative"
                  style={{
                    width: "210mm",
                    minWidth: "210mm",
                    height: iframeHeight,
                    minHeight: "297mm",
                  }}
                >
                  {isProcessing ? (
                    <div className="w-full h-full flex items-center justify-center bg-white">
                      <div className="text-center p-8">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI is updating your CV</h3>
                        <p className="text-gray-500">{cvData.progress || "Please wait..."}</p>
                      </div>
                    </div>
                  ) : isFailed ? (
                    <div className="w-full h-full flex items-center justify-center bg-white">
                      <div className="text-center p-8 max-w-lg">
                        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">CV update failed</h3>
                        <p className="text-gray-500">
                          {cvData.errorMessage || "Could not finish AI update. Try again with a different prompt."}
                        </p>
                      </div>
                    </div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      onLoad={handleIframeLoad}
                      className="w-full h-full border-0 absolute top-0 left-0"
                      style={{
                        width: "210mm",
                        height: iframeHeight,
                      }}
                      title="Generated CV HTML"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white">
                      <div className="text-center p-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">CV is unavailable</h3>
                        <p className="text-gray-500">Generated CV HTML is not available right now.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Format</h3>
              </div>
              <p className="text-gray-600 text-sm">Standard A4, print-ready layout.</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isFailed ? "bg-red-100" : isProcessing ? "bg-amber-100" : "bg-green-100"
                  }`}
                >
                  {isFailed ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : isProcessing ? (
                    <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">Status</h3>
              </div>
              <p className="text-gray-600 text-sm">{statusLabel}</p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Created</h3>
              </div>
              <p className="text-gray-600 text-sm">
                {new Date(cvData.createdAt).toLocaleString("uk-UA", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit CV with AI</DialogTitle>
            <DialogDescription>
              Describe what should be updated in your existing CV. We will preserve the current template style.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Example: Make my summary more concise and emphasize React + TypeScript achievements."
              className="min-h-[140px]"
              maxLength={AI_EDIT_PROMPT_MAX_LENGTH}
              disabled={isSubmittingAiEdit}
            />
            <p className="text-xs text-muted-foreground text-right">
              {aiPrompt.length}/{AI_EDIT_PROMPT_MAX_LENGTH}
            </p>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsAiDialogOpen(false)}
              className="px-4 py-2 rounded-md border border-input bg-background hover:bg-accent"
              disabled={isSubmittingAiEdit}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitAiEdit}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={isSubmittingAiEdit}
            >
              {isSubmittingAiEdit ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </span>
              ) : (
                "Send"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style
        dangerouslySetInnerHTML={{
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
        `,
        }}
      />
    </div>
  );
}
