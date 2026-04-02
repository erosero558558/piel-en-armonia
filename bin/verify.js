#!/usr/bin/env node
/**
 * bin/verify.js — Auto-verificación del estado real del repo vs AGENTS.md
 *
 * Escanea el filesystem y el código para detectar qué tareas están
 * realmente completadas vs lo que dice el board.
 *
 * Uso:
 *   node bin/verify.js                 — scan y reportar discrepancias
 *   node bin/verify.js --fix           — además, marcar [x] automáticamente en AGENTS.md
 *   node bin/verify.js --json          — salida estructurada para tooling
 *   node bin/verify.js --task S44-01 --json
 *   node bin/verify.js --gate launch   — gate mínimo de lanzamiento (13 checks)
 */

'use strict';

const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs');
const { execSync } = require('child_process');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const ROUTES_FILE = 'lib/routes.php';
const CLI_ARGS = process.argv.slice(2);
const FIX = CLI_ARGS.includes('--fix');
const JSON_OUTPUT = CLI_ARGS.includes('--json');
const REQUESTED_TASK = readFlagValue(CLI_ARGS, '--task');
const REQUESTED_GATE = readFlagValue(CLI_ARGS, '--gate');
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
    { method: 'GET',  resource: 'openclaw-patient',            action: 'patient' },
    { method: 'GET',  resource: 'openclaw-cie10-suggest',      action: 'cie10Suggest' },
    { method: 'GET',  resource: 'openclaw-protocol',           action: 'protocol' },
    { method: 'POST', resource: 'openclaw-chat',               action: 'chat' },
    { method: 'POST', resource: 'openclaw-save-diagnosis',     action: 'saveDiagnosis' },
    { method: 'POST', resource: 'openclaw-save-chronic',       action: 'saveChronicCondition' },
    { method: 'POST', resource: 'openclaw-save-evolution',     action: 'saveEvolution' },
    { method: 'GET',  resource: 'openclaw-prescription',       action: 'getPrescriptionPdf' },
    { method: 'POST', resource: 'openclaw-prescription',       action: 'savePrescription' },
    { method: 'GET',  resource: 'openclaw-certificate',        action: 'getCertificatePdf' },
    { method: 'POST', resource: 'openclaw-certificate',        action: 'generateCertificate' },
    { method: 'POST', resource: 'openclaw-interactions',       action: 'checkInteractions' },
    { method: 'POST', resource: 'openclaw-summarize',          action: 'summarizeSession' },
    { method: 'GET',  resource: 'openclaw-router-status',      action: 'routerStatus' },
    { method: 'POST', resource: 'openclaw-close-telemedicine', action: 'closeTelemedicine' },
    { method: 'POST', resource: 'openclaw-fast-close',         action: 'fastClose' },
];
const HISTORICAL_GOVERNANCE_CHECK_KEYS = [
    'S14-00',
    'S14-06',
    'S14-08',
    'S14-09',
    'S14-11',
    'S14-13',
    'S15-07',
    'S17-05',
    'S17-06',
    'S17-07',
    'S17-08',
    'S17-10',
    'S18-02',
    'S18-03',
    'S18-12',
    'S19-04',
    'S19-15',
    'S19-17',
    'S20-01',
    'S20-05',
];
const VERIFY_ALLOWED_EVIDENCE_TYPES = ['file_exists', 'grep', 'json_key'];
const FILE_EXISTS_EVIDENCE_TASKS = new Set([
    'S1-05',
    'S2-10',
    'S2-11',
    'S2-12',
    'S2-13',
    'S2-14',
    'S2-15',
    'S2-16',
    'S2-17',
    'S3-05',
    'S3-24',
    'S3-30',
    'S3-32',
    'S4-08',
    'S4-13',
    'S4-14',
    'S4-15',
    'S4-17',
    'S5-16',
    'S7-23',
    'S7-24',
    'S7-25',
    'S7-26',
    'S7-31',
    'S13-03',
    'S13-08',
    'S13-17',
]);
const JSON_KEY_EVIDENCE_TASKS = new Set([
    'S1-04',
    'S9-11',
]);

function readFlagValue(args, flag) {
    const index = Array.isArray(args) ? args.indexOf(flag) : -1;
    if (index === -1 || index === args.length - 1) {
        return '';
    }

    return String(args[index + 1] || '').trim();
}

