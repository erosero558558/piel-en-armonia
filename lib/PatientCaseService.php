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
    private static ?PatientCaseSyncService $syncInstance = null;
    private static ?PatientCaseQueueService $queueInstance = null;
    private static ?PatientCaseIdentityService $identityInstance = null;

    private static function sync(): PatientCaseSyncService
    {
        if (self::$syncInstance === null) {
            self::$syncInstance = new PatientCaseSyncService();
        }
        return self::$syncInstance;
    }

    private static function queue(): PatientCaseQueueService
    {
        if (self::$queueInstance === null) {
            self::$queueInstance = new PatientCaseQueueService();
        }
        return self::$queueInstance;
    }

    private static function identity(): PatientCaseIdentityService
    {
        if (self::$identityInstance === null) {
            self::$identityInstance = new PatientCaseIdentityService();
        }
        return self::$identityInstance;
    }

    public static function hydrateStore(...$args)
    {
        return self::sync()->hydrateStore(...$args);
    }

    public static function buildSummary(...$args)
    {
        return self::sync()->buildSummary(...$args);
    }

    public static function buildReadModel(...$args)
    {
        return self::sync()->buildReadModel(...$args);
    }

    public static function resolveTenantId(...$args)
    {
        return self::identity()->resolveTenantId(...$args);
    }

    public static function seedExistingCases(...$args)
    {
        return self::sync()->seedExistingCases(...$args);
    }

    public static function normalizeExistingCase(...$args)
    {
        return self::sync()->normalizeExistingCase(...$args);
    }

    public static function indexExistingLinks(...$args)
    {
        return self::sync()->indexExistingLinks(...$args);
    }

    public static function indexExistingTimeline(...$args)
    {
        return self::sync()->indexExistingTimeline(...$args);
    }

    public static function resolveRecordTenantId(...$args)
    {
        return self::identity()->resolveRecordTenantId(...$args);
    }

    public static function ensureCase(...$args)
    {
        return self::sync()->ensureCase(...$args);
    }

    public static function seedPersistedCase(...$args)
    {
        return self::sync()->seedPersistedCase(...$args);
    }

    public static function updateCaseFromAppointment(...$args)
    {
        return self::sync()->updateCaseFromAppointment(...$args);
    }

    public static function updateCaseFromTicket(...$args)
    {
        return self::sync()->updateCaseFromTicket(...$args);
    }

    public static function enrichQueueTicketsWithPatientCaseSnapshots(...$args)
    {
        return self::queue()->enrichQueueTicketsWithPatientCaseSnapshots(...$args);
    }

    public static function attachPatientCaseSnapshotToTicket(...$args)
    {
        return self::queue()->attachPatientCaseSnapshotToTicket(...$args);
    }

    public static function summarizePreviousVisits(...$args)
    {
        return self::sync()->summarizePreviousVisits(...$args);
    }

    public static function resolveCaseJourneyStage(...$args)
    {
        return self::sync()->resolveCaseJourneyStage(...$args);
    }

    public static function resolveJourneyStageLabel(...$args)
    {
        return self::sync()->resolveJourneyStageLabel(...$args);
    }

    public static function resolveQueueTicketReasonLabel(...$args)
    {
        return self::queue()->resolveQueueTicketReasonLabel(...$args);
    }

    public static function buildQueueTicketAlerts(...$args)
    {
        return self::queue()->buildQueueTicketAlerts(...$args);
    }

    public static function applyCaseStatus(...$args)
    {
        return self::sync()->applyCaseStatus(...$args);
    }

    public static function touchCase(...$args)
    {
        return self::sync()->touchCase(...$args);
    }

    public static function normalizeApprovals(...$args)
    {
        return self::identity()->normalizeApprovals(...$args);
    }

    public static function registerIdentityKeys(...$args)
    {
        return self::identity()->registerIdentityKeys(...$args);
    }

    public static function buildAppointmentIdentityKeys(...$args)
    {
        return self::identity()->buildAppointmentIdentityKeys(...$args);
    }

    public static function buildCaseIdentityKeys(...$args)
    {
        return self::identity()->buildCaseIdentityKeys(...$args);
    }

    public static function resolveCallbackCaseId(...$args)
    {
        return self::identity()->resolveCallbackCaseId(...$args);
    }

    public static function buildCallbackIdentityKeys(...$args)
    {
        return self::identity()->buildCallbackIdentityKeys(...$args);
    }

    public static function resolveAppointmentPatientId(...$args)
    {
        return self::identity()->resolveAppointmentPatientId(...$args);
    }

    public static function resolveCallbackPatientId(...$args)
    {
        return self::identity()->resolveCallbackPatientId(...$args);
    }

    public static function deriveAppointmentCaseStatus(...$args)
    {
        return self::identity()->deriveAppointmentCaseStatus(...$args);
    }

    public static function resolveOpenedAt(...$args)
    {
        return self::identity()->resolveOpenedAt(...$args);
    }

    public static function resolveTerminalAt(...$args)
    {
        return self::identity()->resolveTerminalAt(...$args);
    }

    public static function composeScheduledTimestamp(...$args)
    {
        return self::identity()->composeScheduledTimestamp(...$args);
    }

    public static function offsetTimestampMinutes(...$args)
    {
        return self::identity()->offsetTimestampMinutes(...$args);
    }

    public static function mergeMilestone(...$args)
    {
        return self::sync()->mergeMilestone(...$args);
    }

    public static function buildDeterministicId(...$args)
    {
        return self::identity()->buildDeterministicId(...$args);
    }

    public static function resolveCaseId(...$args)
    {
        return self::identity()->resolveCaseId(...$args);
    }

    public static function buildEventId(...$args)
    {
        return self::identity()->buildEventId(...$args);
    }

    public static function sortByCreatedAtDesc(...$args)
    {
        return self::sync()->sortByCreatedAtDesc(...$args);
    }

    public static function sortCases(...$args)
    {
        return self::sync()->sortCases(...$args);
    }

    public static function firstNonEmptyString(...$args)
    {
        return self::identity()->firstNonEmptyString(...$args);
    }

    public static function normalizeTimestampValue(...$args)
    {
        return self::identity()->normalizeTimestampValue(...$args);
    }
}
