<?php

declare(strict_types=1);

namespace Governance;

use Governance\Validators\DocsValidator;
use Governance\Validators\BoardValidator;
use Governance\Validators\HandoffsValidator;
use Governance\Validators\SignalsValidator;
use Governance\Validators\PolicyValidator;
use Governance\Validators\CodexValidator;
use Governance\Validators\QueuesValidator;

class Runner
{
    private string $root;

    public function __construct(string $root)
    {
        $this->root = $root;
    }

    public function run(): void
    {
        $agentsPath = $this->root . '/AGENTS.md';
        $claudePath = $this->root . '/CLAUDE.md';
        $boardPath = $this->root . '/AGENT_BOARD.yaml';
        $handoffsPath = $this->root . '/AGENT_HANDOFFS.yaml';
        $signalsPath = $this->root . '/AGENT_SIGNALS.yaml';
        $governancePolicyPath = $this->root . '/governance-policy.json';
        $julesPath = $this->root . '/JULES_TASKS.md';
        $kimiPath = $this->root . '/KIMI_TASKS.md';
        $codexPlanPath = $this->root . '/PLAN_MAESTRO_CODEX_2026.md';

        $errors = [];

        // 1. Read Files
        $agents = Utils::readFileStrict($agentsPath, $errors);
        $claude = Utils::readFileStrict($claudePath, $errors);
        $boardRaw = Utils::readFileStrict($boardPath, $errors);
        $handoffsRaw = Utils::readFileStrict($handoffsPath, $errors);
        $signalsRaw = Utils::readFileStrict($signalsPath, $errors);
        $governancePolicyRaw = Utils::readFileStrict($governancePolicyPath, $errors);
        $julesRaw = Utils::readFileStrict($julesPath, $errors);
        $kimiRaw = Utils::readFileStrict($kimiPath, $errors);
        $codexPlanRaw = Utils::readFileStrict($codexPlanPath, $errors);

        // 2. Parse Files
        $board = [
            'version' => 1,
            'policy' => [],
            'tasks' => [],
        ];
        if ($boardRaw !== '') {
            $board = Parsers::parseBoardYaml($boardRaw);
        }

        $handoffs = [
            'version' => 1,
            'handoffs' => [],
        ];
        if ($handoffsRaw !== '') {
            $handoffs = Parsers::parseHandoffsYaml($handoffsRaw);
        }

        $signals = [
            'version' => 1,
            'updated_at' => '',
            'signals' => [],
        ];
        if ($signalsRaw !== '') {
            $signals = Parsers::parseSignalsYaml($signalsRaw);
        }

        $governancePolicy = null;
        if ($governancePolicyRaw !== '') {
            $decodedPolicy = json_decode($governancePolicyRaw, true);
            if (!is_array($decodedPolicy)) {
                $errors[] = 'governance-policy.json no contiene un objeto JSON valido';
            } else {
                $governancePolicy = $decodedPolicy;
            }
        }

        $julesTasks = Parsers::parseTaskBlocks($julesRaw);
        $kimiTasks = Parsers::parseTaskBlocks($kimiRaw);
        $codexBlocks = $codexPlanRaw !== '' ? Parsers::parseCodexActiveBlocks($codexPlanRaw) : [];


        // 3. Run Validators

        // DocsValidator
        $docsValidator = new DocsValidator();
        $errors = array_merge($errors, $docsValidator->validate($agents, $claude));

        // BoardValidator
        $boardValidator = new BoardValidator();
        $errors = array_merge($errors, $boardValidator->validate($board));

        // HandoffsValidator
        $handoffsValidator = new HandoffsValidator();
        $errors = array_merge($errors, $handoffsValidator->validate($handoffs, $board['tasks']));

        // SignalsValidator
        $signalsValidator = new SignalsValidator();
        $errors = array_merge($errors, $signalsValidator->validate($signals, $board['tasks']));

        // PolicyValidator
        $policyValidator = new PolicyValidator();
        $errors = array_merge($errors, $policyValidator->validate($governancePolicy));

        // CodexValidator
        $codexValidator = new CodexValidator();
        $errors = array_merge($errors, $codexValidator->validate($codexBlocks, $board['tasks']));

        // QueuesValidator
        $queuesValidator = new QueuesValidator();
        $errors = array_merge($errors, $queuesValidator->validate($julesTasks, $kimiTasks));

        // 4. Output Results
        if (!empty($errors)) {
            fwrite(STDERR, "ERROR: validacion de gobernanza fallida (" . count($errors) . ")\n");
            foreach ($errors as $error) {
                fwrite(STDERR, "- {$error}\n");
            }
            exit(1);
        }

        fwrite(STDOUT, "OK: gobernanza de agentes valida.\n");
        exit(0);
    }
}