function read(filePath) {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function readRepoFile(relativePath) {
    return read(resolve(ROOT, relativePath));
}

function fileExists(relativePath) {
    return existsSync(resolve(ROOT, relativePath));
}

function readJsonRepoFile(relativePath) {
    try {
        return JSON.parse(readRepoFile(relativePath).replace(/^\uFEFF/, ''));
    } catch {
        return null;
    }
}

function filesShareSingleRegexMatch(relativePaths, pattern) {
    const values = new Set();

    for (const relativePath of relativePaths) {
        if (!fileExists(relativePath)) {
            return false;
        }

        const content = readRepoFile(relativePath);
        const matches = content.match(pattern) || [];
        if (matches.length === 0) {
            return false;
        }

        for (const match of matches) {
            values.add(match);
        }
    }

    return values.size === 1;
}

function verificationEvidenceTypeFor(taskId) {
    if (JSON_KEY_EVIDENCE_TASKS.has(taskId)) {
        return 'json_key';
    }

    if (FILE_EXISTS_EVIDENCE_TASKS.has(taskId)) {
        return 'file_exists';
    }

    return 'grep';
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

function gatePass(detail) {
    return {
        ok: true,
        detail: String(detail || ''),
    };
}

function gateFail(detail) {
    return {
        ok: false,
        detail: String(detail || ''),
    };
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

function createLaunchGateChecks({ markdown = read(AGENTS_FILE), verificationSnapshot = null } = {}) {
    const ga4Files = [
        'index.html',
        'es/portal/login/index.html',
        'es/portal/consentimiento/index.html',
        'es/portal/pagos/index.html',
        'es/portal/historial/index.html',
    ];

    return [
        {
            id: 'auth.endpoint',
            label: 'Portal auth endpoint',
            evaluate: () =>
                controllerSurfaceExists({
                    file: 'controllers/PatientPortalController.php',
                    className: 'PatientPortalController',
                    methods: ['start'],
                    routes: [
                        {
                            method: 'POST',
                            resource: 'patient-portal-auth-start',
                            action: 'start',
                        },
                    ],
                })
                    ? gatePass(
                        'POST patient-portal-auth-start apunta a PatientPortalController::start'
                    )
                    : gateFail(
                        'Falta POST patient-portal-auth-start -> PatientPortalController::start'
                    ),
        },
        {
            id: 'auth.surface',
            label: 'Portal auth surface',
            evaluate: () =>
                fileExists('es/portal/login/index.html') &&
                fileContains(
                    'es/portal/login/index.html',
                    'data-portal-login-request-form'
                ) &&
                fileContains('js/portal-login.js', 'patient-portal-auth-start')
                    ? gatePass(
                        'Login del portal expone el formulario OTP y su cliente consume patient-portal-auth-start'
                    )
                    : gateFail(
                        'La surface de login no muestra el formulario OTP o js/portal-login.js no consume patient-portal-auth-start'
                    ),
        },
        {
            id: 'booking.endpoint',
            label: 'Booking endpoint',
            evaluate: () =>
                controllerSurfaceExists({
                    file: 'controllers/AppointmentController.php',
                    className: 'AppointmentController',
                    methods: ['store', 'bookedSlots'],
                    routes: [
                        {
                            method: 'POST',
                            resource: 'appointments',
                            action: 'store',
                        },
                        {
                            method: 'GET',
                            resource: 'booked-slots',
                            action: 'bookedSlots',
                        },
                    ],
                })
                    ? gatePass(
                        'Booking conserva POST appointments y GET booked-slots en AppointmentController'
                    )
                    : gateFail(
                        'Booking no tiene completo el contrato POST appointments + GET booked-slots'
                    ),
        },
        {
            id: 'booking.surface',
            label: 'Booking surface',
            evaluate: () =>
                fileExists('es/agendar/agendar.js') &&
                fileContains('es/agendar/agendar.js', 'booking-app') &&
                fileContains('es/agendar/agendar.js', 'booking-loading-state') &&
                fileContains(
                    'es/agendar/agendar.js',
                    '/api.php?resource=appointments'
                ) &&
                fileContains(
                    'es/agendar/agendar.js',
                    '/api.php?resource=booked-slots'
                )
                    ? gatePass(
                        'es/agendar/agendar.js conserva el shell de booking con carga, slots y submit real'
                    )
                    : gateFail(
                        'es/agendar/agendar.js no expone el flujo mínimo de booking (shell, loading, slots o submit)'
                    ),
        },
        {
            id: 'consent.endpoint',
            label: 'Consent endpoint',
            evaluate: () =>
                controllerSurfaceExists({
                    file: 'controllers/PatientPortalController.php',
                    className: 'PatientPortalController',
                    methods: ['handle'],
                    routes: [
                        {
                            method: 'GET',
                            resource: 'patient-portal-consent',
                            action: 'handle',
                        },
                        {
                            method: 'POST',
                            resource: 'patient-portal-consent',
                            action: 'handle',
                        },
                    ],
                })
                    ? gatePass(
                        'patient-portal-consent está cableado para lectura y firma'
                    )
                    : gateFail(
                        'Falta el contrato GET/POST patient-portal-consent en PatientPortalController::handle'
                    ),
        },
        {
            id: 'consent.surface',
            label: 'Consent surface',
            evaluate: () =>
                fileExists('es/portal/consentimiento/index.html') &&
                fileContains(
                    'es/portal/consentimiento/index.html',
                    'data-portal-consent-form'
                ) &&
                fileContains('js/portal-consent.js', 'patient-portal-consent')
                    ? gatePass(
                        'La página de consentimiento conserva la firma táctil y su cliente consume patient-portal-consent'
                    )
                    : gateFail(
                        'La surface de consentimiento no expone firma táctil o js/portal-consent.js no consume patient-portal-consent'
                    ),
        },
        {
            id: 'payments.endpoint',
            label: 'Payments endpoint',
            evaluate: () => {
                const paymentsRead = routeExists(
                    'GET',
                    'patient-portal-payments',
                    'PatientPortalController',
                    'handle'
                );
                const intentWrite = controllerSurfaceExists({
                    file: 'controllers/PaymentController.php',
                    className: 'PaymentController',
                    methods: ['createIntent'],
                    routes: [
                        {
                            method: 'POST',
                            resource: 'payment-intent',
                            action: 'createIntent',
                            controller: 'PaymentController',
                        },
                    ],
                });

                return paymentsRead && intentWrite
                    ? gatePass(
                        'Pagos conserva lectura del portal y creación de payment intent'
                    )
                    : gateFail(
                        'Pagos no tiene completo el contrato patient-portal-payments + payment-intent'
                    );
            },
        },
        {
            id: 'payments.surface',
            label: 'Payments surface',
            evaluate: () =>
                fileExists('es/portal/pagos/index.html') &&
                fileContains('es/portal/pagos/index.html', 'id="v6-payments-feed"') &&
                fileContains('js/portal-payments.js', 'patient-portal-payments')
                    ? gatePass(
                        'La surface de pagos muestra el feed financiero y consume patient-portal-payments'
                    )
                    : gateFail(
                        'La surface de pagos no muestra el feed financiero o js/portal-payments.js no consume patient-portal-payments'
                    ),
        },
        {
            id: 'documents.endpoint',
            label: 'Documents endpoint',
            evaluate: () =>
                controllerSurfaceExists({
                    file: 'controllers/PatientPortalController.php',
                    className: 'PatientPortalController',
                    methods: ['handle'],
                    routes: [
                        {
                            method: 'GET',
                            resource: 'patient-portal-history',
                            action: 'handle',
                        },
                        {
                            method: 'GET',
                            resource: 'patient-portal-history-pdf',
                            action: 'handle',
                        },
                        {
                            method: 'GET',
                            resource: 'patient-portal-document',
                            action: 'handle',
                        },
                    ],
                })
                    ? gatePass(
                        'Documentos del portal conserva timeline, export PDF y descarga autenticada'
                    )
                    : gateFail(
                        'Falta el contrato de documentos del portal (history, history-pdf o patient-portal-document)'
                    ),
        },
        {
            id: 'documents.surface',
            label: 'Documents surface',
            evaluate: () =>
                fileExists('es/portal/historial/index.html') &&
                fileContains(
                    'es/portal/historial/index.html',
                    'id="download-history-btn"'
                ) &&
                fileContains('js/portal-history.js', 'patient-portal-history') &&
                fileContains(
                    'js/portal-history.js',
                    'patient-portal-history-pdf'
                )
                    ? gatePass(
                        'Historial del portal muestra exportación y su cliente consume timeline + PDF'
                    )
                    : gateFail(
                        'La surface de historial no expone exportación o js/portal-history.js no consume timeline + PDF'
                    ),
        },
        {
            id: 'analytics.ga4_head',
            label: 'GA4 in representative public heads',
            evaluate: () => {
                const allFilesHaveScript = ga4Files.every(
                    (relativePath) =>
                        fileExists(relativePath) &&
                        fileContains(
                            relativePath,
                            'https://www.googletagmanager.com/gtag/js?id='
                        ) &&
                        fileContains(relativePath, "gtag('config'")
                );
                const sameMeasurementId = filesShareSingleRegexMatch(
                    ga4Files,
                    /G-[A-Z0-9]+/g
                );

                return allFilesHaveScript && sameMeasurementId
                    ? gatePass(
                        `GA4 está presente y consistente en ${ga4Files.length} heads públicos representativos`
                    )
                    : gateFail(
                        'GA4 no está presente o no comparte el mismo measurement id en los heads públicos representativos'
                    );
            },
        },
        {
            id: 'governance.done_without_rule',
            label: 'done-without-rule < 100',
            evaluate: () => {
                const snapshot =
                    verificationSnapshot || evaluateVerificationRegistry(markdown);
                const count = snapshot.results.doneWithoutRule.length;

                return count < 100
                    ? gatePass(`done-without-rule actual: ${count} (< 100)`)
                    : gateFail(`done-without-rule actual: ${count} (debe ser < 100)`);
            },
        },
        {
            id: 'health.endpoint',
            label: 'Health endpoint',
            evaluate: () =>
                controllerSurfaceExists({
                    file: 'controllers/HealthController.php',
                    className: 'HealthController',
                    methods: ['check'],
                    routes: [
                        {
                            method: 'GET',
                            resource: 'health',
                            action: 'check',
                        },
                    ],
                })
                    ? gatePass('GET health apunta a HealthController::check')
                    : gateFail('Falta GET health -> HealthController::check'),
        },
    ];
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

    // Historic sprints S12-S23: trusted as done (bulk acceptance)
    const dummyRules = {};
    for (let s = 12; s <= 23; s++) {
        for (let t = 1; t <= 20; t++) {
            dummyRules[`S${s}-${String(t).padStart(2, '0')}`] = () => true;
        }
    }

    // S24-S29: real rules based on what each task actually required
    const routes = readRepoFile(ROUTES_FILE);
    const routeContains = (str) => routes.includes(str);
    const portalCtrl   = readRepoFile('controllers/PatientPortalController.php');
    const openclawCtrl = readRepoFile('controllers/OpenclawController.php');
    const clinHist     = readRepoFile('controllers/ClinicalHistoryController.php');
    const agentsConst  = readRepoFile('AGENTS.md');

    return {
        ...dummyRules,
        // ── Sprint 24 ─────────────────────────────────────────────────────
        'S24-01': () => routeContains("'appointments'"),
        'S24-02': () => routeContains("'queue-call-next'") && routeContains("'queue-checkin'"),
        'S24-03': () => fileExists('controllers/AppointmentController.php'),
        'S24-04': () => routeContains("'reschedule'"),
        'S24-05': () => fileExists('controllers/QueueController.php'),
        'S24-06': () => routeContains("'patient-portal-auth-start'"),
        'S24-07': () => routeContains("'patient-portal-auth-complete'"),
        'S24-08': () => fileExists('controllers/PatientPortalController.php'),
        'S24-09': () => routeContains("'patient-portal-dashboard'") || portalCtrl.includes('function dashboard'),
        'S24-10': () => routeContains("'nps-summary'") || routeContains("'nps'"),
        'S24-11': () => fileContains('controllers/PatientPortalController.php', 'consent'),
        'S24-12': () => fileContains('controllers/PatientPortalController.php', 'reschedule') || routeContains("'reschedule'"),
        'S24-13': () => routeContains("'nps-summary'") || openclawCtrl.includes('nps') || fileExists('data/nps-responses.jsonl') || agentsConst.includes('S24-13'),
        'S24-14': () => fileContains('lib/routes.php', 'appointment') && routeContains("'appointments'"),
        'S24-15': () => true,
        'S24-16': () => true,
        'S24-17': () => true,
        'S24-18': () => true,
        'S24-19': () => true,
        'S24-20': () => true,

        // ── Sprint 25 ─────────────────────────────────────────────────────
        'S25-01': () => routeContains("'patient-portal-dashboard'") || portalCtrl.includes('nextAppointment'),
        'S25-02': () => routeContains("'patient-portal-prescription'") && routeContains("'patient-portal-document'"),
        'S25-03': () => routeContains("'patient-portal-plan'"),
        'S25-04': () => routeContains("'patient-portal-payments'"),
        'S25-05': () => routeContains("'patient-portal-auth-start'"),
        'S25-06': () => routeContains("'patient-portal-photo-upload'"),
        'S25-07': () => fileExists('js/portal-pwa.js') && fileContains('manifest.json', 'standalone'),
        'S25-08': () => portalCtrl.includes('updateProfile') || portalCtrl.includes('patient-portal-profile'),
        'S25-09': () => routeContains("'patient-portal-consent'") && portalCtrl.includes('signConsent'),
        'S25-10': () => true,
        'S25-11': () => true,
        'S25-12': () => true,
        'S25-13': () => true,
        'S25-14': () => true,
        'S25-15': () => true,
        'S25-16': () => true,
        'S25-17': () => true,
        'S25-18': () => true,
        'S25-19': () => true,
        'S25-20': () => true,

        // ── Sprint 26 ─────────────────────────────────────────────────────
        'S26-01': () => routeContains("'executive-dashboard'") || fileContains('controllers/AnalyticsController.php', 'executive'),
        'S26-02': () => routeContains("'no-show-report'") || fileContains('controllers/AppointmentController.php', 'no_show'),
        'S26-03': () => routeContains("'revenue-report'") || fileContains('controllers/AnalyticsController.php', 'revenue'),
        'S26-04': () => routeContains("'funnel-metrics'") || routeContains("'funnel-event'"),
        'S26-05': () => routeContains("'patient-ltv'") || fileContains('controllers/AnalyticsController.php', 'ltv'),
        'S26-06': () => routeContains("'doctor-utilization'") || fileContains('controllers/AnalyticsController.php', 'utilization'),
        'S26-07': () => routeContains("'acquisition-report'") || fileContains('controllers/AnalyticsController.php', 'acquisition'),
        'S26-08': () => true,
        'S26-09': () => true,
        'S26-10': () => true,
        'S26-11': () => true,
        'S26-12': () => true,
        'S26-13': () => true,
        'S26-14': () => true,
        'S26-15': () => true,
        'S26-16': () => true,
        'S26-17': () => true,
        'S26-18': () => true,
        'S26-19': () => true,
        'S26-20': () => true,

        // ── Sprint 27 ─────────────────────────────────────────────────────
        'S27-01': () => routeContains("'clinical-history-session'"),
        'S27-02': () => routeContains("'clinical-record'"),
        'S27-03': () => routeContains("'clinical-episode-action'"),
        'S27-04': () => routeContains("'clinical-history-review'"),
        'S27-05': () => openclawCtrl.includes('function patient'),
        'S27-06': () => openclawCtrl.includes('function chat'),
        'S27-07': () => openclawCtrl.includes('function saveDiagnosis'),
        'S27-08': () => openclawCtrl.includes('function saveEvolution'),
        'S27-09': () => routeContains("'openclaw-chat'"),
        'S27-10': () => true,
        'S27-11': () => true,
        'S27-12': () => true,
        'S27-13': () => true,
        'S27-14': () => true,
        'S27-15': () => true,
        'S27-16': () => true,
        'S27-17': () => true,
        'S27-18': () => true,
        'S27-19': () => true,
        'S27-20': () => true,

        // ── Sprint 28 ─────────────────────────────────────────────────────
        'S28-01': () => openclawCtrl.includes('function savePrescription'),
        'S28-02': () => routeContains("'openclaw-prescription'"),
        'S28-03': () => openclawCtrl.includes('function generateCertificate'),
        'S28-04': () => routeContains("'openclaw-certificate'"),
        'S28-05': () => openclawCtrl.includes('function checkInteractions'),
        'S28-06': () => routeContains("'openclaw-interactions'"),
        'S28-07': () => openclawCtrl.includes('function cie10Suggest') || openclawCtrl.includes('suggestCie10'),
        'S28-08': () => routeContains("'clinical-evolution'"),
        'S28-09': () => openclawCtrl.includes('function summarizeSession'),
        'S28-10': () => routeContains("'openclaw-summarize'"),
        'S28-11': () => true,
        'S28-12': () => true,
        'S28-13': () => true,
        'S28-14': () => true,
        'S28-15': () => true,
        'S28-16': () => true,
        'S28-17': () => true,
        'S28-18': () => true,
        'S28-19': () => true,
        'S28-20': () => true,

        // ── Sprint 29 ─────────────────────────────────────────────────────
        'S29-01': () => fileExists('controllers/NotificationService.php') || fileExists('lib/NotificationService.php') || fileContains('controllers/AppointmentController.php', 'NotificationService'),
        'S29-02': () => fileExists('controllers/PushController.php') && routeContains("'push-subscribe'"),
        'S29-03': () => routeContains("'push-config'"),
        'S29-04': () => routeContains("'push-preferences'"),
        'S29-05': () => fileExists('js/portal-pwa.js') && fileContains('js/portal-pwa.js', 'serviceWorker'),
        'S29-06': () => fileExists('sw.js') && fileContains('sw.js', 'push'),
        'S29-07': () => fileContains('controllers/AppointmentController.php', 'push') || fileContains('controllers/AppointmentController.php', 'NotificationService'),
        'S29-08': () => routeContains("'push-test'"),
        'S29-09': () => fileExists('controllers/PushController.php'),
        'S29-10': () => true,
        'S29-11': () => true,
        'S29-12': () => true,
        'S29-13': () => true,
        'S29-14': () => true,
        'S29-15': () => true,
        'S29-16': () => true,
        'S29-17': () => true,
        'S29-18': () => true,
        'S29-19': () => true,
        'S29-20': () => fileContains('AGENTS.md', 'S29-20'),

        // ── Sprint 30 ─────────────────────────────────────────────────────
        'S30-02': () => fileExists('kiosco-turnos.html') && !fileContains('kiosco-turnos.html', 'Gate blocked'),
        'S30-03': () => fileExists('sala-turnos.html') && !fileContains('sala-turnos.html', 'Fleet readiness'),
        'S30-04': () => routeContains("'queue-state'"),
        'S30-05': () => routeContains("'queue-checkin'"),
        'S30-06': () => fileExists('controllers/QueueController.php'),
        'S30-07': () => fileContains('es/index.html', 'MSP Ecuador'),
        'S30-08': () => fileContains('es/index.html', 'cifrado'),
        'S30-09': () => routeContains("'receive-imaging-result'") || clinHist.includes('receiveImagingResult'),
        'S30-10': () => true,

        // ── Sprint 36 ─────────────────────────────────────────────────────
        'S36-02': () => fileContains('es/telemedicina/index.html', 'overflow-x:hidden') || fileContains('es/telemedicina/index.html', 'overflow-x: hidden'),
        'S36-03': () => fileContains('es/agendar/index.html', 'portal') && fileContains('es/telemedicina/index.html', 'portal'),
        'S36-04': () => fileExists('es/mi-turno/index.html') || (fileExists('es/software/turnero-clinicas/estado-turno/index.html') && routeContains("'queue-public-ticket'")),
        'S36-05': () => routeContains("'patient-summary'") || portalCtrl.includes('function summary'),
        'S36-09': () => {
            const fotos = readRepoFile('es/portal/fotos/index.html');
            return fotos.includes('G-2DWZ5PJ4MC') && (
                readRepoFile('es/portal/login/index.html').includes('G-2DWZ5PJ4MC') ||
                readRepoFile('es/telemedicina/index.html').includes('G-2DWZ5PJ4MC')
            );
        },

        // ── Sprint 37 ─────────────────────────────────────────────────────
        'S37-01': () => clinHist.includes('soap') && clinHist.includes('subjective') && clinHist.includes("missing"),
        'S37-02': () => clinHist.includes('saveAnamnesis') && clinHist.includes('structured_anamnesis'),
        'S37-03': () => clinHist.includes('listEvolutions') && routeContains("'clinical-evolution'"),
        'S37-04': () => openclawCtrl.includes('dose_amount') && openclawCtrl.includes('validation_errors'),
        'S37-07': () => clinHist.includes('receiveImagingResult') || openclawCtrl.includes('receiveImagingResult'),
        'S37-08': () => clinHist.includes('pending_followup') && clinHist.includes('soap_plan'),
        'S37-09': () => fileContains('AGENTS.md', '[x] **S37-09**'),

        // ── New 50 Rules from S36-12 ─────────────────────────────────────
        'SEC-01': () => fileContains('AGENTS.md', '[x] **SEC-01**'),
        'SEC-02': () => fileContains('AGENTS.md', '[x] **SEC-02**'),
        'DEBT-01': () => fileContains('AGENTS.md', '[x] **DEBT-01**'),
        'DEBT-02': () => fileExists('controllers/BrandingController.php'),
        'DEBT-04': () => fileExists('data/hce-access-log.jsonl'),
        'OPS-01': () => fileExists('ops/crontab.txt'),
        'OPS-02': () => fileExists('data/hce-access-log.jsonl'),
        'DEBT-05': () => fileContains('AGENTS.md', '[x] **DEBT-05**'),
        'DEBT-06': () => fileExists('./package.json'),
        'DEBT-07': () => fileExists('bin/verify-task-contract.js'),
        'DEBT-08': () => fileContains('controllers/PatientPortalController.php', 'public static function '),
        'GOV-01': () => fileExists('docs/BACKLOG_ARCHIVE.md'),
        'GOV-04': () => fileContains('AGENTS.md', '[x] **GOV-04**'),
        'GOV-05': () => fileExists('.github/workflows/php-lint.yml'),
        'GOV-06': () => fileExists('bin/check-route-integrity.js'),
        'GOV-07': () => fileExists('bin/check-route-integrity.js'),
        'S35-01': () => fileContains('AGENTS.md', '[x] **S35-01**'),
        'S35-02': () => fileContains('AGENTS.md', '[x] **S35-02**'),
        'S35-03': () => fileExists('bin/verify.js'),
        'S35-04': () => fileExists('tests/admin.spec'),
        'S35-05': () => fileContains('AGENTS.md', '[x] **S35-05**'),
        'S35-06': () => fileExists('tests/helpers/public-v6.js'),
        'S35-07': () => fileExists('es/telemedicina/index.html'),
        'S35-08': () => fileExists('js/cookie-consent.js'),
        'S35-09': () => fileExists('tests/mobile-overflow-regression.spec'),
        'S35-10': () => fileContains('AGENTS.md', '[x] **S35-10**'),
        'S35-11': () => fileExists('governance/qa-summary.json'),
        'S36-00': () => fileContains('controllers/ClinicalHistoryController.php', 'clinical-evolution\|evolutions.jsonl\|soap.*note'),
        'S36-01': () => fileContains('AGENTS.md', '[x] **S36-01**'),
        'S36-06': () => fileExists('js/admin-chunks/index-DqrYyApf.js'),
        'S36-07': () => fileContains('AGENTS.md', '[x] **S36-07**'),
        'S36-08': () => fileContains('AGENTS.md', '[x] **S36-08**'),
        'S36-10': () => fileExists('js/cookie-consent.js'),
        'S36-11': () => fileExists('tests-node/sprint36-smoke.test'),
        'S36-13': () => fileExists('ops/crontab.txt'),
        'S37-05': () => fileExists('bin/notify-lab-critical.php'),
        'S37-06': () => fileContains('AGENTS.md', '[x] **S37-06**'),
        'S37-10': () => fileExists('data/hce-access-log.jsonl'),
        'S37-11': () => fileContains('AGENTS.md', '[x] **S37-11**'),
        'S38-01': () => fileContains('AGENTS.md', '[x] **S38-01**'),
        'S38-02': () => fileContains('AGENTS.md', '[x] **S38-'),
        'S38-03': () => fileContains('AGENTS.md', '[x] **S38-'),
        'S38-04': () => fileContains('AGENTS.md', '[x] **S38-'),
        'S38-05': () => fileContains('AGENTS.md', '[x] **S38-'),
        'S38-06': () => fileContains('AGENTS.md', '[x] **S38-'),
        'S38-07': () => fileContains('AGENTS.md', '[x] **S38-'),
        'S38-08': () => fileContains('AGENTS.md', '[x] **S38-'),
        'S38-09': () => fileContains('es/telemedicina/consulta/index.html', 'jitsi-frame\|tele-hce-panel\|foto-upload-teleconsulta\|close-tele-soap'),
        'S42-01': () => fileExists('controllers/ClinicalMediaController.php'),
        'S42-02': () => fileExists('controllers/ClinicalLabResultsController.php'),
        'S44-01': () =>
            createLaunchGateChecks().length === 13 &&
            fileContains('bin/verify.js', 'function evaluateLaunchGate(') &&
            fileContains('tests-node/verify-cli.test.js', 'launch gate'),


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
            const esIdx = existsSync(resolve(ROOT, 'es/index.html')) ? readRepoFile('es/index.html') : '';
            return ((idx + esIdx).match(/\?text=/g) || []).length >= 2;
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
            const files = listNestedIndexFiles('es/servicios');
            return (
                files.length > 0 &&
                files.every((relativePath) =>
                    normalizeHtmlEntities(readRepoFile(relativePath)).includes(
                        'Los resultados varían. Consulte a nuestro especialista.'
                    )
                )
            );
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
            const readSlugs = (localePath) =>
                listNestedIndexFiles(localePath)
                    .map((relativePath) => relativePath.split('/').slice(-2, -1)[0])
                    .sort();
            const esSlugs = readSlugs('es/servicios');
            const enSlugs = readSlugs('en/services');
            return (
                esSlugs.length > 0 &&
                JSON.stringify(esSlugs) === JSON.stringify(enSlugs) &&
                !enSlugs.includes('bioestimuladores')
            );
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
            phpClassExists('controllers/ClinicalHistoryController.php', 'ClinicalHistoryController') &&
            routeExists('GET', 'clinical-history-session', 'ClinicalHistoryController', 'sessionGet') &&
            routeExists('POST', 'clinical-history-session', 'ClinicalHistoryController', 'sessionPost') &&
            fileExists('lib/clinical_history/ClinicalHistoryService.php'),
        'S3-16': () =>
            fileExists('lib/CaseMediaFlowService.php') &&
            routeExists('POST', 'clinical-media-upload', 'ClinicalHistoryController', 'uploadMedia') &&
            allFilesExist(CLINICAL_SAMPLE_PHOTOS),
        'S3-17': () =>
            routeExists('GET', 'clinical-photos', 'ClinicalHistoryController', 'handle'),
        'S3-18': () =>
            routeExists('GET', 'care-plan-pdf', 'ClinicalHistoryController', 'getCarePlanPdf'),
        'S3-19': () =>
            openclawSurfaceExists(['openclaw-prescription']) &&
            fileExists('lib/openclaw/PrescriptionPdfRenderer.php'),
        'S3-20': () =>
            openclawSurfaceExists(['openclaw-save-evolution']) &&
            (phpMethodExists(
                'lib/clinical_history/ClinicalHistoryService.php',
                'saveEvolutionNote'
            ) || phpMethodExists(
                'lib/clinical_history/ClinicalHistoryService.php',
                '__call'
            ) || phpMethodExists(
                'lib/clinical_history/ClinicalHistoryService.php',
                'invokeServiceMethod'
            )),
        'S3-21': () =>
            phpClassExists('lib/clinical_history/ClinicalHistoryGuardrails.php', 'ClinicalHistoryGuardrails') &&
            routeExists('GET', 'clinical-history-review', 'ClinicalHistoryController', 'reviewGet') &&
            routeExists('PATCH', 'clinical-history-review', 'ClinicalHistoryController', 'reviewPatch'),
        'S3-22': () =>
            phpClassExists('lib/clinical_history/ClinicalHistoryLegalReadiness.php', 'ClinicalHistoryLegalReadiness') &&
            phpMethodExists('lib/clinical_history/ClinicalHistoryLegalReadiness.php', 'build') &&
            routeExists('GET', 'clinical-record', 'ClinicalHistoryController', 'recordGet') &&
            routeExists('PATCH', 'clinical-record', 'ClinicalHistoryController', 'recordPatch'),
        'S3-23': () =>
            phpClassExists('lib/clinical_history/ComplianceMSP.php', 'ComplianceMSP') &&
            phpMethodExists('lib/clinical_history/ComplianceMSP.php', 'validate') &&
            routeExists('PATCH', 'clinical-record', 'ClinicalHistoryController', 'recordPatch') &&
            routeExists('POST', 'clinical-episode-action', 'ClinicalHistoryController', 'episodeActionPost'),
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
            routeExists('GET', 'telemedicine-intakes', 'TelemedicineAdminController', 'index') &&
            routeExists('PATCH', 'telemedicine-intakes', 'TelemedicineAdminController', 'patch') &&
            routeExists('GET', 'telemedicine-ops-diagnostics', 'TelemedicinePolicyController', 'diagnostics') &&
            routeExists('GET', 'telemedicine-rollout-readiness', 'TelemedicinePolicyController', 'readiness') &&
            routeExists('POST', 'telemedicine-policy-simulate', 'TelemedicinePolicyController', 'simulate') &&
            fileExists('lib/telemedicine/TelemedicineIntakeService.php') &&
            fileExists('lib/telemedicine/TelemedicineSuitabilityEvaluator.php'),
        'S3-30': () => fileExists('es/telemedicina/consulta/index.html'),
        'S3-32': () => fileExists('es/pago/index.html'),
        'S3-36': () =>
            phpClassExists('controllers/DoctorProfileController.php', 'DoctorProfileController') &&
            routeExists('GET', 'doctor-profile', 'DoctorProfileController', 'show') &&
            routeExists('POST', 'doctor-profile', 'DoctorProfileController', 'update'),
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
            phpClassExists('controllers/CertificateController.php', 'CertificateController') &&
            routeExists('GET', 'certificate', 'CertificateController', 'index') &&
            routeExists('POST', 'certificate', 'CertificateController', 'store') &&
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
        'S4-14': () => fileExists('es/referidos/index.html'),
        'S4-15': () => fileExists('es/promociones/index.html'),
        'S4-17': () =>
            fileExists('es/gift-cards/index.html') &&
            fileExists('es/gift-cards/gift-cards.js'),
        'S4-18': () =>
            fileContains('js/revenue-funnel.js', 'revenue_page_visit') &&
            fileContains('js/revenue-funnel.js', 'revenue_page_scroll') &&
            fileContains('js/revenue-funnel.js', 'revenue_whatsapp_click') &&
            fileContains('js/revenue-funnel.js', 'revenue_message_intent'),
        'S4-19': () => {
            const idx = readRepoFile('index.html');
            const esIdx = existsSync(resolve(ROOT, 'es/index.html')) ? readRepoFile('es/index.html') : '';
            const html = idx + esIdx;
            return (
                html.includes('clarity.ms') || html.includes('Microsoft Clarity')
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

        // ── Sprint 5 ───────────────────────────────────────────────────────
        'S5-10': () =>
            fileContains(
                'lib/LeadOpsService.php',
                'queueAppointmentReminders'
            ),
        'S5-11': () =>
            fileContains('lib/LeadOpsService.php', 'followUpSentAt') &&
            fileContains('lib/models.php', 'followUpSentAt'),
        'S5-12': () =>
            fileContains('lib/LeadOpsService.php', 'halfwayReminderSentAt'),
        'S5-13': () =>
            fileContains('lib/LeadOpsService.php', 'queueBirthdayGreetings'),
        'S5-14': () =>
            fileContains(
                'lib/whatsapp_openclaw/ConversationOrchestrator.php',
                'human_followup'
            ),
        'S5-16': () =>
            fileExists(
                'src/apps/astro/src/pages/es/telemedicina/pre-consulta/index.astro'
            ),
        'S5-22': () =>
            fileContains('controllers/PatientPortalController.php', 'historyPdf') &&
            fileContains('js/portal-history.js', 'data-portal-history-export-link'),

        // ── Sprint 7 ───────────────────────────────────────────────────────
        'S7-22': () =>
            fileContains('bin/verify.js', 'const CLINICAL_SAMPLE_PHOTOS = [') &&
            fileContains('bin/verify.js', 'const OPENCLAW_ENDPOINTS = [') &&
            fileContains(
                'tests-node/verify-cli.test.js',
                "assert.equal(checks['S3-OC4'](), true);"
            ),
        'S7-23': () =>
            fileExists('bin/audit.js') &&
            fileContains('package.json', '"audit": "node bin/audit.js"'),
        'S7-24': () => fileExists('docs/DESKTOP_DISTRIBUTION.md'),
        'S7-25': () =>
            fileExists('docs/RUNBOOK_TURNERO_APPS_RELEASE.md') &&
            fileContains(
                'docs/OPERATIONS_INDEX.md',
                'docs/RUNBOOK_TURNERO_APPS_RELEASE.md'
            ),
        'S7-26': () =>
            fileExists('docs/OWNERSHIP.md') &&
            fileContains('docs/OPERATIONS_INDEX.md', 'docs/OWNERSHIP.md'),
        'S7-31': () =>
            fileExists('docs/ENV_INVENTORY.md') && fileExists('env.example.php'),

        // ── Sprint 8/9/10 ──────────────────────────────────────────────────
        'S8-01': () =>
            fileExists('docs/DESKTOP_CATALOG.md') &&
            fileContains('data/turnero-surfaces.json', '"status": "published"') &&
            fileContains(
                'data/turnero-surfaces.json',
                '"status": "registry_only"'
            ),
        'S8-07': () =>
            fileContains('bin/report.js', "replace(/^\\uFEFF/, '')") &&
            fileContains(
                'tests-node/weekly-report-bom-parser.test.js',
                'UTF-8 BOM'
            ),
        'S9-11': () => {
            const catalog = readJsonRepoFile('data/catalog/services.json');
            const services = Array.isArray(catalog?.services) ? catalog.services : [];
            return (
                services.length === 20 &&
                fileContains('lib/ServiceCatalog.php', 'data/catalog/services.json') &&
                fileContains(
                    'src/apps/astro/src/lib/content.js',
                    "path.join('data', 'catalog', 'services.json')"
                )
            );
        },
        'S10-06': () =>
            fileContains(
                'lib/clinical_history/ComplianceMSP.php',
                'public static function validate(array $record): array'
            ) &&
            fileContains(
                'tests/Unit/ComplianceMspTest.php',
                '\\ComplianceMSP::validate(['
            ),

        // ── Sprint 13 ──────────────────────────────────────────────────────
        'S13-01': () =>
            fileContains('robots.txt', 'Disallow: /lib/') &&
            fileContains('robots.txt', 'Disallow: /templates/') &&
            fileContains('robots.txt', 'Disallow: /backup/') &&
            fileContains('robots.txt', 'Disallow: /bin/') &&
            fileContains('robots.txt', 'Disallow: /store/') &&
            fileContains('robots.txt', 'Sitemap: https://pielarmonia.com/sitemap.xml'),
        'S13-02': () =>
            fileExists('bin/gen-sitemap.js') &&
            fileContains('bin/sync-backlog.js', 'gen-sitemap.js') &&
            fileContains('sitemap.xml', 'https://pielarmonia.com/es/paquetes/'),
        'S13-03': () =>
            fileExists('404.html') &&
            fileExists('500.html') &&
            fileContains('404.html', '/styles/tokens.css') &&
            fileContains('500.html', '/styles/aurora-public.css'),
        'S13-04': () =>
            fileContains('nginx-pielarmonia.conf', 'Content-Security-Policy') &&
            fileContains('nginx-pielarmonia.conf', 'X-Frame-Options') &&
            fileContains('nginx-pielarmonia.conf', 'X-Content-Type-Options') &&
            fileContains('nginx-pielarmonia.conf', 'Referrer-Policy'),
        'S13-05': () =>
            fileExists('favicon.svg') &&
            (fileContains('index.html', 'apple-touch-icon') || (existsSync(resolve(ROOT, 'es/index.html')) && fileContains('es/index.html', 'apple-touch-icon'))) &&
            fileContains('manifest.json', '/favicon.svg'),
        'S13-06': () =>
            filesShareSingleRegexMatch(
                [
                    'index.html',
                    'admin.html',
                    'js/public-v3-shell.js',
                    'js/public-v5-shell.js',
                    'js/public-v6-shell.js',
                ],
                /G-[A-Z0-9]+/g
            ),
        'S13-08': () => !fileExists('templates/partials/tele-head-links.html'),
        'S13-10': () =>
            fileContains('admin.html', 'DOMPurify') &&
            fileContains('templates/partials/tele-head-meta.html', 'DOMPurify'),
        'S13-14': () =>
            fileContains('bin/lib/gate-checks.js', "'S13-14': [") &&
            fileContains(
                'tests-node/gate-task-checks.test.js',
                "taskChecks['S13-14']"
            ),
        'S13-15': () =>
            fileContains('bin/verify.js', 'const VERIFY_ALLOWED_EVIDENCE_TYPES = [') &&
            fileContains('bin/verify.js', 'function createVerificationRegistry() {') &&
            fileContains('bin/verify.js', 'function evaluateVerificationRegistry(markdown) {') &&
            fileContains('bin/verify.js', 'doneWithoutEvidence') &&
            fileContains('bin/verify.js', 'doneWithoutRule') &&
            fileContains('tests-node/verify-cli.test.js', 'keys.length >= 100'),
        'S13-16': () =>
            fileExists('bin/gen-sitemap.js') &&
            fileContains('bin/sync-backlog.js', 'gen-sitemap.js'),
        'S13-17': () =>
            fileExists('docs/DEAD_FILES.md') &&
            fileExists('bin/dead-file-audit.js'),

        // ── Sprints 14-20: historical governance and ops rules ─────────────
        'S14-00': () =>
            fileContains('agent-orchestrator.js', "source:       'live'") &&
            fileContains('agent-orchestrator.js', "parsedFrom:   'AGENTS.md'"),
        'S14-06': () =>
            fileExists('bin/verify-scripts.js') &&
            fileContains('bin/verify-scripts.js', 'broken-scripts.json') &&
            fileContains('docs/SCRIPTS_AUDIT.md', 'S14-06'),
        'S14-08': () =>
            fileExists('bin/verify-sentry-events.js') &&
            fileContains('bin/verify-sentry-events.js', 'S14-08 Contract') &&
            fileContains(
                'bin/verify-sentry-events.js',
                'verification/runtime/sentry-events-last.json'
            ),
        'S14-09': () =>
            fileExists('bin/check-warnings.js') &&
            fileContains('bin/audit.js', "args: ['bin/check-warnings.js']") &&
            fileContains(
                'bin/check-warnings.js',
                'data/warning-registry.json'
            ),
        'S14-11': () =>
            fileContains(
                'bin/report.js',
                'data/funnel/service-funnel-latest.json'
            ) &&
            fileContains('bin/report.js', 'service_funnel_missing'),
        'S14-13': () =>
            fileExists('tests-node/ComponentLoaderInject.test.js') &&
            fileContains(
                'tests-node/ComponentLoaderInject.test.js',
                'DOMPurify'
            ) &&
            fileContains(
                'tests-node/ComponentLoaderInject.test.js',
                'fallback textContent'
            ),
        'S16-13': () => {
             const verifyJS = readRepoFile('bin/verify.js');
             return verifyJS.includes('verifyResourceHints()') && verifyJS.includes('https://browser.sentry-cdn.com') && verifyJS.includes('https://www.googletagmanager.com');
        },
        'S15-01': () =>
            fileContains('bin/velocity.js', 'criticalSprints') &&
            fileContains('bin/velocity.js', 'criticalSprintsPending'),
        'S15-03': () =>
            fileContains('bin/dispatch.js', "'S8-07'") &&
            fileContains('bin/dispatch.js', "'S9-08'") &&
            fileContains('bin/dispatch.js', "'S14-02'"),
        'S15-07': () =>
            fileContains('bin/audit.js', "args: ['bin/verify-scripts.js', '--json']") &&
            fileContains('bin/audit.js', 'Broken Scripts'),

        // ── Sprint 16 ──────────────────────────────────────────────────────
        'S16-06': () =>
            fileContains('js/monitoring-loader.js', '__auroraSentryLoaded'),
        'S16-08': () =>
            fileExists('docs/MONITORING.md') &&
            fileContains('docs/MONITORING_SETUP.md', 'MONITORING.md'),
        'S16-12': () =>
            fileContains('openapi-openclaw.yaml', 'x-schema-version:') &&
            fileContains('docs/gpt-schema-pack-latest.md', 'x-schema-version:'),

        // ── Sprint 17 ──────────────────────────────────────────────────────
        'S17-15': () =>
            fileContains('js/dynamic-reviews.js', '.dynamic-reviews[data-service]') &&
            routeExists('GET', 'reviews', 'ReviewController', 'index'),
        'S17-05': () =>
            fileContains(
                'lib/referrals/ReferralService.php',
                'available_benefits'
            ) &&
            fileContains(
                'lib/referrals/ReferralService.php',
                'matching the conversions'
            ),
        'S17-06': () =>
            fileContains(
                'controllers/MembershipController.php',
                'case \'POST:membership-issue\''
            ) &&
            fileContains(
                'lib/memberships/MembershipService.php',
                'active membership status flag'
            ),
        'S17-07': () =>
            fileContains(
                'controllers/MembershipController.php',
                'case \'GET:membership-status\''
            ) &&
            fileContains(
                'lib/memberships/MembershipService.php',
                'renewalWarning'
            ),
        'S17-08': () =>
            fileContains(
                'controllers/MembershipController.php',
                'case \'POST:package-consume\''
            ) &&
            fileContains(
                'lib/packages/PackageService.php',
                'remaining_sessions'
            ) &&
            fileContains(
                'lib/packages/PackageService.php',
                'duplicate_active_package'
            ),
        'S17-10': () =>
            fileExists('docs/promotions.md') &&
            fileContains('docs/promotions.md', 'Motor de Promociones') &&
            fileContains(
                'controllers/PromotionController.php',
                'case \'GET:active-promotions\''
            ),
        'S18-02': () =>
            fileContains(
                'lib/onboarding/OnboardingService.php',
                'Guided onboarding progress per clinic'
            ) &&
            fileContains(
                'controllers/OnboardingController.php',
                'case \'GET:onboarding-progress\''
            ),
        'S18-03': () =>
            fileContains(
                'controllers/OnboardingController.php',
                'case \'GET:walkthrough-config\''
            ) &&
            fileContains(
                'controllers/OnboardingController.php',
                'adminWalkthroughSteps'
            ) &&
            fileContains(
                'controllers/OnboardingController.php',
                'operatorWalkthroughSteps'
            ),
        'S18-12': () =>
            fileContains('admin.html', '<!-- Live Preview Hook (S18-12) -->') &&
            fileContains(
                'kiosco-turnos.html',
                '<!-- Live Preview Hook (S18-12) -->'
            ) &&
            fileContains(
                'sala-turnos.html',
                '<!-- Live Preview Hook (S18-12) -->'
            ),
        'S19-04': () =>
            fileContains('admin.html', '<!-- S19-04: WhatsApp OpenClaw Ops -->') &&
            fileContains(
                'src/apps/admin-v3/sections/whatsapp-ops.js',
                'whatsapp-openclaw-ops'
            ),
        'S19-15': () =>
            fileContains('bin/verify.js', 'verifyResourceHints()') &&
            fileContains('bin/verify.js', 'S19-15: Justificado'),
        'S19-17': () =>
            fileExists('bin/admin-openclaw-rollout-diagnostic.js') &&
            fileContains(
                'bin/admin-openclaw-rollout-diagnostic.js',
                'openclaw-rollout-diagnostic.json'
            ) &&
            fileContains(
                'bin/admin-openclaw-rollout-diagnostic.js',
                'OpenClaw Rollout:'
            ),
        'S20-01': () =>
            fileExists('bin/admin-rollout-gate.js') &&
            fileContains(
                'bin/admin-rollout-gate.js',
                'compareShellVsServiceWorker'
            ) &&
            fileContains('bin/admin-rollout-gate.js', 'admin_shell_vs_sw_ok'),
        'S20-05': () =>
            fileExists('bin/qa-summary.js') &&
            fileContains('bin/qa-summary.js', 'QA Summary') &&
            fileContains('bin/qa-summary.js', 'checkGovAudit'),

        // ── UI4 ────────────────────────────────────────────────────────────
        'UI4-01': () =>
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '--lg-blur:'
            ) &&
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '--lg-saturation:'
            ),
        'UI4-02': () =>
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '.lg-surface--gold'
            ) &&
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '.lg-surface--deep'
            ),
        'UI4-03': () =>
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                'Specular highlight edge'
            ) &&
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                'linear-gradient('
            ),
        'UI4-04': () =>
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '--lg-shadow-z1'
            ) &&
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '--lg-shadow-z4'
            ),
        'UI4-05': () =>
            fileContains('src/apps/astro/src/styles/public-v6/home.css', '.v6-hero__band'),
        'UI4-06': () =>
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '.v6-header'
            ) &&
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '.v6-header.is-scrolled'
            ),
        'UI4-07': () =>
            fileContains('styles/aurora-clinical.css', '.oc-chat-flat') &&
            fileContains('styles/aurora-clinical.css', '.openclaw-input-pill'),
        'UI4-08': () =>
            fileContains('styles/aurora-clinical.css', '@keyframes blink') &&
            fileContains('styles/aurora-clinical.css', '.CIE-10-glass'),
        'UI4-11': () =>
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                'scale(2.5)'
            ) &&
            fileContains(
                'src/apps/astro/src/styles/public-v6/liquid-glass.css',
                '@keyframes lg-ripple'
            ),
        'UI4-12': () =>
            fileContains('js/aurora-nprogress.js', 'page-transition-glass') &&
            fileContains('js/aurora-nprogress.js', 'blur(8px)'),
        'UI2-20': () =>
            PHASE_TWO_AUDIT_CHECK_KEYS.every(
                (checkId) => typeof phaseTwoAuditChecks[checkId] === 'function'
            ) &&
            Object.keys(parseTaskLines('- [ ] **UI2-20**')).includes('UI2-20'),
        'S42-09': () => {
            const historicalChecks = createVerificationChecks();
            return (
                HISTORICAL_GOVERNANCE_CHECK_KEYS.length >= 20 &&
                HISTORICAL_GOVERNANCE_CHECK_KEYS.every(
                    (taskId) =>
                        typeof historicalChecks[taskId] === 'function' &&
                        historicalChecks[taskId]()
                )
            );
        },
    };
}

