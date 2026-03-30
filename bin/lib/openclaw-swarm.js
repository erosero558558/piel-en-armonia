#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { homedir } = require('node:os');
const { dirname, join, resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..', '..');
const SWARM_ROOT = resolve(REPO_ROOT, '..', 'pielarmonia-swarm');
const SWARM_AGENTS_ROOT = join(SWARM_ROOT, 'agents');
const SWARM_REPORTS_ROOT = join(SWARM_ROOT, 'reports');
const OPENCLAW_HOME = resolve(homedir(), '.openclaw');
const OPENCLAW_WORKSPACE = join(OPENCLAW_HOME, 'workspace');
const OPENCLAW_ENTRY = join(
    process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'),
    'npm',
    'node_modules',
    'openclaw',
    'openclaw.mjs'
);
const OPENCLAW_COMMAND =
    existsSync(OPENCLAW_ENTRY)
        ? process.execPath
        : process.platform === 'win32' &&
            existsSync(
                join(
                    process.env.APPDATA ||
                        join(homedir(), 'AppData', 'Roaming'),
                    'npm',
                    'openclaw.cmd'
                )
            )
          ? join(
                process.env.APPDATA ||
                    join(homedir(), 'AppData', 'Roaming'),
                'npm',
                'openclaw.cmd'
            )
        : 'openclaw';

const PERSISTENT_AGENT_SPECS = Object.freeze([
    {
        id: 'swarm-scout',
        model: 'openrouter/stepfun/step-3.5-flash:free',
        purpose: 'Lectura rapida, logs y resumenes',
    },
    {
        id: 'swarm-triage',
        model: 'openrouter/qwen/qwen3-coder:free',
        purpose: 'Diagnostico de repo, runtime, board y deploy',
    },
    {
        id: 'swarm-review',
        model: 'openrouter/minimax/minimax-m2.5:free',
        purpose: 'Revision de diffs, riesgos y consolidacion',
    },
]);

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureDir(dirPath) {
    mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function ensureParentDir(filePath) {
    ensureDir(dirname(filePath));
}

function writeTextIfChanged(filePath, content) {
    const next = String(content);
    const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    if (current === next) {
        return false;
    }
    ensureParentDir(filePath);
    writeFileSync(filePath, next, 'utf8');
    return true;
}

function writeJsonIfChanged(filePath, value) {
    return writeTextIfChanged(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizePathForCompare(value) {
    return String(value || '')
        .trim()
        .replace(/\//g, '\\')
        .replace(/\\+$/g, '')
        .toLowerCase();
}

function sanitizeSegment(value, fallback = 'task') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/g, '')
        .replace(/-+$/g, '');
    return normalized || fallback;
}

function buildPersistentAgentWorkspace(agentId) {
    return join(SWARM_AGENTS_ROOT, sanitizeSegment(agentId, 'agent'));
}

function buildPatchAgentId(taskId, lane) {
    return `patch-${sanitizeSegment(taskId, 'task')}-${sanitizeSegment(
        lane,
        'lane'
    )}`;
}

function buildPatchBranch(taskId, lane) {
    return `codex/swarm-${sanitizeSegment(taskId, 'task')}-${sanitizeSegment(
        lane,
        'lane'
    )}`;
}

function buildPatchWorktreePath(taskId, lane) {
    return join(
        SWARM_ROOT,
        `${sanitizeSegment(taskId, 'task')}-${sanitizeSegment(lane, 'lane')}`
    );
}

function buildPersistentWorkspacePolicyText(agentSpec) {
    return [
        '# OpenClaw Swarm Auxiliar',
        '',
        `- Agent: \`${agentSpec.id}\``,
        `- Purpose: ${agentSpec.purpose}`,
        `- Model: \`${agentSpec.model}\``,
        `- Repo principal (solo integrador): \`${REPO_ROOT}\``,
        `- Workspace OpenClaw reservado: \`${OPENCLAW_WORKSPACE}\``,
        `- Root del swarm: \`${SWARM_ROOT}\``,
        '',
        '## Guardrails',
        '',
        '- No editar el repo principal directamente.',
        '- No usar `~/.openclaw/workspace` para coding del producto.',
        '- En v1 no se enlazan bindings a canales.',
        '- Responder siempre con contrato JSON: `summary`, `findings`, `next_command`, `changed_files`.',
        '- Si se necesita escribir codigo, crear antes un worktree dedicado con `patch-<taskid>-<lane>`.',
        '',
    ].join('\n');
}

function buildSwarmLayoutDocument() {
    return {
        version: 1,
        repo_root: REPO_ROOT,
        swarm_root: SWARM_ROOT,
        swarm_agents_root: SWARM_AGENTS_ROOT,
        swarm_reports_root: SWARM_REPORTS_ROOT,
        openclaw_home: OPENCLAW_HOME,
        openclaw_workspace: OPENCLAW_WORKSPACE,
        policy: 'free-first',
        bindings_policy: 'empty_in_v1',
        persistent_agents: PERSISTENT_AGENT_SPECS.map((agent) => ({
            id: agent.id,
            model: agent.model,
            purpose: agent.purpose,
            workspace: buildPersistentAgentWorkspace(agent.id),
        })),
        patch_agent_convention: {
            id: 'patch-<taskid>-<lane>',
            branch: 'codex/swarm-<taskid>-<lane>',
            worktree: join(SWARM_ROOT, '<taskid>-<lane>'),
            model: 'openrouter/qwen/qwen3-coder:free',
        },
        generated_at: new Date().toISOString(),
    };
}

function safeParseJson(text) {
    try {
        return {
            ok: true,
            value: JSON.parse(text),
            error: '',
        };
    } catch (error) {
        return {
            ok: false,
            value: null,
            error: String(error && error.message ? error.message : error),
        };
    }
}

function takeBalancedJson(text, startIndex) {
    const opening = text[startIndex];
    if (opening !== '{' && opening !== '[') {
        return '';
    }
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let index = startIndex; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaping) {
                escaping = false;
                continue;
            }
            if (char === '\\') {
                escaping = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === opening) {
            depth += 1;
            continue;
        }
        if (char === closing) {
            depth -= 1;
            if (depth === 0) {
                return text.slice(startIndex, index + 1);
            }
        }
    }
    return '';
}

function extractJsonText(rawText) {
    const text = String(rawText || '');
    const trimmed = text.trim();
    if (!trimmed) {
        return '';
    }
    if (safeParseJson(trimmed).ok) {
        return trimmed;
    }
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (char !== '{' && char !== '[') {
            continue;
        }
        const candidate = takeBalancedJson(text, index);
        if (!candidate) {
            continue;
        }
        if (safeParseJson(candidate).ok) {
            return candidate;
        }
    }
    return '';
}

