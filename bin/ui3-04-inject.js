const fs = require('fs');
const path = require('path');

function walk(dir, done) {
    let results = [];
    fs.readdir(dir, function(err, list) {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function(file) {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function(err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    if (file.endsWith('.html')) {
                        results.push(file);
                    }
                    if (!--pending) done(null, results);
                }
            });
        });
    });
}

function getOgImageForPath(filePath) {
    if (filePath.includes('/es/servicios/')) return '/images/og/og-servicios.webp';
    if (filePath.includes('/agendar') || filePath.includes('/software/')) return '/images/og/og-portal.webp';
    return '/images/og/og-home.webp';
}

walk(path.join(__dirname, '../es'), function(err, results) {
    if (err) throw err;
    let modified = 0;
    
    results.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');
        
        // Skip if already has og:image
        if (content.includes('og:image')) return;
        
        const ogImage = getOgImageForPath(file);
        const metaTag = `\n  <meta property="og:image" content="https://pielarmonia.com${ogImage}">\n</head>`;
        
        let newContent = content.replace('</head>', metaTag);
        
        if (content !== newContent) {
            fs.writeFileSync(file, newContent);
            modified++;
        }
    });
    
    console.log(`Injected og:image into ${modified} files in /es/`);
});
