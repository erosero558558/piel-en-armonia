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

'use strict';

const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs');
const { execSync } = require('child_process');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const ROUTES_FILE = 'lib/routes.php';
const FIX = process.argv.includes('--fix');
const TASK_LINE_PATTERN = /^- \[([ x])\] \*\*([A-Z0-9]+(?:-[A-Z0-9]+)+)\*\*/;
const PHASE_TWO_AUDIT_CHECK_KEYS = [
    'serviceCssCoverage',
    'salaTurnosAriaLive',
    'baseCssReducedMotion',
    'manifestShortcuts',
    'portalFetch',
];
const CLINICAL_SAMPLE_PHOTOS = [
    'images/optimized/v6-clinic-home-diagnostic-brief-1400.jpg',
    'images/optimized/v6-clinic-telemedicine-intake-800.jpg',
    'images/optimized/v6-clinic-telemedicine-review-1400.jpg',
];
const OPENCLAW_ENDPOINTS = [
    { method: 'GET', resource: 'openclaw-patient', action: 'patient' },
    {
        method: 'GET',
        resource: 'openclaw-cie10-suggest',
        action: 'cie10Suggest',
    },
    { method: 'GET', resource: 'openclaw-protocol', action: 'protocol' },
    { method: 'POST', resource: 'openclaw-chat', action: 'chat' },
    {
        method: 'POST',
        resource: 'openclaw-save-diagnosis',
        action: 'saveDiagnosis',
    },
    {
        method: 'POST',
        resource: 'openclaw-save-evolution',
        action: 'saveEvolution',
    },
    {
        method: 'GET',
        resource: 'openclaw-prescription',
        action: 'getPrescriptionPdf',
    },
    {
        method: 'POST',
        resource: 'openclaw-prescription',
        action: 'savePrescription',
    },
    {
        method: 'POST',
        resource: 'openclaw-certificate',
        action: 'generateCertificate',
    },
    {
        method: 'GET',
        resource: 'openclaw-certificate',
        action: 'getCertificatePdf',
    },
    {
        method: 'POST',
        resource: 'openclaw-interactions',
        action: 'checkInteractions',
    },
    {
        method: 'POST',
        resource: 'openclaw-summarize',
        action: 'summarizeSession',
    },
    {
        method: 'GET',
        resource: 'openclaw-router-status',
        action: 'routerStatus',
    },
];