function extractJsonDocument(rawText) {
    const candidate = extractJsonText(rawText);
    if (!candidate) {
        return null;
    }
    const parsed = safeParseJson(candidate);
    return parsed.ok ? parsed.value : null;
}

function buildCommandText(program, args) {
    return [program]
        .concat(
            args.map((value) => {
                const text = String(value);
                return /\s/.test(text) ? JSON.stringify(text) : text;
            })
        )
        .join(' ');
}

function buildEnv(overrides = null) {
    return overrides ? { ...process.env, ...overrides } : process.env;
}

function commandNeedsShell(program) {
    return (
        !existsSync(OPENCLAW_ENTRY) &&
        process.platform === 'win32' &&
        /\.(cmd|bat)$/i.test(String(program || '').trim())
    );
}

function withOpenClawArgs(args) {
    return existsSync(OPENCLAW_ENTRY) ? [OPENCLAW_ENTRY, ...args] : args;
}

function runCommandSync(program, args, options = {}) {
    const result = spawnSync(program, args, {
        cwd: options.cwd || REPO_ROOT,
        encoding: 'utf8',
        env: buildEnv(options.env || null),
        maxBuffer: safeNumber(options.maxBuffer, 8 * 1024 * 1024),
        windowsHide: true,
        shell: commandNeedsShell(program),
    });
    if (result.error) {
        throw result.error;
    }
    return {
        program,
        args: args.slice(),
        command_text: buildCommandText(program, args),
        exit_code: typeof result.status === 'number' ? result.status : 1,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
    };
}

