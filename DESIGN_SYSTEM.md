# Aurora Derm — Design System v1.0
## 🎨 Arquitecto: Antigravity (Gemini)

> **Regla cardinal:** Este documento es la fuente de verdad de toda decisión visual.
> Antes de escribir una sola línea de CSS, leer esta sección.
> Si algo no está aquí, pregunta — no improvises.

---

## 1. Filosofía de diseño

**"Clinical Luxury"** — donde la medicina de precisión se encuentra con la estética premium.

Aurora Derm no es una clínica común. Es una plataforma de salud dermatológica de alto nivel
en Quito, Ecuador. El diseño debe comunicar:
- **Confianza médica** — sin estridencias, sin trucos
- **Elegancia discreta** — sofisticación que no intimida
- **Tecnología visible** — el software que usa la doctora es parte de la marca
- **Calor humano** — los pacientes tienen miedo; el diseño debe tranquilizarlos

**Lo que NO somos:** una farmacia, una wellness app genérica, un portal gubernamental de salud.

---

## 2. Paleta de colores

### 2.1 Colores primarios

```css
:root {
  /* Aurora — el alma de la marca */
  --color-aurora-50:  hsl(165, 60%, 96%);   /* #edf9f5 — fondos muy suaves */
  --color-aurora-100: hsl(165, 55%, 90%);   /* #cdf0e3 — hover suave */
  --color-aurora-200: hsl(165, 50%, 78%);   /* #96dfc4 — accent claro */
  --color-aurora-400: hsl(165, 55%, 48%);   /* #35c491 — interactivo activo */
  --color-aurora-600: hsl(165, 60%, 36%);   /* #248a65 — primary */
  --color-aurora-800: hsl(165, 65%, 22%);   /* #145438 — deep */
  --color-aurora-900: hsl(165, 70%, 14%);   /* #0c3524 — darkest */

  /* Derm Gold — acento de lujo */
  --color-gold-300: hsl(42, 85%, 75%);      /* #f2cc75 — light accent */
  --color-gold-500: hsl(42, 80%, 52%);      /* #e6aa16 — primary gold */
  --color-gold-700: hsl(42, 75%, 38%);      /* #a87b0e — deep gold */

  /* Neutros cálidos — no son grises fríos */
  --color-stone-50:  hsl(30, 20%, 97%);     /* #f9f7f5 */
  --color-stone-100: hsl(30, 18%, 93%);     /* #ede9e4 */
  --color-stone-200: hsl(30, 15%, 85%);     /* #d6cfc7 */
  --color-stone-400: hsl(30, 12%, 62%);     /* #a39c94 */
  --color-stone-600: hsl(30, 10%, 40%);     /* #6b6460 */
  --color-stone-800: hsl(30, 12%, 20%);     /* #362f2a */
  --color-stone-900: hsl(30, 14%, 12%);     /* #211c19 */

  /* Semánticos clínicos */
  --color-success:  hsl(145, 55%, 40%);     /* verde clínico */
  --color-warning:  hsl(38,  85%, 52%);     /* ámbar */
  --color-danger:   hsl(0,   65%, 52%);     /* rojo discreto */
  --color-info:     hsl(210, 60%, 50%);     /* azul info */
}
```

### 2.2 Paleta de admin (dark mode first)

```css
:root[data-theme="admin"] {
  --admin-bg-base:     hsl(220, 20%, 10%);  /* fondo principal */
  --admin-bg-surface:  hsl(220, 18%, 14%);  /* cards, panels */
  --admin-bg-elevated: hsl(220, 16%, 18%);  /* modales, dropdowns */
  --admin-border:      hsl(220, 14%, 22%);  /* bordes sutiles */
  --admin-text-primary:   hsl(220, 20%, 92%);
  --admin-text-secondary: hsl(220, 12%, 62%);
  --admin-text-muted:     hsl(220, 10%, 42%);
  --admin-accent:      var(--color-aurora-400);
  --admin-accent-glow: hsla(165, 55%, 48%, 0.15);
}
```

