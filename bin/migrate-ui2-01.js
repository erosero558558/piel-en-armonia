const fs = require('fs');
const path = require('path');

const SERVICIOS_DIR = path.join(__dirname, '..', 'es', 'servicios');
const EXCLUDE_FILES = ['laser-dermatologico', 'index.html'];

function getAllIndexHtmls(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach((file) => {
    // If it's a directory
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      // Don't recurse if excluded directory name (like laser-dermatologico)
      if (EXCLUDE_FILES.includes(file)) return;
      results = results.concat(getAllIndexHtmls(fullPath));
    } else {
      // If it's index.html
      if (file === 'index.html' && dir !== SERVICIOS_DIR) {
        results.push(fullPath);
      }
    }
  });

  return results;
}

function extractMetadata(htmlContent) {
  let title = 'Aurora Derm';
  let metaDesc = 'Atención médica en Aurora Derm';
  let h1 = 'Servicio Quirúrgico';
  let ogImage = '/images/optimized/v6-clinic-laser-dermatologico.webp';
  
  const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
  if (titleMatch) title = titleMatch[1];

  const metaDescMatch = htmlContent.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);
  if (metaDescMatch) metaDesc = metaDescMatch[1];

  const h1Match = htmlContent.match(/<h1>(.*?)<\/h1>/);
  if (h1Match) h1 = h1Match[1];
  
  const ogImageMatch = htmlContent.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/);
  if (ogImageMatch) {
    const url = new URL(ogImageMatch[1]);
    ogImage = url.pathname;
    // ensure using webp
    ogImage = ogImage.replace('.jpg', '.webp');
  }

  // extract category from `og:url`
  let category = "Tratamiento Dermatológico";
  const catMatch = htmlContent.match(/<strong[^>]*v6-service-hero-shell__category[^>]*>(.*?)<\/strong>/);
  if(catMatch) category = catMatch[1];

  return { title, metaDesc, h1, ogImage, category };
}

function generateNewTemplate(meta) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title} | Aurora Derm (UI-06 Template)</title>
  <meta name="description" content="${meta.metaDesc}">
  <link rel="icon" href="/images/icon-192.png">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="/styles/tokens.css">
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/components.css">
  <link rel="stylesheet" href="/styles/aurora-public.css">
  <link rel="stylesheet" href="/styles/aurora-service.css">

  <meta property="og:image" content="https://pielarmonia.com${meta.ogImage}">
</head>
<body data-theme="public">

<nav class="navbar-glass">
  <div class="brand-clinical">
    <div class="brand-dot"></div>
    Aurora Derm
  </div>
  <div class="nav-desktop-links">
    <a href="/es/servicios/acne-rosacea/index.html">Acné y Rosácea</a>
    <a href="/es/servicios/laser-dermatologico/index.html">Láser Dermatológico</a>
    <a href="/es/servicios/bioestimuladores-colageno/index.html">Bioestimuladores</a>
  </div>
  <div class="nav-actions">
    <a href="/es/software/turnero-clinicas/dashboard/index.html" class="btn-ghost">Portal Pacientes</a>
    <a href="https://wa.me/593982453672" class="btn-primary" target="_blank" rel="noopener">Contactar Clínica</a>
    <!-- Mobile toggle -->
    <button class="menu-toggle" id="navHamburger" aria-label="Menú"><span></span><span></span><span></span></button>
  </div>
</nav>

<div class="mobile-drawer" id="mobileDrawer">
  <a href="/es/servicios/acne-rosacea/index.html">Acné y Rosácea</a>
  <a href="/es/servicios/laser-dermatologico/index.html">Láser Dermatológico</a>
  <a href="/es/servicios/teledermatologia/index.html">Teledermatología</a>
  <a href="/es/servicios/bioestimuladores-colageno/index.html">Bioestimuladores</a>
  <a href="https://wa.me/593982453672" class="btn-primary" style="margin-top: auto; display:block;">Agenda tu cita por WhatsApp</a>
</div>