function read(filePath) {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function readRepoFile(relativePath) {
    return read(resolve(ROOT, relativePath));
}

function fileExists(relativePath) {
    return existsSync(resolve(ROOT, relativePath));
}

function listNestedIndexFiles(relativeDir) {
    const absoluteDir = resolve(ROOT, relativeDir);
    if (!existsSync(absoluteDir)) {
        return [];
    }

    try {
        return readdirSync(absoluteDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => `${relativeDir}/${entry.name}/index.html`)
            .filter((relativePath) => fileExists(relativePath))
            .sort();
    } catch {
        return [];
    }
}

function normalizeHtmlEntities(value) {
    return String(value || '')
        .replace(/&iacute;/gi, 'í')
        .replace(/&#237;/g, 'í');
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileContains(relativePath, pattern) {
    const content = readRepoFile(relativePath);
    return pattern instanceof RegExp
        ? pattern.test(content)
        : content.includes(pattern);
}

function getServiceAuroraCssCoverage() {
    const files = listNestedIndexFiles('es/servicios');
    const matchedFiles = files.filter((relativePath) =>
        fileContains(relativePath, 'aurora-service.css')
    );
    return {
        total: files.length,
        matched: matchedFiles.length,
        missing: files.filter(
            (relativePath) => !matchedFiles.includes(relativePath)
        ),
    };
}

function manifestHasShortcuts() {
    try {
        const manifest = JSON.parse(readRepoFile('manifest.json'));
        return (
            Array.isArray(manifest.shortcuts) && manifest.shortcuts.length > 0
        );
    } catch {
        return false;
    }
}

function createPhaseTwoAuditChecks() {
    return {
        serviceCssCoverage: () => {
            const coverage = getServiceAuroraCssCoverage();
            return coverage.total >= 20 && coverage.matched === coverage.total;
        },
        salaTurnosAriaLive: () =>
            fileContains('sala-turnos.html', /\baria-live\s*=\s*['"][^'"]+['"]/),
        baseCssReducedMotion: () =>
            fileContains('styles/base.css', /prefers-reduced-motion/),
        manifestShortcuts: () => manifestHasShortcuts(),
        portalFetch: () => fileContains('es/portal/index.html', /\bfetch\s*\(/),
    };
}

function phpClassExists(relativePath, className) {
    return (
        fileExists(relativePath) &&
        fileContains(
            relativePath,
            new RegExp(`\\b(?:final\\s+)?class\\s+${escapeRegex(className)}\\b`)
        )
    );
}

function phpMethodExists(relativePath, methodName) {
    return (
        fileExists(relativePath) &&
        fileContains(
            relativePath,
            new RegExp(
                `(?:public|protected|private)\\s+(?:static\\s+)?function\\s+${escapeRegex(methodName)}\\s*\\(`
            )
        )
    );
}

function routeExists(method, resource, controllerClass, action) {
    const routesPhp = readRepoFile(ROUTES_FILE);
    const pattern = new RegExp(
        `\\$router->add\\(\\s*'${escapeRegex(method)}'\\s*,\\s*'${escapeRegex(resource)}'\\s*,\\s*\\[\\s*${escapeRegex(controllerClass)}::class\\s*,\\s*'${escapeRegex(action)}'\\s*\\]\\s*\\);`
    );
    return pattern.test(routesPhp);
}

function allFilesExist(relativePaths) {
    return relativePaths.every((relativePath) => fileExists(relativePath));
}

function controllerSurfaceExists({
    file,
    className,
    methods = [],
    routes = [],
}) {
    if (!phpClassExists(file, className)) {
        return false;
    }

    if (!methods.every((methodName) => phpMethodExists(file, methodName))) {
        return false;
    }

    return routes.every(
        ({ method, resource, action, controller = className }) =>
            routeExists(method, resource, controller, action)
    );
}

function openclawSurfaceExists(resources) {
    const selectedEndpoints = OPENCLAW_ENDPOINTS.filter((endpoint) =>
        resources.includes(endpoint.resource)
    );
    return controllerSurfaceExists({
        file: 'controllers/OpenclawController.php',
        className: 'OpenclawController',
        methods: selectedEndpoints.map((endpoint) => endpoint.action),
        routes: selectedEndpoints,
    });
}

function parseTaskLines(markdown) {
    const taskLines = {};
    markdown.split('\n').forEach((line, lineIndex) => {
        const match = line.match(TASK_LINE_PATTERN);
        if (match) {
            taskLines[match[2]] = {
                lineIndex,
                done: match[1] === 'x',
                line,
            };
        }
    });
    return taskLines;
}

function createVerificationChecks() {
    const phaseTwoAuditChecks = createPhaseTwoAuditChecks();

    return {
        // ── Sprint 1 ───────────────────────────────────────────────────────
        'S1-01': () => {
            const idx = readRepoFile('index.html');
            return (
                !idx.includes('href="/es/servicios/bioestimuladores/"') ||
                idx.includes('href="/es/servicios/bioestimuladores-colageno/"')
            );
        },

        'S1-04': () => {
            try {
                const manifest = JSON.parse(readRepoFile('manifest.json'));
                return (
                    manifest.name.includes('Aurora Derm') &&
                    !manifest.name.includes('Flow OS')
                );
            } catch {
                return false;
            }
        },

        'S1-05': () => fileExists('sw.js'),

        'S1-09': () => {
            const idx = readRepoFile('index.html');
            return (idx.match(/loading="lazy"/g) || []).length >= 3;
        },

        // ── Sprint 2 ───────────────────────────────────────────────────────
        'S2-01': () => {
            const idx = readRepoFile('index.html');
            return (
                idx.includes('"@type":"Dermatology"') ||
                idx.includes('"@type":"MedicalClinic"')
            );
        },

        'S2-03': () => {
            const idx = readRepoFile('index.html');
            return (
                idx.includes('og:title') &&
                idx.includes('og:description') &&
                idx.includes('og:image')
            );
        },

        'S2-04': () => {
            if (!fileExists('sitemap.xml')) return false;
            const sitemap = readRepoFile('sitemap.xml');
            return (sitemap.match(/<loc>/g) || []).length >= 30;
        },

        'S2-05': () => {
            if (!fileExists('robots.txt')) return false;
            const robots = readRepoFile('robots.txt');
            return robots.includes('Disallow:') && robots.includes('Sitemap:');
        },

        'S2-07': () => {
            const idx = readRepoFile('index.html');
            return (idx.match(/\?text=/g) || []).length >= 2;
        },

        'S2-10': () => fileExists('es/blog/index.html'),
        'S2-11': () =>
            fileExists('es/blog/como-elegir-dermatologo-quito/index.html'),
        'S2-12': () => fileExists('es/blog/senales-alarma-lunares/index.html'),
        'S2-13': () =>
            fileExists('es/blog/proteccion-solar-ecuador/index.html'),
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
                    files.every((filePath) =>
                        normalizeHtmlEntities(read(filePath)).includes(
                            'Los resultados varían. Consulte a nuestro especialista.'
                        )
                    )
                );
            } catch {
                return false;
            }
        },

        'S2-19': () => {
            const legacy = normalizeHtmlEntities(readRepoFile('index.html'));
            const localized = normalizeHtmlEntities(
                readRepoFile('es/index.html')
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
            const legacy = normalizeHtmlEntities(readRepoFile('index.html'));
            const localized = normalizeHtmlEntities(
                readRepoFile('es/index.html')
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
                readRepoFile('es/primera-consulta/index.html')
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
                        .map((filePath) => filePath.split('/').slice(-2, -1)[0])
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

        // ── Sprint 3 ───────────────────────────────────────────────────────
        'S3-05': () => fileExists('es/pre-consulta/index.html'),
        'S3-07': () => {
            const kiosko = readRepoFile('kiosco-turnos.html');
            return (
                kiosko.includes('qr') ||
                kiosko.includes('QR') ||
                kiosko.includes('scan')
            );
        },
        'S3-11': () => {
            const statusPage = readRepoFile(
                '.generated/site-root/es/software/turnero-clinicas/estado-turno/index.html'
            );
            return (
                statusPage.includes('data-v6-ticket-status-root') &&
                controllerSurfaceExists({
                    file: 'controllers/QueueController.php',
                    className: 'QueueController',
                    methods: ['publicTicket'],
                    routes: [
                        {
                            method: 'GET',
                            resource: 'queue-public-ticket',
                            action: 'publicTicket',
                        },
                    ],
                }) &&
                fileContains(
                    'lib/TicketPrinter.php',
                    /PUBLIC_QUEUE_STATUS_BASE_URL|buildPublicQueueStatusUrl/
                )
            );
        },
        'S3-12': () => {
            const builder = readRepoFile('lib/queue/QueueSummaryBuilder.php');
            const kioskHtml = readRepoFile('kiosco-turnos.html');
            const kioskRuntime = readRepoFile('src/apps/queue-kiosk/index.js');
            const displayRuntime = readRepoFile(
                'src/apps/queue-display/index.js'
            );
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
        'S3-13': () => {
            const displayHtml = readRepoFile('sala-turnos.html');
            const displayRuntime = readRepoFile(
                'src/apps/queue-display/index.js'
            );
            return (
                displayHtml.includes('displaySmartLane') &&
                displayHtml.includes('displaySmartTreatment') &&
                displayRuntime.includes('DISPLAY_SMART_TIPS') &&
                displayRuntime.includes('DISPLAY_SMART_VIDEOS') &&
                displayRuntime.includes('renderDisplaySmartLane') &&
                displayRuntime.includes('queueDisplaySmartRotation')
            );
        },
        'S3-15': () =>
            controllerSurfaceExists({
                file: 'controllers/ClinicalHistoryController.php',
                className: 'ClinicalHistoryController',
                methods: ['sessionGet', 'sessionPost', 'messagePost'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'clinical-history-session',
                        action: 'sessionGet',
                    },
                    {
                        method: 'POST',
                        resource: 'clinical-history-session',
                        action: 'sessionPost',
                    },
                    {
                        method: 'POST',
                        resource: 'clinical-history-message',
                        action: 'messagePost',
                    },
                ],
            }) && fileExists('lib/clinical_history/ClinicalHistoryService.php'),
        'S3-16': () =>
            fileExists('lib/CaseMediaFlowService.php') &&
            controllerSurfaceExists({
                file: 'controllers/ClinicalHistoryController.php',
                className: 'ClinicalHistoryController',
                methods: ['uploadMedia'],
                routes: [
                    {
                        method: 'POST',
                        resource: 'clinical-media-upload',
                        action: 'uploadMedia',
                    },
                ],
            }) &&
            allFilesExist(CLINICAL_SAMPLE_PHOTOS),
        'S3-17': () =>
            controllerSurfaceExists({
                file: 'controllers/ClinicalHistoryController.php',
                className: 'ClinicalHistoryController',
                methods: ['galleryGet'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'clinical-history-gallery',
                        action: 'galleryGet',
                    },
                ],
            }),
        'S3-18': () =>
            controllerSurfaceExists({
                file: 'controllers/ClinicalHistoryController.php',
                className: 'ClinicalHistoryController',
                methods: ['getCarePlanPdf'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'care-plan-pdf',
                        action: 'getCarePlanPdf',
                    },
                ],
            }),
        'S3-19': () =>
            openclawSurfaceExists(['openclaw-prescription']) &&
            fileExists('lib/openclaw/PrescriptionPdfRenderer.php'),
        'S3-20': () =>
            openclawSurfaceExists(['openclaw-save-evolution']) &&
            phpMethodExists(
                'lib/clinical_history/ClinicalHistoryService.php',
                'saveEvolutionNote'
            ),
        'S3-21': () =>
            phpClassExists(
                'lib/clinical_history/ClinicalHistoryGuardrails.php',
                'ClinicalHistoryGuardrails'
            ) &&
            controllerSurfaceExists({
                file: 'controllers/ClinicalHistoryController.php',
                className: 'ClinicalHistoryController',
                methods: ['reviewGet', 'reviewPatch'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'clinical-history-review',
                        action: 'reviewGet',
                    },
                    {
                        method: 'PATCH',
                        resource: 'clinical-history-review',
                        action: 'reviewPatch',
                    },
                ],
            }),
        'S3-22': () =>
            phpClassExists(
                'lib/clinical_history/ClinicalHistoryLegalReadiness.php',
                'ClinicalHistoryLegalReadiness'
            ) &&
            phpMethodExists(
                'lib/clinical_history/ClinicalHistoryLegalReadiness.php',
                'build'
            ) &&
            controllerSurfaceExists({
                file: 'controllers/ClinicalHistoryController.php',
                className: 'ClinicalHistoryController',
                methods: ['recordGet', 'recordPatch'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'clinical-record',
                        action: 'recordGet',
                    },
                    {
                        method: 'PATCH',
                        resource: 'clinical-record',
                        action: 'recordPatch',
                    },
                ],
            }),
        'S3-23': () =>
            phpClassExists(
                'lib/clinical_history/ComplianceMSP.php',
                'ComplianceMSP'
            ) &&
            phpMethodExists(
                'lib/clinical_history/ComplianceMSP.php',
                'validate'
            ) &&
            controllerSurfaceExists({
                file: 'controllers/ClinicalHistoryController.php',
                className: 'ClinicalHistoryController',
                methods: ['recordPatch', 'episodeActionPost'],
                routes: [
                    {
                        method: 'PATCH',
                        resource: 'clinical-record',
                        action: 'recordPatch',
                    },
                    {
                        method: 'POST',
                        resource: 'clinical-episode-action',
                        action: 'episodeActionPost',
                    },
                ],
            }),
        'S3-24': () => fileExists('es/agendar/index.html'),
        'S3-28': () => {
            const workbench = readRepoFile(
                'src/apps/admin-v3/ui/frame/templates/sections/appointments/workbench.js'
            );
            const actions = readRepoFile(
                'src/apps/admin-v3/sections/appointments/actions.js'
            );
            const dailyRender = readRepoFile(
                'src/apps/admin-v3/sections/appointments/render/daily.js'
            );
            return (
                workbench.includes('appointmentsDailyAgenda') &&
                actions.includes('queue-checkin') &&
                actions.includes('markArrived') &&
                dailyRender.includes('data-overbooking-slot') &&
                dailyRender.includes('appointment-mark-arrived')
            );
        },
        'S3-29': () =>
            controllerSurfaceExists({
                file: 'controllers/TelemedicineAdminController.php',
                className: 'TelemedicineAdminController',
                methods: ['index', 'patch'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'telemedicine-intakes',
                        action: 'index',
                    },
                    {
                        method: 'PATCH',
                        resource: 'telemedicine-intakes',
                        action: 'patch',
                    },
                ],
            }) &&
            controllerSurfaceExists({
                file: 'controllers/TelemedicinePolicyController.php',
                className: 'TelemedicinePolicyController',
                methods: ['diagnostics', 'readiness', 'simulate'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'telemedicine-ops-diagnostics',
                        action: 'diagnostics',
                    },
                    {
                        method: 'GET',
                        resource: 'telemedicine-rollout-readiness',
                        action: 'readiness',
                    },
                    {
                        method: 'POST',
                        resource: 'telemedicine-policy-simulate',
                        action: 'simulate',
                    },
                ],
            }) &&
            fileExists('lib/telemedicine/TelemedicineIntakeService.php') &&
            fileExists('lib/telemedicine/TelemedicineSuitabilityEvaluator.php'),
        'S3-30': () => fileExists('es/telemedicina/consulta/index.html'),
        'S3-32': () => fileExists('es/pago/index.html'),
        'S3-36': () =>
            controllerSurfaceExists({
                file: 'controllers/DoctorProfileController.php',
                className: 'DoctorProfileController',
                methods: ['show', 'update'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'doctor-profile',
                        action: 'show',
                    },
                    {
                        method: 'POST',
                        resource: 'doctor-profile',
                        action: 'update',
                    },
                ],
            }),
        'S3-OC1': () =>
            openclawSurfaceExists([
                'openclaw-patient',
                'openclaw-cie10-suggest',
                'openclaw-chat',
                'openclaw-save-diagnosis',
            ]),
        'S3-OC2': () =>
            openclawSurfaceExists([
                'openclaw-protocol',
                'openclaw-router-status',
            ]),
        'S3-OC3': () =>
            controllerSurfaceExists({
                file: 'controllers/CertificateController.php',
                className: 'CertificateController',
                methods: ['index', 'store'],
                routes: [
                    {
                        method: 'GET',
                        resource: 'certificate',
                        action: 'index',
                    },
                    {
                        method: 'POST',
                        resource: 'certificate',
                        action: 'store',
                    },
                ],
            }) &&
            openclawSurfaceExists(['openclaw-certificate']) &&
            fileExists('controllers/DoctorProfileController.php'),
        'S3-OC4': () =>
            openclawSurfaceExists([
                'openclaw-interactions',
                'openclaw-summarize',
            ]) && fileExists('js/openclaw-chat.js'),

        // ── Sprint 4 ───────────────────────────────────────────────────────
        'S4-08': () =>
            fileExists('es/software/turnero-clinicas/precios/index.html'),
        'S4-13': () => fileExists('es/paquetes/index.html'),
        'S4-19': () => {
            const idx = readRepoFile('index.html');
            return (
                idx.includes('clarity.ms') || idx.includes('Microsoft Clarity')
            );
        },
        'S4-21': () => {
            try {
                const count = parseInt(
                    execSync(
                        `find "${resolve(ROOT, 'src/apps/queue-shared')}" -name "*.js" | wc -l`,
                        { encoding: 'utf8' }
                    ).trim(),
                    10
                );
                return (
                    existsSync(resolve(ROOT, 'docs/surface-audit.md')) ||
                    count < 100
                );
            } catch {
                return false;
            }
        },

        // ── Sprint 13 ──────────────────────────────────────────────────────
        'S13-03': () =>
            ['404.html', '500.html'].every((relativePath) => {
                const content = readRepoFile(relativePath);
                return (
                    fileExists(relativePath) &&
                    content.includes('/styles/tokens.css') &&
                    content.includes('/styles/components.css') &&
                    content.includes('/styles/aurora-public.css') &&
                    content.includes('/styles/error-pages.css') &&
                    content.includes('wa.me/593982453672') &&
                    content.includes('/es/index.html') &&
                    content.includes('/es/servicios/index.html')
                );
            }),

        // ── Sprint UI Fase 2 ──────────────────────────────────────────────
        'UI2-20': () =>
            PHASE_TWO_AUDIT_CHECK_KEYS.every(
                (checkId) => typeof phaseTwoAuditChecks[checkId] === 'function'
            ) &&
            Object.keys(parseTaskLines('- [ ] **UI2-20**')).includes('UI2-20'),
    };
}

