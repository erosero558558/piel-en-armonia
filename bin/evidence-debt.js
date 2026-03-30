#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = resolve(__dirname, '..');
const VERIFICATION_DIR = path.join(ROOT, 'verification');
const GOVERNANCE_DIR = path.join(ROOT, 'governance');
const REPORT_FILE = path.join(GOVERNANCE_DIR, 'evidence-debt-report.md');

const ERRORS_TO_TRACK = [
    'missing_refs',
    'missing_expected_file',
    'noncanonical_ref',
    'reconstructed_evidence'
];

function resolve(...args) {
    return path.resolve(...args);
}

function walkSync(dir, filelist = []) {
    if (!fs.existsSync(dir)) return filelist;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            filelist = walkSync(filepath, filelist);
        } else {
            if (filepath.endsWith('.md') || filepath.endsWith('.json')) {
                filelist.push(filepath);
            }
        }
    }
    return filelist;
}

function analyzeEvidence() {
    const files = walkSync(VERIFICATION_DIR);
    
    const counts = {
        missing_refs: 0,
        missing_expected_file: 0,
        noncanonical_ref: 0,
        reconstructed_evidence: 0
    };

    const fileScores = [];

    for (const file of files) {
        const relativePath = path.relative(ROOT, file);
        try {
            const content = fs.readFileSync(file, 'utf8');
            let matched = false;
            let score = 0;
            const fileMatches = {
                missing_refs: 0,
                missing_expected_file: 0,
                noncanonical_ref: 0,
                reconstructed_evidence: 0
            };

            for (const key of ERRORS_TO_TRACK) {
                // regex that matches string occurrences
                const regex = new RegExp(key, 'g');
                const matches = content.match(regex);
                if (matches && matches.length > 0) {
                    counts[key] += matches.length;
                    fileMatches[key] += matches.length;
                    score += matches.length;
                    matched = true;
                }
            }

            if (matched) {
                fileScores.push({ file: relativePath, score, details: fileMatches });
            }
        } catch (e) {
            // ignore unreadable files
        }
    }

    fileScores.sort((a, b) => b.score - a.score);
    const topFiles = fileScores.slice(0, 5);

    return { counts, topFiles, totalFilesScanned: files.length };
}

function generateReport(report) {
    if (!fs.existsSync(GOVERNANCE_DIR)) {
        fs.mkdirSync(GOVERNANCE_DIR, { recursive: true });
    }

    const rows = ERRORS_TO_TRACK.map(reason => {
        return `| \`${reason}\` | **${report.counts[reason]}** |`;
    });

    const topRows = report.topFiles.map((f, i) => {
        const details = Object.entries(f.details)
            .filter(([_, count]) => count > 0)
            .map(([k, c]) => `${k}:${c}`)
            .join(', ');
        return `| ${i + 1} | \`${f.file}\` | ${f.score} | _${details}_ |`;
    });

    const markdown = `# 📉 Evidence Debt Report

**Date generated:** ${new Date().toISOString()}
**Total files scanned:** ${report.totalFilesScanned}

## 📊 Summary by Reason

| Reason | Count |
|--------|-------|
${rows.join('\n')}

---

## 🔥 Top 5 Critical Artifacts
These artifacts have the highest concentration of evidence debt annotations.

| Rank | File | Total Debt Score | Breakdown |
|------|------|------------------|-----------|
${topRows.length > 0 ? topRows.join('\n') : '| - | No debts found! 🎉 | 0 | - |'}

`;

    fs.writeFileSync(REPORT_FILE, markdown, 'utf8');
}

function main() {
    const report = analyzeEvidence();
    generateReport(report);

    let isJson = process.argv.includes('--json');
    const reconstCount = report.counts.reconstructed_evidence;

    let exitCode = 0;
    let warning = false;

    if (reconstCount > 25) {
        exitCode = 1;
    } else if (reconstCount > 10) {
        warning = true;
    }

    if (isJson) {
        console.log(JSON.stringify({
            ok: exitCode === 0,
            warning,
            metric: reconstCount,
            ...report
        }, null, 2));
    } else {
        if (exitCode === 1) {
            console.error(`🚨 ERROR: reconstructed_evidence limit exceeded. Value is ${reconstCount} (Max allowed: 25)`);
        } else if (warning) {
            console.warn(`⚠️  WARNING: reconstructed_evidence is high (${reconstCount}). Threshold is 10.`);
        } else {
            console.log(`✅ Evidence debt within healthy limits (reconstructed_evidence: ${reconstCount}).`);
        }
        console.log(`Report generated at: ${REPORT_FILE}`);
    }

    process.exit(exitCode);
}

if (require.main === module) {
    main();
}

module.exports = {
    analyzeEvidence,
    generateReport
};
