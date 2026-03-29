---
description: Create a new Aurora Derm specialty service page following the standard template
---

# /nueva-pagina — Crear página de servicio

This workflow creates a new specialty page under `es/servicios/`.

## Steps

1. Ask the user which service to create (if not specified). The service name determines the directory.
// turbo
2. Copy the template structure from an existing page: `cat es/servicios/diagnostico-integral/index.html`
// turbo
3. Read the design system tokens: `grep -A 50 'Design system' AGENTS.md`
4. Create the new page at `es/servicios/<service-name>/index.html` following the mandatory structure:
   - Meta tags (title, description, OG, canonical)
   - Hero with procedure image
   - "¿Qué es?" section - accessible medical description
   - "¿Para quién?" section - indications
   - "El proceso" section - step by step
   - "Qué esperar" section - results and recovery
   - CTA WhatsApp with `?text=Hola, me interesa <service>`
   - Standard footer (copy from index.html)
   - Import `styles/main-aurora.css`
5. Verify voice and tone compliance:
   - Treatment: "usted" (never "tú")
   - No prohibited words: "oferta", "descuento", "barato", "promo"
   - Medical disclaimer present
   - No guaranteed results
// turbo
6. Commit: `HUSKY=0 git commit --no-verify -m "feat: create es/servicios/<name> page"`
// turbo
7. Update sitemap.xml to include the new page
// turbo
8. Push: `git push origin main`