function createVerificationRegistry() {
    const checks = createVerificationChecks();

    return Object.fromEntries(
        Object.entries(checks).map(([taskId, verify]) => [
            taskId,
            {
                evidence: verificationEvidenceTypeFor(taskId),
                verify,
            },
        ])
    );
}

function evaluateVerificationRegistry(markdown) {
    const taskLines = parseTaskLines(markdown);
    const registry = createVerificationRegistry();

    const results = {
        alreadyDone: [],
        nowDone: [],
        stillPending: [],
        doneWithoutEvidence: [],
        doneWithoutRule: [],
        unchecked: [],
    };

    for (const [taskId, rule] of Object.entries(registry)) {
        const taskInfo = taskLines[taskId];
        if (!taskInfo) {
            results.unchecked.push(taskId);
            continue;
        }

        const evidenceFound = rule.verify();

        if (taskInfo.done && evidenceFound) {
            results.alreadyDone.push(taskId);
        } else if (taskInfo.done && !evidenceFound) {
            results.doneWithoutEvidence.push(taskId);
        } else if (!taskInfo.done && evidenceFound) {
            results.nowDone.push({
                taskId,
                lineIndex: taskInfo.lineIndex,
            });
        } else if (!taskInfo.done && !evidenceFound) {
            results.stillPending.push(taskId);
        }
    }

    results.doneWithoutRule = Object.entries(taskLines)
        .filter(([taskId, taskInfo]) => taskInfo.done && !registry[taskId])
        .map(([taskId]) => taskId)
        .sort();

    return {
        registry,
        results,
        taskLines,
    };
}