function runCommandAsync(program, args, options = {}) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(program, args, {
            cwd: options.cwd || REPO_ROOT,
            env: buildEnv(options.env || null),
            windowsHide: true,
            shell: commandNeedsShell(program),
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('error', rejectPromise);
        child.on('close', (code) => {
            resolvePromise({
                program,
                args: args.slice(),
                command_text: buildCommandText(program, args),
                exit_code: typeof code === 'number' ? code : 1,
                stdout,
                stderr,
            });
        });
    });
}

function commandParsedOk(parsedValue, exitCode) {
    if (exitCode !== 0) {
        return false;
    }
    if (
        parsedValue &&
        typeof parsedValue === 'object' &&
        !Array.isArray(parsedValue) &&
        parsedValue.ok === false
    ) {
        return false;
    }
    return true;
}

function runJsonCommandSync(program, args, options = {}) {
    const result = runCommandSync(program, args, options);
    const json =
        extractJsonDocument(result.stdout) ||
        extractJsonDocument(result.stderr) ||
        extractJsonDocument(`${result.stdout}\n${result.stderr}`);
    return {
        ...result,
        json,
        ok: commandParsedOk(json, result.exit_code),
        parse_error: json ? '' : 'json_not_found_in_stdout',
    };
}

async function runJsonCommandAsync(program, args, options = {}) {
    const result = await runCommandAsync(program, args, options);
    const json =
        extractJsonDocument(result.stdout) ||
        extractJsonDocument(result.stderr) ||
        extractJsonDocument(`${result.stdout}\n${result.stderr}`);
    return {
        ...result,
        json,
        ok: commandParsedOk(json, result.exit_code),
        parse_error: json ? '' : 'json_not_found_in_stdout',
    };
}

function listOpenClawAgents() {
    return runJsonCommandSync(OPENCLAW_COMMAND, withOpenClawArgs(['agents', 'list', '--json']));
}

function listOpenClawBindings() {
    return runJsonCommandSync(
        OPENCLAW_COMMAND,
        withOpenClawArgs(['agents', 'bindings', '--json'])
    );
}

function addOpenClawAgent(agentSpec, workspacePath) {
    return runJsonCommandSync(
        OPENCLAW_COMMAND,
        withOpenClawArgs([
            'agents',
            'add',
            agentSpec.id,
            '--workspace',
            workspacePath,
            '--model',
            agentSpec.model,
            '--non-interactive',
            '--json',
        ])
    );
}

function deleteOpenClawAgent(agentId) {
    return runJsonCommandSync(
        OPENCLAW_COMMAND,
        withOpenClawArgs(['agents', 'delete', agentId, '--json'])
    );
}

function seedPersistentAgentWorkspace(agentSpec) {
    const workspace = ensureDir(buildPersistentAgentWorkspace(agentSpec.id));
    writeTextIfChanged(
        join(workspace, 'SWARM_POLICY.md'),
        `${buildPersistentWorkspacePolicyText(agentSpec).trimEnd()}\n`
    );
    return workspace;
}

function normalizeStringArray(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => {
                if (typeof item === 'string') {
                    return item.trim();
                }
                if (item === null || item === undefined) {
                    return '';
                }
                return JSON.stringify(item);
            })
            .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
        return [value.trim()];
    }
    return [];
}

function normalizeContractPayload(document, rawText = '') {
    const candidate =
        document && typeof document === 'object' && !Array.isArray(document)
            ? document
            : {};
    const hasShape =
        Object.prototype.hasOwnProperty.call(candidate, 'summary') &&
        Object.prototype.hasOwnProperty.call(candidate, 'findings') &&
        Object.prototype.hasOwnProperty.call(candidate, 'next_command') &&
        Object.prototype.hasOwnProperty.call(candidate, 'changed_files');
    const summary =
        typeof candidate.summary === 'string' && candidate.summary.trim()
            ? candidate.summary.trim()
            : '';
    const findings = normalizeStringArray(candidate.findings);
    const nextCommand =
        typeof candidate.next_command === 'string' &&
        candidate.next_command.trim()
            ? candidate.next_command.trim()
            : '';
    const changedFiles = normalizeStringArray(candidate.changed_files);
    const fallbackRaw = String(rawText || '').trim();

    const contractOk =
        hasShape &&
        summary.length > 0 &&
        Array.isArray(candidate.findings) &&
        typeof candidate.next_command === 'string' &&
        Array.isArray(candidate.changed_files);

    return {
        contract_ok: contractOk,
        summary:
            summary || 'La respuesta del agente no cumplio el contrato JSON.',
        findings:
            findings.length > 0 || contractOk
                ? findings
                : fallbackRaw
                  ? [fallbackRaw]
                  : [],
        next_command: nextCommand || 'retry',
        changed_files: changedFiles,
    };
}

