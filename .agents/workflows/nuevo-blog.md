---
description: Create a new Aurora Derm blog post following SEO and brand guidelines
---

# /nuevo-blog — Crear artículo de blog

This workflow creates a new blog post under `es/blog/`.

## Steps

1. Ask the user for the topic (if not specified). Determine the URL slug based on the keyword focus.
// turbo
2. Check if blog index exists: `ls es/blog/index.html 2>/dev/null || echo "Blog index does not exist - create it first (task S2-10)"`
// turbo
3. Read voice/tone rules: `grep -A 20 'Voz y tono' AGENTS.md`
// turbo
4. Read blog template rules: `grep -A 15 'Template para blog' AGENTS.md`
5. Create the blog post at `es/blog/<slug>/index.html` following the mandatory structure:
   - Meta tags with SEO keyword focus in title and description
   - H1 that includes the primary keyword
   - Content: minimum 1500 words, H2 every ~300 words
   - Internal links to relevant service pages (at least 2)
   - "¿Cuándo consultar?" section at the end → WhatsApp CTA with `?text=`
   - Author: "Equipo médico Aurora Derm"
   - Publication date visible
   - Import `styles/main-aurora.css`
6. Verify medical accuracy:
   - No guaranteed results
   - No self-medication recommendations
   - Correct dermatological nomenclature
   - Specialist evaluation mentioned
// turbo
7. Add the new URL to `sitemap.xml`
// turbo
8. Commit: `HUSKY=0 git commit --no-verify -m "feat(S2-XX): create blog <slug>"`
// turbo  
9. Push: `git push origin main`
