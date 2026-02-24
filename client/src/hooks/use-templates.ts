import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useTemplates() {
  return useQuery({
    queryKey: [api.templates.list.path],
    queryFn: async () => {
      const res = await fetch(api.templates.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error("Failed to fetch templates");
      }
      const data = await res.json();
      return parseWithLogging(api.templates.list.responses[200], data, "templates.list");
    },
  });
}
