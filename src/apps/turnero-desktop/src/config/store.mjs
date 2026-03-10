import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createBuildConfig,
    mergeRuntimeConfig,
    normalizeSurface,
} from './contracts.mjs';

const PACKAGE_JSON_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'package.json'
);

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return null;
    }
}

function writeJson(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function pickConfiguredValue(...values) {
    for (const value of values) {
        if (value === false || value === 0) {
            return value;
        }
        if (typeof value === 'string' && value.trim() === '') {
            continue;
        }
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
}

export function readBuildMetadata(env = process.env) {
    const pkg = readJson(PACKAGE_JSON_PATH) || {};
    const raw = pkg.turneroDesktop && typeof pkg.turneroDesktop === 'object'
        ? pkg.turneroDesktop
        : {};

    return createBuildConfig({
        surface: pickConfiguredValue(
            env.TURNERO_DESKTOP_SURFACE,
            raw.surface
        ),
        baseUrl: pickConfiguredValue(env.TURNERO_BASE_URL, raw.baseUrl),
        launchMode: pickConfiguredValue(
            env.TURNERO_LAUNCH_MODE,
            raw.launchMode
        ),
        autoStart: pickConfiguredValue(
            env.TURNERO_AUTO_START,
            raw.autoStart
        ),
        updateChannel: pickConfiguredValue(
            env.TURNERO_UPDATE_CHANNEL,
            raw.updateChannel
        ),
        updateBaseUrl: pickConfiguredValue(
            env.TURNERO_UPDATE_BASE_URL,
            raw.updateBaseUrl
        ),
    });
}

export function ensureRuntimeConfig(app, env = process.env) {
    const buildConfig = readBuildMetadata(env);
    const configPath = path.join(app.getPath('userData'), 'turnero-desktop.json');
    const persisted = readJson(configPath) || {};
    const runtimeConfig = mergeRuntimeConfig(buildConfig, persisted);

    writeJson(configPath, {
        surface: normalizeSurface(buildConfig.surface),
        baseUrl: runtimeConfig.baseUrl,
        launchMode: runtimeConfig.launchMode,
        autoStart: runtimeConfig.autoStart,
        updateChannel: runtimeConfig.updateChannel,
        updateBaseUrl: runtimeConfig.updateBaseUrl,
    });

    return {
        buildConfig,
        runtimeConfig,
        configPath,
    };
}
