import { DEFAULT_GENERATION_TEMPERATURE, MODEL_TEMPERATURE_MAX, MODEL_TEMPERATURE_MIN } from "@shared/config";
import { useTranslation } from "react-i18next";

interface GenerationControlsProps {
  useGenerationPrompt: boolean;
  generationPrompt: string;
  generationTemperature: number;
  onPromptToggle: (checked: boolean) => void;
  onPromptChange: (value: string) => void;
  onTemperatureChange: (value: number) => void;
  disabled?: boolean;
}

export function GenerationControls({
  useGenerationPrompt,
  generationPrompt,
  generationTemperature,
  onPromptToggle,
  onPromptChange,
  onTemperatureChange,
  disabled = false
}: GenerationControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Generation Prompt Toggle */}
      <div className="space-y-2">
        <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/40">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
            checked={useGenerationPrompt}
            onChange={(e) => onPromptToggle(e.target.checked)}
            disabled={disabled}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("modal.use_generation_prompt_label")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("modal.use_generation_prompt_hint")}
            </p>
          </div>
        </label>

        {useGenerationPrompt && (
          <textarea
            value={generationPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={t("modal.generation_prompt_placeholder")}
            maxLength={600}
            disabled={disabled}
            className="w-full min-h-[90px] max-h-[180px] resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        )}
      </div>

      {/* Temperature Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {t("modal.temperature_label")}
          </p>
          <p className="text-xs text-muted-foreground">
            {generationTemperature.toFixed(2)}
          </p>
        </div>
        <input
          type="range"
          min={MODEL_TEMPERATURE_MIN}
          max={MODEL_TEMPERATURE_MAX}
          step={0.05}
          value={generationTemperature}
          onChange={(e) => onTemperatureChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full accent-primary"
        />
        <p className="text-xs text-muted-foreground">
          {t("modal.temperature_hint")}
        </p>
      </div>
    </div>
  );
}
