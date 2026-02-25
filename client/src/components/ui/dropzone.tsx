import React, { useCallback, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateDocxFile, formatFileSize } from '@/lib/file-validation';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onFileRemove: () => void;
  disabled?: boolean;
  className?: string;
}

export function Dropzone({ 
  onFileSelect, 
  selectedFile, 
  onFileRemove, 
  disabled = false,
  className 
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);
    
    // Validate file
    const validation = validateDocxFile(file);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    onFileSelect(file);
  }, [onFileSelect]);

  const handleRemove = useCallback(() => {
    setError(null);
    onFileRemove();
  }, [onFileRemove]);

  return (
    <div className={cn("w-full", className)}>
      {!selectedFile ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-4 sm:p-6 lg:p-8 text-center transition-all duration-200 cursor-pointer",
            isDragOver 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-primary/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileInput}
            disabled={disabled}
            className="hidden"
          />
          
          <Upload className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
          
          <div className="space-y-1 sm:space-y-2">
            <p className="text-sm sm:text-base lg:text-lg font-medium text-foreground">
              Drop your .docx file here
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum file size: 5MB
            </p>
          </div>
        </div>
      ) : (
        <div className="border-2 border-border rounded-xl p-3 sm:p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleRemove}
              disabled={disabled}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-destructive/10 text-destructive hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-2 p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs sm:text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
