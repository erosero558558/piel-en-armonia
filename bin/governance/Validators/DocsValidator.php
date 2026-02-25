<?php

declare(strict_types=1);

namespace Governance\Validators;

class DocsValidator
{
    public function validate(string $agentsContent, string $claudeContent): array
    {
        $errors = [];

        if ($agentsContent !== '') {
            if (!str_contains($agentsContent, 'CANONICAL_AGENT_POLICY: AGENTS.md')) {
                $errors[] = 'AGENTS.md no declara el marcador canonico CANONICAL_AGENT_POLICY: AGENTS.md';
            }
            if (!str_contains($agentsContent, 'AGENT_POLICY_VERSION:')) {
                $errors[] = 'AGENTS.md no declara AGENT_POLICY_VERSION.';
            }
        }

        if ($claudeContent !== '') {
            if (!str_contains($claudeContent, 'SOURCE_OF_TRUTH: AGENTS.md')) {
                $errors[] = 'CLAUDE.md debe declarar SOURCE_OF_TRUTH: AGENTS.md';
            }
            if (preg_match('/SOURCE_OF_TRUTH:\s*CLAUDE\.md/i', $claudeContent) === 1) {
                $errors[] = 'CLAUDE.md no puede declararse como fuente de verdad.';
            }
        }

        return $errors;
    }
}
