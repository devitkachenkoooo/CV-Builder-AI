import { useState } from "react";
import { usePollingJob } from "@/hooks/use-generate";
import { FileText, Loader2, CheckCircle2, AlertCircle, Calendar, Eye, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { GeneratedCvResponse } from "@shared/routes";

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
          title: "CV видалено",
          description: "CV успішно видалено з вашого списку",
        });
        setIsDeleteDialogOpen(false);
        // Оновити сторінку або перенаправити
        window.location.reload();
      } else {
        throw new Error('Failed to delete CV');
      }
    } catch (error) {
      toast({
        title: "Помилка видалення",
        description: "Не вдалося видалити CV. Спробуйте ще раз",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const templateScreenshot = displayData.template?.screenshotUrl || cv.template?.screenshotUrl;
  const templateName = displayData.template?.name || cv.template?.name || "Template";

  return (
    <Link href={`/cv/${cv.id}`} className="block group">
      <div className="glass-card rounded-2xl overflow-hidden group relative flex flex-col cursor-pointer hover:shadow-xl transition-all duration-300">
        {/* Delete Button - Always visible for non-processing CVs */}
        {!isProcessing && (
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <button
                disabled={isDeleting}
                className="absolute top-3 left-3 p-2 bg-destructive hover:bg-destructive/90 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Видалити CV"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Видалити CV?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ви впевнені, що хочете видалити це CV? Цю дію неможливо скасувати.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80">
                    Скасувати
                  </button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Видалення...
                      </>
                    ) : (
                      "Видалити"
                    )}
                  </button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
          {/* Delete Button Overlay - Prevent click events when delete dialog is open */}
          {!isProcessing && isDeleteDialogOpen && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex items-center justify-center">
              <div className="text-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Очікуйте завершення видалення...
              </div>
            </div>
          )}
          <div className="relative aspect-[1/1.414] bg-secondary/30 w-full overflow-hidden border-b border-border/50">
            {templateScreenshot ? (
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
              <h4 className="font-display font-bold text-foreground mb-1">AI is working...</h4>
              <p className="text-sm text-primary font-medium animate-pulse">
                {displayData.progress || "Preparing magical formatting..."}
              </p>
            </div>
          )}

          {/* Failed Overlay */}
          {isFailed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-sm p-6 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-3" />
              <h4 className="font-display font-bold text-destructive mb-1">Помилка генерації</h4>
              <p className="text-xs text-destructive/80 font-medium px-4 break-words">
                {displayData.errorMessage || "Щось пішло не так під час обробки."}
              </p>
            </div>
          )}

          {/* Success Overlay - Just show completion indicator */}
          {isComplete && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
              <div className="text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Готово до перегляду</p>
              </div>
            </div>
          )}

                  </div>

        {/* Info Area */}
        <div className="p-5 flex-1 flex flex-col justify-between bg-card">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-display font-bold text-foreground line-clamp-1">{templateName}</h3>
              {/* Status Badge */}
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isProcessing ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                isComplete ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                'bg-red-500/10 text-red-600 border border-red-500/20'
              }`}>
                {displayData.status}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(cv.createdAt), 'MMM d, yyyy')}
            </div>
            {isComplete && (
              <div className="flex items-center gap-1.5 text-xs text-primary mt-2">
                <Eye className="w-3.5 h-3.5" />
                Натисніть для перегляду CV
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
              {displayData.progress || "Processing..."}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
