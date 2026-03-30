import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..', '..');
const OPENAPI_FILE = path.join(REPO_ROOT, 'docs', 'openapi.yaml');

let cachedModel = null;

function normalizeText(value) {
    return typeof value === 'string' && value.trim().length
        ? value.trim()
        : '';
}

function slugify(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function inferGroupTitle(route, operation = {}) {
    const tag = Array.isArray(operation.tags) ? normalizeText(operation.tags[0]) : '';
    if (tag) {
        return tag;
    }

    const resource = normalizeText(
        String(route || '')
            .replace(/^\/api\.php\?resource=/, '')
            .replace(/^\/+/, '')
            .split(/[/?&]/)[0]
    );
    if (resource) {
        return resource.charAt(0).toUpperCase() + resource.slice(1);
    }

    return 'General';
}

function loadSpec() {
    if (cachedModel) {
        return cachedModel;
    }

    const raw = fs.readFileSync(OPENAPI_FILE, 'utf8');
    const spec = YAML.parse(raw) || {};
    const paths = spec && typeof spec.paths === 'object' ? spec.paths : {};
    const groups = new Map();
    let operationCount = 0;

    for (const [route, operations] of Object.entries(paths)) {
        const safeOperations =
            operations && typeof operations === 'object' ? operations : {};
        for (const [method, operation] of Object.entries(safeOperations)) {
            const title = inferGroupTitle(route, operation || {});
            if (!groups.has(title)) {
                groups.set(title, []);
            }

            groups.get(title).push({
                method: String(method || '').toUpperCase(),
                route: normalizeText(route),
                summary: normalizeText(operation?.summary) || normalizeText(operation?.operationId),
            });
            operationCount += 1;
        }
    }

    cachedModel = {
        info: {
            title: normalizeText(spec?.info?.title),
            version: normalizeText(spec?.info?.version),
            description: normalizeText(spec?.info?.description),
            openapi: normalizeText(spec?.openapi),
        },
        servers: Array.isArray(spec?.servers)
            ? spec.servers
                  .map((server) => ({
                      url: normalizeText(server?.url),
                      description: normalizeText(server?.description),
                  }))
                  .filter((server) => server.url)
            : [],
        securitySchemes:
            spec?.components?.securitySchemes &&
            typeof spec.components.securitySchemes === 'object'
                ? Object.entries(spec.components.securitySchemes)
                      .map(([key, scheme]) => ({
                          key: normalizeText(key),
                          type: normalizeText(scheme?.type),
                          in: normalizeText(scheme?.in),
                          name: normalizeText(scheme?.name),
                      }))
                      .filter((scheme) => scheme.key)
                : [],
        counts: {
            paths: Object.keys(paths).length,
            operations: operationCount,
            schemas:
                spec?.components?.schemas &&
                typeof spec.components.schemas === 'object'
                    ? Object.keys(spec.components.schemas).length
                    : 0,
        },
        groups: Array.from(groups.entries())
            .map(([title, items]) => ({
                id: slugify(title),
                title,
                count: items.length,
                items: items.sort((left, right) => {
                    if (left.route === right.route) {
                        return left.method.localeCompare(right.method);
                    }
                    return left.route.localeCompare(right.route);
                }),
            }))
            .sort((left, right) => left.title.localeCompare(right.title)),
    };

    return cachedModel;
}

export function getSoftwareApiDocsSource() {
    return loadSpec();
}
