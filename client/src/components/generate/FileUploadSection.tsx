import { FileText, AlertCircle } from "lucide-react";
import { Dropzone } from "@/components/ui/dropzone";
import { useTranslation } from "react-i18next";

interface FileUploadSectionProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  disabled?: boolean;
}

export function FileUploadSection({ 
  selectedFile, 
  onFileSelect, 
  onFileRemove, 
  disabled = false 
}: FileUploadSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label htmlFor="file-upload" className="block text-sm font-medium text-foreground">
        {t("modal.upload_label")}
      </label>

      <Dropzone
        onFileSelect={onFileSelect}
        selectedFile={selectedFile}
        onFileRemove={onFileRemove}
        disabled={disabled}
        className="min-h-[120px] sm:min-h-[140px]"
      />

      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
        <FileText className="w-3 h-3 text-primary" />
        <span className="hidden sm:inline">{t("modal.upload_hint")}</span>
        <span className="sm:hidden">{t("modal.upload_hint_mobile")}</span>
      </div>

      {selectedFile && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertCircle className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">{t("modal.ai_processing")}</span>
          <span className="sm:hidden">{t("modal.ai_processing_mobile")}</span>
        </div>
      )}
    </div>
  );
}
