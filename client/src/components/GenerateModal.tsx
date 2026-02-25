import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2, FileText, AlertCircle } from "lucide-react";
import { useGenerateCv, usePollingJob } from "@/hooks/use-generate";
import { useToast } from "@/hooks/use-toast";
import { Dropzone } from "@/components/ui/dropzone";
import { validateDocxFile } from "@/lib/file-validation";
import type { CvTemplate } from "@shared/routes";

interface GenerateModalProps {
  template: CvTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GenerateModal({ template, isOpen, onClose }: GenerateModalProps) {
  console.log("[GenerateModal] Component render, isOpen:", isOpen, "template:", template?.name);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  const { mutate: generateCv, isPending } = useGenerateCv();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Log when onClose is called
  const handleClose = () => {
    console.log("[GenerateModal] onClose called");
    onClose();
  };

  if (!template || !isOpen) {
    console.log("[GenerateModal] Modal not rendering - isOpen:", isOpen, "template:", template?.name);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast({
        title: "File Required",
        description: "Please select a .docx file to upload.",
        variant: "destructive",
      });
      return;
    }

    if (!template) {
      toast({
        title: "No template selected",
        description: "Please select a template to generate your CV.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("[GenerateModal] Starting generation with template:", template.id);
      
      generateCv({
        templateId: template.id,
        file: selectedFile,
      }, {
        onSuccess: (response) => {
          console.log("[GenerateModal] Generation started, response:", response);
          
          toast({
            title: "Generation Started! 🎉",
            description: "Your CV is being generated. You'll be redirected to your resumes.",
          });
          
          console.log("[GenerateModal] Redirecting to /my-resumes immediately");
          
          // Close modal and redirect to my-resumes
          handleClose();
          setLocation("/my-resumes");
        },
        onError: (error) => {
          console.error("[GenerateModal] Generation failed:", error);
          toast({
            title: "Generation Failed",
            description: error instanceof Error ? error.message : "Failed to generate CV. Please try again.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("[GenerateModal] Unexpected error:", error);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-2 sm:px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isPending ? handleClose : undefined}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl mx-2 sm:mx-4 bg-card rounded-2xl shadow-2xl border border-border/50 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden max-h-[95vh] md:max-h-[85vh] my-auto"
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            disabled={isPending}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 sm:p-3 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 rounded-full transition-colors z-10 disabled:opacity-50 touch-manipulation"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
          </button>

          {/* Left: Template Preview */}
          <div className="w-full md:w-2/5 bg-secondary/50 p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border">
            <h3 className="font-display font-bold text-sm sm:text-base lg:text-lg mb-2 sm:mb-3 lg:mb-4 text-center">Selected Template</h3>
            <div className="relative w-full max-w-[160px] sm:max-w-[200px] lg:max-w-none aspect-[1/1.4] rounded-lg overflow-hidden shadow-lg border border-border/50 bg-white">
              <img 
                src={template.screenshotUrl} 
                alt={template.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1.5 sm:p-2 lg:p-4">
                <span className="text-white font-medium text-xs sm:text-xs lg:text-sm">{template.name}</span>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="w-full md:w-3/5 p-4 sm:p-6 lg:p-8 flex flex-col justify-center">
            <div className="mb-6 sm:mb-8">
              <h2 className="font-display font-bold text-lg sm:text-xl lg:text-2xl mb-2 text-foreground">Import Content</h2>
              <p className="text-muted-foreground text-sm">
                <span className="hidden sm:inline">Upload your CV in .docx format. Our AI will automatically extract and format it beautifully into your chosen template.</span>
                <span className="sm:hidden">Upload your .docx file. AI will format it beautifully.</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <label htmlFor="file-upload" className="block text-sm font-medium text-foreground">
                  Upload CV Document
                </label>
                
                <Dropzone
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onFileRemove={handleFileRemove}
                  disabled={isPending || isValidating}
                  className="min-h-[120px] sm:min-h-[140px]"
                />
                
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
                  <FileText className="w-3 h-3 text-primary" />
                  <span className="hidden sm:inline">Upload your CV in .docx format. Maximum file size: 5MB.</span>
                  <span className="sm:hidden">.docx format, max 5MB</span>
                </div>
                
                {selectedFile && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                    <AlertCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">File will be processed and formatted by our AI.</span>
                    <span className="sm:hidden">AI will process your file</span>
                  </div>
                )}
              </div>

              <div className="pt-2 sm:pt-4">
                <button
                  type="submit"
                  disabled={isPending || isValidating || !selectedFile}
                  className="w-full relative flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 overflow-hidden group text-sm sm:text-base"
                >
                  {/* Subtle shine effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                  
                  {isPending || isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      {isValidating ? "Processing File..." : "Starting Magic..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Generate Beautiful CV</span>
                      <span className="sm:inline">Generate CV</span>
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
