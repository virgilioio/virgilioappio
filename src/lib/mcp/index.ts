import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listJobsTool from "./tools/list-jobs";
import searchCandidatesTool from "./tools/search-candidates";
import getCandidateTool from "./tools/get-candidate";

// OAuth issuer must be the direct Supabase host, built from the project ref.
// Vite inlines VITE_SUPABASE_PROJECT_ID at build time so this stays import-safe.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "virgilio-mcp",
  title: "Virgilio",
  version: "0.1.0",
  instructions:
    "Tools for Virgilio, an ATS/CRM. Use `whoami` to verify the connection, `list_jobs` to browse open roles, `search_candidates` to find people by name or email, and `get_candidate` for a full profile. All calls run as the signed-in Virgilio user and respect their permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listJobsTool, searchCandidatesTool, getCandidateTool],
});
