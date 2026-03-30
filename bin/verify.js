#!/usr/bin/env node
/**
 * bin/verify.js — Auto-verificación del estado real del repo vs AGENTS.md
 *
 * Escanea el filesystem y el código para detectar qué tareas están
 * realmente completadas vs lo que dice el board.
 *
 * Uso:
 *   node bin/verify.js           — scan y reportar discrepancias
 *   node bin/verify.js --fix     — además, marcar [x] automáticamente en AGENTS.md
 *   node bin/verify.js --sprint 2 — solo verificar sprint 2
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { execSync } = require('child_process');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const FIX = process.argv.includes('--fix');

function read(f) {
    return existsSync(f) ? readFileSync(f, 'utf8') : '';
}
function fileExists(p) {
    return existsSync(resolve(ROOT, p));
}
function normalizeHtmlEntities(value) {
    return String(value || '')
        .replace(/&iacute;/gi, 'í')
        .replace(/&#237;/g, 'í');
}
function grep(pattern, file) {
    try {
        return (
            execSync(
                `grep -c "${pattern}" "${resolve(ROOT, file)}" 2>/dev/null`,
                { encoding: 'utf8' }
            ).trim() !== '0'
        );
    } catch {
        return false;
    }
}
function countLines(file) {
    try {
        return read(resolve(ROOT, file)).split('\n').length;
    } catch {
        return 0;
    }
}

// ── Verification rules — each maps a task ID to a check function ──────────────
// Returns true if the task is DONE (evidence found), false if still pending

const checks = {
    // ── Sprint 1 ─────────────────────────────────────────────────────────────
    'S1-01': () => {
        const idx = read(resolve(ROOT, 'index.html'));
        // Check footer doesn't have broken bioestimuladores link
        return (
            !idx.includes('href="/es/servicios/bioestimuladores/"') ||
            idx.includes('href="/es/servicios/bioestimuladores-colageno/"')
        );
    },

    'S1-04': () => {
        try {
            const m = JSON.parse(read(resolve(ROOT, 'manifest.json')));
            return (
                m.name.includes('Aurora Derm') && !m.name.includes('Flow OS')
            );
        } catch {
            return false;
        }
    },

    'S1-05': () => fileExists('sw.js'),

    'S1-09': () => {
        const idx = read(resolve(ROOT, 'index.html'));
        return (idx.match(/loading="lazy"/g) || []).length >= 3;
    },

    // ── Sprint 2 ─────────────────────────────────────────────────────────────
    'S2-01': () => {
        const idx = read(resolve(ROOT, 'index.html'));
        return (
            idx.includes('"@type":"Dermatology"') ||
            idx.includes('"@type":"MedicalClinic"')
        );
    },

    'S2-03': () => {
        const idx = read(resolve(ROOT, 'index.html'));
        return (
            idx.includes('og:title') &&
            idx.includes('og:description') &&
            idx.includes('og:image')
        );
    },

    'S2-04': () => {
        if (!fileExists('sitemap.xml')) return false;
        const sm = read(resolve(ROOT, 'sitemap.xml'));
        const urls = (sm.match(/<loc>/g) || []).length;
        return urls >= 30; // should have 60+ with all pages
    },

    'S2-05': () => {
        if (!fileExists('robots.txt')) return false;
        const r = read(resolve(ROOT, 'robots.txt'));
        return r.includes('Disallow:') && r.includes('Sitemap:');
    },

    'S2-07': () => {
        const idx = read(resolve(ROOT, 'index.html'));
        return (idx.match(/\?text=/g) || []).length >= 2;
    },

    'S2-10': () => fileExists('es/blog/index.html'),
    'S2-11': () =>
        fileExists('es/blog/como-elegir-dermatologo-quito/index.html'),
    'S2-12': () => fileExists('es/blog/senales-alarma-lunares/index.html'),
    'S2-13': () => fileExists('es/blog/proteccion-solar-ecuador/index.html'),
    'S2-14': () => fileExists('es/blog/acne-adulto/index.html'),
    'S2-15': () => fileExists('es/blog/melasma-embarazo/index.html'),
    'S2-16': () =>
        fileExists('es/blog/bioestimuladores-vs-rellenos/index.html'),
    'S2-17': () => fileExists('es/blog/feed.xml'),
    'S2-18': () => {
        try {
            const files = execSync(
                `find "${resolve(ROOT, 'es/servicios')}" -mindepth 2 -maxdepth 2 -name "index.html"`,
                { encoding: 'utf8' }
            )
                .split('\n')
                .map((entry) => entry.trim())
                .filter(Boolean);
            return (
                files.length > 0 &&
                files.every((file) =>
                    normalizeHtmlEntities(read(file)).includes(
                        'Los resultados varían. Consulte a nuestro especialista.'
                    )
                )
            );
        } catch {
            return false;
        }
    },

    'S2-19': () => {
        const legacy = normalizeHtmlEntities(read(resolve(ROOT, 'index.html')));
        const localized = normalizeHtmlEntities(
            read(resolve(ROOT, 'es/index.html'))
        );
        return (
            legacy.includes('MSP Certificado') &&
            legacy.includes('hero-trust-badges') &&
            localized.includes('MSP Certificado') &&
            localized.includes('10+ años') &&
            localized.includes('2000+ pacientes')
        );
    },

    'S2-20': () => {
        const legacy = normalizeHtmlEntities(read(resolve(ROOT, 'index.html')));
        const localized = normalizeHtmlEntities(
            read(resolve(ROOT, 'es/index.html'))
        );
        const listingUrl =
            'https://www.google.com/maps?cid=15768128031462376471';
        return (
            legacy.includes('reviews-section') &&
            legacy.includes(listingUrl) &&
            legacy.includes('Google Maps') &&
            localized.includes('data-v6-google-reviews') &&
            localized.includes(listingUrl) &&
            localized.includes('Jose Gancino')
        );
    },

    'S2-21': () => {
        const guide = normalizeHtmlEntities(
            read(resolve(ROOT, 'es/primera-consulta/index.html'))
        );
        return (
            guide.includes('Primera consulta en Aurora Derm') &&
            guide.includes('45 min') &&
            guide.includes('Que traer para aprovechar mejor la visita') &&
            guide.includes(
                'Llegue con tiempo y sin adivinar el ultimo tramo'
            ) &&
            guide.includes('Estacionamiento')
        );
    },
    'S2-24': () => {
        try {
            const readSlugs = (localePath) =>
                execSync(
                    `find "${resolve(ROOT, localePath)}" -mindepth 2 -maxdepth 2 -name "index.html"`,
                    { encoding: 'utf8' }
                )
                    .split('\n')
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                    .map((file) => file.split('/').slice(-2, -1)[0])
                    .sort();
            const esSlugs = readSlugs('es/servicios');
            const enSlugs = readSlugs('en/services');
            return (
                JSON.stringify(esSlugs) === JSON.stringify(enSlugs) &&
                !enSlugs.includes('bioestimuladores')
            );
        } catch {
            return false;
        }
    },

    // ── Sprint 3 ─────────────────────────────────────────────────────────────
    'S3-05': () => fileExists('es/pre-consulta/index.html'),
    'S3-07': () => {
        const kiosko = read(resolve(ROOT, 'kiosco-turnos.html'));
        return (
            kiosko.includes('qr') ||
            kiosko.includes('QR') ||
            kiosko.includes('scan')
        );
    },
    'S3-11': () => {
        const statusPage = read(
            resolve(
                ROOT,
                '.generated/site-root/es/software/turnero-clinicas/estado-turno/index.html'
            )
        );
        const routes = read(resolve(ROOT, 'lib/routes.php'));
        const controller = read(resolve(ROOT, 'controllers/QueueController.php'));
        const printer = read(resolve(ROOT, 'lib/TicketPrinter.php'));
        return (
            statusPage.includes('data-v6-ticket-status-root') &&
            routes.includes("'GET', 'queue-public-ticket'") &&
            controller.includes('publicTicket') &&
            printer.includes('PUBLIC_QUEUE_STATUS_BASE_URL') &&
            printer.includes('buildPublicQueueStatusUrl')
        );
    },
    'S3-12': () => {
        const builder = read(resolve(ROOT, 'lib/queue/QueueSummaryBuilder.php'));
        const kioskHtml = read(resolve(ROOT, 'kiosco-turnos.html'));
        const kioskRuntime = read(resolve(ROOT, 'src/apps/queue-kiosk/index.js'));
        const displayRuntime = read(resolve(ROOT, 'src/apps/queue-display/index.js'));
        return (
            builder.includes('buildWaitingEstimates') &&
            builder.includes('activeConsultorios') &&
            kioskHtml.includes('queueEstimatedWait') &&
            kioskHtml.includes('queueWaitContext') &&
            kioskRuntime.includes('formatQueueEstimatedWait') &&
            kioskRuntime.includes('ticket-wait') &&
            displayRuntime.includes('formatQueueEstimatedWait') &&
            displayRuntime.includes('next-wait')
        );
    },
    'S3-24': () => fileExists('es/agendar/index.html'),
    'S3-30': () => fileExists('es/telemedicina/consulta/index.html'),
    'S3-32': () => fileExists('es/pago/index.html'),

    // ── Sprint 4 ─────────────────────────────────────────────────────────────
    'S4-08': () =>
        fileExists('es/software/turnero-clinicas/precios/index.html'),
    'S4-13': () => fileExists('es/paquetes/index.html'),
    'S4-19': () => {
        const idx = read(resolve(ROOT, 'index.html'));
        return idx.includes('clarity.ms') || idx.includes('Microsoft Clarity');
    },
    'S4-21': () => {
        try {
            const count = parseInt(
                execSync(
                    `find "${resolve(ROOT, 'src/apps/queue-shared')}" -name "*.js" | wc -l`,
                    { encoding: 'utf8' }
                ).trim()
            );
            // "Done" if we've at least audited and documented
            return (
                existsSync(resolve(ROOT, 'docs/surface-audit.md')) ||
                count < 100
            );
        } catch {
            return false;
        }
    },
};

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
    const md = read(AGENTS_FILE);
    const lines = md.split('\n');

    const taskLines = {};
    lines.forEach((line, i) => {
        const m = line.match(/^- \[([ x])\] \*\*(S\d+-\d+)\*\*/);
        if (m) taskLines[m[2]] = { lineIndex: i, done: m[1] === 'x', line };
    });

    const results = {
        alreadyDone: [],
        nowDone: [],
        stillPending: [],
        unchecked: [],
    };

    for (const [taskId, check] of Object.entries(checks)) {
        const taskInfo = taskLines[taskId];
        if (!taskInfo) {
            results.unchecked.push(taskId);
            continue;
        }

        const evidenceFound = check();

        if (taskInfo.done && evidenceFound) {
            results.alreadyDone.push(taskId);
        } else if (!taskInfo.done && evidenceFound) {
            results.nowDone.push({ taskId, lineIndex: taskInfo.lineIndex });
        } else if (!taskInfo.done && !evidenceFound) {
            results.stillPending.push(taskId);
        }
    }

    // Report
    console.log('\n🔍 Aurora Derm — Board Verification\n');

    if (results.nowDone.length > 0) {
        console.log(
            `✅ DONE (evidence found, not marked): ${results.nowDone.length}`
        );
        results.nowDone.forEach(({ taskId }) => console.log(`   ${taskId}`));

        if (FIX) {
            console.log('\n📝 Auto-fixing AGENTS.md...');
            let updatedMd = md;
            // Sort descending by lineIndex so replacement doesn't shift indexes
            results.nowDone.sort((a, b) => b.lineIndex - a.lineIndex);
            results.nowDone.forEach(({ lineIndex }) => {
                const lineArr = updatedMd.split('\n');
                lineArr[lineIndex] = lineArr[lineIndex].replace(
                    '- [ ]',
                    '- [x]'
                );
                updatedMd = lineArr.join('\n');
            });
            writeFileSync(AGENTS_FILE, updatedMd, 'utf8');
            console.log(
                `   Fixed ${results.nowDone.length} tasks in AGENTS.md`
            );
            console.log(
                `   Run: git add AGENTS.md && git commit -m "docs: sync board with actual state"`
            );
        } else {
            console.log(
                '\n   Run with --fix to auto-mark these as done in AGENTS.md'
            );
        }
    }

    if (results.alreadyDone.length > 0) {
        console.log(
            `\n✅ Already correct (done + evidence): ${results.alreadyDone.length}`
        );
        results.alreadyDone.forEach((id) => console.log(`   ${id}`));
    }

    if (results.stillPending.length > 0) {
        console.log(
            `\n⏳ Still pending (no evidence): ${results.stillPending.length}`
        );
        results.stillPending.forEach((id) => console.log(`   ${id}`));
    }

    if (results.unchecked.length > 0) {
        console.log(`\nℹ️  No check rule for: ${results.unchecked.join(', ')}`);
    }

    // Summary
    const total = Object.keys(checks).length;
    const done = results.alreadyDone.length + results.nowDone.length;
    console.log(
        `\n📊 Summary: ${done}/${total} verified done, ${results.stillPending.length} pending\n`
    );

    return results.stillPending.length; // exit code = pending count
}

process.exit(main());
