const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');
const broken = [];

for (const k in pkg.scripts) {
    const cmd = pkg.scripts[k];
    if (cmd.includes('node bin/')) {
        const parts = cmd.split('node ');
        if (parts.length > 1) {
            let scriptPath = parts[1].split(' ')[0];
            if (!fs.existsSync(path.resolve(__dirname, scriptPath))) {
                broken.push(k);
            }
        }
    }
}
console.log(JSON.stringify(broken, null, 2));
process.exit(0);