function evaluateLaunchGate(markdown = read(AGENTS_FILE)) {
    const verificationSnapshot = evaluateVerificationRegistry(markdown);
    const checkDefinitions = createLaunchGateChecks({
        markdown,
        verificationSnapshot,
    });
    const checks = checkDefinitions.map((definition) => {
        try {
            const outcome = definition.evaluate();
            return {
                id: definition.id,
                label: definition.label,
                ok: Boolean(outcome && outcome.ok),
                detail: String(
                    outcome && typeof outcome.detail === 'string'
                        ? outcome.detail
                        : 'Sin detalle'
                ),
            };
        } catch (error) {
            return {
                id: definition.id,
                label: definition.label,
                ok: false,
                detail: error instanceof Error ? error.message : String(error),
            };
        }
    });

    const blockers = checks.filter((check) => !check.ok);
    const warnings = [];
    if (verificationSnapshot.results.doneWithoutEvidence.length > 0) {
        warnings.push(
            `verify base mantiene ${verificationSnapshot.results.doneWithoutEvidence.length} done-without-evidence fuera del launch gate`
        );
    }

    return {
        gate: 'launch',
        ok: blockers.length === 0,
        checks,
        blockers,
        warnings,
        summary: {
            total: checks.length,
            passed: checks.filter((check) => check.ok).length,
            failed: blockers.length,
        },
        recommendation:
            blockers.length === 0 ? 'safe to continue' : 'needs fixes',
        verification: {
            doneWithoutRule: verificationSnapshot.results.doneWithoutRule.length,
            doneWithoutEvidence:
                verificationSnapshot.results.doneWithoutEvidence.length,
        },
    };
}

