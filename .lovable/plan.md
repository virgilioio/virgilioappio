## Phased Typography Alignment

Align the app's type system with the Gio Design Foundation v1.0 guideline. Phased so we can ship value early without risky global re-flows.

---

### Phase 1 — Foundation cleanup (low risk, no visual regression)

Goal: remove bloat, fix font weights/tracking to match spec, add JetBrains Mono.

1. **Trim font imports** in `src/index.css`:
   - Poppins: keep `400;500;600;700`, drop `900`.
   - Inter: keep `400;500;600`, drop `300;700`.
2. **Add JetBrains Mono** import (`weights 400;500`) and update `tailwind.config.ts`:
   - `fontFamily.mono: ['JetBrains Mono', 'Monaco', 'Menlo', 'monospace']`.
3. **Heading weight standardization** in `tailwind.config.ts`:
   - Change all `h1-*` … `h4-*` token `fontWeight` from `700` → `600`.
   - In `src/index.css` base layer, change `h1–h6` from `font-medium` (500) → `font-semibold` (600).
4. **Tracking correction**:
   - Update `letterSpacing.page-title` and the inline `letterSpacing` on heading tokens from `-0.06em` → `-0.04em`.
   - Add `letterSpacing.caps: '0.08em'` for uppercase labels.
5. **Update Core memory** (`mem://index.md`): tracking now -0.04em, weight 600, document mono = JetBrains Mono.

Deliverable: lighter font payload, consistent heading weight, mono ready.

---

### Phase 2 — Semantic token layer (additive, opt-in)

Goal: introduce the named tokens from the guideline without forcing component rewrites yet.

1. **Add new Tailwind `fontSize` tokens** in `tailwind.config.ts` matching the guideline exactly:
   ```
   display.xl  48 / 1.05 / 600 / Poppins
   display.lg  36 / 1.10 / 600 / Poppins
   h1          26 / 1.15 / 600 / Poppins
   h2          18 / 1.20 / 600 / Poppins
   h3          14.5 / 1.30 / 600 / Poppins
   h4          13 / 1.30 / 600 / Poppins

   body.lg     14 / 1.55 / 400 / Inter
   body.md     13 / 1.50 / 400 / Inter
   body.sm     12 / 1.45 / 400 / Inter
   body.emphasis 13 / 1.50 / 500 / Inter

   ui.menu.lg     13 / 1.20 / 500 / Poppins
   ui.menu.md     12.5 / 1.30 / 500 / Inter
   ui.button.lg   13.5 / 1.20 / 500 / Poppins
   ui.button.md   13 / 1.20 / 500 / Poppins
   ui.button.sm   12 / 1.20 / 500 / Poppins
   ui.tab         12.5 / 1.30 / 500 / Poppins
   ui.breadcrumb  11.5 / 1.40 / 400 / Inter

   form.label       12 / 1.40 / 500 / Inter
   form.value       13 / 1.40 / 400 / Inter
   form.placeholder 13 / 1.40 / 400 / Inter (color: muted)
   form.helper      11 / 1.45 / 400 / Inter
   form.error       11.5 / 1.40 / 500 / Inter
   form.required    12 / 1.40 / 500 / Inter (color: error)
   ```
2. **Document tokens** in a short `docs/typography.md` that mirrors the screenshot table — single source of truth for engineers.
3. **No component edits in this phase** — existing classes keep working.

Deliverable: design system available for all new code; old code untouched.

---

### Phase 3 — Adopt tokens in core chrome (controlled rollout)

Goal: visible alignment on the surfaces the user looks at most, without an app-wide sweep.

1. **PageHeader** component → use `text-h1` token (drops page titles from 34 → 26px). This will be the most visible change; preview before merge.
2. **Top nav tabs** + **settings sidebar nav** → `text-ui.menu.lg` / `text-ui.menu.md`.
3. **Buttons** (`src/components/ui/button.tsx`) → map size variants to `ui.button.lg/md/sm`.
4. **Tabs** (`src/components/ui/tabs.tsx`) → `text-ui.tab`.
5. **Breadcrumbs** → `text-ui.breadcrumb`.
6. **Form primitives** (`Label`, `Input` placeholder, helper text in `FormDescription`, `FormMessage`) → form.* tokens.

Deliverable: every chrome surface visibly matches the guideline. No business components touched.

---

### Phase 4 — Long tail + enforcement

1. Sweep remaining ad-hoc `text-2xl`/`text-3xl` heading usages and rewrite to `text-h1`/`text-h2`.
2. Add an ESLint rule (or doc note) discouraging raw `font-poppins`/`font-inter` outside the token layer.
3. Update memory entries `style/typography/high-density-scaling` and `style/ui/page-header-standardization` to reference the new tokens.

Deliverable: guideline becomes enforced default; legacy classes cleaned.

---

### Risks & call-outs
- **Phase 3 PageHeader resize** is the most user-visible change (titles shrink ~24%). Worth previewing on Pipeline / Candidates / Settings before committing.
- All other phases are additive or low-impact.
- No backend/data changes anywhere.
