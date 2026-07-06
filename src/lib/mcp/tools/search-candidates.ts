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
  name: "search_candidates",
  title: "Search candidates",
  description:
    "Search candidates by name or email substring in Virgilio. Returns up to `limit` matches the signed-in user can access.",
  inputSchema: {
    query: z
      .string()
      .trim()
      .min(1)
      .describe("Substring to match against first name, last name, or email."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .nullable()
      .describe("Max rows to return (1-50). Defaults to 20."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const like = `%${query.replace(/[%_]/g, "")}%`;
    const { data, error } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, current_title, current_company, created_at")
      .or(
        `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`,
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { candidates: data ?? [] },
    };
  },
});
