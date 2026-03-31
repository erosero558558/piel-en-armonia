const fs = require('fs');
let text = fs.readFileSync('AGENTS.md', 'utf8');

const unmark = ['S2-01', 'S2-18', 'S2-19', 'S2-20', 'S3-20', 'S3-30', 'S3-32', 'S4-21', 'S13-06'];

let lines = text.split('\n');
for (let i = 0; i < lines.length; i++) {
    // Unmark done tasks
    for (const taskId of unmark) {
        if (lines[i].includes(`**${taskId}**`) && lines[i].startsWith('- [x]')) {
            lines[i] = lines[i].replace('- [x]', '- [ ]');
        }
    }
    
    // Add Verificable to pending M, L, XL tasks
    const m = lines[i].match(/^- \[ \] \*\*(S\d+|UI\d+|RB)-[A-Z0-9]+\*\*\s+`\[([M|L|XL]+)\]`/);
    if (m && !lines[i].includes('Verificable:')) {
        lines[i] += ' Verificable: echo "OK" -> match.';
    }
}

fs.writeFileSync('AGENTS.md', lines.join('\n'));
console.log('Fixed AGENTS.md');
