const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'es', 'servicios');

function getAllHtmlFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
            arrayOfFiles = getAllHtmlFiles(path.join(dirPath, file), arrayOfFiles);
        } else {
            if (file === 'index.html' && dirPath !== dir) {
                arrayOfFiles.push(path.join(dirPath, file));
            }
        }
    });

    return arrayOfFiles;
}

const htmlFiles = getAllHtmlFiles(dir);

htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const serviceName = path.basename(path.dirname(file));

    // Remove existing review sections if any exist
    content = content.replace(/<section id="reviews".*?>[\s\S]*?<\/section>/gi, '');
    content = content.replace(/<div class="dynamic-reviews".*?>[\s\S]*?<\/div>/gi, '');

    const widget = `
        <section id="reviews" class="service-section">
          <div class="dynamic-reviews" data-service="${serviceName}"></div>
        </section>
`;

    if (content.includes('<section id="faq"')) {
        content = content.replace(/<section id="faq"/, widget + '        <section id="faq"');
    } else {
        content = content.replace(/<\/article>/, widget + '\n      </article>');
    }

    if (!content.includes('dynamic-reviews.js')) {
        content = content.replace('</body>', '<script src="/js/dynamic-reviews.js" defer></script>\n</body>');
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Migrated: ${file} (service: ${serviceName})`);
});

console.log("Migration complete!");
