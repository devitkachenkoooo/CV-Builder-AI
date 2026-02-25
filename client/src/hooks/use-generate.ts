import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

// Input type for file upload
type GenerateCvInput = {
  templateId: number;
  file: File;
};

export function useGenerateCv() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: GenerateCvInput) => {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('templateId', data.templateId.toString());
      
      const res = await fetch(api.generate.start.path, {
        method: api.generate.start.method,
        body: formData,
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
  const isPolling = (initialStatus === "pending" || initialStatus === "processing") && jobId > 0;
  console.log(`[usePollingJob] Hook called with jobId: ${jobId}, initialStatus: ${initialStatus}, isPolling: ${isPolling}`);
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [api.generate.status.path, jobId],
    queryFn: async () => {
      console.log(`[usePollingJob] Polling status for job ${jobId}`);
      const url = buildUrl(api.generate.status.path, { jobId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job status");
      
      const data = await res.json();
      const parsed = parseWithLogging(api.generate.status.responses[200], data, "generate.status");
      console.log(`[usePollingJob] Job ${jobId} status:`, parsed.status);
      
      // If we just completed, invalidate the main resumes list to ensure everything is in sync
      if (parsed.status === "complete" || parsed.status === "failed") {
        queryClient.invalidateQueries({ queryKey: [api.resumes.list.path] });
      }
      
      return parsed;
    },
    // Poll every 2 seconds if status is still pending or processing
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status || initialStatus;
      console.log(`[usePollingJob] Job ${jobId} current status:`, currentStatus, "isPolling:", currentStatus === "pending" || currentStatus === "processing");
      if (currentStatus === "pending" || currentStatus === "processing") {
        return 2000;
      }
      return false;
    },
    enabled: isPolling, // Only enable if we're polling AND have a valid jobId
    });
    
    console.log(`[usePollingJob] Query enabled: ${isPolling}`);
}

// Hook for deleting a resume
export function useDeleteResume() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.resumes.delete.path, { id });
      const res = await fetch(url, {
        method: api.resumes.delete.method,
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Resume not found");
        }
        throw new Error("Failed to delete resume");
      }
      
      return;
    },
    onSuccess: () => {
      // Invalidate the resumes list to remove the deleted item
      queryClient.invalidateQueries({ queryKey: [api.resumes.list.path] });
    }
  });
}
