# Auditoría de Rutas Huérfanas (S7-14)

Total de rutas en `lib/routes.php`: **140**
Rutas activas confirmadas (JS/HTML): **95**
Rutas huérfanas o legacy sin referencias: **45**

## Rutas Candidadatas a Eliminar

- `clinical-anamnesis`
- `clinical-history-review`
- `clinical-history-session`
- `figo-config`
- `flow-os-journey-preview`
- `flow-os-manifest`
- `lead-ai-queue`
- `lead-ai-result`
- `openclaw-certificate`
- `openclaw-close-telemedicine`
- `openclaw-evolution`
- `openclaw-fast-close`
- `openclaw-next-patient`
- `openclaw-summarize`
- `operator-auth-complete`
- `operator-auth-logout`
- `operator-auth-start`
- `operator-auth-status`
- `operator-pin-rotate`
- `operator-pin-status`
- `patient-portal-document`
- `patient-portal-referrals`
- `patient-record-pdf`
- `patient-self-vitals`
- `payment-config`
- `payment-intent`
- `payment-verify`
- `predictions`
- `public-case-media-file`
- `push-config`
- `push-preferences`
- `push-subscribe`
- `push-test`
- `push-unsubscribe`
- `retention-report`
- `service-priorities`
- `services-catalog`
- `stripe-webhook`
- `telemedicine-intakes`
- `telemedicine-ops-diagnostics`
- `telemedicine-policy-simulate`
- `telemedicine-rollout-readiness`
- `whatsapp-openclaw-ack`
- `whatsapp-openclaw-inbound`
- `whatsapp-openclaw-outbox`

_Nota: Las rutas huérfanas identificadas no fueron encontradas en el frontend de la plataforma, sugiriendo que son legacy o endpoints de uso exclusivamente por tests/agentes externos._
