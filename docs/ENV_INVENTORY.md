# ENV Inventory

Fecha de auditoría: `2026-03-30`

Metodología usada:

- `rg -o -N "(?:app_env|getenv)\\(\\s*['\\\"]([A-Z0-9_]+)['\\\"]" lib controllers`
- comparación contra `putenv('KEY=...')` en [env.example.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/env.example.php)

## Resumen

- El runtime referencia `248` nombres únicos de variables de entorno desde `lib/` y `controllers/`.
- `142` son variables canónicas de producto/runtime. Después de esta tarea, [env.example.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/env.example.php) documenta `142/142`.
- `99` son aliases legacy o compat (`PIELARMONIA_*`, `BOT_*`, `CHATBOT_*`, `CLAWBOT_*`, `VAPID_*`, `OPENROUTER_*`). Se mantienen por migración, pero no deben ser la ruta primaria en despliegues nuevos.
- `4` vienen del sistema operativo para resolver home dirs: `HOME`, `HOMEDRIVE`, `HOMEPATH`, `USERPROFILE`.
- `3` son metadata/runtime y no requieren documentación operativa en `env.example.php`: `APP_ENV`, `APP_VERSION`, `AURORADERM_APP_VERSION`.

## Variables canónicas agregadas al example

- Admin agent relay:
  `AURORADERM_ADMIN_AGENT_RELAY_URL`,
  `AURORADERM_ADMIN_AGENT_API_KEY`,
  `AURORADERM_ADMIN_AGENT_API_KEY_HEADER`,
  `AURORADERM_ADMIN_AGENT_API_KEY_PREFIX`,
  `AURORADERM_ADMIN_AGENT_MODEL`,
  `AURORADERM_ADMIN_AGENT_TIMEOUT_SECONDS`,
  `AURORADERM_ADMIN_AGENT_EDITORIAL_ALLOWLIST`,
  `AURORADERM_ADMIN_AGENT_EXTERNAL_ALLOWLIST`,
  `AURORADERM_ADMIN_AGENT_EXTERNAL_TEMPLATE_ALLOWLIST`,
  `AURORADERM_ADMIN_AGENT_RELAY_MOCK_RESPONSE`.
- Pricing, branding y soporte:
  `AURORADERM_PRIMARY_DOCTOR_NAME`,
  `AURORADERM_PRIMARY_DOCTOR_MSP`,
  `AURORADERM_PAYMENT_CURRENCY`,
  `AURORADERM_VAT_RATE`,
  `AURORADERM_SERVICES_CATALOG_FILE`,
  `AURORADERM_TRANSFER_UPLOAD_DIR`,
  `AURORADERM_TRANSFER_PUBLIC_BASE_URL`,
  `AURORADERM_FIGO_ENDPOINT`.
- Observabilidad y networking:
  `AURORADERM_REDIS_HOST`,
  `AURORADERM_CA_BUNDLE`,
  `MICROSOFT_CLARITY_PROJECT_ID`,
  `PAPERTRAIL_HOST`,
  `PAPERTRAIL_PORT`,
  `OPENAI_API_KEY`.
- Compatibilidad explícita para migración:
  `AURORADERM_DATA_KEY`,
  `AURORADERM_OPERATOR_AUTH_ALLOWED_EMAILS`,
  `AURORADERM_BACKUP_WEBHOOK_URL`,
  `AURORADERM_BACKUP_WEBHOOK_TOKEN`,
  `AURORADERM_BACKUP_WEBHOOK_TOKEN_HEADER`.
