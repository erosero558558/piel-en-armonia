#!/usr/bin/env node
'use strict';

const { join } = require('node:path');
const swarm = require('./lib/openclaw-swarm.js');

function parseCli(argv) {
    const args = argv.slice();
    let command = '';
    if (args[0] && !String(args[0]).startsWith('--')) {
        command = String(args.shift() || '').trim().toLowerCase();
    }
    const flags = {};
    const positionals = [];

    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!token.startsWith('--')) {
            positionals.push(token);
            continue;
        }
        const key = token.slice(2);
        const next = args[index + 1];
        if (!next || next.startsWith('--')) {
            flags[key] = true;
            continue;
        }
        flags[key] = next;
        index += 1;
    }

    return {
        command,
        flags,
        positionals,
        wants_json: flags.json === true,
    };
}

function usage() {
    return [
        'Uso: node bin/openclaw-swarm.js <setup|status|invoke|patch|pilot> [flags]',
        '',
        'Comandos:',
        '  setup                        crea workspaces externos y agentes persistentes',
        '  status                       inspecciona agentes persistentes, patch-agents y bindings',
        '  invoke --agent <id> --task "..."',
        '                               invoca un agente con contrato JSON obligatorio',
        '  patch <taskid> <lane> [--task "..."]',
        '                               crea/reutiliza worktree + patch-agent free',
        '  pilot                        corre el piloto triage/scout/review',
        '',
        'Flags utiles:',
        '  --json                       salida JSON',
        '  --task / --message           prompt de trabajo',
        '  --agent                      id del agente',
        '  --thinking <level>           minimal|low|medium|high',
        '  --timeout <seconds>          timeout del turn del agente',
        '  --base <ref>                 base para worktree patch (default HEAD)',
        '',
    ].join('\n');
}

function renderText(payload) {
    const lines = [];
    lines.push(`# ${payload.command || 'openclaw-swarm'}`);
    if (payload.summary) {
        lines.push('');
        lines.push(payload.summary);
    }
    if (payload.swarm_root) {
        lines.push('');
        lines.push(`swarm_root: ${payload.swarm_root}`);
    }
    if (Array.isArray(payload.persistent_agents) && payload.persistent_agents.length) {
        lines.push('');
        lines.push('persistent_agents:');
        for (const row of payload.persistent_agents) {
            lines.push(
                `- ${row.id} :: ${row.model} :: ${row.workspace} :: drift=${row.drift}`
            );
        }
    }
    if (Array.isArray(payload.patch_agents) && payload.patch_agents.length) {
        lines.push('');
        lines.push('patch_agents:');
        for (const row of payload.patch_agents) {
            lines.push(`- ${row.id} :: ${row.workspace}`);
        }
    }
    if (payload.invoke) {
        lines.push('');
        lines.push(`invoke.summary: ${payload.invoke.contract.summary}`);
        lines.push(`invoke.next_command: ${payload.invoke.contract.next_command}`);
    }
    if (payload.pilot && payload.pilot.review) {
        lines.push('');
        lines.push(`pilot.review: ${payload.pilot.review.contract.summary}`);
    }
    if (Array.isArray(payload.errors) && payload.errors.length) {
        lines.push('');
        lines.push('errors:');
        for (const error of payload.errors) {
            lines.push(`- ${error}`);
        }
    }
    return lines.join('\n').trimEnd();
}

function emit(payload, wantsJson) {
    if (wantsJson) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return;
    }
    process.stdout.write(`${renderText(payload)}\n`);
}

function mapAgentsById(agentList) {
    return new Map(
        (Array.isArray(agentList) ? agentList : []).map((agent) => [
            String(agent.id || ''),
            agent,
        ])
    );
}

