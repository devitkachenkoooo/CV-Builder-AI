import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type GenerateCvInput } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useGenerateCv() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: GenerateCvInput) => {
      const validated = api.generate.start.input.parse(data);
      const res = await fetch(api.generate.start.path, {
        method: api.generate.start.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message || "Validation failed");
        }
        throw new Error("Failed to start CV generation");
      }
      
      const responseData = await res.json();
      return parseWithLogging(api.generate.start.responses[202], responseData, "generate.start");
    },
    onSuccess: () => {
      // Invalidate the resumes list to show the new pending CV
      queryClient.invalidateQueries({ queryKey: [api.resumes.list.path] });
    }
  });
}

// Hook for polling an individual CV's status
export function usePollingJob(jobId: number, initialStatus: string) {
  const isPolling = initialStatus === "pending" || initialStatus === "processing";
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [api.generate.status.path, jobId],
    queryFn: async () => {
      const url = buildUrl(api.generate.status.path, { jobId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job status");
      
      const data = await res.json();
      const parsed = parseWithLogging(api.generate.status.responses[200], data, "generate.status");
      
      // If we just completed, invalidate the main resumes list to ensure everything is in sync
      if (parsed.status === "complete" || parsed.status === "failed") {
        queryClient.invalidateQueries({ queryKey: [api.resumes.list.path] });
      }
      
      return parsed;
    },
    // Poll every 2 seconds if status is still pending or processing
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status || initialStatus;
      if (currentStatus === "pending" || currentStatus === "processing") {
        return 2000;
      }
      return false;
    },
    enabled: isPolling,
  });
}