- Figo / OpenClaw avanzado:
  `FIGO_ENDPOINT`,
  `FIGO_URL`,
  `FIGO_CHAT_API_URL`,
  `FIGO_CHAT_URL`,
  `FIGO_CHAT_CONFIG_PATH`,
  `FIGO_BACKEND_CONFIG_PATH`,
  `FIGO_BACKEND_ALLOW_LOCAL_FALLBACK`,
  `FIGO_AI_ALLOW_LOCAL_FALLBACK`,
  `FIGO_AI_URL`,
  `FIGO_AI_KEY`,
  `FIGO_AI_API_KEY_HEADER`,
  `FIGO_AI_API_KEY_PREFIX`,
  `FIGO_AI_KEY_HEADER`,
  `FIGO_AI_KEY_PREFIX`,
  `FIGO_AI_TIMEOUT_SECONDS`,
  `FIGO_AI_CONNECT_TIMEOUT_SECONDS`,
  `FIGO_AI_FAILFAST_WINDOW_SECONDS`,
  `FIGO_AI_MAX_TOKENS`,
  `FIGO_OPENCLAW_GATEWAY_ENDPOINT`,
  `FIGO_OPENCLAW_GATEWAY_API_KEY`,
  `FIGO_OPENCLAW_GATEWAY_MODEL`,
  `FIGO_OPENCLAW_GATEWAY_KEY_HEADER`,
  `FIGO_OPENCLAW_GATEWAY_KEY_PREFIX`,
  `OPENCLAW_AUTH_BROKER_SCOPE`,
  `OPENCLAW_ALLOW_CLIENT_MODEL`.

## Legacy que se mantiene pero no se promueve

- [lib/common.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/common.php#L126) resuelve automáticamente pares `AURORADERM_*` ↔ `PIELARMONIA_*`. Eso permite migración sin romper despliegues viejos, pero el nombre canon para configs nuevas debe seguir siendo `AURORADERM_*`.
- Los aliases `BOT_ENDPOINT`, `CHATBOT_ENDPOINT`, `CHATBOT_URL`, `CLAWBOT_ENDPOINT`, `CLAWBOT_URL` siguen vivos por compatibilidad de bridges viejos. No conviene reintroducirlos en nuevos `env.php`.
- `VAPID_*` y `OPENROUTER_*` se usan como compat genérica; el flujo documentado sigue siendo `AURORADERM_VAPID_*` y `OPENCLAW_OPENROUTER_*`.

## Defaults peligrosos y placeholders a vigilar

- Secretos vacíos o ausentes desactivan features críticas o dejan el sistema en modo degradado:
  `AURORADERM_ADMIN_PASSWORD`,
  `AURORADERM_ADMIN_PASSWORD_HASH`,
  `AURORADERM_ADMIN_2FA_SECRET`,
  `AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN`,
  `AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET`,
  `AURORADERM_BACKUP_OFFSITE_TOKEN`,
  `AURORADERM_BACKUP_RECEIVER_TOKEN`,
  `AURORADERM_SMTP_PASS`,
  `OPENAI_API_KEY`,
  `OPENCLAW_GATEWAY_API_KEY`,
  `FIGO_AI_API_KEY`,
  `FIGO_AI_KEY`.
- Flags que deben permanecer cerrados por defecto en producción:
  `AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=false`,
  `AURORADERM_DEBUG_EXCEPTIONS=false`,
  `OPENCLAW_ALLOW_CLIENT_MODEL=false`.
- El example no usa el literal `change-me`, pero sí contiene placeholders deliberadamente no funcionales como `REEMPLAZAR_*`, `sk_live_...`, `token_largo_rotado`, `clave_segura_rotada` y cuentas `smoke.*`. Deben reemplazarse y rotarse antes de cualquier deploy.
- Familias de compatibilidad que no deberían convivir en nuevos despliegues salvo migración puntual:
  `AURORADERM_BACKUP_OFFSITE_*` vs `AURORADERM_BACKUP_WEBHOOK_*`,
  `AURORADERM_OPERATOR_AUTH_ALLOWLIST` vs `AURORADERM_OPERATOR_AUTH_ALLOWED_EMAILS`,
  `AURORADERM_DATA_ENCRYPTION_KEY` vs `AURORADERM_DATA_KEY`,
  `FIGO_AI_API_KEY*` vs `FIGO_AI_KEY*`.

## Referencias útiles

- [lib/common.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/common.php#L126)
- [lib/backup/BackupConfig.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/backup/BackupConfig.php)
- [lib/AdminAgentService.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/AdminAgentService.php)
- [lib/AppConfig.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/AppConfig.php)
- [lib/figo_utils.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/figo_utils.php)
- [controllers/SystemController.php](/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/controllers/SystemController.php)
