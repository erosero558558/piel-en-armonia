const fs = require('fs');

const tasksToAdd = [
    { id: 'S9-22', verifiable: 'Verificable: ls sw.js' },
    { id: 'S9-24', verifiable: 'Verificable: grep "compliance" lib/routes.php' },
    { id: 'S10-08', verifiable: 'Verificable: grep "embarazo" data/drug-interactions.json' },
    { id: 'S10-14', verifiable: 'Verificable: grep "revoked" data/clinical_history/*' },
    { id: 'S10-19', verifiable: 'Verificable: grep "before-after" es/portal/index.html' },
    { id: 'S10-23', verifiable: 'Verificable: ls data/post-procedure/' },
    { id: 'S10-27', verifiable: 'Verificable: grep "doctor_id" data/clinical_history/*' },
    { id: 'S10-29', verifiable: 'Verificable: grep "edit_trail" controllers/ClinicalHistoryController.php' },
    { id: 'S12-03', verifiable: 'Verificable: grep "hreflang" es/index.html' },
    { id: 'S12-07', verifiable: 'Verificable: grep "review_funnel" controllers/ReviewController.php' },
    { id: 'S12-09', verifiable: 'Verificable: ls data/trust/' },
    { id: 'S12-14', verifiable: 'Verificable: grep "reviewed_by" data/medical_content/*' },
    { id: 'S12-18', verifiable: 'Verificable: grep "hesitation_signal" js/public-v6-shell.js' },
    { id: 'S12-25', verifiable: 'Verificable: grep "attribution-report" lib/routes.php' }
];

let md = fs.readFileSync('AGENTS.md', 'utf8');
let lines = md.split('\n');

for (let i = 0; i < lines.length; i++) {
    for (const task of tasksToAdd) {
        if (lines[i].includes(`**${task.id}**`) && lines[i].startsWith('- [') && !lines[i].includes('Verificable:')) {
            lines[i] = lines[i] + ' ' + task.verifiable;
            console.log("Fixed " + task.id);
        }
    }
}

fs.writeFileSync('AGENTS.md', lines.join('\n'));
