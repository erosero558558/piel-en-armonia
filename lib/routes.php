<?php

declare(strict_types=1);

function register_api_routes(Router $router): void
{
    // v1 Routes
    $router->add('GET', 'monitoring-config', [MonitoringConfigController::class, 'monitoringConfig']);
    $router->add('GET', 'features', [SystemController::class, 'features']);
    $router->add('GET', 'public-runtime-config', [SystemController::class, 'publicRuntimeConfig']);
    $router->add('GET', 'metrics', [SystemController::class, 'metrics']);
    $router->add('GET', 'predictions', [SystemController::class, 'predictions']);
    $router->add('POST', 'clinic-onboarding', [SystemController::class, 'clinicOnboarding']);
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
    $router->add('GET', 'checkout-config', [PaymentController::class, 'checkoutConfig']);
    $router->add('POST', 'checkout-transfer-proof', [PaymentController::class, 'checkoutTransferProof']);
    $router->add('PATCH', 'checkout-orders', [PaymentController::class, 'checkoutOrderReview']);
    $router->add('POST', 'software-subscription-checkout', [PaymentController::class, 'softwareSubscriptionCheckout']);

    $router->add('GET', 'data', [AdminDataController::class, 'index']);
    $router->add('GET', 'doctor-profile', [DoctorProfileController::class, 'show']);
    $router->add('POST', 'doctor-profile', [DoctorProfileController::class, 'update']);
    $router->add('GET', 'clinic-profile', [ClinicProfileController::class, 'show']);
    $router->add('POST', 'clinic-profile', [ClinicProfileController::class, 'update']);
    $router->add('GET', 'flow-os-manifest', [FlowOsController::class, 'manifest']);
    $router->add('GET', 'flow-os-journey-preview', [FlowOsController::class, 'journeyPreview']);
    $router->add('POST', 'flow-os-intake', [IntakeController::class, 'store']);
    $router->add('POST', 'patient-portal-auth-start', [PatientPortalController::class, 'start']);
    $router->add('POST', 'patient-portal-auth-complete', [PatientPortalController::class, 'complete']);
    $router->add('POST', 'patient-portal-submit-survey', [PatientPortalController::class, 'submitSurvey']);
    $router->add('GET', 'patient-portal-auth-status', [PatientPortalController::class, 'status']);
    $router->add('GET', 'patient-portal-dashboard', [PatientPortalController::class, 'dashboard']);
    $router->add('GET', 'patient-portal-history', [PatientPortalController::class, 'history']);
    $router->add('GET', 'patient-portal-history-pdf', [PatientPortalController::class, 'historyPdf']);
    $router->add('GET', 'patient-portal-plan', [PatientPortalController::class, 'plan']);
    $router->add('GET', 'patient-portal-photos', [PatientPortalController::class, 'photos']);
    $router->add('GET', 'patient-portal-prescription', [PatientPortalController::class, 'prescription']);
    $router->add('GET', 'patient-portal-consent', [PatientPortalController::class, 'consent']);
    $router->add('POST', 'patient-portal-consent', [PatientPortalController::class, 'signConsent']);
    $router->add('GET', 'notification-config', [NotificationController::class, 'config']);
    $router->add('POST', 'notification-subscribe', [NotificationController::class, 'subscribe']);
    $router->add('POST', 'notification-unsubscribe', [NotificationController::class, 'unsubscribe']);
    $router->add('GET', 'patient-portal-photo-file', [PatientPortalController::class, 'photoFile']);
    $router->add('GET', 'patient-portal-document', [PatientPortalController::class, 'document']);
    $router->add('GET', 'document-verify', [PatientPortalController::class, 'documentVerify']);
    
    // Push Preferences
    $router->add('GET', 'push-preferences', [PatientPortalController::class, 'getPushPreferences']);
    $router->add('POST', 'push-preferences', [PatientPortalController::class, 'setPushPreferences']);

    $router->add('GET', 'patient-cases', [PatientCaseController::class, 'index']);
    $router->add('POST', 'patient-cases', [PatientCaseController::class, 'store']);
    $router->add('GET', 'patient-search', [PatientCaseController::class, 'search']);
    $router->add('POST', 'import', [AdminDataController::class, 'import']);
    $router->add('GET', 'telemedicine-intakes', [TelemedicineAdminController::class, 'index']);
    $router->add('PATCH', 'telemedicine-intakes', [TelemedicineAdminController::class, 'patch']);
    $router->add('GET', 'telemedicine-ops-diagnostics', [TelemedicinePolicyController::class, 'diagnostics']);
    $router->add('GET', 'telemedicine-rollout-readiness', [TelemedicinePolicyController::class, 'readiness']);
    $router->add('POST', 'telemedicine-policy-simulate', [TelemedicinePolicyController::class, 'simulate']);
    $router->add('GET', 'telemedicine-preconsultation', [TelemedicinePublicController::class, 'preConsultation']);
    $router->add('POST', 'telemedicine-preconsultation', [TelemedicinePublicController::class, 'submitPreConsultation']);
    $router->add('GET', 'telemedicine-room-token', [TelemedicineRoomController::class, 'token']);
    $router->add('POST', 'telemedicine-recording-consent', [TelemedicineRoomController::class, 'recordingConsent']);
    $router->add('POST', 'telemedicine-recording', [TelemedicineRoomController::class, 'uploadRecording']);
    $router->add('GET', 'clinical-history-session', [ClinicalHistoryController::class, 'sessionGet']);
    $router->add('POST', 'clinical-history-session', [ClinicalHistoryController::class, 'sessionPost']);
    $router->add('POST', 'clinical-history-message', [ClinicalHistoryController::class, 'messagePost']);
    $router->add('GET', 'clinical-history-review', [ClinicalHistoryController::class, 'reviewGet']);
    $router->add('PATCH', 'clinical-history-review', [ClinicalHistoryController::class, 'reviewPatch']);
    $router->add('GET', 'clinical-history-gallery', [ClinicalHistoryController::class, 'galleryGet']);
    $router->add('GET', 'clinical-record', [ClinicalHistoryController::class, 'recordGet']);
    $router->add('PATCH', 'clinical-record', [ClinicalHistoryController::class, 'recordPatch']);
    $router->add('POST', 'clinical-episode-action', [ClinicalHistoryController::class, 'episodeActionPost']);
    $router->add('GET', 'care-plan-pdf', [ClinicalHistoryController::class, 'getCarePlanPdf']);
    $router->add('POST', 'clinical-media-upload', [ClinicalHistoryController::class, 'uploadMedia']);
    $router->add('GET', 'clinical-photos', [ClinicalHistoryController::class, 'getClinicalPhotos']);
    $router->add('POST', 'clinical-photo-upload', [ClinicalHistoryController::class, 'uploadClinicalPhoto']);
    $router->add('POST', 'clinical-vitals', [ClinicalHistoryController::class, 'saveVitals']);              // S30-02: signos vitales
    $router->add('GET', 'patient-vitals-history', [ClinicalHistoryController::class, 'vitalsHistory']);     // S30-03: historial de vitales
    $router->add('POST', 'receive-lab-result', [ClinicalHistoryController::class, 'receiveLabResult']);     // S30-05: ingesta de resultados lab
    $router->add('POST', 'clinical-lab-pdf-upload', [ClinicalHistoryController::class, 'uploadClinicalLabPdf']); // S30-06: upload PDF lab
    $router->add('POST', 'receive-imaging-result', [ClinicalHistoryController::class, 'receiveImagingResult']); // S30-09: resultado de imagen
    $router->add('POST', 'receive-interconsult-report', [ClinicalHistoryController::class, 'receiveInterconsultReport']); // S30-14: report expuesto
    $router->add('GET', 'media-flow-queue', [CaseMediaFlowController::class, 'queue']);
    $router->add('GET', 'media-flow-case', [CaseMediaFlowController::class, 'caseGet']);
    $router->add('POST', 'media-flow-proposal-generate', [CaseMediaFlowController::class, 'proposalGenerate']);
    $router->add('POST', 'media-flow-proposal-review', [CaseMediaFlowController::class, 'proposalReview']);
    $router->add('POST', 'media-flow-publication-state', [CaseMediaFlowController::class, 'publicationState']);
    $router->add('GET', 'media-flow-private-asset', [CaseMediaFlowController::class, 'privateAsset']);
    $router->add('GET', 'clinical-photos', [ClinicalPhotosController::class, 'index']);
    $router->add('POST', 'clinical-photo-upload', [ClinicalPhotosController::class, 'upload']);
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
    $router->add('GET', 'whatsapp-openclaw-metrics', [WhatsappOpenclawController::class, 'metrics']);

    // OpenClaw — Copiloto clínico (endpoints para openclaw-chat.js y Custom GPT Actions)
    $router->add('GET', 'openclaw-patient', [OpenclawController::class, 'patient']);
    $router->add('GET', 'openclaw-cie10-suggest', [OpenclawController::class, 'cie10Suggest']);
    $router->add('GET', 'openclaw-protocol', [OpenclawController::class, 'protocol']);
    $router->add('POST', 'openclaw-chat', [OpenclawController::class, 'chat']);
    $router->add('POST', 'openclaw-save-diagnosis', [OpenclawController::class, 'saveDiagnosis']);
    $router->add('POST', 'openclaw-save-evolution', [OpenclawController::class, 'saveEvolution']);
    $router->add('GET', 'openclaw-prescription', [OpenclawController::class, 'getPrescriptionPdf']);
    $router->add('POST', 'openclaw-prescription', [OpenclawController::class, 'savePrescription']);
    $router->add('POST', 'openclaw-certificate', [OpenclawController::class, 'generateCertificate']);
    $router->add('GET', 'openclaw-certificate', [OpenclawController::class, 'getCertificatePdf']);
    $router->add('POST', 'openclaw-interactions', [OpenclawController::class, 'checkInteractions']);
    $router->add('POST', 'openclaw-summarize', [OpenclawController::class, 'summarizeSession']);
    $router->add('GET', 'openclaw-router-status', [OpenclawController::class, 'routerStatus']);
    $router->add('POST', 'openclaw-fast-close', [OpenclawController::class, 'fastClose']); // S24: cierra consulta en 1 click

    // Gift Cards
    $router->add('POST', 'gift-card-issue', [GiftCardController::class, 'issue']);
    $router->add('POST', 'gift-card-redeem', [GiftCardController::class, 'redeem']);
    $router->add('GET', 'gift-card-validate', [GiftCardController::class, 'validate']);
    $router->add('GET', 'gift-cards-expiring', [GiftCardController::class, 'expiring']);

    // Certificados médicos — standalone (lista, crear, PDF)
    $router->add('GET', 'certificate', [CertificateController::class, 'index']);
    $router->add('POST', 'certificate', [CertificateController::class, 'store']);

    // Membresías
    $router->add('GET', 'membership-status', [MembershipController::class, 'status']);
    $router->add('POST', 'membership-issue', [MembershipController::class, 'issue']);
    $router->add('GET', 'package-balance', [MembershipController::class, 'packageBalance']);
    $router->add('POST', 'package-activate', [MembershipController::class, 'activatePackage']);
    $router->add('POST', 'package-consume', [MembershipController::class, 'consumeSession']);

    // Referidos
    $router->add('GET', 'referral-link', [ReferralController::class, 'getLink']);
    $router->add('GET', 'referral-stats', [ReferralController::class, 'getStats']);
    $router->add('POST', 'referral-click', [ReferralController::class, 'trackClick']);

    // Membresías — S17-06, S17-07, S17-08
    $router->add('GET', 'membership-status', [MembershipController::class, 'status']);
    $router->add('POST', 'membership-issue', [MembershipController::class, 'issue']);
    $router->add('GET', 'package-balance', [MembershipController::class, 'packageBalance']);
    $router->add('POST', 'package-activate', [MembershipController::class, 'activatePackage']);
    $router->add('POST', 'package-consume', [MembershipController::class, 'consumeSession']);

    // Onboarding + Walkthrough — S18-02, S18-03, S17-16
    $router->add('GET', 'onboarding-progress', [OnboardingController::class, 'progress']);
    $router->add('GET', 'onboarding-status', [OnboardingController::class, 'progress']);
    $router->add('POST', 'onboarding-step', [OnboardingController::class, 'updateStep']);
    $router->add('GET', 'walkthrough-config', [OnboardingController::class, 'walkthroughConfig']);

    // Branding
    require_once __DIR__ . '/../controllers/BrandingController.php';
    $router->add('GET', 'clinic-branding-meta', [BrandingController::class, 'meta']);
    $router->add('GET', 'clinic-manifest', [BrandingController::class, 'manifest']);
    $router->add('GET', 'clinic-branding-css', [BrandingController::class, 'css']);

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
    $router->add('GET', 'booking-funnel-report', [AnalyticsController::class, 'getBookingFunnelReport']);
    $router->add('GET', 'retention-report', [AnalyticsController::class, 'getRetentionReport']);

    $router->add('POST', 'payment-intent', [PaymentController::class, 'createIntent']);
    $router->add('POST', 'payment-verify', [PaymentController::class, 'verify']);
    $router->add('POST', 'checkout-intent', [PaymentController::class, 'checkoutIntent']);
    $router->add('POST', 'checkout-confirm', [PaymentController::class, 'checkoutConfirm']);
    $router->add('POST', 'checkout-submit', [PaymentController::class, 'checkoutSubmit']);
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

    $router->add('GET', 'active-promotions', [PromotionController::class, 'getActivePromotions']);

    $router->add('GET', 'push-diagnostics', [PushController::class, 'diagnostics']);

    // Native Android TV Telemetry
    $router->add('POST', 'tv-heartbeat', [TvController::class, 'heartbeat']);
    $router->add('GET', 'tv-config', [TvController::class, 'config']);

    // v2 Routes
    $router->add('GET', 'health', [HealthController::class, 'check'], 'v2');
}
