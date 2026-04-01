const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../es/servicios');
const files = execSync(`find "${rootDir}" -name "index.html"`, { encoding: 'utf8' }).split('\n').filter(Boolean);

const disclaimerHtml = ` <section class="v6-service-results-disclaimer astro-kh52o4ly" data-v6-service-results-disclaimer style="max-width:1260px;margin:18px auto 0;padding:0 clamp(16px,2vw,24px) 8px;color:rgba(219,227,237,.72);font-size:13px;line-height:1.55;text-align:center"> <p style="margin:0" class="astro-kh52o4ly">Los resultados varían. Consulte a nuestro especialista.</p> </section> `;

const disclaimerHtmlRegex = /<section class="v6-service-results-disclaimer[\s\S]*?<\/section>\s*/;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace encoded í with literal í if the block already exists
  if (content.includes('Los resultados var&iacute;an. Consulte a nuestro especialista.')) {
    content = content.replace('Los resultados var&iacute;an.', 'Los resultados varían.');
    fs.writeFileSync(file, content);
    console.log(`Fixed encoded char in ${file}`);
    continue;
  }
  
  if (!content.includes('Los resultados varían. Consulte a nuestro especialista.')) {
    // Need to inject it before <main> ends or before <footer>
    if (content.includes('</main>')) {
      content = content.replace('</main>', disclaimerHtml + '</main>');
    } else if (content.includes('<footer')) {
      content = content.replace('<footer', disclaimerHtml + '<footer');
    }
    fs.writeFileSync(file, content);
    console.log(`Injected disclaimer in ${file}`);
  }
}