function summarizeTurnAttempt(agentId, result, attemptKind) {
    return {
        agent_id: agentId,
        attempt: attemptKind,
        exit_code: Number(result?.exit_code || 0),
        ok: result?.ok === true,
        contract_ok: result?.contract?.contract_ok === true,
        summary: String(result?.contract?.summary || ''),
        findings: Array.isArray(result?.contract?.findings)
            ? result.contract.findings
            : [],
        next_command: String(result?.contract?.next_command || ''),
        changed_files: Array.isArray(result?.contract?.changed_files)
            ? result.contract.changed_files
            : [],
        stderr: String(result?.stderr || '').trim(),
    };
}

function turnNeedsFallback(result) {
    return !(result && result.contract && result.contract.contract_ok === true);
}

async function runFallbackTurn(primaryAgentId, primaryResult, prompt, fallbackAgentIds, options) {
    const attempts = [summarizeTurnAttempt(primaryAgentId, primaryResult, 'primary')];
    if (!turnNeedsFallback(primaryResult)) {
        return {
            primary_agent_id: primaryAgentId,
            used_agent_id: primaryAgentId,
            used_fallback: false,
            result: primaryResult,
            attempts,
        };
    }

    const seen = new Set([primaryAgentId]);
    for (const candidate of Array.isArray(fallbackAgentIds) ? fallbackAgentIds : []) {
        const fallbackAgentId = String(candidate || '').trim();
        if (!fallbackAgentId || seen.has(fallbackAgentId)) {
            continue;
        }
        seen.add(fallbackAgentId);
        const fallbackResult = await swarm.runAgentTurnAsync(
            fallbackAgentId,
            prompt,
            options
        );
        attempts.push(
            summarizeTurnAttempt(fallbackAgentId, fallbackResult, 'fallback')
        );
        if (!turnNeedsFallback(fallbackResult)) {
            return {
                primary_agent_id: primaryAgentId,
                used_agent_id: fallbackAgentId,
                used_fallback: true,
                result: fallbackResult,
                attempts,
            };
        }
    }

    return {
        primary_agent_id: primaryAgentId,
        used_agent_id: primaryAgentId,
        used_fallback: false,
        result: primaryResult,
        attempts,
    };
}

function buildPersistentAgentStatus(agentList) {
    const byId = mapAgentsById(agentList);
    return swarm.PERSISTENT_AGENT_SPECS.map((spec) => {
        const expectedWorkspace = swarm.buildPersistentAgentWorkspace(spec.id);
        const record = byId.get(spec.id) || null;
        if (!record) {
            return {
                id: spec.id,
                model: spec.model,
                workspace: expectedWorkspace,
                exists: false,
                bindings: 0,
                is_default: false,
                drift: false,
            };
        }
        return {
            ...swarm.summarizeAgentRecord(
                record,
                expectedWorkspace,
                spec.model
            ),
            exists: true,
        };
    });
}

function buildPatchAgentStatus(agentList) {
    return (Array.isArray(agentList) ? agentList : [])
        .filter((agent) => /^patch-/.test(String(agent.id || '')))
        .map((agent) => ({
            id: String(agent.id || ''),
            workspace: String(agent.workspace || ''),
            model: String(agent.model || ''),
            bindings: Number(agent.bindings || 0),
            is_default: agent.isDefault === true,
        }))
        .sort((left, right) => left.id.localeCompare(right.id));
}

function writeSwarmLayout() {
    swarm.ensureDir(swarm.SWARM_ROOT);
    swarm.ensureDir(swarm.SWARM_AGENTS_ROOT);
    swarm.ensureDir(swarm.SWARM_REPORTS_ROOT);
    const layoutPath = join(swarm.SWARM_ROOT, 'swarm-layout.json');
    swarm.writeJsonIfChanged(layoutPath, swarm.buildSwarmLayoutDocument());
    return layoutPath;
}

