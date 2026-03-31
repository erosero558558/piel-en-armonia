'use strict';

const { resolve } = require('path');

function pass(detail) {
  return { ok: true, detail };
}

function fail(detail) {
  return { ok: false, detail };
}

function formatMissing(relativePath, missing) {
  if (missing.length === 0) {
    return `${relativePath} verificado`;
  }

  return `${relativePath} sin ${missing.map((item) => `"${item}"`).join(', ')}`;
}

function createTaskCheckDefinitions(context) {
  const { ROOT, read, fileExists, execSync } = context;
  const resolveRoot = (relativePath) => resolve(ROOT, relativePath);

  function filePresence(relativePath, detail) {
    if (!fileExists(relativePath)) {
      return fail(`No existe ${relativePath}`);
    }

    return pass(detail || `Existe ${relativePath}`);
  }

  function fileIncludes(relativePath, snippets, successDetail) {
    if (!fileExists(relativePath)) {
      return fail(`No existe ${relativePath}`);
    }

    const content = read(resolveRoot(relativePath));
    const missing = snippets.filter((snippet) => !content.includes(snippet));
    if (missing.length > 0) {
      return fail(formatMissing(relativePath, missing));
    }

    return pass(successDetail || formatMissing(relativePath, []));
  }

  function fileMatches(relativePath, patterns, successDetail) {
    if (!fileExists(relativePath)) {
      return fail(`No existe ${relativePath}`);
    }

    const content = read(resolveRoot(relativePath));
    const missing = patterns
      .filter(({ pattern }) => !pattern.test(content))
      .map(({ label }) => label);
    if (missing.length > 0) {
      return fail(formatMissing(relativePath, missing));
    }

    return pass(successDetail || formatMissing(relativePath, []));
  }

  function firstPassing(results, fallbackDetail) {
    for (const result of results) {
      if (result && result.ok) {
        return result;
      }
    }

    const details = results
      .filter(Boolean)
      .map((result) => result.detail)
      .filter(Boolean);
    return fail(fallbackDetail || details.join(' | ') || 'Sin evidencia');
  }

  return {
    'S1-01': [
      {
        name: 'bioestimuladores link fixed in index.html',
        evaluate: () => {
          const indexPath = 'index.html';
          const indexHtml = read(resolveRoot(indexPath));
          const legacyHref = 'href="/es/servicios/bioestimuladores/"';
          const fixedHref = 'href="/es/servicios/bioestimuladores-colageno/"';

          if (!indexHtml.includes(legacyHref)) {
            return pass(`${indexPath} ya no apunta al slug legacy de bioestimuladores`);
          }

          if (indexHtml.includes(fixedHref)) {
            return pass(`${indexPath} incluye el slug corregido ${fixedHref}`);
          }

          return fail(`${indexPath} mantiene ${legacyHref} sin el reemplazo ${fixedHref}`);
        },
      },
    ],
    'S1-04': [
      {
        name: 'manifest.json has no Flow OS reference',
        evaluate: () => {
          const manifestPath = 'manifest.json';

          if (!fileExists(manifestPath)) {
            return fail(`No existe ${manifestPath}`);
          }

          try {
            const manifest = JSON.parse(read(resolveRoot(manifestPath)));
            const manifestName = String(manifest.name || '');
            if (manifestName.includes('Flow OS')) {
              return fail(`${manifestPath} todavía contiene "Flow OS"`);
            }

            if (!manifestName.includes('Aurora Derm')) {
              return fail(`${manifestPath} no refleja "Aurora Derm" en name`);
            }

            return pass(`${manifestPath} usa name="${manifestName}" sin referencias a Flow OS`);
          } catch {
            return fail(`${manifestPath} no es JSON válido`);
          }
        },
      },
    ],
    'S2-07': [
      {
        name: 'WhatsApp links have ?text= parameter',
        evaluate: () => {
          const indexPath = 'index.html';
          const indexHtml = read(resolveRoot(indexPath));
          const matches = indexHtml.match(/wa\.me\/593982453672\?text=/g) || [];
          if (matches.length < 3) {
            return fail(`${indexPath} solo tiene ${matches.length} links WhatsApp con ?text=`);
          }

          return pass(`${indexPath} tiene ${matches.length} links WhatsApp con ?text=`);
        },
      },
    ],
    'S2-18': [
      {
        name: 'Medical disclaimer on all service pages',
        evaluate: () => {
          try {
            const files = execSync(
              `find "${resolveRoot('es/servicios')}" -name "index.html"`,
              { encoding: 'utf8' }
            )
              .split('\n')
              .filter(Boolean);
            const missing = files.filter((filePath) => !read(filePath).includes('Los resultados varían'));
            if (missing.length > 0) {
              return fail(
                `Falta disclaimer en ${missing
                  .slice(0, 3)
                  .map((filePath) => filePath.replace(`${ROOT}/`, ''))
                  .join(', ')}`
              );
            }

            return pass(`Disclaimer validado en ${files.length} páginas de es/servicios`);
          } catch {
            return fail('No se pudo inspeccionar es/servicios');
          }
        },
      },
    ],
    'S2-19': [
      {
        name: 'Hero badges present in index.html',
        evaluate: () => {
          const indexPath = 'index.html';
          const indexHtml = read(resolveRoot(indexPath));
          if (indexHtml.includes('MSP Certificado')) {
            return pass(`${indexPath} muestra el badge "MSP Certificado"`);
          }

          if (indexHtml.includes('hero-badge')) {
            return pass(`${indexPath} conserva el bloque .hero-badge`);
          }

          return fail(`${indexPath} no muestra badges visibles en el hero`);
        },
      },
    ],
    'S2-21': [
      {
        name: 'Primera consulta page exists',
        evaluate: () => filePresence('es/primera-consulta/index.html'),
      },
      {
        name: 'Primera consulta has WhatsApp CTA',
        warn: true,
        evaluate: () => {
          const pagePath = 'es/primera-consulta/index.html';
          if (!fileExists(pagePath)) {
            return fail(`No existe ${pagePath}`);
          }

          const pageHtml = read(resolveRoot(pagePath));
          if (pageHtml.includes('wa.me/') && pageHtml.includes('?text=')) {
            return pass(`${pagePath} incluye CTA WhatsApp con copy prellenado`);
          }

          return fail(`${pagePath} no incluye CTA WhatsApp con ?text=`);
        },
      },
    ],
    'S3-05': [
      {
        name: 'Pre-consulta page exists',
        evaluate: () => filePresence('es/pre-consulta/index.html'),
      },
    ],
    'S3-19': [
      {
        name: 'Prescription artifact present',
        evaluate: () => {
          const directController = filePresence(
            'controllers/PrescriptionController.php',
            'Existe controllers/PrescriptionController.php'
          );
          const openclawController = fileIncludes(
            'controllers/OpenclawController.php',
            [
              'public static function savePrescription',
              'public static function getPrescriptionPdf',
              "'pdf_url'",
              'Content-Type: application/pdf',
            ],
            'controllers/OpenclawController.php expone savePrescription(), getPrescriptionPdf() y salida PDF'
          );
          const routes = fileMatches(
            'lib/routes.php',
            [
              {
                label: 'GET openclaw-prescription -> getPrescriptionPdf',
                pattern: /\$router->add\('GET'\s*,\s*'openclaw-prescription'\s*,\s*\[OpenclawController::class,\s*'getPrescriptionPdf'\]\);/,
              },
              {
                label: 'POST openclaw-prescription -> savePrescription',
                pattern: /\$router->add\('POST'\s*,\s*'openclaw-prescription'\s*,\s*\[OpenclawController::class,\s*'savePrescription'\]\);/,
              },
            ],
            'lib/routes.php conecta GET/POST openclaw-prescription'
          );

          if (directController.ok) {
            return directController;
          }

          const fallback = firstPassing(
            [openclawController.ok && routes.ok ? pass(`${openclawController.detail}; ${routes.detail}`) : null],
            [
              directController.detail,
              openclawController.detail,
              routes.detail,
            ]
              .filter(Boolean)
              .join(' | ')
          );

          return fallback;
        },
      },
    ],
    'S3-24': [
      {
        name: 'Booking page exists',
        evaluate: () =>
          filePresence(
            'es/agendar/index.html',
            'Existe es/agendar/index.html como shell pública de booking'
          ),
      },
      {
        name: 'Booking integrates with availability artifacts',
        warn: true,
        evaluate: () => {
          const bookingPage = fileIncludes(
            'es/agendar/index.html',
            ['id="booking-app"', 'id="booking-date"', 'id="time-slots"'],
            'es/agendar/index.html contiene la UI de servicio, fecha y horarios'
          );
          const calendarModule = fileIncludes(
            'src/apps/booking/components/calendar.js',
            ['loadAvailabilityData', 'availability[selectedDate]', 'bookedSlots'],
            'src/apps/booking/components/calendar.js consulta disponibilidad real y filtra slots ocupados'
          );

          if (bookingPage.ok && calendarModule.ok) {
            return pass(`${bookingPage.detail}; ${calendarModule.detail}`);
          }

          return fail([bookingPage.detail, calendarModule.detail].filter(Boolean).join(' | '));
        },
      },
    ],
    'S3-36': [
      {
        name: 'Doctor profile controller exists',
        evaluate: () =>
          fileIncludes(
            'controllers/DoctorProfileController.php',
            ['final class DoctorProfileController', 'public static function show', 'public static function update'],
            'controllers/DoctorProfileController.php expone show()/update() para el perfil médico'
          ),
      },
      {
        name: 'Doctor profile routes wired',
        evaluate: () =>
          fileMatches(
            'lib/routes.php',
            [
              {
                label: 'GET doctor-profile -> show',
                pattern: /\$router->add\('GET'\s*,\s*'doctor-profile'\s*,\s*\[DoctorProfileController::class,\s*'show'\]\);/,
              },
              {
                label: 'POST doctor-profile -> update',
                pattern: /\$router->add\('POST'\s*,\s*'doctor-profile'\s*,\s*\[DoctorProfileController::class,\s*'update'\]\);/,
              },
            ],
            'lib/routes.php conecta GET/POST doctor-profile'
          ),
      },
    ],
    'S3-45': [
      {
        name: 'Task-specific gate map exists with audited examples',
        evaluate: () =>
          fileIncludes(
            'bin/lib/gate-checks.js',
            ["'S3-19': [", "'S3-24': [", "'S3-36': [", "'S3-45': ["],
            'bin/lib/gate-checks.js contiene checks auditados para S3-19, S3-24, S3-36 y el propio S3-45'
          ),
      },
      {
        name: 'Gate runtime and test harness consume the shared map',
        evaluate: () => {
          const gateRuntime = fileIncludes(
            'bin/gate.js',
            ["require('./lib/gate-checks')", 'createTaskCheckDefinitions', 'taskChecks[taskId].forEach'],
            'bin/gate.js consume el mapa compartido y recorre checks por tarea'
          );
          const gateTests = fileIncludes(
            'tests-node/gate-task-checks.test.js',
            ['createTaskCheckDefinitions', "taskChecks['S3-19']", "taskChecks['S3-36']"],
            'tests-node/gate-task-checks.test.js valida el mapa compartido con node:test'
          );

          if (gateRuntime.ok && gateTests.ok) {
            return pass(`${gateRuntime.detail}; ${gateTests.detail}`);
          }

          return fail([gateRuntime.detail, gateTests.detail].filter(Boolean).join(' | '));
        },
      },
    ],
    'S4-08': [
      {
        name: 'Pricing page exists',
        evaluate: () =>
          filePresence(
            'es/software/turnero-clinicas/precios/index.html',
            'Existe es/software/turnero-clinicas/precios/index.html'
          ),
      },
      {
        name: 'Pricing page has 3 tiers',
        evaluate: () => {
          const pricingPath = 'es/software/turnero-clinicas/precios/index.html';
          if (!fileExists(pricingPath)) {
            return fail(`No existe ${pricingPath}`);
          }

          const pricingHtml = read(resolveRoot(pricingPath));
          const hasFree = pricingHtml.includes('Free') || pricingHtml.includes('Gratis');
          const hasPro = pricingHtml.includes('Pro');
          const hasEnterprise = pricingHtml.includes('Enterprise');

          if (!hasFree || !hasPro || !hasEnterprise) {
            return fail(`${pricingPath} no contiene los tres tiers Free/Pro/Enterprise`);
          }

          return pass(`${pricingPath} expone tiers Free/Gratis, Pro y Enterprise`);
        },
      },
    ],
    'S13-02': [
      {
        name: 'Sitemap automation and critical public routes are present',
        evaluate: () => {
          const generator = fileIncludes(
            'bin/gen-sitemap.js',
            [
              'const SITEMAP_FILE = path.join(ROOT, \'sitemap.xml\');',
              'const LEGACY_CONTRACT_ROUTES = [',
              'collectCatalogRoutes(routes);',
              "collectJsonRoutes('content/public-v6/es/software.json', routes);",
              'const BASE_URL = \'https://pielarmonia.com\';',
            ],
            'bin/gen-sitemap.js combina rutas de contrato, catalogo y contenido con base https://pielarmonia.com'
          );
          const sync = fileIncludes(
            'bin/sync-backlog.js',
            ['gen-sitemap.js', 'Auto-regenerar sitemap.xml después de cada sync'],
            'bin/sync-backlog.js regenera sitemap.xml automáticamente'
          );
          const sitemap = fileIncludes(
            'sitemap.xml',
            [
              'https://pielarmonia.com/es/paquetes/',
              'https://pielarmonia.com/es/agendar/',
              'https://pielarmonia.com/es/portal/',
              'https://pielarmonia.com/es/software/turnero-clinicas/precios/',
              'https://pielarmonia.com/en/services/depilacion-laser/',
            ],
            'sitemap.xml incluye paquetes y rutas públicas recientes de booking, portal, pricing y servicio SEO canónico'
          );

          if (generator.ok && sync.ok && sitemap.ok) {
            return pass(`${generator.detail}; ${sync.detail}; ${sitemap.detail}`);
          }

          return fail([generator.detail, sync.detail, sitemap.detail].filter(Boolean).join(' | '));
        },
      },
    ],
    'S8-01': [
      {
        name: 'Desktop catalog truth artifacts exist and declare explicit surface status',
        evaluate: () => {
          const doc = filePresence(
            'docs/DESKTOP_CATALOG.md',
            'docs/DESKTOP_CATALOG.md documenta la tabla de verdad del catálogo desktop'
          );
          const registry = fileIncludes(
            'data/turnero-surfaces.json',
            [
              '"id": "operator"',
              '"status": "published"',
              '"id": "kiosk"',
              '"status": "registry_only"',
              '"id": "sala_tv"',
            ],
            'data/turnero-surfaces.json declara status explícito para operator, kiosk y sala_tv'
          );

          if (doc.ok && registry.ok) {
            return pass(`${doc.detail}; ${registry.detail}`);
          }

          return fail([doc.detail, registry.detail].filter(Boolean).join(' | '));
        },
      },
    ],
    'S8-07': [
      {
        name: 'BOM-safe JSON parsing is wired and covered by test',
        evaluate: () => {
          const report = fileIncludes(
            'bin/report.js',
            ["replace(/^\\uFEFF/, '')", 'JSON.parse'],
            'bin/report.js normaliza UTF-8 BOM antes de parsear JSON operativo'
          );
          const coverage = fileIncludes(
            'tests-node/weekly-report-bom-parser.test.js',
            [
              'weekly report and generic JSON parsers gracefully handle UTF-8 BOM',
              'report.js no debe morir con SyntaxError por leer un claims/stuck.json con BOM',
            ],
            'tests-node/weekly-report-bom-parser.test.js cubre el contrato BOM de readiness y report.js'
          );

          if (report.ok && coverage.ok) {
            return pass(`${report.detail}; ${coverage.detail}`);
          }

          return fail([report.detail, coverage.detail].filter(Boolean).join(' | '));
        },
      },
    ],
    'S9-11': [
      {
        name: 'Commercial catalog exists with 20 services and shared consumers',
        evaluate: () => {
          const catalogPath = 'data/catalog/services.json';
          if (!fileExists(catalogPath)) {
            return fail(`No existe ${catalogPath}`);
          }

          let services = [];
          try {
            const parsed = JSON.parse(read(resolveRoot(catalogPath)));
            services = Array.isArray(parsed.services) ? parsed.services : [];
          } catch {
            return fail(`${catalogPath} no es JSON válido`);
          }

          if (services.length !== 20) {
            return fail(`${catalogPath} expone ${services.length} servicios; se esperaban 20`);
          }

          const runtime = fileIncludes(
            'lib/ServiceCatalog.php',
            ['data/catalog/services.json', 'function load_service_catalog_payload(): array'],
            'lib/ServiceCatalog.php usa data/catalog/services.json como fuente canónica'
          );
          const consumers = firstPassing(
            [
              fileIncludes(
                'controllers/PatientPortalController.php',
                ['service_catalog_preparation_for('],
                'controllers/PatientPortalController.php consume el catálogo comercial'
              ),
              fileIncludes(
                'lib/email.php',
                ['service_catalog_preparation_for('],
                'lib/email.php consume el catálogo comercial'
              ),
              fileIncludes(
                'src/apps/astro/src/lib/content.js',
                ["path.join('data', 'catalog', 'services.json')"],
                'src/apps/astro/src/lib/content.js carga el catálogo comercial'
              ),
            ],
            'No se encontró un consumidor vivo del catálogo comercial'
          );

          if (runtime.ok && consumers.ok) {
            return pass(`${catalogPath} mantiene 20 servicios; ${runtime.detail}; ${consumers.detail}`);
          }

          return fail([runtime.detail, consumers.detail].filter(Boolean).join(' | '));
        },
      },
    ],
    'S10-06': [
      {
        name: 'ComplianceMSP.validate contract exists for diagnosis quality gate',
        evaluate: () => {
          const runtime = fileMatches(
            'lib/clinical_history/ComplianceMSP.php',
            [
              { label: 'class ComplianceMSP', pattern: /final class ComplianceMSP/ },
              { label: 'public static function validate(array $record): array', pattern: /public static function validate\(array \$record\): array/ },
            ],
            'lib/clinical_history/ComplianceMSP.php expone ComplianceMSP::validate()'
          );
          const coverage = fileIncludes(
            'tests/Unit/ComplianceMspTest.php',
            ['\\ComplianceMSP::validate(['],
            'tests/Unit/ComplianceMspTest.php ejerce ComplianceMSP::validate()'
          );

          if (runtime.ok && coverage.ok) {
            return pass(`${runtime.detail}; ${coverage.detail}`);
          }

          return fail([runtime.detail, coverage.detail].filter(Boolean).join(' | '));
        },
      },
    ],
    'S12-06': [
      {
        name: 'Google Business checklist artifact exists',
        evaluate: () =>
          filePresence(
            'docs/GOOGLE_BUSINESS_CHECKLIST.md',
            'Existe docs/GOOGLE_BUSINESS_CHECKLIST.md'
          ),
      },
    ],
    'S13-14': [
      {
        name: 'Gate map includes audited checks for S8, S9, S10 and S12',
        evaluate: () =>
          fileIncludes(
            'bin/lib/gate-checks.js',
            ["'S8-01': [", "'S8-07': [", "'S9-11': [", "'S10-06': [", "'S12-06': [", "'S13-14': ["],
            'bin/lib/gate-checks.js contiene checks mínimos auditados para S8-01, S8-07, S9-11, S10-06, S12-06 y el propio S13-14'
          ),
      },
      {
        name: 'Gate test harness covers the new audited check map',
        evaluate: () =>
          fileIncludes(
            'tests-node/gate-task-checks.test.js',
            ["taskChecks['S8-01']", "taskChecks['S8-07']", "taskChecks['S9-11']", "taskChecks['S10-06']", "taskChecks['S12-06']", "taskChecks['S13-14']"],
            'tests-node/gate-task-checks.test.js cubre el nuevo mapa de checks auditados'
          ),
      },
    ],
  };
}

module.exports = {
  createTaskCheckDefinitions,
};
