<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/metrics.php';
require_once __DIR__ . '/telemedicine/ClinicalMediaService.php';

final class CaseMediaFlowService
{
    private const PROPOSAL_DECISIONS = ['approve', 'edit_and_publish', 'reject', 'archive'];
    private const PUBLICATION_STATES = ['draft', 'approved', 'published', 'archived', 'rejected'];
    private const PRIVATE_PREVIEW_RESOURCE = '/api.php?resource=media-flow-private-asset&assetId=';
    private const PUBLIC_FILE_RESOURCE = '/api.php?resource=public-case-media-file&name={name}';
    private const GATEWAY_TIMEOUT_SECONDS = 10;

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    public static function buildAdminMeta(array $store): array
    {
        $cases = self::deriveCases($store);
        $queue = [];
        $summary = [
            'totalCases' => count($cases),
            'eligibleCases' => 0,
            'blockedCases' => 0,
            'publishedCases' => 0,
            'needsReviewCases' => 0,
            'latestActivityAt' => '',
        ];

        foreach ($cases as $case) {
            $queue[] = self::buildQueueItem($case);
            $status = (string) ($case['policy']['status'] ?? 'needs_review');
            $publicationStatus = (string) ($case['publication']['status'] ?? 'draft');

            if ($status === 'eligible') {
                $summary['eligibleCases']++;
            } elseif ($status === 'blocked') {
                $summary['blockedCases']++;
            } else {
                $summary['needsReviewCases']++;
            }

            if ($publicationStatus === 'published') {
                $summary['publishedCases']++;
            }

            $summary['latestActivityAt'] = self::maxTimestamp(
                $summary['latestActivityAt'],
                (string) ($case['latestActivityAt'] ?? '')
            );
        }

        usort($queue, static function (array $left, array $right): int {
            $priorityLeft = self::queuePriority($left);
            $priorityRight = self::queuePriority($right);
            if ($priorityLeft !== $priorityRight) {
                return $priorityLeft <=> $priorityRight;
            }

            return strcmp((string) ($right['latestActivityAt'] ?? ''), (string) ($left['latestActivityAt'] ?? ''));
        });

        return [
            'summary' => $summary,
            'queue' => array_values($queue),
            'recentEvents' => self::recentEvents($store, 20),
            'config' => [
                'publicMediaDir' => self::publicMediaDir(),
                'publicMediaBaseUrl' => self::publicMediaBaseUrl(),
                'gateway' => self::gatewayStatus(),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    public static function queue(array $store): array
    {
        return self::buildAdminMeta($store);
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    public static function getCase(array $store, string $caseId): array
    {
        $case = self::findCase($store, $caseId);
        if ($case === null) {
            throw new RuntimeException('Caso de media no encontrado', 404);
        }

        return $case;
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function generateProposal(array $store, array $payload): array
    {
        $caseId = trim((string) ($payload['caseId'] ?? ''));
        if ($caseId === '') {
            throw new RuntimeException('caseId requerido', 400);
        }

        $case = self::findCase($store, $caseId);
        if ($case === null) {
            throw new RuntimeException('Caso de media no encontrado', 404);
        }

        $snapshot = self::buildPatientFlowSnapshot($case);
        $proposalData = self::generateGatewayProposal($snapshot);
        $trace = [
            'mode' => 'heuristic',
            'model' => self::gatewayModel(),
            'generatedAt' => local_date('c'),
            'gatewayReachable' => self::gatewayConfigured(),
        ];

        if (!is_array($proposalData)) {
            $proposalData = self::generateHeuristicProposal($case);
        } else {
            $trace['mode'] = 'gateway';
        }

        $proposal = self::normalizeProposalRecord(
            self::mergeProposalDefaults($case, $proposalData),
            $case
        );
        $proposal['proposalId'] = self::generateId('msp');
        $proposal['caseId'] = $caseId;
        $proposal['status'] = (string) ($proposal['status'] ?? 'draft');
        $proposal['openclawTrace'] = array_merge(
            is_array($proposal['openclawTrace'] ?? null) ? $proposal['openclawTrace'] : [],
            $trace
        );
        $proposal['createdAt'] = local_date('c');
        $proposal['updatedAt'] = $proposal['createdAt'];
        $proposal['patientFlowSnapshot'] = $snapshot;

        $store = self::upsertProposal($store, $proposal);
        $event = self::buildEventRecord($caseId, 'media_flow.proposal_generated', [
            'proposalId' => $proposal['proposalId'],
            'recommendation' => $proposal['recommendation'],
            'trace' => $proposal['openclawTrace'],
        ]);
        $store = self::appendEvent($store, $event);
        write_store($store);

        audit_log_event('media_flow.proposal_generated', [
            'caseId' => $caseId,
            'proposalId' => $proposal['proposalId'],
            'recommendation' => $proposal['recommendation'],
            'mode' => $trace['mode'],
        ]);
        self::emitMetric('case_media_proposals_total', [
            'mode' => (string) $trace['mode'],
            'recommendation' => (string) ($proposal['recommendation'] ?? 'needs_review'),
        ]);

        return [
            'case' => self::getCase($store, $caseId),
            'proposal' => $proposal,
            'event' => $event,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function patchProposal(array $store, array $payload): array
    {
        $proposal = self::requireProposal($store, $payload);
        $case = self::findCase($store, (string) ($proposal['caseId'] ?? ''));
        if ($case === null) {
            throw new RuntimeException('Caso de media no encontrado', 404);
        }

        $proposal = self::applyProposalEdits(
            $proposal,
            is_array($payload['edits'] ?? null) ? $payload['edits'] : [],
            $case
        );
        $proposal['status'] = (string) ($case['policy']['status'] ?? '') === 'blocked'
            ? 'blocked'
            : 'draft';
        $proposal['updatedAt'] = local_date('c');
        $proposal['openclawTrace'] = array_merge(
            is_array($proposal['openclawTrace'] ?? null) ? $proposal['openclawTrace'] : [],
            [[
                'mode' => 'agent_patch',
                'generatedAt' => $proposal['updatedAt'],
                'instruction' => truncate_field(
                    sanitize_xss((string) ($payload['instruction'] ?? '')),
                    240
                ),
            ]]
        );

        $store = self::upsertProposal($store, $proposal);
        $event = self::buildEventRecord((string) ($proposal['caseId'] ?? ''), 'media_flow.proposal_patched', [
            'proposalId' => (string) ($proposal['proposalId'] ?? ''),
            'instruction' => truncate_field(
                sanitize_xss((string) ($payload['instruction'] ?? '')),
                240
            ),
        ]);
        $store = self::appendEvent($store, $event);
        write_store($store);

        audit_log_event('media_flow.proposal_patched', [
            'caseId' => (string) ($proposal['caseId'] ?? ''),
            'proposalId' => (string) ($proposal['proposalId'] ?? ''),
        ]);

        return [
            'case' => self::getCase($store, (string) ($proposal['caseId'] ?? '')),
            'proposal' => $proposal,
            'event' => $event,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function reviewProposal(array $store, array $payload): array
    {
        $decision = strtolower(trim((string) ($payload['decision'] ?? '')));
        if (!in_array($decision, self::PROPOSAL_DECISIONS, true)) {
            throw new RuntimeException('decision invalida', 400);
        }

        $proposal = self::requireProposal($store, $payload);
        $case = self::findCase($store, (string) ($proposal['caseId'] ?? ''));
        if ($case === null) {
            throw new RuntimeException('Caso de media no encontrado', 404);
        }

        $proposal = self::applyProposalEdits($proposal, is_array($payload['edits'] ?? null) ? $payload['edits'] : [], $case);
        $proposal['updatedAt'] = local_date('c');
        $proposal['reviewDecision'] = $decision;
        $proposal['reviewedAt'] = $proposal['updatedAt'];
        $proposal['reviewedBy'] = trim((string) ($payload['reviewedBy'] ?? 'admin'));

        if (
            in_array($decision, ['approve', 'edit_and_publish'], true)
            && (string) ($case['policy']['status'] ?? '') === 'blocked'
        ) {
            throw new RuntimeException('El caso esta bloqueado por policy y no se puede publicar', 409);
        }

        $publication = self::findPublicationByCaseId($store, (string) ($proposal['caseId'] ?? ''));

        if ($decision === 'approve') {
            $proposal['status'] = 'approved';
            $publication = self::buildOrUpdatePublication($publication, $proposal, $case, 'approved');
        } elseif ($decision === 'edit_and_publish') {
            $proposal['status'] = 'published';
            $publication = self::buildOrUpdatePublication($publication, $proposal, $case, 'published');
            $publication = self::materializePublicationAssets($publication, $case);
        } elseif ($decision === 'reject') {
            $proposal['status'] = 'rejected';
            if (is_array($publication)) {
                $publication['status'] = 'rejected';
                $publication['updatedAt'] = local_date('c');
            }
        } else {
            $proposal['status'] = 'archived';
            if (is_array($publication)) {
                $publication['status'] = 'archived';
                $publication['updatedAt'] = local_date('c');
            }
        }

        $store = self::upsertProposal($store, $proposal);
        if (is_array($publication)) {
            $store = self::upsertPublication($store, $publication);
        }

        $event = self::buildEventRecord((string) ($proposal['caseId'] ?? ''), 'media_flow.proposal_reviewed', [
            'proposalId' => $proposal['proposalId'],
            'decision' => $decision,
            'publicationStatus' => is_array($publication) ? (string) ($publication['status'] ?? '') : '',
        ]);
        $store = self::appendEvent($store, $event);
        write_store($store);

        audit_log_event('media_flow.proposal_reviewed', [
            'caseId' => (string) ($proposal['caseId'] ?? ''),
            'proposalId' => (string) ($proposal['proposalId'] ?? ''),
            'decision' => $decision,
        ]);
        self::emitMetric('case_media_reviews_total', ['decision' => $decision]);

        return [
            'case' => self::getCase($store, (string) ($proposal['caseId'] ?? '')),
            'proposal' => $proposal,
            'publication' => $publication,
            'event' => $event,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function publicationState(array $store, array $payload): array
    {
        $state = strtolower(trim((string) ($payload['state'] ?? '')));
        if (!in_array($state, self::PUBLICATION_STATES, true)) {
            throw new RuntimeException('state invalido', 400);
        }

        $caseId = trim((string) ($payload['caseId'] ?? ''));
        $publication = self::findPublication($store, $payload);
        if (!is_array($publication)) {
            if ($caseId === '') {
                throw new RuntimeException('caseId requerido', 400);
            }

            $proposal = self::latestProposalForCase($store, $caseId);
            if ($proposal === null) {
                throw new RuntimeException('No existe una propuesta para este caso', 404);
            }
            $case = self::findCase($store, $caseId);
            if ($case === null) {
                throw new RuntimeException('Caso de media no encontrado', 404);
            }
            $publication = self::buildOrUpdatePublication(null, $proposal, $case, $state);
        } else {
            $caseId = (string) ($publication['caseId'] ?? $caseId);
            $case = self::findCase($store, $caseId);
            if ($case === null) {
                throw new RuntimeException('Caso de media no encontrado', 404);
            }
            $publication['status'] = $state;
            $publication['updatedAt'] = local_date('c');
            if ($state === 'published') {
                $publication = self::materializePublicationAssets($publication, $case);
            }
        }

        if ($state === 'published' && empty($publication['publishedAt'])) {
            $publication['publishedAt'] = local_date('c');
        } elseif ($state !== 'published') {
            $publication['publishedAt'] = $state === 'approved'
                ? (string) ($publication['publishedAt'] ?? '')
                : '';
        }

        if (
            $state === 'published'
            && isset($case)
            && is_array($case)
            && (string) ($case['policy']['status'] ?? '') === 'blocked'
        ) {
            throw new RuntimeException('El caso esta bloqueado por policy y no se puede publicar', 409);
        }

        $store = self::upsertPublication($store, $publication);
        $event = self::buildEventRecord($caseId, 'media_flow.publication_state_changed', [
            'storyId' => $publication['storyId'],
            'state' => $state,
        ]);
        $store = self::appendEvent($store, $event);
        write_store($store);

        audit_log_event('media_flow.publication_state_changed', [
            'caseId' => $caseId,
            'storyId' => (string) ($publication['storyId'] ?? ''),
            'state' => $state,
        ]);
        self::emitMetric('case_media_publications_total', ['state' => $state]);

        return [
            'case' => self::getCase($store, $caseId),
            'publication' => $publication,
            'event' => $event,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    public static function publicStories(array $store, string $locale = 'es'): array
    {
        $safeLocale = self::normalizeLocale($locale);
        $items = [];

        foreach (self::publicationRecords($store) as $publication) {
            if ((string) ($publication['status'] ?? '') !== 'published') {
                continue;
            }

            $story = self::publicationToPublicStory($publication, $safeLocale);
            if ($story !== null) {
                $items[] = $story;
            }
        }

        usort($items, static function (array $left, array $right): int {
            return strcmp((string) ($right['publishedAt'] ?? ''), (string) ($left['publishedAt'] ?? ''));
        });

        return [
            'locale' => $safeLocale,
            'items' => array_values($items),
            'count' => count($items),
            'generatedAt' => local_date('c'),
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function resolvePrivateAsset(array $store, array $payload): array
    {
        $assetId = trim((string) ($payload['assetId'] ?? ($_GET['assetId'] ?? '')));
        if ($assetId === '') {
            throw new RuntimeException('assetId requerido', 400);
        }

        foreach (self::deriveCases($store) as $case) {
            foreach ((array) ($case['mediaAssets'] ?? []) as $asset) {
                if ((string) ($asset['assetId'] ?? '') !== $assetId) {
                    continue;
                }

                $diskPath = self::resolvePrivateDiskPath((string) ($asset['privatePath'] ?? ''));
                if ($diskPath === '' || !is_file($diskPath)) {
                    throw new RuntimeException('Asset privado no disponible', 404);
                }

                return [
                    'path' => $diskPath,
                    'mime' => self::safeMime((string) ($asset['mime'] ?? ''), $diskPath),
                    'filename' => basename($diskPath),
                ];
            }
        }

        throw new RuntimeException('Asset privado no encontrado', 404);
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function resolvePublicMediaFile(array $payload): array
    {
        $name = basename(trim((string) ($payload['name'] ?? ($_GET['name'] ?? ''))));
        if ($name === '' || $name === '.' || $name === '..') {
            throw new RuntimeException('name requerido', 400);
        }

        $path = self::publicMediaDir() . DIRECTORY_SEPARATOR . $name;
        if (!is_file($path)) {
            throw new RuntimeException('Media publica no encontrada', 404);
        }

        return [
            'path' => $path,
            'mime' => self::safeMime('', $path),
            'filename' => $name,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<int,array<string,mixed>>
     */
    private static function deriveCases(array $store): array
    {
        $appointmentsById = [];
        foreach ((array) ($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            $appointmentsById[(int) ($appointment['id'] ?? 0)] = $appointment;
        }

        $intakesByAppointmentId = [];
        $intakesById = [];
        foreach ((array) ($store['telemedicine_intakes'] ?? []) as $intake) {
            if (!is_array($intake)) {
                continue;
            }
            $intakeId = (int) ($intake['id'] ?? 0);
            $appointmentId = (int) ($intake['linkedAppointmentId'] ?? 0);
            if ($appointmentId > 0) {
                $intakesByAppointmentId[$appointmentId] = $intake;
            }
            if ($intakeId > 0) {
                $intakesById[$intakeId] = $intake;
            }
        }

        $sessionsByAppointmentId = [];
        $sessionsByCaseId = [];
        foreach ((array) ($store['clinical_history_sessions'] ?? []) as $session) {
            if (!is_array($session)) {
                continue;
            }
            $appointmentId = (int) ($session['appointmentId'] ?? 0);
            $caseId = trim((string) ($session['caseId'] ?? ''));
            if ($appointmentId > 0) {
                $sessionsByAppointmentId[$appointmentId] = $session;
            }
            if ($caseId !== '') {
                $sessionsByCaseId[$caseId] = $session;
            }
        }

        $draftsByCaseId = [];
        $draftsBySessionId = [];
        foreach ((array) ($store['clinical_history_drafts'] ?? []) as $draft) {
            if (!is_array($draft)) {
                continue;
            }
            $caseId = trim((string) ($draft['caseId'] ?? ''));
            $sessionId = trim((string) ($draft['sessionId'] ?? ''));
            if ($caseId !== '') {
                $draftsByCaseId[$caseId] = $draft;
            }
            if ($sessionId !== '') {
                $draftsBySessionId[$sessionId] = $draft;
            }
        }

        $latestProposalsByCaseId = [];
        foreach (self::proposalRecords($store) as $proposal) {
            $caseId = trim((string) ($proposal['caseId'] ?? ''));
            if ($caseId === '') {
                continue;
            }

            $current = $latestProposalsByCaseId[$caseId] ?? null;
            if (!is_array($current) || strcmp((string) ($proposal['updatedAt'] ?? ''), (string) ($current['updatedAt'] ?? '')) >= 0) {
                $latestProposalsByCaseId[$caseId] = $proposal;
            }
        }

        $latestPublicationsByCaseId = [];
        foreach (self::publicationRecords($store) as $publication) {
            $caseId = trim((string) ($publication['caseId'] ?? ''));
            if ($caseId === '') {
                continue;
            }

            $current = $latestPublicationsByCaseId[$caseId] ?? null;
            if (!is_array($current) || strcmp((string) ($publication['updatedAt'] ?? ''), (string) ($current['updatedAt'] ?? '')) >= 0) {
                $latestPublicationsByCaseId[$caseId] = $publication;
            }
        }

        $eventsByCaseId = [];
        foreach ((array) ($store['case_media_events'] ?? []) as $event) {
            if (!is_array($event)) {
                continue;
            }
            $caseId = trim((string) ($event['caseId'] ?? ''));
            if ($caseId === '') {
                continue;
            }
            $eventsByCaseId[$caseId][] = $event;
        }

        $cases = [];
        foreach ((array) ($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }
            if (!self::isPublicPipelineUpload($upload)) {
                continue;
            }

            $appointmentId = (int) ($upload['appointmentId'] ?? 0);
            $intakeId = (int) ($upload['intakeId'] ?? 0);
            $appointment = $appointmentsById[$appointmentId] ?? [];
            if (!is_array($appointment)) {
                $appointment = [];
            }
            $intake = $intakesByAppointmentId[$appointmentId] ?? ($intakesById[$intakeId] ?? []);
            if (!is_array($intake)) {
                $intake = [];
            }
            $session = $sessionsByAppointmentId[$appointmentId] ?? [];
            if (!is_array($session)) {
                $session = [];
            }
            $caseId = self::resolveCaseId($upload, $appointment, $intake, $session);

            if (!isset($cases[$caseId])) {
                $draft = $draftsByCaseId[$caseId] ?? ($draftsBySessionId[(string) ($session['sessionId'] ?? '')] ?? []);
                if (!is_array($draft)) {
                    $draft = [];
                }
                $cases[$caseId] = self::buildBaseCaseRecord($caseId, $appointment, $intake, $session, $draft);
            }

            $cases[$caseId]['mediaAssets'][] = self::buildAssetRecord($upload, $cases[$caseId]);
            $cases[$caseId]['latestActivityAt'] = self::maxTimestamp(
                (string) ($cases[$caseId]['latestActivityAt'] ?? ''),
                (string) ($upload['updatedAt'] ?? $upload['createdAt'] ?? '')
            );
        }

        foreach ($cases as $caseId => $case) {
            $assets = array_values(is_array($case['mediaAssets'] ?? null) ? $case['mediaAssets'] : []);
            usort($assets, static function (array $left, array $right): int {
                return strcmp((string) ($left['createdAt'] ?? ''), (string) ($right['createdAt'] ?? ''));
            });

            $policy = self::evaluateCasePolicy($case, $assets);
            $case['mediaAssets'] = $assets;
            $case['policy'] = $policy;
            $case['latestActivityAt'] = self::maxTimestamp(
                (string) ($case['latestActivityAt'] ?? ''),
                (string) ($policy['latestAssetAt'] ?? '')
            );
            $case['proposal'] = $latestProposalsByCaseId[$caseId] ?? null;
            $case['publication'] = $latestPublicationsByCaseId[$caseId] ?? self::emptyPublication($caseId);
            $case['timeline'] = self::normalizeEventList($eventsByCaseId[$caseId] ?? []);
            $case['summary'] = self::buildCaseSummary($case, $assets, $policy);
            $case['patientCaseSnapshot'] = self::buildPatientFlowSnapshot($case);
            $cases[$caseId] = $case;
        }

        return array_values($cases);
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>|null
     */
    private static function findCase(array $store, string $caseId): ?array
    {
        $needle = trim($caseId);
        if ($needle === '') {
            return null;
        }

        foreach (self::deriveCases($store) as $case) {
            if ((string) ($case['caseId'] ?? '') === $needle) {
                return $case;
            }
        }

        return null;
    }

    /**
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function buildQueueItem(array $case): array
    {
        $proposal = is_array($case['proposal'] ?? null) ? $case['proposal'] : [];
        $publication = is_array($case['publication'] ?? null) ? $case['publication'] : [];
        return [
            'caseId' => (string) ($case['caseId'] ?? ''),
            'appointmentId' => $case['appointmentId'] ?? null,
            'patientName' => (string) ($case['patient']['name'] ?? ''),
            'serviceLabel' => (string) ($case['service']['label'] ?? ''),
            'assetCount' => count((array) ($case['mediaAssets'] ?? [])),
            'policyStatus' => (string) ($case['policy']['status'] ?? 'needs_review'),
            'policyFlags' => array_values((array) ($case['policy']['flags'] ?? [])),
            'recommendation' => (string) ($proposal['recommendation'] ?? ($case['policy']['status'] ?? 'needs_review')),
            'proposalStatus' => (string) ($proposal['status'] ?? 'draft'),
            'publicationStatus' => (string) ($publication['status'] ?? 'draft'),
            'consentStatus' => (string) ($case['consent']['status'] ?? 'missing'),
            'latestActivityAt' => (string) ($case['latestActivityAt'] ?? ''),
            'summary' => (string) ($case['summary']['deck'] ?? ''),
        ];
    }

    /**
     * @param array<string,mixed> $item
     */
    private static function queuePriority(array $item): int
    {
        $policyStatus = (string) ($item['policyStatus'] ?? 'needs_review');
        $publicationStatus = (string) ($item['publicationStatus'] ?? 'draft');
        if ($publicationStatus === 'published') {
            return 4;
        }
        if ($policyStatus === 'blocked') {
            return 1;
        }
        if ($publicationStatus === 'approved') {
            return 2;
        }
        return 0;
    }

    /**
     * @param array<string,mixed> $upload
     */
    private static function isPublicPipelineUpload(array $upload): bool
    {
        $kind = trim((string) ($upload['kind'] ?? ''));
        if ($kind === ClinicalMediaService::KIND_PAYMENT_PROOF) {
            return false;
        }
        if ($kind === ClinicalMediaService::KIND_SUPPORTING_DOCUMENT) {
            return false;
        }

        $privatePath = trim((string) ($upload['privatePath'] ?? ''));
        if ($privatePath === '') {
            return false;
        }

        $mime = strtolower(trim((string) ($upload['mime'] ?? '')));
        return str_starts_with($mime, 'image/');
    }

    /**
     * @param array<string,mixed> $upload
     * @param array<string,mixed> $appointment
     * @param array<string,mixed> $intake
     * @param array<string,mixed> $session
     */
    private static function resolveCaseId(array $upload, array $appointment, array $intake, array $session): string
    {
        $sessionCaseId = trim((string) ($session['caseId'] ?? ''));
        if ($sessionCaseId !== '') {
            return $sessionCaseId;
        }

        $uploadCaseId = trim((string) ($upload['caseId'] ?? ''));
        if ($uploadCaseId !== '') {
            return $uploadCaseId;
        }

        $appointmentId = (int) ($appointment['id'] ?? $upload['appointmentId'] ?? 0);
        if ($appointmentId > 0) {
            return 'CASE-APPT-' . $appointmentId;
        }

        $intakeId = (int) ($intake['id'] ?? $upload['intakeId'] ?? 0);
        if ($intakeId > 0) {
            return 'CASE-INTAKE-' . $intakeId;
        }

        return 'CASE-UPLOAD-' . (int) ($upload['id'] ?? 0);
    }

    /**
     * @param array<string,mixed> $appointment
     * @param array<string,mixed> $intake
     * @param array<string,mixed> $session
     * @param array<string,mixed> $draft
     * @return array<string,mixed>
     */
    private static function buildBaseCaseRecord(
        string $caseId,
        array $appointment,
        array $intake,
        array $session,
        array $draft
    ): array {
        $patient = self::resolvePatient($appointment, $intake, $session, $draft);
        $service = self::resolveService($appointment, $session, $draft);
        $consent = self::resolveConsent($appointment, $intake, $session);
        $openedAt = self::firstNonEmptyTimestamp([
            (string) ($session['createdAt'] ?? ''),
            (string) ($intake['createdAt'] ?? ''),
            (string) ($appointment['createdAt'] ?? ''),
        ]);
        $latestActivityAt = self::firstNonEmptyTimestamp([
            (string) ($session['updatedAt'] ?? ''),
            (string) ($draft['updatedAt'] ?? ''),
            (string) ($intake['updatedAt'] ?? ''),
            (string) ($appointment['updatedAt'] ?? ''),
        ]);

        return [
            'caseId' => $caseId,
            'appointmentId' => (int) ($appointment['id'] ?? $session['appointmentId'] ?? $intake['linkedAppointmentId'] ?? 0),
            'intakeId' => (int) ($intake['id'] ?? 0),
            'sessionId' => trim((string) ($session['sessionId'] ?? '')),
            'openedAt' => $openedAt,
            'latestActivityAt' => $latestActivityAt,
            'patient' => $patient,
            'service' => $service,
            'consent' => $consent,
            'source' => [
                'appointment' => $appointment,
                'intake' => $intake,
                'session' => $session,
                'draft' => $draft,
            ],
            'mediaAssets' => [],
            'proposal' => null,
            'publication' => self::emptyPublication($caseId),
            'timeline' => [],
            'summary' => [],
        ];
    }

    /**
     * @param array<string,mixed> $upload
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function buildAssetRecord(array $upload, array $case): array
    {
        $filename = strtolower(trim((string) ($upload['originalName'] ?? basename((string) ($upload['privatePath'] ?? '')))));
        $kind = self::classifyAssetKind($filename, (string) ($upload['kind'] ?? 'case_photo'));
        $privatePath = trim((string) ($upload['privatePath'] ?? ''));
        $qualityFlags = [];
        $riskFlags = [];

        if ($privatePath === '') {
            $qualityFlags[] = 'missing_private_path';
        }

        $mime = strtolower(trim((string) ($upload['mime'] ?? '')));
        if (!str_starts_with($mime, 'image/')) {
            $qualityFlags[] = 'non_image_asset';
        }

        if ((int) ($upload['size'] ?? 0) < 1024) {
            $qualityFlags[] = 'tiny_file';
        }

        if (self::hasIdentificationRisk($filename)) {
            $riskFlags[] = 'identification_risk';
        }

        if ((int) ($case['patient']['ageYears'] ?? 0) > 0 && (int) ($case['patient']['ageYears'] ?? 0) < 18) {
            $riskFlags[] = 'patient_underage';
        }

        if ((string) ($case['consent']['status'] ?? 'missing') !== 'explicit') {
            $riskFlags[] = 'missing_publication_consent';
        }

        return [
            'assetId' => 'cma_' . (int) ($upload['id'] ?? 0),
            'uploadId' => (int) ($upload['id'] ?? 0),
            'caseId' => (string) ($case['caseId'] ?? ''),
            'appointmentId' => $upload['appointmentId'] ?? $case['appointmentId'] ?? null,
            'intakeId' => $upload['intakeId'] ?? $case['intakeId'] ?? null,
            'kind' => $kind,
            'storageMode' => (string) ($upload['storageMode'] ?? ''),
            'privatePath' => $privatePath,
            'previewUrl' => self::PRIVATE_PREVIEW_RESOURCE . rawurlencode('cma_' . (int) ($upload['id'] ?? 0)),
            'mime' => (string) ($upload['mime'] ?? ''),
            'size' => (int) ($upload['size'] ?? 0),
            'originalName' => (string) ($upload['originalName'] ?? ''),
            'sha256' => (string) ($upload['sha256'] ?? ''),
            'consent' => $case['consent'],
            'qualityFlags' => array_values(array_unique($qualityFlags)),
            'riskFlags' => array_values(array_unique($riskFlags)),
            'visibility' => self::assetVisibility($qualityFlags, $riskFlags),
            'createdAt' => (string) ($upload['createdAt'] ?? ''),
            'updatedAt' => (string) ($upload['updatedAt'] ?? ''),
        ];
    }

    private static function classifyAssetKind(string $filename, string $fallbackKind): string
    {
        $normalized = self::normalizeText($filename);
        if (str_contains($normalized, 'before') || str_contains($normalized, 'antes')) {
            return 'before';
        }
        if (str_contains($normalized, 'after') || str_contains($normalized, 'despues') || str_contains($normalized, 'despu')) {
            return 'after';
        }
        if (str_contains($normalized, 'detail') || str_contains($normalized, 'detalle') || str_contains($normalized, 'macro')) {
            return 'detail';
        }
        if (str_contains($normalized, 'document') || str_contains($normalized, 'doc') || $fallbackKind === ClinicalMediaService::KIND_SUPPORTING_DOCUMENT) {
            return 'document';
        }
        return 'progress';
    }

    /**
     * @param list<string> $qualityFlags
     * @param list<string> $riskFlags
     */
    private static function assetVisibility(array $qualityFlags, array $riskFlags): string
    {
        if ($qualityFlags !== [] || $riskFlags !== []) {
            return 'private_only';
        }
        return 'candidate';
    }

    private static function hasIdentificationRisk(string $filename): bool
    {
        $normalized = self::normalizeText($filename);
        foreach (['cara', 'rostro', 'face', 'selfie', 'cedula', 'identidad', 'full'] as $token) {
            if (str_contains($normalized, $token)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string,mixed> $appointment
     * @param array<string,mixed> $intake
     * @param array<string,mixed> $session
     * @param array<string,mixed> $draft
     * @return array<string,mixed>
     */
    private static function resolvePatient(array $appointment, array $intake, array $session, array $draft): array
    {
        $sessionPatient = is_array($session['patient'] ?? null) ? $session['patient'] : [];
        $draftIntake = is_array($draft['intake'] ?? null) ? $draft['intake'] : [];
        $patientFacts = is_array($draftIntake['datosPaciente'] ?? null) ? $draftIntake['datosPaciente'] : [];

        return [
            'name' => self::firstNonEmptyString([
                $sessionPatient['name'] ?? null,
                $appointment['name'] ?? null,
                $appointment['patientName'] ?? null,
                $intake['patientName'] ?? null,
            ]),
            'email' => self::firstNonEmptyString([
                $sessionPatient['email'] ?? null,
                $appointment['email'] ?? null,
                $intake['email'] ?? null,
            ]),
            'phone' => self::firstNonEmptyString([
                $sessionPatient['phone'] ?? null,
                $appointment['phone'] ?? null,
                $intake['phone'] ?? null,
            ]),
            'ageYears' => self::firstPositiveInt([
                $sessionPatient['ageYears'] ?? null,
                $patientFacts['edadAnios'] ?? null,
                $appointment['ageYears'] ?? null,
                $appointment['edadAnios'] ?? null,
                $intake['ageYears'] ?? null,
            ]),
            'sexAtBirth' => self::firstNonEmptyString([
                $sessionPatient['sexAtBirth'] ?? null,
                $patientFacts['sexoBiologico'] ?? null,
                $appointment['sexAtBirth'] ?? null,
            ]),
        ];
    }

    /**
     * @param array<string,mixed> $appointment
     * @param array<string,mixed> $session
     * @param array<string,mixed> $draft
     * @return array<string,mixed>
     */
    private static function resolveService(array $appointment, array $session, array $draft): array
    {
        $sessionMetadata = is_array($session['metadata'] ?? null) ? $session['metadata'] : [];
        $clinicianDraft = is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : [];
        $draftIntake = is_array($draft['intake'] ?? null) ? $draft['intake'] : [];
        $serviceSlug = self::firstNonEmptyString([
            $appointment['service'] ?? null,
            $session['service'] ?? null,
            $sessionMetadata['service'] ?? null,
        ]);
        $serviceLabel = $serviceSlug !== '' && function_exists('get_service_label')
            ? (string) get_service_label($serviceSlug)
            : $serviceSlug;
        $summary = self::firstNonEmptyString([
            $clinicianDraft['resumen'] ?? null,
            $draftIntake['resumenClinico'] ?? null,
            $appointment['service'] ?? null,
        ]);

        return [
            'slug' => $serviceSlug,
            'label' => $serviceLabel !== '' ? $serviceLabel : 'Caso dermatologico',
            'summary' => $summary,
        ];
    }

    /**
     * @param array<string,mixed> $appointment
     * @param array<string,mixed> $intake
     * @param array<string,mixed> $session
     * @return array<string,mixed>
     */
    private static function resolveConsent(array $appointment, array $intake, array $session): array
    {
        $intakeConsent = is_array($intake['consentSnapshot'] ?? null) ? $intake['consentSnapshot'] : [];
        $sessionMetadata = is_array($session['metadata'] ?? null) ? $session['metadata'] : [];
        $privacyAccepted = self::truthy([
            $intakeConsent['consentAccepted'] ?? null,
            $appointment['privacyConsent'] ?? null,
        ]);
        $publicationExplicit = self::truthy([
            $appointment['mediaPublicationConsent'] ?? null,
            $appointment['publicationConsent'] ?? null,
            $appointment['publicCaseConsent'] ?? null,
            $intake['mediaPublicationConsent'] ?? null,
            $intake['publicationConsent'] ?? null,
            $intakeConsent['publicationConsentAccepted'] ?? null,
            $sessionMetadata['mediaPublicationConsent'] ?? null,
            $sessionMetadata['publicationConsent'] ?? null,
        ]);

        $status = 'missing';
        if ($publicationExplicit) {
            $status = 'explicit';
        } elseif ($privacyAccepted) {
            $status = 'privacy_only';
        }

        return [
            'status' => $status,
            'privacyAccepted' => $privacyAccepted,
            'privacyAcceptedAt' => self::firstNonEmptyString([
                $intakeConsent['consentAcceptedAt'] ?? null,
                $appointment['privacyConsentAt'] ?? null,
            ]),
            'publicationExplicit' => $publicationExplicit,
            'publicationAcceptedAt' => self::firstNonEmptyString([
                $appointment['mediaPublicationConsentAt'] ?? null,
                $appointment['publicationConsentAt'] ?? null,
                $intake['mediaPublicationConsentAt'] ?? null,
                $sessionMetadata['mediaPublicationConsentAt'] ?? null,
            ]),
        ];
    }

    /**
     * @param array<string,mixed> $case
     * @param array<int,array<string,mixed>> $assets
     * @return array<string,mixed>
     */
    private static function evaluateCasePolicy(array $case, array $assets): array
    {
        $flags = [];
        $latestAssetAt = '';
        $assetCount = count($assets);
        $eligibleAssetCount = 0;

        if ((string) ($case['consent']['status'] ?? 'missing') !== 'explicit') {
            $flags[] = 'missing_publication_consent';
        }

        if ((int) ($case['patient']['ageYears'] ?? 0) > 0 && (int) ($case['patient']['ageYears'] ?? 0) < 18) {
            $flags[] = 'patient_underage';
        }

        foreach ($assets as $asset) {
            $latestAssetAt = self::maxTimestamp($latestAssetAt, (string) ($asset['updatedAt'] ?? $asset['createdAt'] ?? ''));
            if ((string) ($asset['visibility'] ?? '') === 'candidate') {
                $eligibleAssetCount++;
            }

            foreach ((array) ($asset['qualityFlags'] ?? []) as $flag) {
                if ($flag === 'missing_private_path') {
                    $flags[] = 'asset_missing_private_path';
                }
                if ($flag === 'non_image_asset') {
                    $flags[] = 'non_clinical_asset';
                }
            }

            foreach ((array) ($asset['riskFlags'] ?? []) as $flag) {
                if ($flag === 'identification_risk') {
                    $flags[] = 'identification_risk';
                }
            }
        }

        if ($assetCount < 2) {
            $flags[] = 'insufficient_context';
        }

        $status = 'eligible';
        foreach (['missing_publication_consent', 'patient_underage', 'asset_missing_private_path', 'non_clinical_asset', 'identification_risk'] as $hardBlock) {
            if (in_array($hardBlock, $flags, true)) {
                $status = 'blocked';
                break;
            }
        }

        if ($status !== 'blocked' && in_array('insufficient_context', $flags, true)) {
            $status = 'needs_review';
        }

        return [
            'status' => $status,
            'flags' => array_values(array_unique($flags)),
            'latestAssetAt' => $latestAssetAt,
            'assetCount' => $assetCount,
            'eligibleAssetCount' => $eligibleAssetCount,
        ];
    }

    /**
     * @param array<string,mixed> $case
     * @param array<int,array<string,mixed>> $assets
     * @param array<string,mixed> $policy
     * @return array<string,mixed>
     */
    private static function buildCaseSummary(array $case, array $assets, array $policy): array
    {
        $serviceLabel = (string) ($case['service']['label'] ?? 'Caso dermatologico');
        $assetCount = count($assets);
        $patientName = trim((string) ($case['patient']['name'] ?? ''));
        $headline = $patientName !== '' ? $patientName : $serviceLabel;
        $deck = $assetCount > 0
            ? sprintf('%s • %d activo(s) clinico(s) disponibles para curacion editorial.', $serviceLabel, $assetCount)
            : 'Sin activos clinicos listos para curacion editorial.';

        return [
            'headline' => $headline,
            'deck' => $deck,
            'policyStatus' => (string) ($policy['status'] ?? 'needs_review'),
        ];
    }

    /**
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function buildPatientFlowSnapshot(array $case): array
    {
        return [
            'caseId' => (string) ($case['caseId'] ?? ''),
            'appointmentId' => $case['appointmentId'] ?? null,
            'sessionId' => (string) ($case['sessionId'] ?? ''),
            'openedAt' => (string) ($case['openedAt'] ?? ''),
            'latestActivityAt' => (string) ($case['latestActivityAt'] ?? ''),
            'patient' => [
                'name' => (string) ($case['patient']['name'] ?? ''),
                'ageYears' => $case['patient']['ageYears'] ?? null,
                'sexAtBirth' => (string) ($case['patient']['sexAtBirth'] ?? ''),
            ],
            'service' => $case['service'] ?? [],
            'consent' => $case['consent'] ?? [],
            'policy' => $case['policy'] ?? [],
            'mediaAssets' => array_map(static function (array $asset): array {
                return [
                    'assetId' => (string) ($asset['assetId'] ?? ''),
                    'kind' => (string) ($asset['kind'] ?? ''),
                    'qualityFlags' => array_values((array) ($asset['qualityFlags'] ?? [])),
                    'riskFlags' => array_values((array) ($asset['riskFlags'] ?? [])),
                    'createdAt' => (string) ($asset['createdAt'] ?? ''),
                ];
            }, (array) ($case['mediaAssets'] ?? [])),
            'mediaPublicationCandidate' => [
                'proposalStatus' => (string) (($case['proposal']['status'] ?? '') ?: 'draft'),
                'publicationStatus' => (string) (($case['publication']['status'] ?? '') ?: 'draft'),
            ],
        ];
    }

    /**
     * @param array<string,mixed> $snapshot
     * @return array<string,mixed>|null
     */
    private static function generateGatewayProposal(array $snapshot): ?array
    {
        $endpoint = self::gatewayEndpoint();
        if ($endpoint === '' || !function_exists('curl_init')) {
            return null;
        }

        $payload = [
            'task' => 'case_media_story',
            'responseFormat' => 'json',
            'model' => self::gatewayModel(),
            'patientCase' => $snapshot,
        ];

        $headers = ['Content-Type: application/json'];
        $apiKey = self::gatewayApiKey();
        if ($apiKey !== '') {
            $prefix = trim(self::gatewayKeyPrefix());
            $headerValue = $prefix !== '' ? ($prefix . ' ' . $apiKey) : $apiKey;
            $headers[] = self::gatewayKeyHeader() . ': ' . $headerValue;
        }

        $ch = curl_init($endpoint);
        if ($ch === false) {
            return null;
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => self::GATEWAY_TIMEOUT_SECONDS,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if (!is_string($raw) || $raw === '' || $status < 200 || $status >= 300) {
            return null;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }

        $candidate = is_array($decoded['data'] ?? null) ? $decoded['data'] : $decoded;
        if (!is_array($candidate)) {
            return null;
        }

        $selectedAssetIds = array_values(array_filter(array_map('strval', (array) ($candidate['selectedAssetIds'] ?? []))));
        if ($selectedAssetIds === []) {
            return null;
        }

        return [
            'selectedAssetIds' => $selectedAssetIds,
            'coverAssetId' => trim((string) ($candidate['coverAssetId'] ?? '')),
            'comparePairs' => self::normalizeComparePairs((array) ($candidate['comparePairs'] ?? [])),
            'copy' => self::normalizeLocalizedCopy((array) ($candidate['copy'] ?? [])),
            'alt' => self::normalizeLocalizedAlt((array) ($candidate['alt'] ?? [])),
            'disclaimer' => trim((string) ($candidate['disclaimer'] ?? self::defaultDisclaimer())),
            'category' => trim((string) ($candidate['category'] ?? '')),
            'tags' => array_values(array_filter(array_map('strval', (array) ($candidate['tags'] ?? [])))),
            'recommendation' => trim((string) ($candidate['recommendation'] ?? 'needs_review')),
            'status' => trim((string) ($candidate['status'] ?? 'draft')),
            'publicationScore' => max(0, min(100, (int) ($candidate['publicationScore'] ?? 0))),
            'timeline' => is_array($candidate['timeline'] ?? null) ? $candidate['timeline'] : [],
            'policyFlags' => array_values(array_filter(array_map('strval', (array) ($candidate['policyFlags'] ?? [])))),
            'openclawTrace' => is_array($candidate['openclawTrace'] ?? null) ? $candidate['openclawTrace'] : [],
        ];
    }

    /**
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function generateHeuristicProposal(array $case): array
    {
        $assets = array_values(array_filter((array) ($case['mediaAssets'] ?? []), static function (array $asset): bool {
            return (string) ($asset['visibility'] ?? '') === 'candidate';
        }));
        if ($assets === []) {
            $assets = array_values((array) ($case['mediaAssets'] ?? []));
        }

        $selectedAssets = array_slice($assets, 0, 4);
        $selectedAssetIds = array_values(array_map(static function (array $asset): string {
            return (string) ($asset['assetId'] ?? '');
        }, $selectedAssets));

        $comparePairs = self::pairBeforeAfter($selectedAssets);
        $coverAssetId = self::pickCoverAssetId($selectedAssets, $comparePairs);
        $serviceLabel = (string) ($case['service']['label'] ?? 'Caso dermatologico');
        $summary = trim((string) ($case['service']['summary'] ?? ''));
        if ($summary === '') {
            $summary = sprintf('%s con %d activo(s) clinico(s) revisados por curacion operativa.', $serviceLabel, count($selectedAssets));
        }

        $recommendation = 'needs_review';
        if ((string) ($case['policy']['status'] ?? 'needs_review') === 'blocked') {
            $recommendation = 'blocked';
        } elseif ((string) ($case['consent']['status'] ?? 'missing') === 'explicit' && $comparePairs !== []) {
            $recommendation = 'publish_ready';
        }

        return [
            'selectedAssetIds' => $selectedAssetIds,
            'coverAssetId' => $coverAssetId,
            'comparePairs' => $comparePairs,
            'copy' => [
                'es' => [
                    'title' => $serviceLabel,
                    'summary' => $summary,
                    'deck' => 'Paquete editorial generado desde el flujo clinico interno y pendiente de aprobacion humana.',
                ],
                'en' => [
                    'title' => $serviceLabel,
                    'summary' => 'Editorial case package generated from the internal clinical flow and pending human approval.',
                    'deck' => $summary,
                ],
            ],
            'alt' => [
                'es' => [
                    'cover' => 'Caso clinico editorial curado para la web',
                    'before' => 'Imagen previa del caso clinico',
                    'after' => 'Imagen posterior del caso clinico',
                ],
                'en' => [
                    'cover' => 'Editorial clinical case prepared for the website',
                    'before' => 'Before image of the clinical case',
                    'after' => 'After image of the clinical case',
                ],
            ],
            'disclaimer' => self::defaultDisclaimer(),
            'category' => self::inferCategory($case),
            'tags' => self::inferTags($case),
            'recommendation' => $recommendation,
            'status' => $recommendation === 'blocked' ? 'blocked' : 'draft',
            'publicationScore' => self::calculatePublicationScore($case, $selectedAssets, $comparePairs),
            'timeline' => [
                'openedAt' => (string) ($case['openedAt'] ?? ''),
                'latestActivityAt' => (string) ($case['latestActivityAt'] ?? ''),
            ],
            'policyFlags' => array_values((array) ($case['policy']['flags'] ?? [])),
            'openclawTrace' => [],
        ];
    }

    private static function defaultDisclaimer(): string
    {
        return 'Contenido editorial con fines informativos. La indicacion clinica individual siempre requiere valoracion medica.';
    }

    /**
     * @param array<string,mixed> $case
     * @return list<string>
     */
    private static function inferTags(array $case): array
    {
        $tags = [];
        $service = trim((string) ($case['service']['label'] ?? ''));
        if ($service !== '') {
            $tags[] = $service;
        }
        if ((string) ($case['consent']['status'] ?? '') === 'explicit') {
            $tags[] = 'Consentimiento OK';
        }
        if ((string) ($case['policy']['status'] ?? '') === 'needs_review') {
            $tags[] = 'Revision editorial';
        }
        return array_values(array_unique(array_filter($tags)));
    }

    /**
     * @param array<string,mixed> $case
     */
    private static function inferCategory(array $case): string
    {
        $service = self::normalizeText((string) ($case['service']['label'] ?? ''));
        if (str_contains($service, 'acne')) {
            return 'Acne y control';
        }
        if (str_contains($service, 'botox')) {
            return 'Facial premium';
        }
        if (str_contains($service, 'laser')) {
            return 'Laser dermatologico';
        }
        return 'Caso editorial dermatologico';
    }

    /**
     * @param array<string,mixed> $case
     * @param array<int,array<string,mixed>> $selectedAssets
     * @param array<int,array<string,string>> $comparePairs
     */
    private static function calculatePublicationScore(array $case, array $selectedAssets, array $comparePairs): int
    {
        $score = count($selectedAssets) * 18;
        if ($comparePairs !== []) {
            $score += 22;
        }
        if ((string) ($case['consent']['status'] ?? '') === 'explicit') {
            $score += 20;
        }
        if ((string) ($case['policy']['status'] ?? '') === 'blocked') {
            $score -= 60;
        }
        return max(0, min(100, $score));
    }

    /**
     * @param array<int,array<string,mixed>> $assets
     * @return array<int,array<string,string>>
     */
    private static function pairBeforeAfter(array $assets): array
    {
        $before = [];
        $after = [];

        foreach ($assets as $asset) {
            $kind = (string) ($asset['kind'] ?? '');
            if ($kind === 'before') {
                $before[] = $asset;
            } elseif ($kind === 'after') {
                $after[] = $asset;
            }
        }

        $pairs = [];
        if ($before !== [] && $after !== []) {
            $count = min(count($before), count($after));
            for ($index = 0; $index < $count; $index++) {
                $pairs[] = [
                    'beforeAssetId' => (string) ($before[$index]['assetId'] ?? ''),
                    'afterAssetId' => (string) ($after[$index]['assetId'] ?? ''),
                ];
            }
            return $pairs;
        }

        if (count($assets) >= 2) {
            $pairs[] = [
                'beforeAssetId' => (string) ($assets[0]['assetId'] ?? ''),
                'afterAssetId' => (string) ($assets[count($assets) - 1]['assetId'] ?? ''),
            ];
        }

        return $pairs;
    }

    /**
     * @param array<int,array<string,mixed>> $assets
     * @param array<int,array<string,string>> $comparePairs
     */
    private static function pickCoverAssetId(array $assets, array $comparePairs): string
    {
        if ($comparePairs !== []) {
            return (string) ($comparePairs[0]['afterAssetId'] ?? '');
        }

        foreach ($assets as $asset) {
            if ((string) ($asset['kind'] ?? '') === 'after') {
                return (string) ($asset['assetId'] ?? '');
            }
        }

        return (string) ($assets[0]['assetId'] ?? '');
    }

    /**
     * @param array<string,mixed> $case
     * @param array<string,mixed> $proposalData
     * @return array<string,mixed>
     */
    private static function mergeProposalDefaults(array $case, array $proposalData): array
    {
        $defaults = self::generateHeuristicProposal($case);
        return array_merge($defaults, $proposalData);
    }

    /**
     * @param array<string,mixed> $proposal
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function normalizeProposalRecord(array $proposal, array $case): array
    {
        $validAssetIds = array_values(array_map(static function (array $asset): string {
            return (string) ($asset['assetId'] ?? '');
        }, (array) ($case['mediaAssets'] ?? [])));

        $selectedAssetIds = array_values(array_filter(array_map('strval', (array) ($proposal['selectedAssetIds'] ?? [])), static function (string $assetId) use ($validAssetIds): bool {
            return in_array($assetId, $validAssetIds, true);
        }));
        if ($selectedAssetIds === []) {
            $selectedAssetIds = array_slice($validAssetIds, 0, 4);
        }

        $coverAssetId = trim((string) ($proposal['coverAssetId'] ?? ''));
        if ($coverAssetId === '' || !in_array($coverAssetId, $selectedAssetIds, true)) {
            $coverAssetId = $selectedAssetIds[0] ?? '';
        }

        return [
            'proposalId' => trim((string) ($proposal['proposalId'] ?? '')),
            'caseId' => trim((string) ($proposal['caseId'] ?? '')),
            'status' => trim((string) ($proposal['status'] ?? 'draft')),
            'selectedAssetIds' => $selectedAssetIds,
            'coverAssetId' => $coverAssetId,
            'comparePairs' => self::normalizeComparePairs((array) ($proposal['comparePairs'] ?? [])),
            'copy' => self::normalizeLocalizedCopy((array) ($proposal['copy'] ?? [])),
            'alt' => self::normalizeLocalizedAlt((array) ($proposal['alt'] ?? [])),
            'disclaimer' => trim((string) ($proposal['disclaimer'] ?? self::defaultDisclaimer())),
            'category' => trim((string) ($proposal['category'] ?? self::inferCategory($case))),
            'tags' => array_values(array_filter(array_map('strval', (array) ($proposal['tags'] ?? self::inferTags($case))))),
            'recommendation' => trim((string) ($proposal['recommendation'] ?? 'needs_review')),
            'publicationScore' => max(0, min(100, (int) ($proposal['publicationScore'] ?? 0))),
            'timeline' => is_array($proposal['timeline'] ?? null) ? $proposal['timeline'] : [],
            'policyFlags' => array_values(array_filter(array_map('strval', (array) ($proposal['policyFlags'] ?? [])))),
            'openclawTrace' => is_array($proposal['openclawTrace'] ?? null) ? $proposal['openclawTrace'] : [],
            'reviewDecision' => trim((string) ($proposal['reviewDecision'] ?? '')),
            'reviewedBy' => trim((string) ($proposal['reviewedBy'] ?? '')),
            'reviewedAt' => trim((string) ($proposal['reviewedAt'] ?? '')),
            'createdAt' => trim((string) ($proposal['createdAt'] ?? '')),
            'updatedAt' => trim((string) ($proposal['updatedAt'] ?? '')),
            'patientFlowSnapshot' => is_array($proposal['patientFlowSnapshot'] ?? null) ? $proposal['patientFlowSnapshot'] : [],
        ];
    }

    /**
     * @param array<int,mixed> $pairs
     * @return array<int,array<string,string>>
     */
    private static function normalizeComparePairs(array $pairs): array
    {
        $normalized = [];
        foreach ($pairs as $pair) {
            if (!is_array($pair)) {
                continue;
            }
            $beforeAssetId = trim((string) ($pair['beforeAssetId'] ?? $pair['before'] ?? ''));
            $afterAssetId = trim((string) ($pair['afterAssetId'] ?? $pair['after'] ?? ''));
            if ($beforeAssetId === '' || $afterAssetId === '') {
                continue;
            }
            $normalized[] = [
                'beforeAssetId' => $beforeAssetId,
                'afterAssetId' => $afterAssetId,
            ];
        }

        return array_values($normalized);
    }

    /**
     * @param array<string,mixed> $copy
     * @return array<string,array<string,string>>
     */
    private static function normalizeLocalizedCopy(array $copy): array
    {
        return [
            'es' => self::normalizeCopyNode(is_array($copy['es'] ?? null) ? $copy['es'] : []),
            'en' => self::normalizeCopyNode(is_array($copy['en'] ?? null) ? $copy['en'] : []),
        ];
    }

    /**
     * @param array<string,mixed> $node
     * @return array<string,string>
     */
    private static function normalizeCopyNode(array $node): array
    {
        return [
            'title' => trim((string) ($node['title'] ?? '')),
            'summary' => trim((string) ($node['summary'] ?? '')),
            'deck' => trim((string) ($node['deck'] ?? '')),
        ];
    }

    /**
     * @param array<string,mixed> $alt
     * @return array<string,array<string,string>>
     */
    private static function normalizeLocalizedAlt(array $alt): array
    {
        return [
            'es' => self::normalizeAltNode(is_array($alt['es'] ?? null) ? $alt['es'] : []),
            'en' => self::normalizeAltNode(is_array($alt['en'] ?? null) ? $alt['en'] : []),
        ];
    }

    /**
     * @param array<string,mixed> $node
     * @return array<string,string>
     */
    private static function normalizeAltNode(array $node): array
    {
        return [
            'cover' => trim((string) ($node['cover'] ?? '')),
            'before' => trim((string) ($node['before'] ?? '')),
            'after' => trim((string) ($node['after'] ?? '')),
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private static function requireProposal(array $store, array $payload): array
    {
        $proposalId = trim((string) ($payload['proposalId'] ?? ''));
        if ($proposalId !== '') {
            foreach (self::proposalRecords($store) as $proposal) {
                if ((string) ($proposal['proposalId'] ?? '') === $proposalId) {
                    return $proposal;
                }
            }
        }

        $caseId = trim((string) ($payload['caseId'] ?? ''));
        $proposal = self::latestProposalForCase($store, $caseId);
        if ($proposal === null) {
            throw new RuntimeException('Propuesta no encontrada', 404);
        }

        return $proposal;
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>|null
     */
    private static function latestProposalForCase(array $store, string $caseId): ?array
    {
        $needle = trim($caseId);
        if ($needle === '') {
            return null;
        }

        $latest = null;
        foreach (self::proposalRecords($store) as $proposal) {
            if ((string) ($proposal['caseId'] ?? '') !== $needle) {
                continue;
            }
            if (!is_array($latest) || strcmp((string) ($proposal['updatedAt'] ?? ''), (string) ($latest['updatedAt'] ?? '')) >= 0) {
                $latest = $proposal;
            }
        }

        return $latest;
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $payload
     * @return array<string,mixed>|null
     */
    private static function findPublication(array $store, array $payload): ?array
    {
        $storyId = trim((string) ($payload['storyId'] ?? ''));
        if ($storyId !== '') {
            foreach (self::publicationRecords($store) as $publication) {
                if ((string) ($publication['storyId'] ?? '') === $storyId) {
                    return $publication;
                }
            }
        }

        $caseId = trim((string) ($payload['caseId'] ?? ''));
        return self::findPublicationByCaseId($store, $caseId);
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>|null
     */
    private static function findPublicationByCaseId(array $store, string $caseId): ?array
    {
        $needle = trim($caseId);
        if ($needle === '') {
            return null;
        }

        $latest = null;
        foreach (self::publicationRecords($store) as $publication) {
            if ((string) ($publication['caseId'] ?? '') !== $needle) {
                continue;
            }
            if (!is_array($latest) || strcmp((string) ($publication['updatedAt'] ?? ''), (string) ($latest['updatedAt'] ?? '')) >= 0) {
                $latest = $publication;
            }
        }

        return $latest;
    }

    /**
     * @param array<string,mixed>|null $publication
     * @param array<string,mixed> $proposal
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function buildOrUpdatePublication(?array $publication, array $proposal, array $case, string $state): array
    {
        $now = local_date('c');
        $existing = is_array($publication) ? $publication : [];
        $storyId = trim((string) ($existing['storyId'] ?? ''));
        if ($storyId === '') {
            $storyId = self::generateId('story');
        }

        $slug = trim((string) ($existing['slug'] ?? ''));
        if ($slug === '') {
            $slug = self::slugify((string) ($proposal['category'] ?? (string) ($case['service']['label'] ?? 'caso-dermatologico')) . '-' . (string) ($case['caseId'] ?? ''));
        }

        return [
            'id' => (int) ($existing['id'] ?? 0),
            'storyId' => $storyId,
            'caseId' => (string) ($proposal['caseId'] ?? ''),
            'proposalId' => (string) ($proposal['proposalId'] ?? ''),
            'slug' => $slug,
            'status' => $state,
            'coverAssetId' => (string) ($proposal['coverAssetId'] ?? ''),
            'selectedAssetIds' => array_values((array) ($proposal['selectedAssetIds'] ?? [])),
            'comparePairs' => array_values((array) ($proposal['comparePairs'] ?? [])),
            'copy' => $proposal['copy'] ?? [],
            'alt' => $proposal['alt'] ?? [],
            'disclaimer' => (string) ($proposal['disclaimer'] ?? ''),
            'category' => (string) ($proposal['category'] ?? ''),
            'tags' => array_values((array) ($proposal['tags'] ?? [])),
            'timeline' => $proposal['timeline'] ?? [],
            'publicationScore' => (int) ($proposal['publicationScore'] ?? 0),
            'cover' => is_array($existing['cover'] ?? null) ? $existing['cover'] : [],
            'publicAssets' => is_array($existing['publicAssets'] ?? null) ? $existing['publicAssets'] : [],
            'publishedAt' => $state === 'published'
                ? self::firstNonEmptyString([$existing['publishedAt'] ?? null, $now])
                : (string) ($existing['publishedAt'] ?? ''),
            'createdAt' => self::firstNonEmptyString([$existing['createdAt'] ?? null, $now]),
            'updatedAt' => $now,
        ];
    }

    /**
     * @param array<string,mixed> $publication
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function materializePublicationAssets(array $publication, array $case): array
    {
        $assetsById = [];
        foreach ((array) ($case['mediaAssets'] ?? []) as $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $assetsById[(string) ($asset['assetId'] ?? '')] = $asset;
        }

        $publicAssets = [];
        foreach ((array) ($publication['selectedAssetIds'] ?? []) as $assetId) {
            $asset = $assetsById[(string) $assetId] ?? null;
            if (!is_array($asset)) {
                continue;
            }
            $publicAssets[(string) $assetId] = self::copyAssetToPublicRuntime($publication, $asset);
        }

        $coverAssetId = (string) ($publication['coverAssetId'] ?? '');
        $coverAsset = $publicAssets[$coverAssetId] ?? [];
        $publication['cover'] = is_array($coverAsset) ? $coverAsset : [];
        $publication['publicAssets'] = $publicAssets;
        return $publication;
    }

    /**
     * @param array<string,mixed> $publication
     * @param array<string,mixed> $asset
     * @return array<string,mixed>
     */
    private static function copyAssetToPublicRuntime(array $publication, array $asset): array
    {
        $privatePath = trim((string) ($asset['privatePath'] ?? ''));
        if ($privatePath === '') {
            throw new RuntimeException('El asset no tiene ruta privada consistente', 409);
        }

        $source = self::resolvePrivateDiskPath($privatePath);
        if ($source === '' || !is_file($source)) {
            throw new RuntimeException('El asset privado no existe en disk', 409);
        }

        $dir = self::publicMediaDir();
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('No se pudo preparar el directorio runtime de media publica', 500);
        }

        $extension = strtolower(pathinfo($source, PATHINFO_EXTENSION));
        if ($extension === '') {
            $extension = 'jpg';
        }
        $filename = self::slugify((string) ($publication['slug'] ?? 'story')) . '-' . self::slugify((string) ($asset['assetId'] ?? 'asset'));
        $filename .= '-' . substr(sha1((string) ($asset['sha256'] ?? $privatePath)), 0, 10) . '.' . $extension;
        $target = $dir . DIRECTORY_SEPARATOR . $filename;

        if (!is_file($target)) {
            if (!@copy($source, $target)) {
                throw new RuntimeException('No se pudo copiar el asset publico derivado', 500);
            }
            @chmod($target, 0644);
        }

        return [
            'assetId' => (string) ($asset['assetId'] ?? ''),
            'url' => self::buildPublicMediaUrl($filename),
            'mime' => self::safeMime((string) ($asset['mime'] ?? ''), $target),
            'filename' => $filename,
        ];
    }

    private static function publicMediaDir(): string
    {
        $configured = getenv('PIELARMONIA_PUBLIC_CASE_MEDIA_DIR');
        if (is_string($configured) && trim($configured) !== '') {
            return rtrim(trim($configured), '\\/');
        }

        return data_dir_path() . DIRECTORY_SEPARATOR . 'public-case-media';
    }

    private static function publicMediaBaseUrl(): string
    {
        $configured = getenv('PIELARMONIA_PUBLIC_CASE_MEDIA_BASE_URL');
        if (is_string($configured) && trim($configured) !== '') {
            return trim($configured);
        }

        return self::PUBLIC_FILE_RESOURCE;
    }

    private static function buildPublicMediaUrl(string $filename): string
    {
        $base = self::publicMediaBaseUrl();
        $encoded = rawurlencode($filename);
        if (str_contains($base, '{name}')) {
            return str_replace('{name}', $encoded, $base);
        }

        return rtrim($base, '/') . '/' . $encoded;
    }

    private static function resolvePrivateDiskPath(string $privatePath): string
    {
        $normalized = ltrim(str_replace(['\\', '//'], '/', trim($privatePath)), '/');
        if ($normalized === '') {
            return '';
        }

        if (str_starts_with($normalized, 'clinical-media/')) {
            return data_dir_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalized);
        }

        return clinical_media_dir_path() . DIRECTORY_SEPARATOR . basename($normalized);
    }

    private static function safeMime(string $mime, string $path): string
    {
        $candidate = trim($mime);
        if ($candidate !== '') {
            return $candidate;
        }

        if (function_exists('mime_content_type')) {
            $detected = @mime_content_type($path);
            if (is_string($detected) && trim($detected) !== '') {
                return trim($detected);
            }
        }

        return 'application/octet-stream';
    }

    /**
     * @param array<string,mixed> $publication
     * @return array<string,mixed>|null
     */
    private static function publicationToPublicStory(array $publication, string $locale): ?array
    {
        $copy = is_array($publication['copy'] ?? null) ? $publication['copy'] : [];
        $alt = is_array($publication['alt'] ?? null) ? $publication['alt'] : [];
        $localizedCopy = is_array($copy[$locale] ?? null) ? $copy[$locale] : (is_array($copy['es'] ?? null) ? $copy['es'] : []);
        $localizedAlt = is_array($alt[$locale] ?? null) ? $alt[$locale] : (is_array($alt['es'] ?? null) ? $alt['es'] : []);
        $cover = is_array($publication['cover'] ?? null) ? $publication['cover'] : [];
        $publicAssets = is_array($publication['publicAssets'] ?? null) ? $publication['publicAssets'] : [];

        $coverUrl = trim((string) ($cover['url'] ?? ''));
        if ($coverUrl === '') {
            return null;
        }

        $comparePairs = [];
        foreach ((array) ($publication['comparePairs'] ?? []) as $pair) {
            if (!is_array($pair)) {
                continue;
            }
            $before = $publicAssets[(string) ($pair['beforeAssetId'] ?? '')] ?? null;
            $after = $publicAssets[(string) ($pair['afterAssetId'] ?? '')] ?? null;
            if (!is_array($before) || !is_array($after)) {
                continue;
            }

            $comparePairs[] = [
                'before' => [
                    'url' => (string) ($before['url'] ?? ''),
                    'alt' => (string) ($localizedAlt['before'] ?? ''),
                ],
                'after' => [
                    'url' => (string) ($after['url'] ?? ''),
                    'alt' => (string) ($localizedAlt['after'] ?? ''),
                ],
            ];
        }

        return [
            'storyId' => (string) ($publication['storyId'] ?? ''),
            'slug' => (string) ($publication['slug'] ?? ''),
            'title' => (string) ($localizedCopy['title'] ?? ''),
            'summary' => (string) ($localizedCopy['summary'] ?? ''),
            'deck' => (string) ($localizedCopy['deck'] ?? ''),
            'category' => (string) ($publication['category'] ?? ''),
            'tags' => array_values((array) ($publication['tags'] ?? [])),
            'cover' => [
                'url' => $coverUrl,
                'alt' => (string) ($localizedAlt['cover'] ?? ''),
            ],
            'comparePairs' => $comparePairs,
            'publishedAt' => (string) ($publication['publishedAt'] ?? ''),
            'disclaimer' => (string) ($publication['disclaimer'] ?? ''),
        ];
    }

    /**
     * @param array<string,mixed> $proposal
     * @param array<string,mixed> $edits
     * @param array<string,mixed> $case
     * @return array<string,mixed>
     */
    private static function applyProposalEdits(array $proposal, array $edits, array $case): array
    {
        $merged = $proposal;
        if (isset($edits['selectedAssetIds']) && is_array($edits['selectedAssetIds'])) {
            $merged['selectedAssetIds'] = array_values($edits['selectedAssetIds']);
        }
        if (isset($edits['coverAssetId'])) {
            $merged['coverAssetId'] = trim((string) $edits['coverAssetId']);
        }
        if (isset($edits['comparePairs']) && is_array($edits['comparePairs'])) {
            $merged['comparePairs'] = $edits['comparePairs'];
        }
        if (isset($edits['copy']) && is_array($edits['copy'])) {
            $merged['copy'] = $edits['copy'];
        }
        if (isset($edits['alt']) && is_array($edits['alt'])) {
            $merged['alt'] = $edits['alt'];
        }
        if (isset($edits['category'])) {
            $merged['category'] = trim((string) $edits['category']);
        }
        if (isset($edits['tags']) && is_array($edits['tags'])) {
            $merged['tags'] = array_values($edits['tags']);
        }
        if (isset($edits['timeline']) && is_array($edits['timeline'])) {
            $merged['timeline'] = $edits['timeline'];
        }
        if (isset($edits['disclaimer'])) {
            $merged['disclaimer'] = trim((string) $edits['disclaimer']);
        }

        return self::normalizeProposalRecord($merged, $case);
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $proposal
     * @return array<string,mixed>
     */
    private static function upsertProposal(array $store, array $proposal): array
    {
        $records = self::proposalRecords($store);
        $targetId = (int) ($proposal['id'] ?? 0);
        $targetProposalId = (string) ($proposal['proposalId'] ?? '');

        foreach ($records as $index => $existing) {
            if (
                ($targetId > 0 && (int) ($existing['id'] ?? 0) === $targetId)
                || ($targetProposalId !== '' && (string) ($existing['proposalId'] ?? '') === $targetProposalId)
            ) {
                $proposal['id'] = (int) ($existing['id'] ?? $targetId);
                $records[$index] = $proposal;
                $store['case_media_proposals'] = array_values($records);
                return $store;
            }
        }

        $proposal['id'] = self::nextRecordId($records);
        $records[] = $proposal;
        $store['case_media_proposals'] = array_values($records);
        return $store;
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $publication
     * @return array<string,mixed>
     */
    private static function upsertPublication(array $store, array $publication): array
    {
        $records = self::publicationRecords($store);
        $targetId = (int) ($publication['id'] ?? 0);
        $storyId = (string) ($publication['storyId'] ?? '');

        foreach ($records as $index => $existing) {
            if (
                ($targetId > 0 && (int) ($existing['id'] ?? 0) === $targetId)
                || ($storyId !== '' && (string) ($existing['storyId'] ?? '') === $storyId)
            ) {
                $publication['id'] = (int) ($existing['id'] ?? $targetId);
                $records[$index] = $publication;
                $store['case_media_publications'] = array_values($records);
                return $store;
            }
        }

        $publication['id'] = self::nextRecordId($records);
        $records[] = $publication;
        $store['case_media_publications'] = array_values($records);
        return $store;
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $event
     * @return array<string,mixed>
     */
    private static function appendEvent(array $store, array $event): array
    {
        $records = isset($store['case_media_events']) && is_array($store['case_media_events'])
            ? $store['case_media_events']
            : [];
        $event['id'] = self::nextRecordId($records);
        $records[] = $event;
        $store['case_media_events'] = array_values($records);
        return $store;
    }

    /**
     * @param array<string,mixed> $store
     * @return array<int,array<string,mixed>>
     */
    private static function recentEvents(array $store, int $limit): array
    {
        $events = self::normalizeEventList((array) ($store['case_media_events'] ?? []));
        return array_slice($events, 0, $limit);
    }

    /**
     * @param array<int,mixed> $events
     * @return array<int,array<string,mixed>>
     */
    private static function normalizeEventList(array $events): array
    {
        $normalized = [];
        foreach ($events as $event) {
            if (!is_array($event)) {
                continue;
            }
            $normalized[] = [
                'eventId' => (string) ($event['eventId'] ?? ''),
                'caseId' => (string) ($event['caseId'] ?? ''),
                'type' => (string) ($event['type'] ?? ''),
                'title' => (string) ($event['title'] ?? ''),
                'message' => (string) ($event['message'] ?? ''),
                'payload' => is_array($event['payload'] ?? null) ? $event['payload'] : [],
                'createdAt' => (string) ($event['createdAt'] ?? ''),
            ];
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp((string) ($right['createdAt'] ?? ''), (string) ($left['createdAt'] ?? ''));
        });

        return array_values($normalized);
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private static function buildEventRecord(string $caseId, string $type, array $payload): array
    {
        $createdAt = local_date('c');
        return [
            'eventId' => self::generateId('mfe'),
            'caseId' => $caseId,
            'type' => $type,
            'title' => self::eventTitle($type),
            'message' => self::eventMessage($type, $payload),
            'payload' => $payload,
            'createdAt' => $createdAt,
        ];
    }

    private static function eventTitle(string $type): string
    {
        switch ($type) {
            case 'media_flow.proposal_generated':
                return 'Propuesta OpenClaw generada';
            case 'media_flow.proposal_patched':
                return 'Propuesta editorial ajustada';
            case 'media_flow.proposal_reviewed':
                return 'Revision editorial registrada';
            case 'media_flow.publication_state_changed':
                return 'Estado de publicacion actualizado';
            default:
                return 'Evento de Media Flow';
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function eventMessage(string $type, array $payload): string
    {
        switch ($type) {
            case 'media_flow.proposal_generated':
                return 'Se preparo una propuesta editorial para revisar activos, copy y comparativas.';
            case 'media_flow.proposal_patched':
                return 'OpenClaw ajusto la propuesta activa sin publicar ni aprobar automaticamente.';
            case 'media_flow.proposal_reviewed':
                return 'La mesa operativa reviso la propuesta y dejo una decision auditable.';
            case 'media_flow.publication_state_changed':
                return 'La historia publica cambio de estado dentro del feed editorial de V6.';
            default:
                return 'Evento registrado.';
        }
    }

    /**
     * @param array<int,array<string,mixed>> $records
     */
    private static function nextRecordId(array $records): int
    {
        $max = 0;
        foreach ($records as $record) {
            $id = (int) ($record['id'] ?? 0);
            if ($id > $max) {
                $max = $id;
            }
        }
        return $max + 1;
    }

    /**
     * @param array<string,mixed> $store
     * @return array<int,array<string,mixed>>
     */
    private static function proposalRecords(array $store): array
    {
        return isset($store['case_media_proposals']) && is_array($store['case_media_proposals'])
            ? array_values($store['case_media_proposals'])
            : [];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<int,array<string,mixed>>
     */
    private static function publicationRecords(array $store): array
    {
        return isset($store['case_media_publications']) && is_array($store['case_media_publications'])
            ? array_values($store['case_media_publications'])
            : [];
    }

    /**
     * @return array<string,mixed>
     */
    private static function emptyPublication(string $caseId): array
    {
        return [
            'storyId' => '',
            'caseId' => $caseId,
            'status' => 'draft',
            'cover' => [],
            'publicAssets' => [],
            'publishedAt' => '',
        ];
    }

    private static function gatewayConfigured(): bool
    {
        return self::gatewayEndpoint() !== '';
    }

    /**
     * @return array<string,mixed>
     */
    private static function gatewayStatus(): array
    {
        return [
            'configured' => self::gatewayConfigured(),
            'endpoint' => self::gatewayEndpoint() !== '' ? 'configured' : 'disabled',
            'model' => self::gatewayModel(),
        ];
    }

    private static function gatewayEndpoint(): string
    {
        $endpoint = getenv('PIELARMONIA_MEDIA_FLOW_OPENCLAW_ENDPOINT');
        if (is_string($endpoint) && trim($endpoint) !== '') {
            return trim($endpoint);
        }
        if (function_exists('api_figo_env_gateway_endpoint')) {
            return trim((string) api_figo_env_gateway_endpoint());
        }
        return '';
    }

    private static function gatewayApiKey(): string
    {
        $apiKey = getenv('PIELARMONIA_MEDIA_FLOW_OPENCLAW_API_KEY');
        if (is_string($apiKey) && trim($apiKey) !== '') {
            return trim($apiKey);
        }
        if (function_exists('api_figo_env_gateway_api_key')) {
            return trim((string) api_figo_env_gateway_api_key());
        }
        return '';
    }

    private static function gatewayModel(): string
    {
        $model = getenv('PIELARMONIA_MEDIA_FLOW_OPENCLAW_MODEL');
        if (is_string($model) && trim($model) !== '') {
            return trim($model);
        }
        if (function_exists('api_figo_env_gateway_model')) {
            return trim((string) api_figo_env_gateway_model());
        }
        return 'auto';
    }

    private static function gatewayKeyHeader(): string
    {
        $value = getenv('PIELARMONIA_MEDIA_FLOW_OPENCLAW_KEY_HEADER');
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
        if (function_exists('api_figo_env_gateway_key_header')) {
            return trim((string) api_figo_env_gateway_key_header());
        }
        return 'Authorization';
    }

    private static function gatewayKeyPrefix(): string
    {
        $value = getenv('PIELARMONIA_MEDIA_FLOW_OPENCLAW_KEY_PREFIX');
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
        if (function_exists('api_figo_env_gateway_key_prefix')) {
            return trim((string) api_figo_env_gateway_key_prefix());
        }
        return 'Bearer';
    }

    private static function normalizeLocale(string $locale): string
    {
        return strtolower(trim($locale)) === 'en' ? 'en' : 'es';
    }

    /**
     * @param list<mixed> $values
     */
    private static function truthy(array $values): bool
    {
        foreach ($values as $value) {
            if ($value === null || $value === '') {
                continue;
            }

            if (function_exists('parse_bool')) {
                if (parse_bool($value)) {
                    return true;
                }
                continue;
            }

            if ($value === true || $value === 1 || $value === '1') {
                return true;
            }
        }
        return false;
    }

    /**
     * @param list<mixed> $values
     */
    private static function firstPositiveInt(array $values): ?int
    {
        foreach ($values as $value) {
            $parsed = (int) $value;
            if ($parsed > 0) {
                return $parsed;
            }
        }

        return null;
    }

    /**
     * @param list<mixed> $values
     */
    private static function firstNonEmptyString(array $values): string
    {
        foreach ($values as $value) {
            $text = trim((string) $value);
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    /**
     * @param list<string> $values
     */
    private static function firstNonEmptyTimestamp(array $values): string
    {
        return self::firstNonEmptyString($values);
    }

    private static function maxTimestamp(string $left, string $right): string
    {
        if ($left === '') {
            return $right;
        }
        if ($right === '') {
            return $left;
        }

        return strcmp($left, $right) >= 0 ? $left : $right;
    }

    private static function normalizeText(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'n'],
            $normalized
        );
        return $normalized;
    }

    private static function slugify(string $value): string
    {
        $value = self::normalizeText($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        $value = trim($value, '-');
        return $value !== '' ? $value : 'case-media';
    }

    private static function generateId(string $prefix): string
    {
        try {
            return $prefix . '_' . bin2hex(random_bytes(6));
        } catch (Throwable $e) {
            return $prefix . '_' . substr(sha1((string) microtime(true)), 0, 12);
        }
    }

    private static function emitMetric(string $name, array $labels = []): void
    {
        if (class_exists('Metrics')) {
            Metrics::increment($name, $labels);
        }
    }
}
