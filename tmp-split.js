const fs = require('fs');

const lines = fs.readFileSync('AGENTS.md', 'utf-8').split('\n');

const header = [];
const archive = [];
const active = [];

let state = 'header'; // header, archive, active

for (const line of lines) {
    if (line.match(/^## .*Sprint 1 /) || line.match(/^### 🔴 Sprint 1 /)) {
        state = 'archive';
    } else if (line.match(/^## 🎨 Sprint UI — Fase 5/)) {
        state = 'active';
    } else if (line.match(/^## 30\. Sprint 30/)) {
        state = 'archive';
    } else if (line.match(/^## Sprint 31/)) {
        state = 'active'; // or archive depending on S31 status, let's keep it active
    } else if (line.match(/^## Sprint 32/) || line.match(/^## Sprint 33/) || line.match(/^## Sprint 34/) || line.match(/^## Sprint 35/) || line.match(/^## Sprint 36/) || line.match(/^## 35\./) || line.match(/^## 36\./)) {
        state = 'active';
    } 

    if (state === 'header') {
        header.push(line);
    } else if (state === 'archive') {
        archive.push(line);
    } else if (state === 'active') {
        active.push(line);
    }
}

if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs');
}

fs.writeFileSync('docs/BACKLOG_ARCHIVE.md', header.join('\n') + '\n' + archive.join('\n'));
fs.writeFileSync('AGENTS.md', header.join('\n') + '\n' + active.join('\n'));

console.log(`Header lines: ${header.length}`);
console.log(`Archive lines: ${archive.length}`);
console.log(`Active lines: ${active.length}`);
