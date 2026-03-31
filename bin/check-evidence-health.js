#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VERIFICATION_DIR = path.resolve(__dirname, '../verification');
const GOVERNANCE_DIR = path.resolve(__dirname, '../governance');
const REPORT_FILE = path.join(GOVERNANCE_DIR, 'evidence-debt-report.md');
const JSON_FILE = path.join(GOVERNANCE_DIR, 'evidence-health.json');

const REASONS = [
    'missing_refs',
    'missing_expected_file',
    'noncanonical_ref',
    'reconstructed_evidence'
];

function scanDirectory(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'chrome-profile') continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            scanDirectory(filePath, fileList);
        } else if (filePath.endsWith('.md')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

function classifyEvidence() {
    const mdFiles = scanDirectory(VERIFICATION_DIR);
    const counts = {
        missing_refs: 0,
        missing_expected_file: 0,
        noncanonical_ref: 0,
        reconstructed_evidence: 0
    };
    const criticalList = [];

    for (const file of mdFiles) {
        const content = fs.readFileSync(file, 'utf8');
        let fileHasCritical = false;
        let reasonsInFile = [];

        for (const reason of REASONS) {
            if (content.includes(reason)) {
                counts[reason]++;
                reasonsInFile.push(reason);
                fileHasCritical = true;
            }
        }
        
        if (fileHasCritical) {
            criticalList.push({
                file: path.relative(VERIFICATION_DIR, file),
                reasons: reasonsInFile
            });
        }
    }
    
    // Sort critical list by number of reasons descending
    criticalList.sort((a, b) => b.reasons.length - a.reasons.length);
    const top5 = criticalList.slice(0, 5);

    return { counts, top5, totalCritical: criticalList.length };
}

function generateReport(data) {
    let md = `# Evidence Debt Report\n\n`;
    md += `## Resumen de razones\n`;
    for (const [reason, count] of Object.entries(data.counts)) {
        md += `- **${reason}**: ${count}\n`;
    }
    md += `\n## Top 5 más críticos\n`;
    if (data.top5.length === 0) {
        md += `*No hay deuda evidente.*\n`;
    } else {
        data.top5.forEach((item, index) => {
            md += `${index + 1}. \`${item.file}\` (${item.reasons.join(', ')})\n`;
        });
    }
    return md;
}

function main() {
    if (!fs.existsSync(GOVERNANCE_DIR)) {
        fs.mkdirSync(GOVERNANCE_DIR, { recursive: true });
    }

    const data = classifyEvidence();
    
    fs.writeFileSync(JSON_FILE, JSON.stringify(data, null, 2));
    fs.writeFileSync(REPORT_FILE, generateReport(data));

    const asJson = process.argv.includes('--json');
    if (asJson) {
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log(`Evidence debt checked. Reconstructed: ${data.counts.reconstructed_evidence}`);
    }

    if (data.counts.reconstructed_evidence > 25) {
        if (!asJson) console.error("ERROR: reconstructed_evidence > 25");
        process.exit(1);
    } else if (data.counts.reconstructed_evidence > 10) {
        if (!asJson) console.warn("WARNING: reconstructed_evidence > 10");
        process.exit(0); // Exit 0 because it's only a warning, doesn't fail the audit
    }
    process.exit(0);
}

main();
