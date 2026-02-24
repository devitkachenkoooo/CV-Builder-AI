import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link as LinkIcon, Sparkles, Loader2, FileText } from "lucide-react";
import { useGenerateCv } from "@/hooks/use-generate";
import { useToast } from "@/hooks/use-toast";
import type { CvTemplate } from "@shared/routes";

interface GenerateModalProps {
  template: CvTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GenerateModal({ template, isOpen, onClose }: GenerateModalProps) {
  const [googleDocsUrl, setGoogleDocsUrl] = useState("");
  const { mutate: generateCv, isPending } = useGenerateCv();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (!template || !isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!googleDocsUrl.includes("docs.google.com")) {
      toast({
        title: "Invalid URL",
        description: "Please provide a valid Google Docs URL.",
        variant: "destructive",
      });
      return;
    }

    generateCv(
      { templateId: template.id, googleDocsUrl },
      {
        onSuccess: () => {
          toast({
            title: "Generation Started! 🎉",
            description: "Your CV is being formatted by our AI.",
          });
          onClose();
          setGoogleDocsUrl("");
          setLocation("/my-resumes");
        },
        onError: (err) => {
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isPending ? onClose : undefined}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col md:flex-row"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={isPending}
            className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors z-10 disabled:opacity-50"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>

          {/* Left: Template Preview */}
          <div className="w-full md:w-2/5 bg-secondary/50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border">
            <h3 className="font-display font-bold text-lg mb-4 text-center">Selected Template</h3>
            <div className="relative w-full aspect-[1/1.4] rounded-lg overflow-hidden shadow-lg border border-border/50 bg-white">
              <img 
                src={template.screenshotUrl} 
                alt={template.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <span className="text-white font-medium text-sm">{template.name}</span>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="w-full md:w-3/5 p-8 flex flex-col justify-center">
            <div className="mb-8">
              <h2 className="font-display font-bold text-2xl mb-2 text-foreground">Import Content</h2>
              <p className="text-muted-foreground text-sm">
                Paste your unformatted resume or raw content from Google Docs. Our AI will automatically extract and format it beautifully into your chosen template.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="docsUrl" className="block text-sm font-medium text-foreground">
                  Google Docs URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="docsUrl"
                    type="url"
                    value={googleDocsUrl}
                    onChange={(e) => setGoogleDocsUrl(e.target.value)}
                    required
                    disabled={isPending}
                    placeholder="https://docs.google.com/document/d/..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
                  <FileText className="w-3 h-3 text-primary" />
                  <span>Make sure your document is set to <strong>"Anyone with the link can view"</strong>.</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isPending || !googleDocsUrl}
                  className="w-full relative flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 overflow-hidden group"
                >
                  {/* Subtle shine effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                  
                  {isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting Magic...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Beautiful CV
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
