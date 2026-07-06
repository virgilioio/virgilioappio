import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_jobs",
  title: "List jobs",
  description:
    "List jobs the signed-in user can see in Virgilio. Optionally filter by status (e.g. open, closed, draft). Returns up to `limit` rows.",
  inputSchema: {
    status: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .describe("Optional job status filter (e.g. 'open')."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .nullable()
      .describe("Max rows to return (1-50). Defaults to 20."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("jobs")
      .select("id, title, status, department, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { jobs: data ?? [] },
    };
  },
});
