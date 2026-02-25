<?php

declare(strict_types=1);

namespace Governance\Validators;

class PolicyValidator
{
    public function validate(?array $governancePolicy): array
    {
        $errors = [];

        if ($governancePolicy === null) {
            return $errors;
        }

        if ((int) ($governancePolicy['version'] ?? 0) !== 1) {
            $errors[] = 'governance-policy.json debe declarar version=1';
        }

        $domainHealth = $governancePolicy['domain_health'] ?? null;
        if (!is_array($domainHealth)) {
            $errors[] = 'governance-policy.json requiere objeto domain_health';
        } else {
            $priorityDomains = $domainHealth['priority_domains'] ?? null;
            if (!is_array($priorityDomains) || count($priorityDomains) === 0) {
                $errors[] = 'governance-policy.json requiere domain_health.priority_domains como lista no vacia';
            } else {
                $seenDomains = [];
                foreach ($priorityDomains as $rawDomain) {
                    $domain = trim((string) $rawDomain);
                    if ($domain === '') {
                        $errors[] = 'governance-policy.json contiene dominio vacio en domain_health.priority_domains';
                        continue;
                    }
                    $key = strtolower($domain);
                    if (isset($seenDomains[$key])) {
                        $errors[] = "governance-policy.json tiene dominio duplicado en priority_domains: {$domain}";
                    }
                    $seenDomains[$key] = true;
                }
            }

            $domainWeights = $domainHealth['domain_weights'] ?? null;
            if (!is_array($domainWeights)) {
                $errors[] = 'governance-policy.json requiere domain_health.domain_weights como objeto';
            } else {
                if (!array_key_exists('default', $domainWeights)) {
                    $errors[] = 'governance-policy.json requiere domain_health.domain_weights.default';
                }
                foreach ($domainWeights as $weightKey => $rawWeight) {
                    if (!is_numeric($rawWeight) || (float) $rawWeight <= 0) {
                        $errors[] = "governance-policy.json tiene peso invalido en domain_weights.{$weightKey}";
                    }
                }
            }

            $signalScores = $domainHealth['signal_scores'] ?? null;
            if (!is_array($signalScores)) {
                $errors[] = 'governance-policy.json requiere domain_health.signal_scores como objeto';
            } else {
                foreach (['GREEN', 'YELLOW', 'RED'] as $signalKey) {
                    if (!array_key_exists($signalKey, $signalScores)) {
                        $errors[] = "governance-policy.json requiere signal_scores.{$signalKey}";
                    } elseif (!is_numeric($signalScores[$signalKey])) {
                        $errors[] = "governance-policy.json tiene signal_scores.{$signalKey} no numerico";
                    }
                }

                if (
                    array_key_exists('GREEN', $signalScores) &&
                    array_key_exists('YELLOW', $signalScores) &&
                    array_key_exists('RED', $signalScores) &&
                    is_numeric($signalScores['GREEN']) &&
                    is_numeric($signalScores['YELLOW']) &&
                    is_numeric($signalScores['RED'])
                ) {
                    $greenScore = (float) $signalScores['GREEN'];
                    $yellowScore = (float) $signalScores['YELLOW'];
                    $redScore = (float) $signalScores['RED'];
                    if (!($greenScore >= $yellowScore && $yellowScore >= $redScore)) {
                        $errors[] = 'governance-policy.json requiere GREEN >= YELLOW >= RED en domain_health.signal_scores';
                    }
                }
            }
        }

        $summary = $governancePolicy['summary'] ?? null;
        $thresholds = is_array($summary) ? ($summary['thresholds'] ?? null) : null;
        if (!is_array($thresholds)) {
            $errors[] = 'governance-policy.json requiere summary.thresholds';
        } else {
            $yellowThreshold = $thresholds['domain_score_priority_yellow_below'] ?? null;
            if (!is_numeric($yellowThreshold) || (float) $yellowThreshold < 0) {
                $errors[] = 'governance-policy.json tiene threshold invalido: summary.thresholds.domain_score_priority_yellow_below';
            }
        }

        $enforcement = $governancePolicy['enforcement'] ?? null;
        if ($enforcement !== null) {
            if (!is_array($enforcement)) {
                $errors[] = 'governance-policy.json requiere enforcement como objeto';
            } else {
                $branchProfiles = $enforcement['branch_profiles'] ?? null;
                if (!is_array($branchProfiles)) {
                    $errors[] = 'governance-policy.json requiere enforcement.branch_profiles como objeto';
                } else {
                    foreach ($branchProfiles as $branchName => $branchCfg) {
                        if (!is_array($branchCfg)) {
                            $errors[] = "governance-policy.json requiere enforcement.branch_profiles.{$branchName} como objeto";
                            continue;
                        }
                        $failOnRed = trim((string) ($branchCfg['fail_on_red'] ?? ''));
                        if (!in_array($failOnRed, ['warn', 'error', 'ignore'], true)) {
                            $errors[] = "governance-policy.json tiene fail_on_red invalido en enforcement.branch_profiles.{$branchName}";
                        }
                    }
                }

                $warningPolicies = $enforcement['warning_policies'] ?? null;
                if (!is_array($warningPolicies)) {
                    $errors[] = 'governance-policy.json requiere enforcement.warning_policies como objeto';
                } else {
                    foreach ($warningPolicies as $warningKey => $warningCfg) {
                        if (!is_array($warningCfg)) {
                            $errors[] = "governance-policy.json requiere enforcement.warning_policies.{$warningKey} como objeto";
                            continue;
                        }
                        if (!array_key_exists('enabled', $warningCfg) || !is_bool($warningCfg['enabled'])) {
                            $errors[] = "governance-policy.json requiere enforcement.warning_policies.{$warningKey}.enabled boolean";
                        }
                        $severity = trim((string) ($warningCfg['severity'] ?? ''));
                        if (!in_array($severity, ['warning', 'error'], true)) {
                            $errors[] = "governance-policy.json tiene severity invalido en enforcement.warning_policies.{$warningKey}";
                        }
                        if (array_key_exists('hours_threshold', $warningCfg)) {
                            $hoursThreshold = $warningCfg['hours_threshold'];
                            if (!is_numeric($hoursThreshold) || (float) $hoursThreshold <= 0) {
                                $errors[] = "governance-policy.json tiene hours_threshold invalido en enforcement.warning_policies.{$warningKey}";
                            }
                        }
                    }
                }

                $boardLeases = $enforcement['board_leases'] ?? null;
                if ($boardLeases !== null) {
                    if (!is_array($boardLeases)) {
                        $errors[] = 'governance-policy.json requiere enforcement.board_leases como objeto';
                    } else {
                        foreach (['enabled', 'auto_clear_on_terminal'] as $boolKey) {
                            if (array_key_exists($boolKey, $boardLeases) && !is_bool($boardLeases[$boolKey])) {
                                $errors[] = "governance-policy.json requiere enforcement.board_leases.{$boolKey} boolean";
                            }
                        }
                        foreach (['ttl_hours_default', 'ttl_hours_max', 'heartbeat_stale_minutes'] as $numKey) {
                            if (array_key_exists($numKey, $boardLeases)) {
                                $v = $boardLeases[$numKey];
                                if (!is_numeric($v) || (float) $v <= 0) {
                                    $errors[] = "governance-policy.json tiene enforcement.board_leases.{$numKey} invalido";
                                }
                            }
                        }
                        foreach (['required_statuses', 'tracked_statuses'] as $arrKey) {
                            if (array_key_exists($arrKey, $boardLeases) && !is_array($boardLeases[$arrKey])) {
                                $errors[] = "governance-policy.json requiere enforcement.board_leases.{$arrKey} como lista";
                            }
                        }
                    }
                }

                $boardDoctor = $enforcement['board_doctor'] ?? null;
                if ($boardDoctor !== null) {
                    if (!is_array($boardDoctor)) {
                        $errors[] = 'governance-policy.json requiere enforcement.board_doctor como objeto';
                    } else {
                        foreach (['enabled', 'strict_default'] as $boolKey) {
                            if (array_key_exists($boolKey, $boardDoctor) && !is_bool($boardDoctor[$boolKey])) {
                                $errors[] = "governance-policy.json requiere enforcement.board_doctor.{$boolKey} boolean";
                            }
                        }
                        $doctorThresholds = $boardDoctor['thresholds'] ?? null;
                        if ($doctorThresholds !== null) {
                            if (!is_array($doctorThresholds)) {
                                $errors[] = 'governance-policy.json requiere enforcement.board_doctor.thresholds como objeto';
                            } else {
                                foreach ($doctorThresholds as $thresholdKey => $thresholdValue) {
                                    if (!is_numeric($thresholdValue) || (float) $thresholdValue < 0) {
                                        $errors[] = "governance-policy.json tiene enforcement.board_doctor.thresholds.{$thresholdKey} invalido";
                                    }
                                }
                            }
                        }
                    }
                }

                $wipLimits = $enforcement['wip_limits'] ?? null;
                if ($wipLimits !== null) {
                    if (!is_array($wipLimits)) {
                        $errors[] = 'governance-policy.json requiere enforcement.wip_limits como objeto';
                    } else {
                        if (array_key_exists('enabled', $wipLimits) && !is_bool($wipLimits['enabled'])) {
                            $errors[] = 'governance-policy.json requiere enforcement.wip_limits.enabled boolean';
                        }
                        if (array_key_exists('mode', $wipLimits) && !in_array((string) $wipLimits['mode'], ['warn', 'error', 'ignore'], true)) {
                            $errors[] = 'governance-policy.json tiene enforcement.wip_limits.mode invalido';
                        }
                        if (array_key_exists('count_statuses', $wipLimits) && !is_array($wipLimits['count_statuses'])) {
                            $errors[] = 'governance-policy.json requiere enforcement.wip_limits.count_statuses como lista';
                        }
                        foreach (['by_executor', 'by_scope'] as $mapKey) {
                            if (array_key_exists($mapKey, $wipLimits)) {
                                if (!is_array($wipLimits[$mapKey])) {
                                    $errors[] = "governance-policy.json requiere enforcement.wip_limits.{$mapKey} como objeto";
                                } else {
                                    foreach ($wipLimits[$mapKey] as $limitKey => $limitValue) {
                                        if (!is_numeric($limitValue) || (float) $limitValue <= 0) {
                                            $errors[] = "governance-policy.json tiene enforcement.wip_limits.{$mapKey}.{$limitKey} invalido";
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return $errors;
    }
}
