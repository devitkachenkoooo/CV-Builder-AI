import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePollingJob } from "@/hooks/use-generate";
import { FileText, Loader2, CheckCircle2, AlertCircle, Calendar, Eye, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { api } from "@shared/routes";
import type { GeneratedCvResponse } from "@shared/routes";
import { useTranslation } from "react-i18next";

// Function to get progress width based on progress text
function getProgressWidth(progress?: string | null): string {
  if (!progress) return "25%";

  const progressLower = progress.toLowerCase();
  if (progressLower.includes("starting")) return "10%";
  if (progressLower.includes("analyzing")) return "30%";
  if (progressLower.includes("formatting")) return "60%";
  if (progressLower.includes("finalizing")) return "85%";
  if (progressLower.includes("generating pdf")) return "90%";

  return "50%"; // Default for unknown progress
}

export function CvStatusCard({ cv }: { cv: GeneratedCvResponse }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Poll if status is pending/processing
  const { data: polledJob } = usePollingJob(cv.id, cv.status);

  const displayData = polledJob || cv;
  const isProcessing = displayData.status === "pending" || displayData.status === "processing";
  const isFailed = displayData.status === "failed";
  const isComplete = displayData.status === "complete";

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/resumes/${cv.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: t("toast.cv_deleted_title"),
          description: t("toast.cv_deleted_desc"),
        });
        setIsDeleteDialogOpen(false);
        // Refresh the resumes list without page reload
        queryClient.invalidateQueries({ queryKey: [api.resumes.list.path] });
      } else {
        throw new Error('Failed to delete CV');
      }
    } catch (error) {
      toast({
        title: t("toast.delete_failed_title"),
        description: t("toast.delete_failed_desc"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const templateScreenshot = displayData.template?.screenshotUrl || cv.template?.screenshotUrl;
  const templateName = displayData.template?.name || cv.template?.name || "Template";

  return (
    <>
      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cv_card.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cv_card.delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80">
                {t("common.cancel")}
              </button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("common.deleting")}
                  </>
                ) : (
                  t("common.delete")
                )}
              </button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link href={`/cv/${cv.id}`} className="block group">
        <div className="glass-card rounded-2xl overflow-hidden group relative flex flex-col cursor-pointer hover:shadow-xl transition-all duration-300">
          {/* Delete Button */}
          {!isProcessing && (
            <button
              disabled={isDeleting}
              className="absolute top-3 left-3 p-2 bg-destructive hover:bg-destructive/90 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl z-10 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t("cv_card.delete_btn")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Delete Processing Overlay */}
          {!isProcessing && isDeleteDialogOpen && isDeleting && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="text-center text-sm text-muted-foreground flex items-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t("common.deleting")}
              </div>
            </div>
          )}

          <div className="relative aspect-[4/5] lg:aspect-[1/1.414] bg-secondary/30 w-full overflow-hidden border-b border-border/50">
            {isComplete && displayData.pdfUrl ? (
              <div className="w-full h-full overflow-hidden relative">
                <iframe
                  src={displayData.pdfUrl}
                  className="absolute top-0 left-0 w-full h-auto border-0 transition-transform duration-500 group-hover:scale-105"
                  style={{
                    overflow: 'hidden',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    minHeight: '100%',
                    width: '100%'
                  }}
                  title="Generated CV"
                  onError={(e: React.SyntheticEvent<HTMLIFrameElement>) => {
                    // Fallback to template screenshot if iframe fails
                    const iframe = e.currentTarget;
                    const fallbackDiv = document.createElement('div');
                    fallbackDiv.className = 'w-full h-full flex items-center justify-center text-muted-foreground';
                    fallbackDiv.innerHTML = '<svg class="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';
                    iframe.parentNode?.replaceChild(fallbackDiv, iframe);
                  }}
                  onLoad={(e: React.SyntheticEvent<HTMLIFrameElement>) => {
                    // Hide scrollbars
                    try {
                      const iframe = e.currentTarget;
                      if (iframe.contentWindow) {
                        const style = iframe.contentWindow.document.createElement('style');
                        style.textContent = `
                          ::-webkit-scrollbar { display: none; } 
                          html, body { 
                            overflow-x: hidden !important; 
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                          }
                        `;
                        iframe.contentWindow.document.head.appendChild(style);
                      }
                    } catch (err) {
                      // Cross-origin iframe, ignore
                    }
                  }}
                />
              </div>
            ) : templateScreenshot ? (
              <img
                src={templateScreenshot}
                alt={templateName}
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isProcessing ? 'opacity-30 grayscale' : ''}`}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80'
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <FileText className="w-12 h-12 opacity-20" />
              </div>
            )}

            {/* Processing Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[2px] p-6 text-center">
                <div className="w-16 h-16 relative mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                </div>
                <h4 className="font-display font-bold text-foreground mb-1">{t("cv_card.ai_working")}</h4>
                <p className="text-sm text-primary font-medium animate-pulse">
                  {displayData.progress || t("cv_card.preparing_format")}
                </p>
              </div>
            )}

            {/* Failed Overlay */}
            {isFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-sm p-6 text-center">
                <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                <h4 className="font-display font-bold text-destructive mb-1">{t("cv_card.gen_error")}</h4>
                <p className="text-xs text-destructive/80 font-medium px-4 break-words">
                  {displayData.errorMessage || t("cv_card.gen_error_desc")}
                </p>
              </div>
            )}

            {/* Success Overlay */}
            {isComplete && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">{t("cv_card.ready")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Info Area */}
          <div className="p-4 lg:p-5 h-[126px] lg:h-[140px] flex flex-col justify-between bg-card">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-display font-bold text-foreground line-clamp-1">{templateName}</h3>
                {/* Status Badge */}
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isProcessing ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                  isComplete ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                    'bg-red-500/10 text-red-600 border border-red-500/20'
                  }`}>
                  {isProcessing ? t("cv_card.processing") : displayData.status}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(cv.createdAt), 'MMM d, yyyy, HH:mm')}
              </div>
              {isComplete && (
                <div className="flex items-center gap-1.5 text-xs text-primary mt-2">
                  <Eye className="w-3.5 h-3.5" />
                  {t("cv_card.click_to_view")}
                </div>
              )}
            </div>

            {/* Progress Bar (if processing) */}
            {isProcessing && (
              <div className="mt-4 w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-out animate-[pulse_2s_ease-in-out_infinite]"
                  style={{
                    width: getProgressWidth(displayData.progress)
                  }}
                ></div>
              </div>
            )}

            {/* Progress Text */}
            {isProcessing && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                <span className="block truncate" title={displayData.progress || t("cv_card.processing")}>
                  {displayData.progress || t("cv_card.processing")}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </>
  );
}
