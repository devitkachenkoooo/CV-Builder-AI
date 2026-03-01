function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const appConfig = {
  rateLimits: {
    aiRequestsPerHour: parsePositiveInt(process.env.AI_REQUESTS_PER_HOUR, 20),
    aiRequestsWindowMs: parsePositiveInt(process.env.AI_REQUEST_WINDOW_MS, 60 * 60 * 1000),
  },
  html: {
    maxGeneratedHtmlChars: parsePositiveInt(process.env.AI_MAX_GENERATED_HTML_CHARS, 500_000),
  },
};

