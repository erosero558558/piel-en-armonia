<?php

declare(strict_types=1);

require_once __DIR__ . '/case/PatientCaseSyncService.php';
require_once __DIR__ . '/case/PatientCaseQueueService.php';
require_once __DIR__ . '/case/PatientCaseIdentityService.php';


require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/tenants.php';

final class PatientCaseService
{
    public static function hydrateStore(...$args)
    {
        return PatientCaseSyncService::hydrateStore(...$args);
    }

    public static function buildSummary(...$args)
    {
        return PatientCaseSyncService::buildSummary(...$args);
    }

    public static function buildReadModel(...$args)
    {
        return PatientCaseSyncService::buildReadModel(...$args);
    }

    public static function resolveTenantId(...$args)
    {
        return PatientCaseIdentityService::resolveTenantId(...$args);
    }

    public static function seedExistingCases(...$args)
    {
        return PatientCaseSyncService::seedExistingCases(...$args);
    }

    public static function normalizeExistingCase(...$args)
    {
        return PatientCaseSyncService::normalizeExistingCase(...$args);
    }

    public static function indexExistingLinks(...$args)
    {
        return PatientCaseSyncService::indexExistingLinks(...$args);
    }

    public static function indexExistingTimeline(...$args)
    {
        return PatientCaseSyncService::indexExistingTimeline(...$args);
    }

    public static function resolveRecordTenantId(...$args)
    {
        return PatientCaseIdentityService::resolveRecordTenantId(...$args);
    }

    public static function ensureCase(...$args)
    {
        return PatientCaseSyncService::ensureCase(...$args);
    }

    public static function seedPersistedCase(...$args)
    {
        return PatientCaseSyncService::seedPersistedCase(...$args);
    }

    public static function updateCaseFromAppointment(...$args)
    {
        return PatientCaseSyncService::updateCaseFromAppointment(...$args);
    }

    public static function updateCaseFromTicket(...$args)
    {
        return PatientCaseSyncService::updateCaseFromTicket(...$args);
    }

    public static function enrichQueueTicketsWithPatientCaseSnapshots(...$args)
    {
        return PatientCaseQueueService::enrichQueueTicketsWithPatientCaseSnapshots(...$args);
    }

    public static function attachPatientCaseSnapshotToTicket(...$args)
    {
        return PatientCaseQueueService::attachPatientCaseSnapshotToTicket(...$args);
    }

    public static function summarizePreviousVisits(...$args)
    {
        return PatientCaseSyncService::summarizePreviousVisits(...$args);
    }

    public static function resolveCaseJourneyStage(...$args)
    {
        return PatientCaseSyncService::resolveCaseJourneyStage(...$args);
    }

    public static function resolveJourneyStageLabel(...$args)
    {
        return PatientCaseSyncService::resolveJourneyStageLabel(...$args);
    }

    public static function resolveQueueTicketReasonLabel(...$args)
    {
        return PatientCaseQueueService::resolveQueueTicketReasonLabel(...$args);
    }

    public static function buildQueueTicketAlerts(...$args)
    {
        return PatientCaseQueueService::buildQueueTicketAlerts(...$args);
    }

    public static function applyCaseStatus(...$args)
    {
        return PatientCaseSyncService::applyCaseStatus(...$args);
    }

    public static function touchCase(...$args)
    {
        return PatientCaseSyncService::touchCase(...$args);
    }

    public static function normalizeApprovals(...$args)
    {
        return PatientCaseIdentityService::normalizeApprovals(...$args);
    }

    public static function registerIdentityKeys(...$args)
    {
        return PatientCaseIdentityService::registerIdentityKeys(...$args);
    }

    public static function buildAppointmentIdentityKeys(...$args)
    {
        return PatientCaseIdentityService::buildAppointmentIdentityKeys(...$args);
    }

    public static function buildCaseIdentityKeys(...$args)
    {
        return PatientCaseIdentityService::buildCaseIdentityKeys(...$args);
    }

    public static function resolveCallbackCaseId(...$args)
    {
        return PatientCaseIdentityService::resolveCallbackCaseId(...$args);
    }

    public static function buildCallbackIdentityKeys(...$args)
    {
        return PatientCaseIdentityService::buildCallbackIdentityKeys(...$args);
    }

    public static function resolveAppointmentPatientId(...$args)
    {
        return PatientCaseIdentityService::resolveAppointmentPatientId(...$args);
    }

    public static function resolveCallbackPatientId(...$args)
    {
        return PatientCaseIdentityService::resolveCallbackPatientId(...$args);
    }

    public static function deriveAppointmentCaseStatus(...$args)
    {
        return PatientCaseIdentityService::deriveAppointmentCaseStatus(...$args);
    }

    public static function resolveOpenedAt(...$args)
    {
        return PatientCaseIdentityService::resolveOpenedAt(...$args);
    }

    public static function resolveTerminalAt(...$args)
    {
        return PatientCaseIdentityService::resolveTerminalAt(...$args);
    }

    public static function composeScheduledTimestamp(...$args)
    {
        return PatientCaseIdentityService::composeScheduledTimestamp(...$args);
    }

    public static function offsetTimestampMinutes(...$args)
    {
        return PatientCaseIdentityService::offsetTimestampMinutes(...$args);
    }

    public static function mergeMilestone(...$args)
    {
        return PatientCaseSyncService::mergeMilestone(...$args);
    }

    public static function buildDeterministicId(...$args)
    {
        return PatientCaseIdentityService::buildDeterministicId(...$args);
    }

    public static function resolveCaseId(...$args)
    {
        return PatientCaseIdentityService::resolveCaseId(...$args);
    }

    public static function buildEventId(...$args)
    {
        return PatientCaseIdentityService::buildEventId(...$args);
    }

    public static function sortByCreatedAtDesc(...$args)
    {
        return PatientCaseSyncService::sortByCreatedAtDesc(...$args);
    }

    public static function sortCases(...$args)
    {
        return PatientCaseSyncService::sortCases(...$args);
    }

    public static function firstNonEmptyString(...$args)
    {
        return PatientCaseIdentityService::firstNonEmptyString(...$args);
    }

    public static function normalizeTimestampValue(...$args)
    {
        return PatientCaseIdentityService::normalizeTimestampValue(...$args);
    }
}