function ensurePersistentAgents() {
    writeSwarmLayout();
    const listedBefore = swarm.listOpenClawAgents();
    if (!listedBefore.json || !Array.isArray(listedBefore.json)) {
        throw new Error(
            `No se pudo listar agentes OpenClaw: ${
                listedBefore.stderr || listedBefore.stdout || listedBefore.parse_error
            }`
        );
    }
    const byId = mapAgentsById(listedBefore.json);
    const results = [];

    for (const spec of swarm.PERSISTENT_AGENT_SPECS) {
        const workspace = swarm.seedPersistentAgentWorkspace(spec);
        const existing = byId.get(spec.id) || null;
        if (!existing) {
            const created = swarm.addOpenClawAgent(spec, workspace);
            results.push({
                id: spec.id,
                action: created.ok ? 'created' : 'create_failed',
                workspace,
                model: spec.model,
                command: created.command_text,
                exit_code: created.exit_code,
                stderr: created.stderr.trim(),
                parse_error: created.parse_error,
            });
            continue;
        }
        const drift =
            swarm.normalizePathForCompare(existing.workspace) !==
                swarm.normalizePathForCompare(workspace) ||
            String(existing.model || '').trim() !== spec.model;
        results.push({
            id: spec.id,
            action: drift ? 'drift_detected' : 'kept',
            workspace,
            model: spec.model,
            existing_workspace: String(existing.workspace || ''),
            existing_model: String(existing.model || ''),
            drift,
        });
    }

    const listedAfter = swarm.listOpenClawAgents();
    const bindings = swarm.listOpenClawBindings();
    return {
        setup_results: results,
        agents_list: Array.isArray(listedAfter.json) ? listedAfter.json : [],
        bindings: Array.isArray(bindings.json) ? bindings.json : [],
        bindings_ok:
            Array.isArray(bindings.json) && bindings.json.length === 0,
    };
}

function buildStatusPayload(commandName) {
    const agentsResult = swarm.listOpenClawAgents();
    if (!agentsResult.json || !Array.isArray(agentsResult.json)) {
        throw new Error(
            `No se pudo listar agentes OpenClaw: ${
                agentsResult.stderr || agentsResult.stdout || agentsResult.parse_error
            }`
        );
    }
    const bindingsResult = swarm.listOpenClawBindings();
    const bindings = Array.isArray(bindingsResult.json) ? bindingsResult.json : [];
    return {
        ok: true,
        command: commandName,
        summary: 'Estado actual del swarm auxiliar OpenClaw.',
        repo_root: swarm.REPO_ROOT,
        swarm_root: swarm.SWARM_ROOT,
        openclaw_workspace: swarm.OPENCLAW_WORKSPACE,
        bindings_policy: 'empty_in_v1',
        bindings_ok: bindings.length === 0,
        bindings,
        persistent_agents: buildPersistentAgentStatus(agentsResult.json),
        patch_agents: buildPatchAgentStatus(agentsResult.json),
        safety_note:
            'El sandbox OpenClaw puede estar off; la seguridad de v1 depende del layout y de worktrees separados.',
    };
}

function requireString(value, message) {
    const text = String(value || '').trim();
    if (!text) {
        throw new Error(message);
    }
    return text;
}

async function handleInvoke(parsed) {
    const agentId = requireString(
        parsed.flags.agent || parsed.positionals[0],
        'Falta --agent <id> para invoke.'
    );
    const rawTask =
        parsed.flags.task ||
        parsed.flags.message ||
        parsed.positionals.slice(1).join(' ');
    const task = requireString(rawTask, 'Falta --task/--message para invoke.');
    const prompt = swarm.buildContractPrompt({
        agentId,
        task,
        allowWrite: false,
    });
    const result = await swarm.runAgentTurnAsync(agentId, prompt, {
        timeout_seconds: Number(parsed.flags.timeout || 180),
        thinking: String(parsed.flags.thinking || 'minimal'),
    });

    return {
        ok: result.ok && result.contract.contract_ok,
        command: 'invoke',
        summary: `Invocacion CLI del agente ${agentId}.`,
        repo_root: swarm.REPO_ROOT,
        swarm_root: swarm.SWARM_ROOT,
        invoke: {
            agent_id: agentId,
            command: result.command_text,
            exit_code: result.exit_code,
            stderr: result.stderr.trim(),
            payload_text: result.payload_text,
            contract: result.contract,
            envelope_summary:
                result.json &&
                typeof result.json === 'object' &&
                !Array.isArray(result.json)
                    ? String(result.json.summary || '')
                    : '',
        },
    };
}