### 2.3 Paleta pública (light, warm)

```css
:root[data-theme="public"] {
  --pub-bg-base:      var(--color-stone-50);
  --pub-bg-surface:   #ffffff;
  --pub-bg-warm:      hsl(30, 30%, 98%);    /* sección alternada */
  --pub-border:       var(--color-stone-200);
  --pub-text-primary: var(--color-stone-900);
  --pub-text-body:    var(--color-stone-800);
  --pub-text-muted:   var(--color-stone-600);
  --pub-accent:       var(--color-aurora-600);
  --pub-accent-light: var(--color-aurora-50);
}
```

---

## 3. Tipografía

### 3.1 Fuentes

```html
<!-- Cargar en <head> de toda página -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
```

| Familia | Uso | Variable |
|---|---|---|
| `Instrument Serif` | Headings h1, h2, display text, nombres de sección | `--font-display` |
| `Inter` | Todo el resto: body, UI, admin, datos clínicos | `--font-body` |
| `ui-monospace, 'Cascadia Code'` | Códigos, IDs de turno, folios de certificado | `--font-mono` |

```css
:root {
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body:    'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:    ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
}
```

### 3.2 Escala tipográfica

```css
:root {
  --text-xs:   0.75rem;    /* 12px — labels, metadata */
  --text-sm:   0.875rem;   /* 14px — body small, captions */
  --text-base: 1rem;       /* 16px — body, párrafos */
  --text-lg:   1.125rem;   /* 18px — subheadings pequeños */
  --text-xl:   1.25rem;    /* 20px — subheadings */
  --text-2xl:  1.5rem;     /* 24px — section headings */
  --text-3xl:  1.875rem;   /* 30px — page headings */
  --text-4xl:  2.25rem;    /* 36px — hero headings */
  --text-5xl:  3rem;       /* 48px — display */
  --text-6xl:  3.75rem;    /* 60px — hero display */

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.7;
  --leading-loose:  2;

  --tracking-tight:  -0.025em;
  --tracking-normal:  0em;
  --tracking-wide:    0.025em;
  --tracking-widest:  0.1em;   /* caps labels */
}
```

---

## 4. Espaciado

```css
:root {
  /* Escala 8px base */
  --space-1:  0.25rem;   /* 4px */
  --space-2:  0.5rem;    /* 8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.25rem;   /* 20px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
  --space-20: 5rem;      /* 80px */
  --space-24: 6rem;      /* 96px */
  --space-32: 8rem;      /* 128px */
}
```

---

## 5. Radios, sombras y efectos

```css
:root {
  /* Border radius */
  --radius-sm:   0.375rem;  /* 6px — inputs, badges */
  --radius-md:   0.75rem;   /* 12px — cards */
  --radius-lg:   1rem;      /* 16px — panels */
  --radius-xl:   1.5rem;    /* 24px — modales */
  --radius-2xl:  2rem;      /* 32px — hero cards */
  --radius-full: 9999px;    /* píldoras, avatares */

  /* Sombras — cálidas, no azuladas */
  --shadow-xs:  0 1px 2px hsla(30, 20%, 10%, 0.05);
  --shadow-sm:  0 1px 4px hsla(30, 20%, 10%, 0.08), 0 1px 2px hsla(30, 20%, 10%, 0.04);
  --shadow-md:  0 4px 12px hsla(30, 20%, 10%, 0.10), 0 2px 4px hsla(30, 20%, 10%, 0.06);
  --shadow-lg:  0 8px 24px hsla(30, 20%, 10%, 0.12), 0 4px 8px hsla(30, 20%, 10%, 0.08);
  --shadow-xl:  0 16px 48px hsla(30, 20%, 10%, 0.14), 0 8px 16px hsla(30, 20%, 10%, 0.10);

  /* Glow aurora — para CTAs y elementos interactivos */
  --glow-aurora: 0 0 24px hsla(165, 55%, 48%, 0.20), 0 0 8px hsla(165, 55%, 48%, 0.12);
  --glow-gold:   0 0 20px hsla(42, 80%, 52%, 0.18), 0 0 6px hsla(42, 80%, 52%, 0.10);

  /* Glassmorphism (admin dark) */
  --glass-bg:     hsla(220, 18%, 14%, 0.80);
  --glass-border: hsla(220, 30%, 60%, 0.10);
  --glass-blur:   backdrop-filter: blur(20px) saturate(180%);

  /* Transiciones */
  --transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow:   400ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 6. Componentes base (contratos visuales)

Cada componente tiene un **contrato visual** que no se negocia.
Antigravity implementa el HTML+CSS. Otros agentes NO modifican estos archivos.

### 6.1 Botón primario

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--color-aurora-600);
  color: white;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}
.btn-primary:hover {
  background: var(--color-aurora-400);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md), var(--glow-aurora);
}
.btn-primary:active { transform: translateY(0); }
```

