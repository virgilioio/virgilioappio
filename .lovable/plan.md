

## Fix: Three Critical Failures in Language + Location Grounding

### What Went Wrong (Evidence from Logs)

The latest sourcing project (`6a00291f`) created from an English JD about "Manager of the Analyst Team" for India/Philippines produced:

- **Title**: "Manager of the Equipo of Analistas" (mixed English/Spanish)
- **Locations**: 12 APAC countries (IN, CN, JP, SG, AU, KR, ID, TH, VN, PH, MY, NZ) instead of just IN + PH
- **Research titles**: "Gerente de Analisis", "Lider de Equipo de Analistas" (fully Spanish)
- **Keywords**: "Analisis de Datos", "Gestion de Proyectos" (fully Spanish)
- **Apollo results**: 0 — because no one has the title "Manager of the Equipo of Analistas"

Three independent failures need three targeted fixes.

---

### Fix 1: Expand the Server-Side Spanish Title Map

**File**: `supabase/functions/generate-job-spec/index.ts` (lines 582-588)

**Problem**: The `SPANISH_TITLE_MAP` used to sanitize titles before passing to research is missing words like "Equipo" (Team), "Analistas" (Analysts), "Ventas" (Sales), etc. The frontend `sanitizeJobSpec` in `AIJobAssistant.tsx` has a larger map, but the server-side map is incomplete.

**Fix**: Expand the server-side map to match and exceed the frontend map. Add all common Spanish business/role words:

```
'Analistas' -> 'Analysts', 'Equipo' -> 'Team', 'Ventas' -> 'Sales',
'Operaciones' -> 'Operations', 'Recursos' -> 'Resources', 'Humanos' -> 'Human',
'Contabilidad' -> 'Accounting', 'Finanzas' -> 'Finance', 'Mercadeo' -> 'Marketing',
'Comercial' -> 'Commercial', 'Tecnico' -> 'Technical', 'Producto' -> 'Product',
'Proyecto' -> 'Project', 'Proyectos' -> 'Projects', 'Datos' -> 'Data',
'Seguridad' -> 'Security', 'Calidad' -> 'Quality', 'Investigacion' -> 'Research',
'Soporte' -> 'Support', 'Atencion' -> 'Service', 'Cliente' -> 'Client',
'Clientes' -> 'Clients', 'Cuenta' -> 'Account', 'Cuentas' -> 'Accounts',
'Negocios' -> 'Business', 'Gestion' -> 'Management', 'Administrador' -> 'Administrator',
'Programador' -> 'Programmer', 'Disenador' -> 'Designer', 'Arquitecto' -> 'Architect',
'Estrategia' -> 'Strategy', 'Senior' -> 'Senior', 'Junior' -> 'Junior',
'Asistente' -> 'Assistant', 'Asociado' -> 'Associate', 'Regional' -> 'Regional',
'Nacional' -> 'National', 'Internacional' -> 'International', 'General' -> 'General',
'Principal' -> 'Principal', 'Bienes' -> 'Real', 'Raices' -> 'Estate',
'Comerciales' -> 'Commercial', 'Analisis' -> 'Analysis'
```

Also apply this same sanitization to `jobSpec.alt_titles` and `jobSpec.department` before passing to the research function — not just the title.

---

### Fix 2: Force Country Codes Extraction with Stronger Prompt

**File**: `supabase/functions/generate-job-spec/index.ts` (lines 492-496, 507-515)

**Problem**: The grounding rule exists but the model still defaults to `region: "APAC"`. The JSON schema shows `country_codes` with `or null` which makes the model treat it as optional. The model takes the path of least resistance.

**Fix**:
- Make the JSON schema description more directive: remove `or null`, replace with explicit instructions
- Move the CRITICAL LOCATION GROUNDING RULE to be right next to the JSON field definition (proximity matters)
- In the FINAL INSTRUCTION message (line 545), add a location-specific reminder when the prompt mentions specific country names

Updated JSON field:
```json
"country_codes": ["ISO codes when SPECIFIC countries are mentioned in the prompt. REQUIRED when 2+ countries are named. Example: prompt says 'India or Philippines' -> ['IN', 'PH']. Leave as empty array [] only if no specific countries mentioned."],
```

Updated FINAL INSTRUCTION to include:
```
If the prompt mentions specific countries by name, you MUST use country_codes with those exact countries. Do NOT use region instead.
```

---

### Fix 3: Research Function Must Sanitize Its Own Input + Strengthen Output Rules

**File**: `supabase/functions/research-sourcing-criteria/index.ts` (lines 78-100)

**Problem**: Even with the English language rule (line 80), the research function received a half-Spanish title ("Manager of the Equipo of Analistas") and returned fully Spanish results. The input title primes the model toward Spanish. The current language instruction is a single line buried in context — not strong enough.

**Fix**:
- Add a server-side sanitization of the input `job_title` within the research function itself (same SPANISH_TITLE_MAP approach), so even if generate-job-spec leaks Spanish, research cleans it before using it in the prompt
- Move the language instruction from a context line to a dedicated final paragraph with emphasis
- Add it to the end of the research prompt (recency bias), not the beginning

Updated structure:
```
...existing research prompt...

ABSOLUTE LANGUAGE RULE:
ALL output — alternative titles, keywords, reasoning — MUST be in English.
Do NOT generate Spanish, Portuguese, or any non-English text.
The job location does NOT determine the output language.
```

---

### Fix 4: Expand Frontend sanitizeJobSpec

**File**: `src/components/dashboard/AIJobAssistant.tsx`

**Problem**: The frontend `sanitizeJobSpec` function needs to also sanitize `title_keywords` (the array used in search criteria on line 402) and `keywords` from research metadata. These flow directly into Apollo search and were Spanish.

**Fix**: Apply the same sanitization to:
- `title_keywords` array before it goes into `search_criteria` (line 402)
- `research_metadata.researched_keywords` before storing in `job_spec_data`
- `research_metadata.researched_titles` before storing

This is a last-resort safety net — the server-side fixes above should prevent Spanish from reaching the frontend, but defense in depth.

---

### Summary of Changes

| File | What Changes |
|---|---|
| `supabase/functions/generate-job-spec/index.ts` | Expand SPANISH_TITLE_MAP (30+ words), sanitize alt_titles + department, strengthen country_codes JSON schema, add location reminder to FINAL INSTRUCTION |
| `supabase/functions/research-sourcing-criteria/index.ts` | Add input title sanitization, move language rule to end of prompt with emphasis |
| `src/components/dashboard/AIJobAssistant.tsx` | Sanitize title_keywords, researched_keywords, and researched_titles arrays |

### Expected Outcome
For the same JD ("Manager of the Analyst Team... India or the Philippines"):
- Title: "Manager of the Analyst Team" (English)
- Locations: ["IN", "PH"] (only India and Philippines)
- Research titles: "Analytics Manager", "Research Team Lead" (English)
- Keywords: "Data Analysis", "Project Management" (English)
- Apollo results: hundreds of matches (because the titles are now real English job titles)