async function handlePatch(parsed) {
    const taskId = requireString(
        parsed.flags['task-id'] || parsed.positionals[0],
        'Falta <taskid> para patch.'
    );
    const lane = requireString(
        parsed.flags.lane || parsed.positionals[1],
        'Falta <lane> para patch.'
    );
    const beforeStatus = swarm.gitStatusShort(swarm.REPO_ROOT);
    const prepared = swarm.preparePatchWorktree(taskId, lane, {
        base_ref: String(parsed.flags.base || 'HEAD'),
    });
    const patchSpec = {
        id: prepared.agent_id,
        model: 'openrouter/qwen/qwen3-coder:free',
        purpose: `Patch aislado para ${prepared.task_id}/${prepared.lane}`,
    };

    const agentListBefore = swarm.listOpenClawAgents();
    if (!agentListBefore.json || !Array.isArray(agentListBefore.json)) {
        throw new Error(
            `No se pudo listar agentes antes del patch: ${
                agentListBefore.stderr ||
                agentListBefore.stdout ||
                agentListBefore.parse_error
            }`
        );
    }
    const existing = mapAgentsById(agentListBefore.json).get(prepared.agent_id);
    let patchAgentAction = {
        id: prepared.agent_id,
        action: 'kept',
        workspace: prepared.worktree_path,
        model: patchSpec.model,
        drift: false,
    };
    if (!existing) {
        const created = swarm.addOpenClawAgent(patchSpec, prepared.worktree_path);
        patchAgentAction = {
            id: prepared.agent_id,
            action: created.ok ? 'created' : 'create_failed',
            workspace: prepared.worktree_path,
            model: patchSpec.model,
            command: created.command_text,
            exit_code: created.exit_code,
            stderr: created.stderr.trim(),
        };
    } else {
        const drift =
            swarm.normalizePathForCompare(existing.workspace) !==
                swarm.normalizePathForCompare(prepared.worktree_path) ||
            String(existing.model || '').trim() !== patchSpec.model;
        patchAgentAction = {
            id: prepared.agent_id,
            action: drift ? 'drift_detected' : 'kept',
            workspace: prepared.worktree_path,
            model: patchSpec.model,
            existing_workspace: String(existing.workspace || ''),
            existing_model: String(existing.model || ''),
            drift,
        };
    }

    const afterStatus = swarm.gitStatusShort(swarm.REPO_ROOT);
    const rawTask = parsed.flags.task || parsed.flags.message || '';
    let invoke = null;
    if (String(rawTask || '').trim()) {
        const prompt = swarm.buildContractPrompt({
            agentId: prepared.agent_id,
            task: rawTask,
            allowWrite: true,
            worktreePath: prepared.worktree_path,
            context_lines: [
                `Branch objetivo: ${prepared.branch}`,
                `Worktree exclusivo: ${prepared.worktree_path}`,
            ],
        });
        const turn = await swarm.runAgentTurnAsync(prepared.agent_id, prompt, {
            timeout_seconds: Number(parsed.flags.timeout || 300),
            thinking: String(parsed.flags.thinking || 'minimal'),
        });
        invoke = {
            command: turn.command_text,
            exit_code: turn.exit_code,
            stderr: turn.stderr.trim(),
            payload_text: turn.payload_text,
            contract: turn.contract,
        };
    }

    return {
        ok:
            patchAgentAction.action !== 'create_failed' &&
            beforeStatus.stdout === afterStatus.stdout &&
            (!invoke || invoke.contract.contract_ok),
        command: 'patch',
        summary: `Patch agent ${prepared.agent_id} listo en worktree dedicado.`,
        repo_root: swarm.REPO_ROOT,
        swarm_root: swarm.SWARM_ROOT,
        patch: {
            ...prepared,
            patch_agent_action: patchAgentAction,
            repo_status_unchanged: beforeStatus.stdout === afterStatus.stdout,
            main_repo_status_before: beforeStatus.lines,
            main_repo_status_after: afterStatus.lines,
        },
        invoke,
    };
}