<main id="main-content">
  <!-- UI-06: Clinical Service Hero -->
  <header class="service-hero">
    <div class="service-hero-content">
      <span class="badge badge-warning">${meta.category}</span>
      <h1>${meta.h1}</h1>
      <p class="service-hero-lead">${meta.metaDesc}</p>
    </div>
    <div class="service-hero-visual">
       <img src="${meta.ogImage}" alt="${meta.h1} Aurora Derm">
       <div class="expected-outcome-badge">
          <strong>Evaluación Clínica</strong>
          <span>[ Expectativa Médica ]</span>
       </div>
    </div>
  </header>

  <div class="service-body">
    <div class="container service-main-grid">
      
      <!-- Left Rail (Sticky Navigation desktop) -->
      <aside class="service-rail">
        <nav class="service-rail-nav">
          <a href="#que-revisamos" class="active">Qué se revisa primero</a>
          <a href="#como-avanza">Cómo avanza (El Proceso)</a>
          <a href="#faq">Dudas Frecuentes</a>
        </nav>
        
        <div class="card" style="margin-top: var(--space-8);">
          <h3 style="font-size: var(--text-lg); margin-bottom: var(--space-2);">Decida con certeza</h3>
          <p style="font-size: var(--text-sm); color: var(--pub-text-muted); margin-bottom: var(--space-4);">No inicie tratamientos sin entender primero por qué los necesita su piel.</p>
          <a href="https://wa.me/593982453672" class="btn-primary" style="width: 100%; display: block; text-align: center;">Agendar por WhatsApp</a>
        </div>
      </aside>

      <!-- Main Content (2/3 width) -->
      <article class="service-content">
        
        <section id="que-revisamos" class="service-section">
          <h2>Qué revisamos primero</h2>
          <p>La evaluación clínica inicial es indispensable para no recetar procedimientos innecesarios. Revisamos el historial, alergias, fototipo y estado de la barrera cutánea antes de proponer esta ruta.</p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-6);">
            <div class="card" style="background: var(--pub-bg-base);">
              <strong>01.</strong><br>
              <span style="font-size: var(--text-sm); font-weight: 600;">Diagnóstico Diferencial</span>
            </div>
            <div class="card" style="background: var(--pub-bg-base);">
              <strong>02.</strong><br>
              <span style="font-size: var(--text-sm); font-weight: 600;">Lectura de Fototipo</span>
            </div>
            <div class="card" style="background: var(--pub-bg-base);">
              <strong>03.</strong><br>
              <span style="font-size: var(--text-sm); font-weight: 600;">Plan Terapéutico Claro</span>
            </div>
            <div class="card" style="background: var(--pub-bg-base);">
              <strong>04.</strong><br>
              <span style="font-size: var(--text-sm); font-weight: 600;">Fotoprotección</span>
            </div>
          </div>
        </section>

        <section id="como-avanza" class="service-section">
          <h2>Cómo avanza</h2>
          <p>Seguimos protocolos transparentes para cada fase de su tratamiento, informándole desde el día uno cómo será la recuperación y evolución.</p>
          
          <div class="service-process">
            <div class="service-step">
              <span class="step-number">Etapa — 01</span>
              <h3>Valoración Médica</h3>
              <p style="font-size: var(--text-md); color: var(--pub-text-muted);">Confirmamos la indicación terapéutica y ajustamos la expectativa de resultados.</p>
            </div>
            <div class="service-step">
              <span class="step-number">Etapa — 02</span>
              <h3>Ejecución Clínica</h3>
              <p style="font-size: var(--text-md); color: var(--pub-text-muted);">El especialista conduce el procedimiento garantizando control aséptico y parámetros precisos.</p>
            </div>
            <div class="service-step">
              <span class="step-number">Etapa — 03</span>
              <h3>Control y Seguimiento</h3>
              <p style="font-size: var(--text-md); color: var(--pub-text-muted);">Nos aseguramos de que su piel cure o reaccione como está previsto en la literatura médica.</p>
            </div>
          </div>
        </section>

        <section id="faq" class="service-section">
          <h2>Dudas frecuentes</h2>
          
          <details class="service-faq">
            <summary>¿Cuánto tiempo demoran los resultados?</summary>
            <div class="faq-body">Eso depende estríctamente de su anatomía, tipo de piel (fototipo) y capacidad de regeneración celular. El especialista le dará un cronograma muy realista en la primera cita.</div>
          </details>
          <details class="service-faq">
            <summary>¿Qué cuidados debo tener en casa?</summary>
            <div class="faq-body">Toda la asesoría e indicaciones se detallan posibilitando la correcta evolución. Por regla general: no exponer la zona a fricción excesiva ni automedicarse con cremas ácidas no recetadas en esos días. Y protección solar.</div>
          </details>
          <details class="service-faq">
            <summary>¿Cuándo agendar mi control?</summary>
            <div class="faq-body">Nuestro equipo u el doctor mismo le agendarán o indicarán la ventana de fechas apropiada para que vuelva al consultorio. Normalmente oscila entre los 20-30 días post-alta para la mayoría de los casos.</div>
          </details>

        </section>
      </article>

    </div>
  </div>

  <div class="service-mobile-cta">
    <div class="service-mobile-cta-info">
      <strong>${meta.h1}</strong>
      <span>Inicie evaluación</span>
    </div>
    <a href="https://wa.me/593982453672" class="btn-primary">WhatsApp</a>
  </div>

</main>

<footer class="site-footer container">
  <div class="footer-grid reveal">
    <div class="footer-brand">
      <h3>Aurora Derm</h3>
      <p>Dermatología que le explica cómo sanar y qué esperar, sin vueltas innecesarias ni presión comercial. Quito, Ecuador.</p>
    </div>
    <nav>
      <h4>Servicios</h4>
      <a href="/es/servicios/acne-rosacea/index.html">Acné y Rosácea</a>
      <a href="/es/servicios/laser-dermatologico/index.html">Láser Dermatológico</a>
      <a href="/es/servicios/bioestimuladores-colageno/index.html">Bioestimuladores</a>
    </nav>
    <nav>
      <h4>Legal</h4>
      <a href="/es/legal/aviso-medico/index.html">Aviso Médico</a>
      <a href="/es/legal/privacidad/index.html">Privacidad</a>
      <a href="/es/legal/terminos/index.html">Términos</a>
    </nav>
    <div class="footer-contact">
      <h4>Contacto</h4>
      <p>Av. República de El Salvador, Quito, Ecuador</p>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy; 2026 Aurora Derm — Quito, Ecuador</p>
    <p>Información de carácter médico. Consulte siempre a un especialista.</p>
  </div>
</footer>

<script>
  // Simple Mobile menu toggle logic
  const hamburger = document.getElementById('navHamburger');
  const drawer = document.getElementById('mobileDrawer');
  
  if(hamburger && drawer) {
    hamburger.addEventListener('click', () => {
      drawer.classList.toggle('open');
    });
  }
</script>

</body>
</html>`;
}

console.log("Starting Migration UI2-01...");
const allHtmls = getAllIndexHtmls(SERVICIOS_DIR);
console.log(`Found ${allHtmls.length} html files to process`);

allHtmls.forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const metadata = extractMetadata(content);
  
  const newHtml = generateNewTemplate(metadata);
  fs.writeFileSync(filePath, newHtml, 'utf-8');
  console.log(`Updated => ${filePath} (${metadata.h1})`);
});
console.log("Migration finished.");
