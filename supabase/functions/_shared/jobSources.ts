// The text of a job's uploaded files (job_files.extracted_text), read for the Gio
// writers: generate-job-description and generate-job-skills. Read with the
// service role, only for a job in the caller's workspace, and capped so a prompt
// stays small: 12,000 characters per file, 30,000 in all, newest files first.
// deno-lint-ignore-file no-explicit-any

export interface JobSource {
  name: string;
  text: string;
}

const PER_FILE = 12000;
const TOTAL = 30000;

export async function jobFileSources(admin: any, jobId: string, tenantId: string): Promise<JobSource[]> {
  const { data: job } = await admin.from("jobs").select("tenant_id").eq("id", jobId).maybeSingle();
  if (!job || job.tenant_id !== tenantId) return [];
  const { data, error } = await admin
    .from("job_files")
    .select("file_name, extracted_text")
    .eq("job_id", jobId)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const out: JobSource[] = [];
  let used = 0;
  for (const row of data as { file_name: string; extracted_text: string | null }[]) {
    const text = (row.extracted_text ?? "").replace(/\s+\n/g, "\n").trim();
    if (!text) continue;
    const room = Math.min(PER_FILE, TOTAL - used);
    if (room <= 200) break;
    const cut = text.length > room ? text.slice(0, room) + "\n[...]" : text;
    out.push({ name: row.file_name, text: cut });
    used += cut.length;
  }
  return out;
}

/** The sources as a prompt block, or "" when there are none. */
export function sourcesBlock(sources: JobSource[]): string {
  if (!sources.length) return "";
  return "\n\n## Source documents uploaded by the recruiter\n" +
    sources.map((s, i) => `### Document ${i + 1}: ${s.name}\n${s.text}`).join("\n\n");
}