function buildPilotPrompts() {
    return {
        triage: swarm.buildContractPrompt({
            agentId: 'swarm-triage',
            task: [
                'Piloto v1 del swarm auxiliar.',
                `Analiza el bloqueo public_main_sync con posible head_drift en ${swarm.REPO_ROOT}.`,
                `Usa como foco el comando: node "${join(
                    swarm.REPO_ROOT,
                    'agent-orchestrator.js'
                )}" jobs verify public_main_sync --json`,
                'Trabajo de solo lectura.',
                'Devuelve causa probable, riesgo actual y el siguiente comando mas seguro.',
            ].join('\n'),
            allowWrite: false,
        }),
        scout: swarm.buildContractPrompt({
            agentId: 'swarm-scout',
            task: [
                'Piloto v1 del swarm auxiliar.',
                `Analiza forks del AGENT_BOARD.yaml y mixed_lane en ${swarm.REPO_ROOT}.`,
                `Usa como foco el comando: node "${join(
                    swarm.REPO_ROOT,
                    'agent-orchestrator.js'
                )}" board doctor --json --profile ci`,
                'Trabajo de solo lectura.',
                'Devuelve los hallazgos mas peligrosos y el siguiente comando mas seguro.',
            ].join('\n'),
            allowWrite: false,
        }),
    };
}

