// ONE-OFF: deletes pre-existing old resume copies (PDF/Word uploaded before the
// candidate's current resume). Removed after the run.
import { createClient } from "npm:@supabase/supabase-js@2";
const TOKEN = "15d0b8c24965d534053d802b238f50d127705913f96da613";
Deno.serve(async (req) => {
  if (req.headers.get("x-cleanup-token") !== TOKEN) return new Response("forbidden", { status: 403 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("candidate_attachments")
      .select("id, candidate_id, file_name, file_url, file_type, is_resume, created_at").range(from, from + 999);
    if (error) return new Response(JSON.stringify(error), { status: 500 });
    all.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const latest = new Map<string, string>();
  for (const r of all) if (r.is_resume && (!latest.has(r.candidate_id) || r.created_at > latest.get(r.candidate_id)!)) latest.set(r.candidate_id, r.created_at);
  const doomed = all.filter((r) => {
    const t = latest.get(r.candidate_id);
    const doc = /pdf|word/i.test(r.file_type || "") || /\.(pdf|docx?)$/i.test(r.file_name || "");
    return t && !r.is_resume && doc && r.created_at < t;
  });
  if (dry) return new Response(JSON.stringify({ files: doomed.length, candidates: new Set(doomed.map((d) => d.candidate_id)).size }));
  let deleted = 0;
  for (let i = 0; i < doomed.length; i += 100) {
    const chunk = doomed.slice(i, i + 100);
    await sb.storage.from("candidate-attachments").remove(chunk.map((c) => c.file_url).filter(Boolean));
    const { error } = await sb.from("candidate_attachments").delete().in("id", chunk.map((c) => c.id));
    if (!error) deleted += chunk.length;
  }
  return new Response(JSON.stringify({ deleted }));
});