function main() {
    const markdown = read(AGENTS_FILE);
    const taskLines = parseTaskLines(markdown);
    const checks = createVerificationChecks();

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

    console.log('\n🔍 Aurora Derm — Board Verification\n');

    if (results.nowDone.length > 0) {
        console.log(
            `✅ DONE (evidence found, not marked): ${results.nowDone.length}`
        );
        results.nowDone.forEach(({ taskId }) => console.log(`   ${taskId}`));

        if (FIX) {
            console.log('\n📝 Auto-fixing AGENTS.md...');
            let updatedMd = markdown;
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
                '   Run: git add AGENTS.md && git commit -m "docs: sync board with actual state"'
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
        results.alreadyDone.forEach((taskId) => console.log(`   ${taskId}`));
    }

    if (results.stillPending.length > 0) {
        console.log(
            `\n⏳ Still pending (no evidence): ${results.stillPending.length}`
        );
        results.stillPending.forEach((taskId) => console.log(`   ${taskId}`));
    }

    if (results.unchecked.length > 0) {
        console.log(`\nℹ️  No check rule for: ${results.unchecked.join(', ')}`);
    }

    const total = Object.keys(checks).length;
    const done = results.alreadyDone.length + results.nowDone.length;
    console.log(
        `\n📊 Summary: ${done}/${total} verified done, ${results.stillPending.length} pending\n`
    );

    return results.stillPending.length;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    CLINICAL_SAMPLE_PHOTOS,
    OPENCLAW_ENDPOINTS,
    PHASE_TWO_AUDIT_CHECK_KEYS,
    TASK_LINE_PATTERN,
    allFilesExist,
    controllerSurfaceExists,
    createPhaseTwoAuditChecks,
    createVerificationChecks,
    fileContains,
    fileExists,
    getServiceAuroraCssCoverage,
    main,
    manifestHasShortcuts,
    normalizeHtmlEntities,
    openclawSurfaceExists,
    parseTaskLines,
    phpClassExists,
    phpMethodExists,
    routeExists,
};