async function handlePilot() {
    ensurePersistentAgents();
    const prompts = buildPilotPrompts();
    const [triagePrimary, scoutPrimary] = await Promise.all([
        swarm.runAgentTurnAsync('swarm-triage', prompts.triage, {
            timeout_seconds: 240,
            thinking: 'minimal',
        }),
        swarm.runAgentTurnAsync('swarm-scout', prompts.scout, {
            timeout_seconds: 240,
            thinking: 'minimal',
        }),
    ]);
    const triage = await runFallbackTurn(
        'swarm-triage',
        triagePrimary,
        prompts.triage,
        ['swarm-scout'],
        {
            timeout_seconds: 240,
            thinking: 'minimal',
        }
    );
    const scout = await runFallbackTurn(
        'swarm-scout',
        scoutPrimary,
        prompts.scout,
        ['swarm-triage'],
        {
            timeout_seconds: 240,
            thinking: 'minimal',
        }
    );

    const reviewPrompt = swarm.buildContractPrompt({
        agentId: 'swarm-review',
        task: [
            'Consolida el piloto v1 del swarm auxiliar.',
            'Combina el resultado del triage y del scout.',
            '',
            'Resultado triage:',
            JSON.stringify(triage.result.contract, null, 2),
            '',
            'Resultado scout:',
            JSON.stringify(scout.result.contract, null, 2),
            '',
            'Entrega un resumen ejecutivo corto, 3 hallazgos maximo y el siguiente comando integrador.',
        ].join('\n'),
        allowWrite: false,
    });
    const reviewPrimary = await swarm.runAgentTurnAsync(
        'swarm-review',
        reviewPrompt,
        {
            timeout_seconds: 240,
            thinking: 'minimal',
        }
    );
    const review = await runFallbackTurn(
        'swarm-review',
        reviewPrimary,
        reviewPrompt,
        ['swarm-scout', 'swarm-triage'],
        {
            timeout_seconds: 240,
            thinking: 'minimal',
        }
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(swarm.SWARM_REPORTS_ROOT, 'pilot-latest.json');
    const historyPath = join(swarm.SWARM_REPORTS_ROOT, `pilot-${timestamp}.json`);
    const report = {
        version: 1,
        generated_at: new Date().toISOString(),
        repo_root: swarm.REPO_ROOT,
        swarm_root: swarm.SWARM_ROOT,
        pilot: {
            triage: {
                primary_agent_id: triage.primary_agent_id,
                used_agent_id: triage.used_agent_id,
                used_fallback: triage.used_fallback,
                attempts: triage.attempts,
                command: triage.result.command_text,
                exit_code: triage.result.exit_code,
                stderr: triage.result.stderr.trim(),
                payload_text: triage.result.payload_text,
                contract: triage.result.contract,
            },
            scout: {
                primary_agent_id: scout.primary_agent_id,
                used_agent_id: scout.used_agent_id,
                used_fallback: scout.used_fallback,
                attempts: scout.attempts,
                command: scout.result.command_text,
                exit_code: scout.result.exit_code,
                stderr: scout.result.stderr.trim(),
                payload_text: scout.result.payload_text,
                contract: scout.result.contract,
            },
            review: {
                primary_agent_id: review.primary_agent_id,
                used_agent_id: review.used_agent_id,
                used_fallback: review.used_fallback,
                attempts: review.attempts,
                command: review.result.command_text,
                exit_code: review.result.exit_code,
                stderr: review.result.stderr.trim(),
                payload_text: review.result.payload_text,
                contract: review.result.contract,
            },
        },
    };
    swarm.ensureDir(swarm.SWARM_REPORTS_ROOT);
    swarm.writeJsonIfChanged(reportPath, report);
    swarm.writeJsonIfChanged(historyPath, report);

    return {
        ok:
            triage.result.contract.contract_ok &&
            scout.result.contract.contract_ok &&
            review.result.contract.contract_ok,
        command: 'pilot',
        summary: 'Piloto del swarm auxiliar ejecutado.',
        repo_root: swarm.REPO_ROOT,
        swarm_root: swarm.SWARM_ROOT,
        report_path: reportPath,
        history_path: historyPath,
        pilot: report.pilot,
    };
}

async function main() {
    const parsed = parseCli(process.argv.slice(2));
    if (!parsed.command || parsed.flags.help) {
        emit(
            {
                ok: !parsed.command,
                command: 'help',
                summary: usage(),
            },
            parsed.wants_json
        );
        process.exitCode = parsed.flags.help ? 0 : parsed.command ? 0 : 1;
        return;
    }

    let payload;
    if (parsed.command === 'setup') {
        const setup = ensurePersistentAgents();
        payload = {
            ok:
                setup.bindings_ok &&
                setup.setup_results.every(
                    (item) =>
                        item.action !== 'create_failed' &&
                        item.action !== 'drift_detected'
                ),
            command: 'setup',
            summary: 'Swarm auxiliar configurado o verificado.',
            repo_root: swarm.REPO_ROOT,
            swarm_root: swarm.SWARM_ROOT,
            openclaw_workspace: swarm.OPENCLAW_WORKSPACE,
            bindings_ok: setup.bindings_ok,
            bindings: setup.bindings,
            persistent_agents: buildPersistentAgentStatus(setup.agents_list),
            setup_results: setup.setup_results,
            layout_path: join(swarm.SWARM_ROOT, 'swarm-layout.json'),
        };
    } else if (parsed.command === 'status') {
        payload = buildStatusPayload('status');
    } else if (parsed.command === 'invoke') {
        payload = await handleInvoke(parsed);
    } else if (parsed.command === 'patch') {
        payload = await handlePatch(parsed);
    } else if (parsed.command === 'pilot') {
        payload = await handlePilot(parsed);
    } else {
        throw new Error(`Comando no soportado: ${parsed.command}`);
    }

    emit(payload, parsed.wants_json);
    if (payload.ok === false) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    const parsed = parseCli(process.argv.slice(2));
    emit(
        {
            ok: false,
            command: parsed.command || 'openclaw-swarm',
            summary: usage(),
            errors: [
                String(error && error.message ? error.message : error),
            ],
        },
        parsed.wants_json
    );
    process.exitCode = 1;
});
