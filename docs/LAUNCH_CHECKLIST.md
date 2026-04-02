# Aurora Derm: Launch Checklist (Portada)

Este documento certifica las verificaciones obligatorias para la subida a Producción de la landing page pública versión 6 (`/es/`).

## 10/10 Readiness Checks

- [x] **1. Analítica Activa**: Tag de GA4 (`G-XXXXXXXXXX`) integrado asíncronamente en el layout global para monitoreo de conversión desde el día 0.
- [x] **2. Schema.org Dermatológico**: Inyectado JSON-LD con tipo `MedicalBusiness/Dermatology`, geocoordenadas (Quito) e información de contacto estructurada para indexación local.
- [x] **3. CTA Primario Above-Fold**: Call-To-Action ("Agendar Ahora") presente de forma prominente, con colores de contraste WCAG-AA y target cliqueable masivo en el primer pantallazo (`reborn-hero`).
- [x] **4. WhatsApp Flotante**: Iconografía SVG ligera renderizada por fuera del flujo del documento (`z-index: 1000`, `position: fixed`) visible permanentemente para captación conversacional global.
- [x] **5. Social Proof (Prueba Social)**: Importación e hidratación de componentes `<TrustSignalsV6 />` y `<GoogleReviewsV6 />` completada con datos de fallbacks y reseñas explícitas.
- [x] **6. Cero Datos Demo (0% Placeholder)**: Exhaustiva limpieza de textos en blanco (`""`) en `home.json`. Textos como "Lorem ipsum" descartados enteramente del renderizado.
- [x] **7. HTTPS / Protocolo Seguro**: Headers estáticos en `index.php` configurados para rechazar fallback local a HTTP desnudo (`Strict-Transport-Security`).
- [x] **8. Core Web Vitals (Pintura Primaria)**: Precarga nativa en `PublicShellV6.astro` activa con prioridades `fetchpriority="high"` e imágenes en `<picture>` con orígenes `.webp`.
- [x] **9. Accesibilidad y Semántica**: Etiquetas `aria-label="Escríbenos por WhatsApp"` integradas; botón back-to-top accesible; navegación estructurada bajo `<header>` y `<main>`.
- [x] **10. Responsive Design Adaptable**: Comportamiento adaptado vía media queries (`@media (max-width: 768px)`) ajustado para botones CTA touch-friendly (ej. 48x48 área de tap).

**Estatus Actual:** TOTALMENTE LISTO PARA PRODUCCIÓN (10/10)
