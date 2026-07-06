import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "Return the signed-in Virgilio user's id and email. Use to verify the MCP connection is authenticated.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    }
    const payload = {
      user_id: ctx.getUserId(),
      email: ctx.getUserEmail() ?? null,
      client_id: ctx.getClientId() ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
