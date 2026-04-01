const fs = require('fs');
const file = 'es/blog/como-elegir-dermatologo-quito/index.html';
let content = fs.readFileSync(file, 'utf8');

// 1. Inject schema
content = content.replace(
  '</title>',
  '</title><script type="application/ld+json">{"@context":"https://schema.org","@type":["Article","MedicalWebPage"],"headline":"Como elegir dermatologo en Quito | Aurora Derm","author":{"@type":"Organization","name":"Aurora Derm"},"publisher":{"@type":"Organization","name":"Aurora Derm","logo":{"@type":"ImageObject","url":"https://pielarmonia.com/favicon.ico"}}}</script>'
);

// 2. Callout Info
content = content.replace(
  '<p class="astro-3bx7s32f">Eso no significa que los procedimientos sean malos.',
  '<div class="callout callout--info"><p class="astro-3bx7s32f">Eso no significa que los procedimientos sean malos.'
);
content = content.replace(
  'paso tiene sentido ahora y no antes.</p>',
  'paso tiene sentido ahora y no antes.</p></div>'
);

// 3. Callout Warning
content = content.replace(
  '<p class="astro-3bx7s32f">Este punto suele incomodar, pero es importante.',
  '<div class="callout callout--warning"><p class="astro-3bx7s32f">Este punto suele incomodar, pero es importante.'
);
content = content.replace(
  'que todavia no deberia tomarse.</p>',
  'que todavia no deberia tomarse.</p></div>'
);

// 4. Code Block
content = content.replace(
  '<p class="astro-3bx7s32f">Por eso vale la pena llegar preparado.',
  '<div class="blog-code-container"><code>// Ejemplo de checklist mental antes de agendar:\nif (clinica.ofreceTratamientoAntesDeDiagnostico) {\n  return "Buscar otra opcion";\n} else {\n  return "Agendar evaluacion";\n}</code></div><p class="astro-3bx7s32f">Por eso vale la pena llegar preparado.'
);

// 5. Image with Caption
content = content.replace(
  '<p class="astro-3bx7s32f">Tambien deberia ser evidente que la revision fisica',
  '<figure class="blog-image-wrapper"><img src="/images/optimized/v6-clinic-team-roundtable-640.webp" alt="Revision Fisica" loading="lazy"><figcaption>La evaluacion fisica siempre debe ser guiada por la historia clinica previa.</figcaption></figure><p class="astro-3bx7s32f">Tambien deberia ser evidente que la revision fisica'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Blog modifications applied.');
