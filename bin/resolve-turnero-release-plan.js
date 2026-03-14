#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    buildTurneroReleaseArtifactName,
    getTurneroDefaultTargetKey,
    getTurneroRegistryDefaults,
    listTurneroSurfaceDefinitions,
    listTurneroTargetKeys,
} = require('../lib/turnero-surface-registry.js');

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed[key] = 'true';
            continue;
        }
        parsed[key] = next;
        index += 1;
    }
    return parsed;
}

function normalizeId(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function parseList(value) {
    return Array.from(
        new Set(
            String(value || '')
                .split(',')
                .map((entry) => normalizeId(entry))
                .filter(Boolean)
        )
    );
}

function parseBooleanLike(value, fallback = false) {
    const normalized = normalizeId(value);
    if (normalized === '') {
        return Boolean(fallback);
    }
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

function buildDesktopMatrix(options = {}) {
    const surfaceFilter = Array.isArray(options.surfaceFilter)
        ? options.surfaceFilter
        : [];
    const targetFilter = Array.isArray(options.targetFilter)
        ? options.targetFilter
        : [];
    return {
        include: listTurneroSurfaceDefinitions({ family: 'desktop' }).flatMap(
            (surface) =>
                (surfaceFilter.length > 0 && !surfaceFilter.includes(surface.id)
                    ? []
                    : listTurneroTargetKeys(surface)
                )
                    .filter(
                        (targetKey) =>
                            (targetKey === 'win' || targetKey === 'mac') &&
                            (targetFilter.length === 0 ||
                                targetFilter.includes(targetKey))
                    )
                    .map((targetKey) => ({
                        surface: surface.id,
                        platform: targetKey,
                        target_key: targetKey,
                        runner:
                            targetKey === 'mac'
                                ? 'macos-latest'
                                : 'windows-latest',
                        artifact_name: buildTurneroReleaseArtifactName(
                            surface,
                            targetKey
                        ),
                    }))
        ),
    };
}

function buildAndroidMatrix(options = {}) {
    if (options.skipAndroid === true) {
        return { include: [] };
    }
    const surfaceFilter = Array.isArray(options.surfaceFilter)
        ? options.surfaceFilter
        : [];
    const targetFilter = Array.isArray(options.targetFilter)
        ? options.targetFilter
        : [];
    const defaults = getTurneroRegistryDefaults();
    return {
        include: listTurneroSurfaceDefinitions({ family: 'android' })
            .filter(
                (surface) =>
                    surfaceFilter.length === 0 ||
                    surfaceFilter.includes(surface.id)
            )
            .flatMap((surface) => {
                const targetKey = getTurneroDefaultTargetKey(surface, {
                    targetKey:
                        surface.android &&
                        typeof surface.android.targetKey === 'string'
                            ? surface.android.targetKey
                            : '',
                });

                if (
                    targetFilter.length > 0 &&
                    !targetFilter.includes(targetKey)
                ) {
                    return [];
                }

                return {
                    surface: surface.id,
                    target_key: targetKey,
                    runner: 'ubuntu-latest',
                    artifact_name: buildTurneroReleaseArtifactName(
                        surface,
                        targetKey
                    ),
                    gradle_project: String(
                        surface.android?.gradleProject || ''
                    ),
                    build_task: String(
                        surface.android?.buildTask || 'assembleRelease'
                    ),
                    source_artifact: String(
                        surface.android?.sourceArtifact || ''
                    ),
                    staged_artifact: String(
                        surface.android?.stagedArtifact ||
                            surface.targets?.[targetKey]?.manualFile ||
                            `${surface.artifactBase}.apk`
                    ),
                    staged_artifact_path: path.posix.join(
                        path.posix.dirname(
                            String(
                                surface.android?.sourceArtifact ||
                                    'app/build/outputs/apk/release/app-release.apk'
                            )
                        ),
                        String(
                            surface.android?.stagedArtifact ||
                                surface.targets?.[targetKey]?.manualFile ||
                                `${surface.artifactBase}.apk`
                        )
                    ),
                    base_url: String(
                        surface.android?.baseUrl || defaults.baseUrl
                    ),
                    surface_path: String(
                        surface.android?.surfacePath || surface.route || ''
                    ),
                };
            }),
    };
}

function formatGithubOutput(payload) {
    return Object.entries(payload)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join('\n');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const surfaceFilter = parseList(args['surface-filter']);
    const targetFilter = parseList(args['target-filter']);
    const skipAndroid = parseBooleanLike(args['skip-android']);
    const desktopMatrix = buildDesktopMatrix({
        surfaceFilter,
        targetFilter,
    });
    const androidMatrix = buildAndroidMatrix({
        surfaceFilter,
        targetFilter,
        skipAndroid,
    });
    const payload = {
        desktop_matrix: desktopMatrix,
        android_matrix: androidMatrix,
        desktop_count: String(desktopMatrix.include.length),
        android_count: String(androidMatrix.include.length),
    };

    if (typeof args['github-output'] === 'string') {
        fs.appendFileSync(
            args['github-output'],
            `${formatGithubOutput(payload)}\n`,
            'utf8'
        );
        return;
    }

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
