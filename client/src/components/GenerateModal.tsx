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
  const [jobId, setJobId] = useState<number | null>(null);
  console.log("[GenerateModal] State - jobId:", jobId, "selectedFile:", selectedFile?.name);
  
  const { mutate: generateCv, isPending } = useGenerateCv();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Set up polling when we have a jobId
  console.log("[GenerateModal] About to call usePollingJob with jobId:", jobId);
  const { data: jobStatus } = usePollingJob(
    jobId || 0, // Pass 0 when no jobId, hook will be disabled
    "pending" // Always start with "pending" when we have a jobId
  );

  console.log("[GenerateModal] Current jobId:", jobId);
  console.log("[GenerateModal] Current jobStatus:", jobStatus);

  // Redirect to CV view when generation is complete
  useEffect(() => {
    console.log("[GenerateModal] useEffect triggered");
    console.log("[GenerateModal] jobStatus:", jobStatus);
    console.log("[GenerateModal] jobId:", jobId);
    console.log("[GenerateModal] jobStatus.id:", jobStatus?.id);
    console.log("[GenerateModal] jobStatus.status:", jobStatus?.status);
    
    if (jobId && jobStatus?.status === "complete" && jobStatus.id) {
      console.log("[GenerateModal] CONDITION MET - Redirecting to CV view:", `/cv/${jobStatus.id}`);
      
      // Navigate FIRST, then close modal and reset state
      console.log("[GenerateModal] Executing setLocation to:", `/cv/${jobStatus.id}`);
      setLocation(`/cv/${jobStatus.id}`);
      
      toast({
        title: "CV Generated Successfully! 🎉",
        description: "Your CV has been generated and is ready to view.",
      });
      
      // Close modal and reset state AFTER navigation
      setTimeout(() => {
        console.log("[GenerateModal] Closing modal and resetting jobId");
        setJobId(null);
        onClose();
      }, 100);
    } else {
      console.log("[GenerateModal] CONDITION NOT MET - jobId:", jobId, "status:", jobStatus?.status, "id:", jobStatus?.id);
    }
    
    if (jobStatus?.status === "failed") {
      console.log("[GenerateModal] Generation failed - showing error");
      toast({
        title: "Generation Failed",
        description: jobStatus.errorMessage || "Failed to generate CV. Please try again.",
        variant: "destructive",
      });
      setJobId(null);
    }
  }, [jobStatus, jobId, toast, setLocation, onClose]);

  if (!template || !isOpen) return null;

  // Show generation progress screen
  if (jobId && jobStatus) {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Progress Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden p-8 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
              <div className="relative w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary-foreground animate-pulse" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {jobStatus.status === "processing" ? "Formatting Your CV" : "Starting Generation"}
            </h2>
            
            <p className="text-muted-foreground mb-6">
              {jobStatus.progress || "Our AI is working its magic..."}
            </p>
            
            <div className="w-full bg-secondary rounded-full h-2 mb-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: jobStatus.status === "processing" ? "60%" : "30%",
                  animation: "pulse 2s infinite"
                }}
              ></div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              This usually takes 30-60 seconds. You'll be redirected automatically when complete.
            </p>
          </motion.div>
        </div>
      </AnimatePresence>
    );
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
            description: "Your CV is being formatted by our AI. You'll be redirected automatically when it's ready.",
          });
          
          console.log("[GenerateModal] About to setJobId to:", response.jobId);
          setJobId(response.jobId);
          setSelectedFile(null);
          
          console.log("[GenerateModal] jobId set to:", response.jobId, "modal will stay open");
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
                Upload your CV in .docx format. Our AI will automatically extract and format it beautifully into your chosen template.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="file-upload" className="block text-sm font-medium text-foreground">
                  Upload CV Document
                </label>
                
                <Dropzone
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onFileRemove={handleFileRemove}
                  disabled={isPending || isValidating}
                />
                
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
                  <FileText className="w-3 h-3 text-primary" />
                  <span>Upload your CV in .docx format. Maximum file size: 5MB.</span>
                </div>
                
                {selectedFile && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                    <AlertCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span>File will be processed and formatted by our AI.</span>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isPending || isValidating || !selectedFile}
                  className="w-full relative flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 overflow-hidden group"
                >
                  {/* Subtle shine effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                  
                  {isPending || isValidating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isValidating ? "Processing File..." : "Starting Magic..."}
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
