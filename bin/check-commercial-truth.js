const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROOF_LEDGER_PATH = path.join(REPO_ROOT, 'data', 'flow-os', 'proof-ledger.json');
const PUBLIC_V6_JS = path.join(REPO_ROOT, 'src', 'apps', 'astro', 'src', 'lib', 'public-v6.js');
const SOFTWARE_JSON_ES = path.join(REPO_ROOT, 'content', 'public-v6', 'es', 'software.json');
const SOFTWARE_JSON_EN = path.join(REPO_ROOT, 'content', 'public-v6', 'en', 'software.json');
const KNOWN_NATIVE_ARTIFACTS = {
    'operator': 'operador-turnos.html',
    'kiosk': 'kiosco-turnos.html',
    'sala_tv': 'sala-turnos.html'
};

const INVALID_INTERNAL_CTAS = [
    '/es/software/turnero-clinicas/pricing',
    '/es/software/turnero-clinicas/sla',
    '/es/software/turnero-clinicas/installation',
    '/admin.html',
    '/admin.html#queue',
    '/admin.html#settings',
    '/dashboard'
];

let hasViolations = false;

function logViolation(message) {
    console.error(`[check-commercial-truth] ❌ ${message}`);
    hasViolations = true;
}

function printHeader(title) {
    console.log(`\n--- ${title} ---`);
}

function checkProofLedger() {
    printHeader('Checking Proof Ledger');
    if (!fs.existsSync(PROOF_LEDGER_PATH)) {
        logViolation(`Proof ledger not found at ${PROOF_LEDGER_PATH}`);
        return;
    }
    const data = JSON.parse(fs.readFileSync(PROOF_LEDGER_PATH, 'utf-8'));
    for (const [key, claim] of Object.entries(data)) {
        if (!claim.source) logViolation(`Claim '${key}' is missing 'source'.`);
        if (!claim.captured_at) logViolation(`Claim '${key}' is missing 'captured_at'.`);
        if (!claim.status || !['live', 'stale', 'demo'].includes(claim.status)) {
            logViolation(`Claim '${key}' has invalid 'status' (live|stale|demo).`);
        }
    }
    console.log(`[check-commercial-truth] ✅ Proof ledger structure verified.`);
}

function checkReadinessBadges() {
    printHeader('Checking Readiness Badges');
    if (!fs.existsSync(PUBLIC_V6_JS)) {
        logViolation(`Public V6 JS file not found at ${PUBLIC_V6_JS}`);
        return;
    }
    
    // Check if operator/kiosk/sala_tv define readinessBadge that implies product is ready
    const v6Code = fs.readFileSync(PUBLIC_V6_JS, 'utf-8');
    
    // We expect the surface rendering to dynamically wire our badge parser
    const expectedHook = /readinessBadge:\s*getNativeAppReadinessBadge\(surface,\s*locale\)/;
    if (!expectedHook.test(v6Code)) {
        logViolation(`Native apps are not using dynamic artifact getter: getNativeAppReadinessBadge(surface, locale) is missing from public-v6.js! Hardcoded commercial promises detected.`);
    }

    console.log(`[check-commercial-truth] ✅ Readiness badges structurally verified against artifacts hook.`);
}

function checkCTAsAndPricing() {
    printHeader('Checking CTAs and Commercial Promises');
    const files = [SOFTWARE_JSON_ES, SOFTWARE_JSON_EN];
    for (const jsonFile of files) {
        if (!fs.existsSync(jsonFile)) continue;
        const content = fs.readFileSync(jsonFile, 'utf-8');
        
        INVALID_INTERNAL_CTAS.forEach(cta => {
            if (content.includes(`"${cta}"`) || content.includes(`'${cta}'`)) {
                logViolation(`[${path.basename(path.dirname(jsonFile))}] Found dead/forbidden internal routing: ${cta}`);
            }
        });

        const parsed = JSON.parse(content);
        
        // Check SLA/Pricing promises
        const forbiddenPricing = /SLA\s+garantizado|100%\s+uptime/i;
        // Check recursively inside pricing object if it exists
        if (parsed.pricing && parsed.pricing.plans) {
            parsed.pricing.plans.forEach(plan => {
                if (forbiddenPricing.test(plan.deck) || forbiddenPricing.test(plan.title)) {
                    logViolation(`[${path.basename(path.dirname(jsonFile))}] Incoherent pricing or SLA found in pricing plan: ${plan.name}`);
                }
            });
        }

        // Verify CTAs contain no empty targets
        const checkLinks = (obj) => {
            if (typeof obj === 'object' && obj !== null) {
                if (obj.href === '#' || obj.href === '') {
                    logViolation(`[${path.basename(path.dirname(jsonFile))}] Found empty CTA href in commercial layout: ${JSON.stringify(obj)}`);
                }
                if (obj.ctaHref === '#' || obj.ctaHref === '') {
                    logViolation(`[${path.basename(path.dirname(jsonFile))}] Found empty ctaHref in commercial layout: ${JSON.stringify(obj)}`);
                }
                Object.values(obj).forEach(checkLinks);
            } else if (Array.isArray(obj)) {
                obj.forEach(checkLinks);
            }
        };
        checkLinks(parsed);
    }

    console.log(`[check-commercial-truth] ✅ CTAs and Commercial Promises verified.`);
}

function run() {
    console.log('[check-commercial-truth] Starting truth gate checks...');
    checkProofLedger();
    checkReadinessBadges();
    checkCTAsAndPricing();

    if (hasViolations) {
        console.error('\n[check-commercial-truth] 🧨 Commercial Truth Gate FAILED. Fix issues above.');
        process.exit(1);
    } else {
        console.log('\n[check-commercial-truth] 🌟 All commercial surfaces passed the Truth Gate!');
        process.exit(0);
    }
}

run();