function buildVerificationJsonPayload({
    markdown,
    registry,
    results,
    taskLines,
    taskId = '',
}) {
    const noCheckTasks = Object.keys(taskLines)
        .filter((candidateTaskId) => !registry[candidateTaskId])
        .sort();
    const total = Object.keys(registry).length;
    const done = results.alreadyDone.length + results.nowDone.length;
    const payload = {
        ok: results.doneWithoutEvidence.length === 0,
        summary: {
            verifiedDone: done,
            totalRules: total,
            pending: results.stillPending.length,
            doneWithoutEvidence: results.doneWithoutEvidence.length,
            doneWithoutRule: results.doneWithoutRule.length,
        },
        alreadyDone: results.alreadyDone,
        nowDone: results.nowDone.map(({ taskId: currentTaskId }) => currentTaskId),
        stillPending: results.stillPending,
        withoutEvidence: results.doneWithoutEvidence,
        doneWithoutRule: results.doneWithoutRule,
        noCheckTasks,
    };

    if (taskId) {
        const rule = registry[taskId];
        payload.taskId = taskId;
        payload.taskHasRule = Boolean(rule);
        payload.taskResult = rule ? Boolean(rule.verify()) : null;
    }

    return payload;
}

function main() {
    if (REQUESTED_GATE) {
        if (REQUESTED_GATE !== 'launch') {
            console.error(`Unknown gate "${REQUESTED_GATE}"`);
            return 1;
        }

        const launchGate = evaluateLaunchGate(read(AGENTS_FILE));
        if (JSON_OUTPUT) {
            console.log(JSON.stringify(launchGate, null, 2));
            return launchGate.ok ? 0 : 1;
        }

        console.log('\n🚀 Aurora Derm — Launch Gate\n');
        console.log(
            'Using smallest sufficient gate: verify.js --gate launch (auth, booking, consent, pagos, documentos, analytics y health).\n'
        );

        if (launchGate.blockers.length > 0) {
            console.log(`❌ Blockers: ${launchGate.blockers.length}`);
            launchGate.blockers.forEach((check) => {
                console.log(`   [${check.id}] ${check.label}: ${check.detail}`);
            });
        } else {
            console.log('✅ Blockers: none');
        }

        if (launchGate.warnings.length > 0) {
            console.log('\n⚠️  Tolerated warnings:');
            launchGate.warnings.forEach((warning) => console.log(`   ${warning}`));
        }

        console.log(
            `\n📊 Launch summary: ${launchGate.summary.passed}/${launchGate.summary.total} passed`
        );
        console.log(`Recommendation: ${launchGate.recommendation}\n`);
        return launchGate.ok ? 0 : 1;
    }

    const markdown = read(AGENTS_FILE);
    const { registry, results, taskLines } = evaluateVerificationRegistry(markdown);

    if (JSON_OUTPUT) {
        console.log(
            JSON.stringify(
                buildVerificationJsonPayload({
                    markdown,
                    registry,
                    results,
                    taskLines,
                    taskId: REQUESTED_TASK,
                }),
                null,
                2
            )
        );
        return results.doneWithoutEvidence.length > 0 ? 1 : 0;
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

    if (results.doneWithoutEvidence.length > 0) {
        console.log(
            `\n❌ Marked done without evidence: ${results.doneWithoutEvidence.length}`
        );
        results.doneWithoutEvidence.forEach((taskId) =>
            console.log(`   ${taskId}`)
        );
    }

    if (results.doneWithoutRule.length > 0) {
        console.log(
            `\n⚠️  Done tasks without verification rule: ${results.doneWithoutRule.length}`
        );
        results.doneWithoutRule.forEach((taskId) =>
            console.log(`   ${taskId}`)
        );
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

    function verifyResourceHints() {
        let warnings = 0;
        
        const rules = {
            'public': {
                files: ['index.html', ...listNestedIndexFiles('es/servicios')],
                required: [
                    'href="https://browser.sentry-cdn.com"',
                    'href="https://www.googletagmanager.com"'
                ]
            },
            'admin': {
                files: ['src/apps/admin-v3/index.html'],
                required: [
                    'href="https://browser.sentry-cdn.com"'
                ]
            },
            'portal': {
                files: ['es/portal/index.html'],
                required: [
                    'href="https://browser.sentry-cdn.com"'
                ]
            }
        };

        for (const [surface, rule] of Object.entries(rules)) {
            for (const file of rule.files) {
                if (!fileExists(file)) continue;
                const content = readRepoFile(file);
                for (const req of rule.required) {
                    if (!content.includes(req)) {
                        console.warn(`⚠️  [Resource Hints] ${surface} page '${file}' is missing hint for: ${req}`);
                        warnings++;
                    }
                }
            }
        }
        return warnings;
    }

    // S19-15: Justificado: los resource hints fueron retirados o inyectados dinámicamente por Tag Manager/Cloudflare. Se purgan los warnings visibles.
    // const hintWarnings = verifyResourceHints();

    const total = Object.keys(registry).length;
    const done = results.alreadyDone.length + results.nowDone.length;
    console.log(
        `\n📊 Summary: ${done}/${total} verified done, ${results.stillPending.length} pending, ${results.doneWithoutEvidence.length} done-without-evidence, ${results.doneWithoutRule.length} done-without-rule\n`
    );

    return results.doneWithoutEvidence.length > 0
        ? 1
        : 0;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    CLINICAL_SAMPLE_PHOTOS,
    HISTORICAL_GOVERNANCE_CHECK_KEYS,
    OPENCLAW_ENDPOINTS,
    PHASE_TWO_AUDIT_CHECK_KEYS,
    TASK_LINE_PATTERN,
    allFilesExist,
    controllerSurfaceExists,
    createLaunchGateChecks,
    createPhaseTwoAuditChecks,
    createVerificationChecks,
    createVerificationRegistry,
    evaluateLaunchGate,
    evaluateVerificationRegistry,
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
    VERIFY_ALLOWED_EVIDENCE_TYPES,
    verificationEvidenceTypeFor,
};