function extractAgentPayloadText(envelope) {
    const payloads =
        envelope &&
        typeof envelope === 'object' &&
        envelope.result &&
        Array.isArray(envelope.result.payloads)
            ? envelope.result.payloads
            : envelope &&
                typeof envelope === 'object' &&
                Array.isArray(envelope.payloads)
              ? envelope.payloads
              : [];
    if (payloads.length > 0) {
        return payloads
            .map((payload) =>
                payload && typeof payload.text === 'string' ? payload.text : ''
            )
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

function buildContractPrompt(options = {}) {
    const task = String(options.task || '').trim();
    const agentId = String(options.agentId || 'swarm-agent').trim();
    const allowWrite = options.allowWrite === true;
    const worktreePath = String(options.worktreePath || '').trim();
    const contextLines = normalizeStringArray(options.context_lines);
    const writePolicy =
        allowWrite && worktreePath
            ? `Modo de escritura: solo puedes editar dentro de ${worktreePath}. No edites ${REPO_ROOT} directo ni ${OPENCLAW_WORKSPACE}.`
            : `Modo de lectura: no edites ${REPO_ROOT} ni ${OPENCLAW_WORKSPACE}.`;

    return [
        `Eres ${agentId}, parte del swarm auxiliar local de Piel en Armonia.`,
        `Repo principal propiedad del integrador Codex: ${REPO_ROOT}`,
        `Workspace OpenClaw reservado para memoria/tower, no para coding: ${OPENCLAW_WORKSPACE}`,
        `Root externo del swarm: ${SWARM_ROOT}`,
        writePolicy,
        'Responde SOLO con un objeto JSON valido, sin markdown, sin fences y sin texto adicional.',
        'Claves obligatorias: "summary", "findings", "next_command", "changed_files".',
        '"summary": string corto y accionable en espanol.',
        '"findings": arreglo de strings con hallazgos concretos.',
        '"next_command": un solo comando shell sugerido o "none".',
        '"changed_files": arreglo de rutas; usa [] si no editaste nada.',
    ]
        .concat(contextLines)
        .concat(['Tarea:', task || 'Resume el siguiente paso mas seguro.'])
        .join('\n');
}

async function runAgentTurnAsync(agentId, prompt, options = {}) {
    const args = [
        'agent',
        '--agent',
        agentId,
        '--message',
        prompt,
        '--thinking',
        String(options.thinking || 'minimal'),
        '--timeout',
        String(safeNumber(options.timeout_seconds, 180)),
        '--json',
    ];
    const result = await runJsonCommandAsync(
        OPENCLAW_COMMAND,
        withOpenClawArgs(args),
        options
    );
    const payloadText = extractAgentPayloadText(result.json);
    const payloadDocument = extractJsonDocument(payloadText);
    const contract = normalizeContractPayload(payloadDocument, payloadText);
    return {
        ...result,
        payload_text: payloadText,
        payload_document: payloadDocument,
        contract,
    };
}

function runAgentTurnSync(agentId, prompt, options = {}) {
    const args = [
        'agent',
        '--agent',
        agentId,
        '--message',
        prompt,
        '--thinking',
        String(options.thinking || 'minimal'),
        '--timeout',
        String(safeNumber(options.timeout_seconds, 180)),
        '--json',
    ];
    const result = runJsonCommandSync(
        OPENCLAW_COMMAND,
        withOpenClawArgs(args),
        options
    );
    const payloadText = extractAgentPayloadText(result.json);
    const payloadDocument = extractJsonDocument(payloadText);
    const contract = normalizeContractPayload(payloadDocument, payloadText);
    return {
        ...result,
        payload_text: payloadText,
        payload_document: payloadDocument,
        contract,
    };
}

function gitStatusShort(cwd = REPO_ROOT) {
    const result = runCommandSync('git', ['status', '--short'], { cwd });
    return {
        ...result,
        lines: result.stdout
            .split(/\r?\n/)
            .map((line) => line.trimEnd())
            .filter(Boolean),
    };
}

function branchExists(branchName) {
    const result = runCommandSync('git', [
        'show-ref',
        '--verify',
        '--quiet',
        `refs/heads/${branchName}`,
    ]);
    return result.exit_code === 0;
}

function isGitWorktree(targetPath) {
    const result = runCommandSync('git', [
        '-C',
        targetPath,
        'rev-parse',
        '--is-inside-work-tree',
    ]);
    return result.exit_code === 0;
}

function preparePatchWorktree(taskId, lane, options = {}) {
    const sanitizedTask = sanitizeSegment(taskId, 'task');
    const sanitizedLane = sanitizeSegment(lane, 'lane');
    const worktreePath = buildPatchWorktreePath(sanitizedTask, sanitizedLane);
    const branch = buildPatchBranch(sanitizedTask, sanitizedLane);
    const agentId = buildPatchAgentId(sanitizedTask, sanitizedLane);
    const baseRef = String(options.base_ref || 'HEAD').trim() || 'HEAD';

    ensureDir(SWARM_ROOT);

    let created = false;
    let reused = false;
    let createResult = null;
    if (existsSync(worktreePath)) {
        if (!isGitWorktree(worktreePath)) {
            throw new Error(
                `La ruta del worktree ya existe pero no es un repo git: ${worktreePath}`
            );
        }
        reused = true;
    } else {
        const args = ['worktree', 'add', worktreePath];
        if (branchExists(branch)) {
            args.push(branch);
        } else {
            args.push('-b', branch, baseRef);
        }
        createResult = runCommandSync('git', args, { cwd: REPO_ROOT });
        if (createResult.exit_code !== 0) {
            throw new Error(
                `No se pudo crear el worktree ${worktreePath}: ${
                    createResult.stderr || createResult.stdout || 'sin detalle'
                }`
            );
        }
        created = true;
    }

    return {
        task_id: sanitizedTask,
        lane: sanitizedLane,
        agent_id: agentId,
        branch,
        worktree_path: worktreePath,
        base_ref: baseRef,
        created,
        reused,
        create_result: createResult
            ? {
                  command: createResult.command_text,
                  exit_code: createResult.exit_code,
              }
            : null,
    };
}

function summarizeAgentRecord(record, expectedWorkspace, expectedModel) {
    const workspace = String(record?.workspace || '').trim();
    const model = String(record?.model || '').trim();
    return {
        id: String(record?.id || '').trim(),
        workspace,
        model,
        bindings: safeNumber(record?.bindings, 0),
        is_default: record?.isDefault === true,
        drift:
            normalizePathForCompare(workspace) !==
                normalizePathForCompare(expectedWorkspace) ||
            model !== expectedModel,
    };
}

module.exports = {
    OPENCLAW_HOME,
    OPENCLAW_COMMAND,
    OPENCLAW_ENTRY,
    OPENCLAW_WORKSPACE,
    PERSISTENT_AGENT_SPECS,
    REPO_ROOT,
    SWARM_AGENTS_ROOT,
    SWARM_REPORTS_ROOT,
    SWARM_ROOT,
    addOpenClawAgent,
    branchExists,
    buildCommandText,
    buildContractPrompt,
    buildPatchAgentId,
    buildPatchBranch,
    buildPatchWorktreePath,
    buildPersistentAgentWorkspace,
    buildPersistentWorkspacePolicyText,
    buildSwarmLayoutDocument,
    deleteOpenClawAgent,
    ensureDir,
    extractAgentPayloadText,
    extractJsonDocument,
    extractJsonText,
    gitStatusShort,
    isGitWorktree,
    listOpenClawAgents,
    listOpenClawBindings,
    normalizeContractPayload,
    normalizePathForCompare,
    normalizeStringArray,
    preparePatchWorktree,
    runAgentTurnAsync,
    runAgentTurnSync,
    runCommandAsync,
    runCommandSync,
    runJsonCommandAsync,
    runJsonCommandSync,
    sanitizeSegment,
    seedPersistentAgentWorkspace,
    summarizeAgentRecord,
    writeJsonIfChanged,
    writeTextIfChanged,
};
