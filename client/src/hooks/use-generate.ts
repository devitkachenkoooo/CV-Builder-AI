import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import i18n from "@/lib/i18n";

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
        headers: {
          'x-language': i18n.language || 'ua'
        }
      });

      if (!res.ok) {
        if (res.status === 400 || res.status === 429) {
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
      // Scroll to top to show the new CV being generated
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

// Hook for polling an individual CV's status
export function usePollingJob(jobId: number, initialStatus: string) {
  const isJobActive = initialStatus === "pending" || initialStatus === "processing";
  const pollingScope = isJobActive ? "active" : "inactive";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [api.generate.status.path, jobId, pollingScope],
    queryFn: async () => {
      const url = buildUrl(api.generate.status.path, { jobId });

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch job status");
      }

      const data = await res.json();

      const parsed = parseWithLogging(api.generate.status.responses[200], data, "generate.status");

      return parsed;
    },
    // Override global staleTime Infinity so polling can restart from cached complete state
    staleTime: 0,
    refetchOnMount: "always",
    // Poll every 2 seconds if status is still pending or processing
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status || initialStatus;
      if (currentStatus === "pending" || currentStatus === "processing") {
        return 2000;
      }
      return false;
    },
    enabled: jobId > 0 && isJobActive,
  });

  // Handle side effects (like invalidating queries) in useEffect, not in queryFn
  useEffect(() => {
    if (query.data?.status === "complete" || query.data?.status === "failed") {
      queryClient.invalidateQueries({ queryKey: [api.resumes.list.path] });
    }
  }, [query.data?.status, queryClient, jobId]);

  return query;
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
