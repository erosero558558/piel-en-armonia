<?php

declare(strict_types=1);

function register_api_routes(Router $router): void
{
    // v1 Routes
    $router->add('GET', 'monitoring-config', [MonitoringConfigController::class, 'handle']);
    $router->add('GET', 'features', [SystemController::class, 'handle']);
    $router->add('GET', 'public-runtime-config', [SystemController::class, 'handle']);
    $router->add('GET', 'metrics', [SystemController::class, 'handle']);
    $router->add('GET', 'predictions', [SystemController::class, 'handle']);
    $router->add('POST', 'clinic-onboarding', [SystemController::class, 'handle']);
    $router->add('POST', 'operator-auth-start', [OperatorAuthController::class, 'handle']);
    $router->add('GET', 'operator-auth-status', [OperatorAuthController::class, 'handle']);
    $router->add('POST', 'operator-auth-complete', [OperatorAuthController::class, 'handle']);
    $router->add('POST', 'operator-auth-logout', [OperatorAuthController::class, 'handle']);
    $router->add('GET', 'operator-pin-status', [OperatorPinController::class, 'handle']);
    $router->add('GET', 'operator-session-status', [OperatorPinController::class, 'handle']);
    $router->add('POST', 'operator-pin-login', [OperatorPinController::class, 'handle']);
    $router->add('POST', 'operator-pin-logout', [OperatorPinController::class, 'handle']);
    $router->add('POST', 'operator-pin-rotate', [OperatorPinController::class, 'handle']);

    $router->add('GET', 'figo-config', [ConfigController::class, 'handle']);
    $router->add('POST', 'figo-config', [ConfigController::class, 'handle']);
    $router->add('PUT', 'figo-config', [ConfigController::class, 'handle']);
    $router->add('PATCH', 'figo-config', [ConfigController::class, 'handle']);

    $router->add('GET', 'health', [HealthController::class, 'handle']);
    $router->add('GET', 'health-diagnostics', [HealthController::class, 'handle']);
    $router->add('GET', 'system-status', [HealthController::class, 'handle']);
    $router->add('GET', 'security-report', [SecurityReportController::class, 'handle']);

    $router->add('GET', 'payment-config', [PaymentController::class, 'handle']);
    $router->add('GET', 'checkout-config', [PaymentController::class, 'handle']);
    $router->add('POST', 'checkout-transfer-proof', [PaymentController::class, 'handle']);
    $router->add('PATCH', 'checkout-orders', [PaymentController::class, 'handle']);
    $router->add('POST', 'software-subscription-checkout', [PaymentController::class, 'handle']);

    $router->add('GET', 'data', [AdminDataController::class, 'handle']);
    $router->add('GET', 'doctor-profile', [DoctorProfileController::class, 'handle']);
    $router->add('POST', 'doctor-profile', [DoctorProfileController::class, 'handle']);
    $router->add('GET', 'clinic-profile', [ClinicProfileController::class, 'handle']);
    $router->add('POST', 'clinic-profile', [ClinicProfileController::class, 'handle']);
    $router->add('GET', 'config-audit-log', [ConfigAuditLogController::class, 'handle']);
    $router->add('GET', 'flow-os-manifest', [FlowOsController::class, 'handle']);
    $router->add('GET', 'flow-os-journey-preview', [FlowOsController::class, 'handle']);
    $router->add('POST', 'flow-os-intake', [IntakeController::class, 'handle']);
    $router->add('POST', 'patient-portal-auth-start', [PatientPortalController::class, 'handle']);
    $router->add('POST', 'patient-portal-auth-complete', [PatientPortalController::class, 'handle']);
    $router->add('POST', 'patient-portal-submit-survey', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-auth-status', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-summary', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-dashboard', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-history', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-history-pdf', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-record-pdf', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-payments', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-plan', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-photos', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-prescription', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-consent', [PatientPortalController::class, 'handle']);
    $router->add('POST', 'patient-portal-consent', [PatientPortalController::class, 'handle']);
    $router->add('POST', 'patient-self-vitals', [PatientPortalController::class, 'handle']);
    $router->add('POST', 'patient-portal-photo-upload', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'notification-config', [NotificationController::class, 'handle']);
    $router->add('POST', 'notification-subscribe', [NotificationController::class, 'handle']);
    $router->add('POST', 'notification-unsubscribe', [NotificationController::class, 'handle']);
    $router->add('GET', 'patient-portal-photo-file', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'patient-portal-document', [PatientPortalController::class, 'handle']);
    $router->add('GET', 'document-verify', [PatientPortalController::class, 'handle']);
    
    // Security & Hardening S28
    $router->add('GET', 'data-access-audit', [DataAccessAuditController::class, 'handle']);
    $router->add('GET', 'active-sessions', [ActiveSessionsController::class, 'handle']);
    $router->add('DELETE', 'active-sessions', [ActiveSessionsController::class, 'handle']);
    $router->add('DELETE', 'patient-data-erasure', [PatientDataErasureController::class, 'handle']);
    $router->add('GET', 'patient-data-export', [PatientDataExportController::class, 'handle']);
    $router->add('GET', 'stats-export', [StatsExportController::class, 'handle']);
    $router->add('GET', 'consent-status', [ConsentStatusController::class, 'handle']);
    $router->add('POST', 'consent-status', [ConsentStatusController::class, 'handle']);

    // Push Preferences
    $router->add('GET', 'push-preferences', [PatientPortalController::class, 'handle']);
    $router->add('POST', 'push-preferences', [PatientPortalController::class, 'handle']);

    $router->add('GET', 'patient-cases', [PatientCaseController::class, 'handle']);
    $router->add('POST', 'patient-cases', [PatientCaseController::class, 'handle']);
    $router->add('GET', 'patient-search', [DoctorDashboardController::class, 'handle']);
    $router->add('GET', 'doctor-dashboard', [DoctorDashboardController::class, 'handle']);
    $router->add('GET', 'doctor-stats', [DoctorDashboardController::class, 'handle']);
    $router->add('POST', 'import', [AdminDataController::class, 'handle']);
    $router->add('GET', 'telemedicine-intakes', [TelemedicineAdminController::class, 'handle']);
    $router->add('PATCH', 'telemedicine-intakes', [TelemedicineAdminController::class, 'handle']);
    $router->add('GET', 'telemedicine-ops-diagnostics', [TelemedicinePolicyController::class, 'handle']);
    $router->add('GET', 'telemedicine-rollout-readiness', [TelemedicinePolicyController::class, 'handle']);
    $router->add('POST', 'telemedicine-policy-simulate', [TelemedicinePolicyController::class, 'handle']);
    $router->add('GET', 'telemedicine-preconsultation', [TelemedicinePublicController::class, 'handle']);
    $router->add('POST', 'telemedicine-preconsultation', [TelemedicinePublicController::class, 'handle']);
    $router->add('GET', 'telemedicine-room-token', [TelemedicineRoomController::class, 'handle']);
    $router->add('POST', 'telemedicine-recording-consent', [TelemedicineRoomController::class, 'handle']);
    $router->add('POST', 'telemedicine-recording', [TelemedicineRoomController::class, 'handle']);
    $router->add('GET', 'clinical-history-session', [ClinicalHistoryController::class, 'handle']);
    $router->add('POST', 'clinical-history-session', [ClinicalHistoryController::class, 'handle']);
    $router->add('POST', 'clinical-evolution', [ClinicalHistoryController::class, 'handle']);
    $router->add('GET', 'clinical-evolution', [ClinicalHistoryController::class, 'handle']);    // S37-03: historial de evoluciones paginado
    $router->add('POST', 'clinical-anamnesis', [ClinicalHistoryController::class, 'handle']);     // S37-02: anamnesis estructurada
    $router->add('GET', 'hce-audit-log', [ClinicalHistoryController::class, 'handle']);           // S37-11: audit log de acceso a evoluciones
    $router->add('POST', 'admin-lab-result-share', [ClinicalHistoryController::class, 'handle']); // S37-06: visibilidad de labs en portal
    $router->add('POST', 'clinical-history-message', [ClinicalHistoryController::class, 'handle']);
    $router->add('GET', 'clinical-history-review', [ClinicalHistoryController::class, 'handle']);
    $router->add('PATCH', 'clinical-history-review', [ClinicalHistoryController::class, 'handle']);
    $router->add('GET', 'clinical-record', [ClinicalHistoryController::class, 'handle']);
    $router->add('PATCH', 'clinical-record', [ClinicalHistoryController::class, 'handle']);
    $router->add('POST', 'clinical-episode-action', [ClinicalHistoryController::class, 'handle']);
    $router->add('GET', 'care-plan-pdf', [ClinicalHistoryController::class, 'handle']);
    $router->add('POST', 'clinical-media-upload', [ClinicalHistoryController::class, 'handle']);
    $router->add('GET', 'clinical-photos', [ClinicalHistoryController::class, 'handle']);
    $router->add('POST', 'clinical-photo-upload', [ClinicalHistoryController::class, 'handle']);
    $router->add('POST', 'clinical-vitals', [ClinicalHistoryController::class, 'handle']);              // S30-02: signos vitales
    $router->add('GET', 'patient-vitals-history', [ClinicalHistoryController::class, 'handle']);     // S30-03: historial de vitales
    $router->add('POST', 'receive-lab-result', [ClinicalHistoryController::class, 'handle']);     // S30-05: ingesta de resultados lab
    $router->add('POST', 'clinical-lab-pdf-upload', [ClinicalHistoryController::class, 'handle']); // S30-06: upload PDF lab
    $router->add('POST', 'receive-imaging-result', [ClinicalHistoryController::class, 'handle']); // S30-09: resultado de imagen
    $router->add('POST', 'receive-interconsult-report', [ClinicalHistoryController::class, 'handle']); // S30-14: report expuesto
    $router->add('GET', 'media-flow-queue', [CaseMediaFlowController::class, 'handle']);
    $router->add('GET', 'media-flow-case', [CaseMediaFlowController::class, 'handle']);
    $router->add('POST', 'media-flow-proposal-generate', [CaseMediaFlowController::class, 'handle']);
    $router->add('POST', 'media-flow-proposal-review', [CaseMediaFlowController::class, 'handle']);
    $router->add('POST', 'media-flow-publication-state', [CaseMediaFlowController::class, 'handle']);
    $router->add('GET', 'media-flow-private-asset', [CaseMediaFlowController::class, 'handle']);

    $router->add('GET', 'public-case-stories', [CaseMediaFlowController::class, 'handle']);
    $router->add('GET', 'public-case-media-file', [CaseMediaFlowController::class, 'handle']);

    $router->add('GET', 'queue-state', [QueueController::class, 'handle']);
    $router->add('GET', 'queue-public-ticket', [QueueController::class, 'handle']);
    $router->add('POST', 'queue-surface-heartbeat', [QueueController::class, 'handle']);
    $router->add('POST', 'queue-checkin', [QueueController::class, 'handle']);
    $router->add('POST', 'queue-ticket', [QueueController::class, 'handle']);
    $router->add('POST', 'queue-help-request', [QueueController::class, 'handle']);
    $router->add('POST', 'queue-call-next', [QueueController::class, 'handle']);
    $router->add('PATCH', 'queue-ticket', [QueueController::class, 'handle']);
    $router->add('PATCH', 'queue-help-request', [QueueController::class, 'handle']);
    $router->add('POST', 'queue-reprint', [QueueController::class, 'handle']);

    $router->add('GET', 'appointments', [AppointmentController::class, 'handle']);
    $router->add('POST', 'appointments', [AppointmentController::class, 'handle']);
    $router->add('PATCH', 'appointments', [AppointmentController::class, 'handle']);
    $router->add('PUT', 'appointments', [AppointmentController::class, 'handle']);
    $router->add('POST', 'appointment-checkin', [AppointmentController::class, 'handle']);
    
    $router->add('GET', 'business-metrics', [AdminDataController::class, 'handle']);
    $router->add('GET', 'chronic-panel', [AdminDataController::class, 'handle']);
    $router->add('GET', 'patient-ltv', [AdminDataController::class, 'handle']);
    $router->add('POST', 'adverse-reaction-report', [ClinicalHistoryController::class, 'handle']);

    $router->add('GET', 'callbacks', [CallbackController::class, 'handle']);
    $router->add('POST', 'callbacks', [CallbackController::class, 'handle']);
    $router->add('PATCH', 'callbacks', [CallbackController::class, 'handle']);
    $router->add('PUT', 'callbacks', [CallbackController::class, 'handle']);
    $router->add('POST', 'lead-ai-request', [LeadAiController::class, 'handle']);
    $router->add('GET', 'lead-ai-queue', [LeadAiController::class, 'handle']);
    $router->add('POST', 'lead-ai-result', [LeadAiController::class, 'handle']);
    $router->add('POST', 'whatsapp-openclaw-inbound', [WhatsappOpenclawController::class, 'handle']);
    $router->add('GET', 'whatsapp-openclaw-outbox', [WhatsappOpenclawController::class, 'handle']);
    $router->add('POST', 'whatsapp-openclaw-ack', [WhatsappOpenclawController::class, 'handle']);
    $router->add('GET', 'whatsapp-openclaw-ops', [WhatsappOpenclawController::class, 'handle']);
    $router->add('POST', 'whatsapp-openclaw-ops', [WhatsappOpenclawController::class, 'handle']);
    $router->add('GET', 'whatsapp-openclaw-metrics', [WhatsappOpenclawController::class, 'handle']);

    // OpenClaw — Copiloto clínico (endpoints para openclaw-chat.js y Custom GPT Actions)
    $router->add('GET', 'openclaw-patient', [OpenclawController::class, 'handle']);
    $router->add('GET', 'openclaw-cie10-suggest', [OpenclawController::class, 'handle']);
    $router->add('GET', 'openclaw-protocol', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-chat', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-save-diagnosis', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-save-chronic', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-save-evolution', [OpenclawController::class, 'handle']);
    $router->add('GET', 'openclaw-prescription', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-prescription', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-certificate', [OpenclawController::class, 'handle']);
    $router->add('GET', 'openclaw-certificate', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-interactions', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-summarize', [OpenclawController::class, 'handle']);
    $router->add('GET', 'openclaw-router-status', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-close-telemedicine', [OpenclawController::class, 'handle']);
    $router->add('POST', 'openclaw-fast-close', [OpenclawController::class, 'handle']); // S24: cierra consulta en 1 click

    // Gift Cards
    $router->add('POST', 'gift-card-issue', [GiftCardController::class, 'handle']);
    $router->add('POST', 'gift-card-redeem', [GiftCardController::class, 'handle']);
    $router->add('GET', 'gift-card-validate', [GiftCardController::class, 'handle']);
    $router->add('GET', 'gift-cards-expiring', [GiftCardController::class, 'handle']);

    // Certificados médicos — standalone (lista, crear, PDF)
    $router->add('GET', 'certificate', [CertificateController::class, 'handle']);
    $router->add('POST', 'certificate', [CertificateController::class, 'handle']);

    // Membresías
    $router->add('GET', 'membership-status', [MembershipController::class, 'handle']);
    $router->add('POST', 'membership-issue', [MembershipController::class, 'handle']);
    $router->add('GET', 'package-balance', [MembershipController::class, 'handle']);
    $router->add('POST', 'package-activate', [MembershipController::class, 'handle']);
    $router->add('POST', 'package-consume', [MembershipController::class, 'handle']);

    // Referidos
    $router->add('GET', 'referral-link', [ReferralController::class, 'handle']);
    $router->add('GET', 'referral-stats', [ReferralController::class, 'handle']);
    $router->add('POST', 'referral-click', [ReferralController::class, 'handle']);

    // Onboarding + Walkthrough — S18-02, S18-03, S17-16
    $router->add('GET', 'onboarding-progress', [OnboardingController::class, 'handle']);
    $router->add('GET', 'onboarding-status', [OnboardingController::class, 'handle']);
    $router->add('POST', 'onboarding-step', [OnboardingController::class, 'handle']);
    $router->add('GET', 'walkthrough-config', [OnboardingController::class, 'handle']);

    // Branding
    require_once __DIR__ . '/../controllers/BrandingController.php';
    $router->add('GET', 'clinic-branding-meta', [BrandingController::class, 'handle']);
    $router->add('GET', 'clinic-manifest', [BrandingController::class, 'handle']);
    $router->add('GET', 'clinic-branding-css', [BrandingController::class, 'handle']);

    $router->add('GET', 'reviews', [ReviewController::class, 'handle']);
    $router->add('POST', 'reviews', [ReviewController::class, 'handle']);

    $router->add('GET', 'availability', [AvailabilityController::class, 'handle']);
    $router->add('POST', 'availability', [AvailabilityController::class, 'handle']);
    $router->add('POST', 'admin-agent-session-start', [AdminAgentController::class, 'handle']);
    $router->add('POST', 'admin-agent-turn', [AdminAgentController::class, 'handle']);
    $router->add('GET', 'admin-agent-status', [AdminAgentController::class, 'handle']);
    $router->add('GET', 'admin-agent-events', [AdminAgentController::class, 'handle']);
    $router->add('POST', 'admin-agent-approve', [AdminAgentController::class, 'handle']);
    $router->add('POST', 'admin-agent-cancel', [AdminAgentController::class, 'handle']);

    $router->add('GET', 'booked-slots', [AppointmentController::class, 'handle']);
    $router->add('POST', 'funnel-event', [AnalyticsController::class, 'handle']);
    $router->add('GET', 'funnel-metrics', [AnalyticsController::class, 'handle']);
    $router->add('GET', 'booking-funnel-report', [AnalyticsController::class, 'handle']);
    $router->add('GET', 'retention-report', [AnalyticsController::class, 'handle']);

    $router->add('POST', 'payment-intent', [PaymentController::class, 'handle']);
    $router->add('POST', 'payment-verify', [PaymentController::class, 'handle']);
    $router->add('POST', 'checkout-intent', [PaymentController::class, 'handle']);
    $router->add('POST', 'checkout-confirm', [PaymentController::class, 'handle']);
    $router->add('POST', 'checkout-submit', [PaymentController::class, 'handle']);
    $router->add('POST', 'transfer-proof', [PaymentController::class, 'handle']);
    $router->add('POST', 'stripe-webhook', [PaymentController::class, 'handle']);

    $router->add('GET', 'reschedule', [AppointmentController::class, 'handle']);
    $router->add('PATCH', 'reschedule', [AppointmentController::class, 'handle']);

    $router->add('GET', 'content', [ContentController::class, 'handle']);
    $router->add('GET', 'services-catalog', [ServiceCatalogController::class, 'handle']);
    $router->add('GET', 'service-priorities', [ServicePriorityController::class, 'handle']);

    $router->add('GET', 'push-config', [PushController::class, 'handle']);
    $router->add('POST', 'push-subscribe', [PushController::class, 'handle']);
    $router->add('POST', 'push-unsubscribe', [PushController::class, 'handle']);
    $router->add('POST', 'push-test', [PushController::class, 'handle']);

    $router->add('GET', 'active-promotions', [PromotionController::class, 'handle']);

    $router->add('GET', 'push-diagnostics', [PushController::class, 'handle']);

    // Native Android TV Telemetry
    $router->add('POST', 'tv-heartbeat', [TvController::class, 'handle']);
    $router->add('GET', 'tv-config', [TvController::class, 'handle']);

    // v2 Routes
    $router->add('GET', 'health', [HealthController::class, 'handle'], 'v2');
}
