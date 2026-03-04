import type { CvTemplate } from "@shared/routes";
import { useTranslation } from "react-i18next";

interface TemplatePreviewProps {
  template: CvTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full md:w-2/5 bg-secondary/50 p-3 sm:p-4 lg:p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border">
      <h3 className="font-display font-bold text-sm sm:text-base lg:text-lg mb-2 sm:mb-3 lg:mb-4 text-center">
        {t("modal.selected_template")}
      </h3>
      <div className="relative w-full max-w-[160px] sm:max-w-[200px] lg:max-w-none aspect-[1/1.4] rounded-lg overflow-hidden shadow-lg border border-border/50 bg-white">
        <img
          src={template.screenshotUrl}
          alt={template.name}
          className="w-full h-full object-cover"
          onError={(e) => { 
            e.currentTarget.src = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&q=80' 
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-1.5 sm:p-2 lg:p-4">
          <span className="text-white font-medium text-xs sm:text-xs lg:text-sm">
            {template.name}
          </span>
        </div>
      </div>
    </div>
  );
}
