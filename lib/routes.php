<?php

declare(strict_types=1);

function register_api_routes(Router $router): void
{
    // v1 Routes
    $router->add('GET', 'monitoring-config', [SystemController::class, 'monitoringConfig']);
    $router->add('GET', 'features', [SystemController::class, 'features']);
    $router->add('GET', 'public-runtime-config', [SystemController::class, 'publicRuntimeConfig']);
    $router->add('GET', 'metrics', [SystemController::class, 'metrics']);
    $router->add('GET', 'predictions', [SystemController::class, 'predictions']);
    $router->add('POST', 'operator-auth-start', [OperatorAuthController::class, 'start']);
    $router->add('GET', 'operator-auth-status', [OperatorAuthController::class, 'status']);
    $router->add('POST', 'operator-auth-complete', [OperatorAuthController::class, 'complete']);
    $router->add('POST', 'operator-auth-logout', [OperatorAuthController::class, 'logout']);
    $router->add('GET', 'operator-pin-status', [OperatorPinController::class, 'status']);
    $router->add('GET', 'operator-session-status', [OperatorPinController::class, 'sessionStatus']);
    $router->add('POST', 'operator-pin-login', [OperatorPinController::class, 'login']);
    $router->add('POST', 'operator-pin-logout', [OperatorPinController::class, 'logout']);
    $router->add('POST', 'operator-pin-rotate', [OperatorPinController::class, 'rotate']);

    $router->add('GET', 'figo-config', [ConfigController::class, 'getFigoConfig']);
    $router->add('POST', 'figo-config', [ConfigController::class, 'updateFigoConfig']);
    $router->add('PUT', 'figo-config', [ConfigController::class, 'updateFigoConfig']);
    $router->add('PATCH', 'figo-config', [ConfigController::class, 'updateFigoConfig']);

    $router->add('GET', 'health', [HealthController::class, 'check']);
    $router->add('GET', 'health-diagnostics', [HealthController::class, 'diagnostics']);

    $router->add('GET', 'payment-config', [PaymentController::class, 'config']);

    $router->add('GET', 'data', [AdminDataController::class, 'index']);
    $router->add('GET', 'doctor-profile', [DoctorProfileController::class, 'show']);
    $router->add('POST', 'doctor-profile', [DoctorProfileController::class, 'update']);
    $router->add('GET', 'flow-os-manifest', [FlowOsController::class, 'manifest']);
    $router->add('GET', 'flow-os-journey-preview', [FlowOsController::class, 'journeyPreview']);
    $router->add('POST', 'flow-os-intake', [IntakeController::class, 'store']);
    $router->add('GET', 'patient-cases', [PatientCaseController::class, 'index']);
    $router->add('POST', 'patient-cases', [PatientCaseController::class, 'store']);
    $router->add('POST', 'import', [AdminDataController::class, 'import']);
    $router->add('GET', 'telemedicine-intakes', [TelemedicineAdminController::class, 'index']);
    $router->add('PATCH', 'telemedicine-intakes', [TelemedicineAdminController::class, 'patch']);
    $router->add('GET', 'telemedicine-ops-diagnostics', [TelemedicinePolicyController::class, 'diagnostics']);
    $router->add('GET', 'telemedicine-rollout-readiness', [TelemedicinePolicyController::class, 'readiness']);
    $router->add('POST', 'telemedicine-policy-simulate', [TelemedicinePolicyController::class, 'simulate']);
    $router->add('GET', 'clinical-history-session', [ClinicalHistoryController::class, 'sessionGet']);
    $router->add('POST', 'clinical-history-session', [ClinicalHistoryController::class, 'sessionPost']);
    $router->add('POST', 'clinical-history-message', [ClinicalHistoryController::class, 'messagePost']);
    $router->add('GET', 'clinical-history-review', [ClinicalHistoryController::class, 'reviewGet']);
    $router->add('PATCH', 'clinical-history-review', [ClinicalHistoryController::class, 'reviewPatch']);
    $router->add('GET', 'clinical-record', [ClinicalHistoryController::class, 'recordGet']);
    $router->add('PATCH', 'clinical-record', [ClinicalHistoryController::class, 'recordPatch']);
    $router->add('POST', 'clinical-episode-action', [ClinicalHistoryController::class, 'episodeActionPost']);
    $router->add('GET', 'care-plan-pdf', [ClinicalHistoryController::class, 'getCarePlanPdf']);
    $router->add('POST', 'clinical-media-upload', [ClinicalHistoryController::class, 'uploadMedia']);
    $router->add('GET', 'media-flow-queue', [CaseMediaFlowController::class, 'queue']);
    $router->add('GET', 'media-flow-case', [CaseMediaFlowController::class, 'caseGet']);
    $router->add('POST', 'media-flow-proposal-generate', [CaseMediaFlowController::class, 'proposalGenerate']);
    $router->add('POST', 'media-flow-proposal-review', [CaseMediaFlowController::class, 'proposalReview']);
    $router->add('POST', 'media-flow-publication-state', [CaseMediaFlowController::class, 'publicationState']);
    $router->add('GET', 'media-flow-private-asset', [CaseMediaFlowController::class, 'privateAsset']);
    $router->add('GET', 'public-case-stories', [CaseMediaFlowController::class, 'publicStories']);
    $router->add('GET', 'public-case-media-file', [CaseMediaFlowController::class, 'publicMediaFile']);

    $router->add('GET', 'queue-state', [QueueController::class, 'state']);
    $router->add('GET', 'queue-public-ticket', [QueueController::class, 'publicTicket']);
    $router->add('POST', 'queue-surface-heartbeat', [QueueController::class, 'surfaceHeartbeat']);
    $router->add('POST', 'queue-checkin', [QueueController::class, 'checkin']);
    $router->add('POST', 'queue-ticket', [QueueController::class, 'ticket']);
    $router->add('POST', 'queue-help-request', [QueueController::class, 'helpRequest']);
    $router->add('POST', 'queue-call-next', [QueueController::class, 'callNext']);
    $router->add('PATCH', 'queue-ticket', [QueueController::class, 'patchTicket']);
    $router->add('PATCH', 'queue-help-request', [QueueController::class, 'patchHelpRequest']);
    $router->add('POST', 'queue-reprint', [QueueController::class, 'reprint']);

    $router->add('GET', 'appointments', [AppointmentController::class, 'index']);
    $router->add('POST', 'appointments', [AppointmentController::class, 'store']);
    $router->add('PATCH', 'appointments', [AppointmentController::class, 'update']);
    $router->add('PUT', 'appointments', [AppointmentController::class, 'update']);

    $router->add('GET', 'callbacks', [CallbackController::class, 'index']);
    $router->add('POST', 'callbacks', [CallbackController::class, 'store']);
    $router->add('PATCH', 'callbacks', [CallbackController::class, 'update']);
    $router->add('PUT', 'callbacks', [CallbackController::class, 'update']);
    $router->add('POST', 'lead-ai-request', [LeadAiController::class, 'request']);
    $router->add('GET', 'lead-ai-queue', [LeadAiController::class, 'queue']);
    $router->add('POST', 'lead-ai-result', [LeadAiController::class, 'result']);
    $router->add('POST', 'whatsapp-openclaw-inbound', [WhatsappOpenclawController::class, 'inbound']);
    $router->add('GET', 'whatsapp-openclaw-outbox', [WhatsappOpenclawController::class, 'outbox']);
    $router->add('POST', 'whatsapp-openclaw-ack', [WhatsappOpenclawController::class, 'ack']);
    $router->add('GET', 'whatsapp-openclaw-ops', [WhatsappOpenclawController::class, 'ops']);
    $router->add('POST', 'whatsapp-openclaw-ops', [WhatsappOpenclawController::class, 'ops']);

    // OpenClaw — Copiloto clínico (endpoints para openclaw-chat.js y Custom GPT Actions)
    $router->add('GET',  'openclaw-patient',        [OpenclawController::class, 'patient']);
    $router->add('GET',  'openclaw-cie10-suggest',  [OpenclawController::class, 'cie10Suggest']);
    $router->add('GET',  'openclaw-protocol',       [OpenclawController::class, 'protocol']);
    $router->add('POST', 'openclaw-chat',            [OpenclawController::class, 'chat']);
    $router->add('POST', 'openclaw-save-diagnosis', [OpenclawController::class, 'saveDiagnosis']);
    $router->add('POST', 'openclaw-save-evolution', [OpenclawController::class, 'saveEvolution']);
    $router->add('GET',  'openclaw-prescription',   [OpenclawController::class, 'getPrescriptionPdf']);
    $router->add('POST', 'openclaw-prescription',   [OpenclawController::class, 'savePrescription']);
    $router->add('POST', 'openclaw-certificate',    [OpenclawController::class, 'generateCertificate']);
    $router->add('GET',  'openclaw-certificate',    [OpenclawController::class, 'getCertificatePdf']);
    $router->add('POST', 'openclaw-interactions',  [OpenclawController::class, 'checkInteractions']);
    $router->add('POST', 'openclaw-summarize',     [OpenclawController::class, 'summarizeSession']);
    $router->add('GET',  'openclaw-router-status', [OpenclawController::class, 'routerStatus']);

    // Certificados médicos — standalone (lista, crear, PDF)
    $router->add('GET',  'certificate', [CertificateController::class, 'index']);
    $router->add('POST', 'certificate', [CertificateController::class, 'store']);

    $router->add('GET', 'reviews', [ReviewController::class, 'index']);
    $router->add('POST', 'reviews', [ReviewController::class, 'store']);

    $router->add('GET', 'availability', [AvailabilityController::class, 'index']);
    $router->add('POST', 'availability', [AvailabilityController::class, 'update']);
    $router->add('POST', 'admin-agent-session-start', [AdminAgentController::class, 'start']);
    $router->add('POST', 'admin-agent-turn', [AdminAgentController::class, 'turn']);
    $router->add('GET', 'admin-agent-status', [AdminAgentController::class, 'status']);
    $router->add('GET', 'admin-agent-events', [AdminAgentController::class, 'events']);
    $router->add('POST', 'admin-agent-approve', [AdminAgentController::class, 'approve']);
    $router->add('POST', 'admin-agent-cancel', [AdminAgentController::class, 'cancel']);

    $router->add('GET', 'booked-slots', [AppointmentController::class, 'bookedSlots']);
    $router->add('POST', 'funnel-event', [AnalyticsController::class, 'recordEvent']);
    $router->add('GET', 'funnel-metrics', [AnalyticsController::class, 'getFunnelMetrics']);
    $router->add('GET', 'retention-report', [AnalyticsController::class, 'getRetentionReport']);

    $router->add('POST', 'payment-intent', [PaymentController::class, 'createIntent']);
    $router->add('POST', 'payment-verify', [PaymentController::class, 'verify']);
    $router->add('POST', 'transfer-proof', [PaymentController::class, 'transferProof']);
    $router->add('POST', 'stripe-webhook', [PaymentController::class, 'webhook']);

    $router->add('GET', 'reschedule', [AppointmentController::class, 'checkReschedule']);
    $router->add('PATCH', 'reschedule', [AppointmentController::class, 'processReschedule']);

    $router->add('GET', 'content', [ContentController::class, 'get']);
    $router->add('GET', 'services-catalog', [ServiceCatalogController::class, 'index']);
    $router->add('GET', 'service-priorities', [ServicePriorityController::class, 'index']);

    $router->add('GET', 'push-config', [PushController::class, 'config']);
    $router->add('POST', 'push-subscribe', [PushController::class, 'subscribe']);
    $router->add('POST', 'push-unsubscribe', [PushController::class, 'unsubscribe']);
    $router->add('POST', 'push-test', [PushController::class, 'test']);

    // v2 Routes
    $router->add('GET', 'health', [HealthController::class, 'check'], 'v2');
}
