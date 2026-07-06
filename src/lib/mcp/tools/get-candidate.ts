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
  name: "get_candidate",
  title: "Get candidate",
  description:
    "Fetch the full profile of a Virgilio candidate by id, subject to the signed-in user's access.",
  inputSchema: {
    candidate_id: z.string().uuid().describe("The candidate's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ candidate_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidate_id)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: "Candidate not found" }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { candidate: data },
    };
  },
});
