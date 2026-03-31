const fs = require('node:fs');
const path = require('node:path');

const STATUS_DOC = path.resolve(__dirname, '../docs/PRODUCT_OPERATIONAL_STATUS.md');
const SOFTWARE_JSON_ES = path.resolve(__dirname, '../content/public-v6/es/software.json');
const SOFTWARE_JSON_EN = path.resolve(__dirname, '../content/public-v6/en/software.json');

const FORBIDDEN_IF_RED = [
    /piloto\s+(listo|pagado)/i,
    /primer\s+despliegue/i,
    /despliegue\s+activo/i,
    /empieza\s+ya/i,
    /instalaci[oó]n\s+inmediata/i,
    /SLA\s+garantizado/i,
    /operaci[oó]n\s+inmediata/i,
    /paid\s+pilot/i,
    /first\s+deployment/i,
    /active\s+deployment/i,
    /start\s+now/i,
    /immediate\s+installation/i,
    /guaranteed\s+SLA/i,
    /read[y|iness]\s+(to|for)\s+deploy/i,
];

function getOperationalStatus() {
    if (!fs.existsSync(STATUS_DOC)) {
        return 'UNKNOWN';
    }
    const content = fs.readFileSync(STATUS_DOC, 'utf-8');
    const match = content.match(/-\s*Estado\s+actual:\s*`?(RED|YELLOW|GREEN)`?/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
}

function checkContent(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`[commercial-readiness] Document not found: ${filePath}`);
        return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const violations = [];

    FORBIDDEN_IF_RED.forEach((regex) => {
        const match = content.match(regex);
        if (match) {
            violations.push(`Found forbidden phrase "${match[0]}"`);
        }
    });

    return violations;
}

function run() {
    const status = getOperationalStatus();
    console.log(`[commercial-readiness] Current operational status: ${status}`);

    if (status !== 'RED') {
        console.log(`[commercial-readiness] Status is not RED. Commercial claims check bypassed.`);
        process.exit(0);
    }

    let hasViolations = false;

    [SOFTWARE_JSON_ES, SOFTWARE_JSON_EN].forEach((file) => {
        const violations = checkContent(file);
        if (violations.length > 0) {
            console.error(`[commercial-readiness] 🧨 VIOLATION in ${path.basename(path.dirname(file))}/${path.basename(file)}:`);
            violations.forEach((v) => console.error(`   - ${v}`));
            hasViolations = true;
        }
    });

    if (hasViolations) {
        console.error('\n[commercial-readiness] ❌ B2B commercial surfaces must degrade promises to "waitlist", "demo exploratoria" or similar when status is RED.');
        process.exit(1);
    }

    console.log('[commercial-readiness] ✅ All commercial promises have been successfully degraded for RED status.');
    process.exit(0);
}

run();