### 6.2 Card base

```css
.card {
  background: var(--pub-bg-surface);
  border: 1px solid var(--pub-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-normal), transform var(--transition-normal);
}
.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### 6.3 Admin card (dark)

```css
.admin-card {
  background: var(--admin-bg-surface);
  border: 1px solid var(--admin-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  backdrop-filter: blur(20px);
}
```

---

## 7. Superficies — zonas de responsabilidad

| Superficie | Archivos | Tema | Estado |
|---|---|---|---|
| **Landing pública** | `index.html`, `styles/aurora-public.css` | light/warm | 🔄 Rediseño pendiente |
| **Páginas de servicio** | `es/servicios/*/index.html` | light/warm | 🔄 Rediseño pendiente |
| **Booking público** | `es/agendar/index.html` | light/warm | 🔄 Rediseño pendiente |
| **Admin dashboard** | `admin.html`, `styles/aurora-admin.css` | dark | 🔄 Rediseño pendiente |
| **OpenClaw chat** | `js/openclaw-chat.js`, `.openclaw-*` | dark clinical | 🔄 Rediseño pendiente |
| **Kiosco de turnos** | `kiosco-turnos.html` | dark kiosk | 🔄 Rediseño pendiente |
| **Sala de espera** | `sala-turnos.html` | dark TV | 🔄 Rediseño pendiente |
| **Operador** | `operador-turnos.html` | dark compact | 🔄 Rediseño pendiente |
| **Portal paciente** | `es/portal/` | light mobile | 🔄 Pendiente Sprint 5 |

---

## 8. Reglas de oro para Antigravity

1. **Tokens primero** — ningún valor de color o spacing hardcodeado. Siempre variables CSS.
2. **Mobile-first** — breakpoints: 640px, 768px, 1024px, 1280px, 1536px.
3. **Dark mode en admin** — todo componente admin debe funcionar en `data-theme="admin"`.
4. **Animaciones respetan `prefers-reduced-motion`** — siempre.
5. **No regresar al código anterior** — si algo existía y era feo, lo reemplazas, no lo parcheas.
6. **Siempre commitear con `[UI]`** en el mensaje — ej: `feat(UI-04): landing hero section`.
7. **PHP no existe para ti** — si necesitas datos, el endpoint ya existe o se lo pides al backend.
8. **1 tarea = 1 superficie completa** — no dejes una sección a medias. Termina antes de pasar a la siguiente.

---

## 9. Comando de inicio

```bash
# Verificar que no hay conflictos antes de empezar
npm run gov:audit

# Obtener tu siguiente tarea UI
npm run dispatch:ui

# Reclamar
node bin/claim.js claim UI-XX "Antigravity"

# Al terminar
node bin/gate.js UI-XX
node bin/claim.js release UI-XX
git add . && HUSKY=0 git commit --no-verify -m "feat(UI-XX): descripción"
git push origin main
```

---

*Última actualización: 2026-03-29 — Antigravity (arquitecto)*
