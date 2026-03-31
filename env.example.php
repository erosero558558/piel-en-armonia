<?php

/**
 * Ejemplo de configuración de Aurora Derm.
 * Copia este archivo como env.php y completa los valores.
 * env.php está en .gitignore y NO se sube al repositorio.
 */

// ── SMTP (Gmail) ──────────────────────────────────────
// putenv('AURORADERM_SMTP_HOST=smtp.gmail.com');
// putenv('AURORADERM_SMTP_PORT=587');
// putenv('AURORADERM_SMTP_USER=tu_email@gmail.com');
// putenv('AURORADERM_SMTP_PASS=contraseña_de_aplicación');
// putenv('AURORADERM_EMAIL_FROM=tu_email@gmail.com');
// putenv('AURORADERM_ADMIN_EMAIL=tu_email@gmail.com');

// Push Web Notifications (Admin)
// Genera llaves VAPID y configura estas variables en produccion.
// putenv('AURORADERM_VAPID_PUBLIC_KEY=BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
// putenv('AURORADERM_VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
// putenv('AURORADERM_VAPID_SUBJECT=mailto:javier.rosero94@gmail.com');

// ── Admin ─────────────────────────────────────────────
// putenv('AURORADERM_ADMIN_PASSWORD=tu_clave_admin');
// Legacy/test only:
// putenv('AURORADERM_ADMIN_PASSWORD_HASH=$2y$...');

// ── Cifrado de datos en reposo ────────────────────────
// Recomendado/obligatorio en produccion cuando el backend usa JSON fallback.
// putenv('AURORADERM_DATA_ENCRYPTION_KEY=clave_larga_rotada_o_base64:...');
// Fuerza el cumplimiento en health/readiness aunque el entorno no exponga APP_ENV.
// putenv('AURORADERM_REQUIRE_DATA_ENCRYPTION=true');

// ── Stripe ────────────────────────────────────────────
// putenv('AURORADERM_STRIPE_SECRET_KEY=sk_live_...');
// putenv('AURORADERM_STRIPE_PUBLISHABLE_KEY=pk_live_...');
// putenv('AURORADERM_STRIPE_WEBHOOK_SECRET=whsec_...');

// ── Orígenes permitidos (CORS) ────────────────────────
// putenv('AURORADERM_ALLOWED_ORIGIN=https://pielarmonia.com');
// Si Nginx/Cloudflare ya define CSP, puedes desactivar el CSP emitido por PHP
// para evitar cabeceras duplicadas.
// putenv('AURORADERM_DISABLE_APP_CSP=true');

// ── CAPTCHA (Turnstile) ──────────────────────────────
// putenv('AURORADERM_TURNSTILE_SITE_KEY=0x4AAAAAAABcDeFgHiJkLmNo');
// putenv('AURORADERM_TURNSTILE_SECRET_KEY=0x4AAAAAAABcDeFgHiJkLmNoPqRsTuVwXyZ');

// ── Chatbot (Figo) ───────────────────────────────────
// IMPORTANTE: no apuntar al propio /figo-chat.php (genera recursión).
// Usa el endpoint HTTP real del backend de Clawbot/Figo.
// putenv('FIGO_CHAT_ENDPOINT=https://TU_BACKEND_FIGO/chat');
// putenv('FIGO_CHAT_TOKEN=TOKEN_ROTADO_DESDE_BOTFATHER');
// Opcional: forzar fallback local cuando el backend falle. Por defecto es auto (live si upstream esta sano).
// putenv('FIGO_CHAT_DEGRADED_MODE=true');
// Ventana fail-fast (segundos) para cortar rapido cuando upstream viene fallando.
// Reduce latencia en cascada durante caidas temporales.
// putenv('FIGO_UPSTREAM_FAILFAST_SECONDS=15');
// Timeout de conexion cURL al backend de chat (default auto entre 2 y 6s).
// putenv('FIGO_CHAT_CONNECT_TIMEOUT_SECONDS=4');
// Si usas backend local (figo-backend.php) con puente Telegram:
// putenv('FIGO_CHAT_ENDPOINT=https://pielarmonia.com/figo-backend.php');
// putenv('FIGO_TELEGRAM_BOT_TOKEN=TOKEN_BOTFATHER_ROTADO');
// putenv('FIGO_TELEGRAM_CHAT_ID=TU_CHAT_ID_TELEGRAM');
// putenv('FIGO_TELEGRAM_WEBHOOK_SECRET=TOKEN_SECRETO_WEBHOOK');
// Token interno opcional entre figo-chat.php y figo-backend.php (recomendado en produccion).
// putenv('FIGO_INTERNAL_TOKEN=token_interno_largo_rotado');
// Header opcional del token interno (default X-Figo-Internal-Token).
// putenv('FIGO_INTERNAL_TOKEN_HEADER=X-Figo-Internal-Token');

// ── IA para Figo (respuestas naturales) ──────────────
// Endpoint OpenAI-compatible (OpenRouter, Kimi, DeepSeek, OpenAI, Ollama, etc.)
// putenv('FIGO_AI_ENDPOINT=https://openrouter.ai/api/v1/chat/completions');
// putenv('FIGO_AI_API_KEY=sk-or-v1-REEMPLAZAR');
// putenv('FIGO_AI_MODEL=arcee-ai/trinity-large-preview:free');
// Alias equivalente para endpoint IA (compatibilidad):
// putenv('FIGO_AI_API_URL=https://api.moonshot.ai/v1/chat/completions');
// Ejemplo Kimi:
// putenv('FIGO_AI_API_KEY=sk-REEMPLAZAR');
// putenv('FIGO_AI_MODEL=kimi-k2.5');

// -- OpenClaw Queue (modo recomendado sin Trinity) ----------------------------
// Activa el modo cola OpenClaw en figo-chat.php
// putenv('FIGO_PROVIDER_MODE=openclaw_queue');
// Endpoint OpenResponses HTTP API de tu gateway OpenClaw local
// putenv('OPENCLAW_GATEWAY_ENDPOINT=http://127.0.0.1:4141/v1/responses');
// API key del gateway
// putenv('OPENCLAW_GATEWAY_API_KEY=REEMPLAZAR_TOKEN_OPENCLAW');
// Agente/modelo por defecto (OpenClaw recomienda openclaw:<agentId>)
// putenv('OPENCLAW_GATEWAY_MODEL=openclaw:main');
// Header/prefijo para auth (por defecto Authorization + Bearer)
// putenv('OPENCLAW_GATEWAY_KEY_HEADER=Authorization');
// putenv('OPENCLAW_GATEWAY_KEY_PREFIX=Bearer');
// TTL y retencion de jobs en cola
// putenv('OPENCLAW_QUEUE_TTL_SEC=1800');
// putenv('OPENCLAW_QUEUE_RETENTION_SEC=86400');
// Espera sincrona inicial del bridge antes de devolver queued
// putenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS=1400');
// Parametros del worker
// putenv('OPENCLAW_WORKER_MAX_JOBS=20');
// putenv('OPENCLAW_WORKER_RETRY_MAX=2');
// putenv('OPENCLAW_GATEWAY_TIMEOUT_SECONDS=12');
// Polling sugerido para frontend
// putenv('OPENCLAW_POLL_AFTER_MS=800');
// Tiempo maximo (segundos) que cada poll puede usar para procesar el job
// putenv('OPENCLAW_POLL_PROCESS_TIMEOUT_SEC=8');
// Worker pull-based para LeadOps interno (server nunca empuja al laptop)
// URL base del servidor de Pielarmonia que expone lead-ai-queue / lead-ai-result
// putenv('AURORADERM_LEADOPS_SERVER_BASE_URL=https://pielarmonia.com');
// putenv('AURORADERM_LEADOPS_MACHINE_TOKEN=REEMPLAZAR_TOKEN_MAQUINA');
// putenv('AURORADERM_LEADOPS_MACHINE_TOKEN_HEADER=Authorization');
// putenv('AURORADERM_LEADOPS_MACHINE_TOKEN_PREFIX=Bearer');
// Intervalo de polling del worker local en milisegundos
// putenv('AURORADERM_LEADOPS_WORKER_INTERVAL_MS=5000');
// Segundos antes de declarar worker degradado/offline en health y admin
// putenv('AURORADERM_LEADOPS_WORKER_STALE_AFTER_SECONDS=900');
// Trigger local al encolar (opcional)
// putenv('OPENCLAW_TRIGGER_MAX_JOBS=1');
// putenv('OPENCLAW_TRIGGER_TIME_BUDGET_MS=900');
// En produccion, recomendado desactivar fallback local silencioso
// putenv('FIGO_ALLOW_LOCAL_FALLBACK=false');

// -- OpenClaw AI Router (multi-proveedor, anti vendor lock-in) ---------------
// Estrategia: Tier 1 (Codex OAuth) → Tier 2 (OpenRouter libre) → Tier 3 (local)
// El médico nunca se queda sin respuesta aunque ChatGPT suba el precio o limite.
//
// Modo del router:
//   auto           = intenta Tier 1 → Tier 2 → Tier 3 (recomendado)
//   codex_only     = solo Codex/ChatGPT OAuth
//   openrouter_only = solo OpenRouter (cuando el Codex se agotó para la sesión)
//   local_only     = solo heurístico local (para debug/emergencia)
// putenv('OPENCLAW_ROUTER_MODE=auto');
//
// Tier 1 — Codex/ChatGPT OAuth (costo $0 para la clínica, el médico paga su Plus)
// Se recarga cada 5h. Cuando se agota → el router baja automáticamente a Tier 2.
// putenv('OPENCLAW_CODEX_ENDPOINT=http://127.0.0.1:4141/v1/responses');
// putenv('OPENCLAW_CODEX_API_KEY=REEMPLAZAR_TOKEN_OAUTH');
//
// Tier 2 — OpenRouter (fallback económico: modelos chinos/libres)
// Modelos free disponibles: DeepSeek-V3, Qwen-235B, Llama-70B, Mistral-7B
// Registrarse en https://openrouter.ai (gratis para modelos :free)
// putenv('OPENCLAW_OPENROUTER_KEY=sk-or-v1-REEMPLAZAR');
// putenv('OPENCLAW_OPENROUTER_MODEL=deepseek/deepseek-chat-v3-0324:free');
// Modelos alternativos en cadena si el preferido falla:
// putenv('OPENCLAW_OPENROUTER_FALLBACK_MODELS=qwen/qwen3-235b-a22b:free,meta-llama/llama-3.3-70b-instruct:free');
//
// Tier 3 — local_heuristic (siempre activo, $0, calidad reducida)
// No requiere configuración. Se activa automáticamente cuando Tier 1 y Tier 2 fallan.
// El médico ve aviso: "⚠️ IA en modo offline temporal"



// -- WhatsApp OpenClaw backend -----------------------------------------------
// Habilita la orquestacion backend para inbound/outbox/ack del bridge WhatsApp.
// putenv('AURORADERM_WHATSAPP_OPENCLAW_ENABLED=true');
// Modos: dry_run | live_allowlist | live
// putenv('AURORADERM_WHATSAPP_OPENCLAW_MODE=dry_run');
// Lista blanca opcional para mutaciones reales cuando el modo es live_allowlist.
// putenv('AURORADERM_WHATSAPP_OPENCLAW_ALLOWLIST=593999000111,593999000222');
// Token compartido entre el bridge local y el servidor.
// putenv('AURORADERM_WHATSAPP_BRIDGE_TOKEN=token_whatsapp_bridge_largo_rotado');
// Header/prefijo usados por el bridge hacia inbound/outbox/ack.
// putenv('AURORADERM_WHATSAPP_BRIDGE_TOKEN_HEADER=Authorization');
// putenv('AURORADERM_WHATSAPP_BRIDGE_TOKEN_PREFIX=Bearer');
// Segundos antes de marcar el bridge como offline en health.
// putenv('AURORADERM_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS=600');
// TTL de holds por metodo de pago.
// putenv('AURORADERM_WHATSAPP_SLOT_HOLD_TTL_CARD_SEC=600');
// putenv('AURORADERM_WHATSAPP_SLOT_HOLD_TTL_TRANSFER_SEC=300');
// Overrides opcionales de gateway/modelo para el planner conversacional.
// putenv('AURORADERM_WHATSAPP_OPENCLAW_GATEWAY_ENDPOINT=http://127.0.0.1:4141/v1/responses');
// putenv('AURORADERM_WHATSAPP_OPENCLAW_GATEWAY_API_KEY=REEMPLAZAR_TOKEN_OPENCLAW');
// putenv('AURORADERM_WHATSAPP_OPENCLAW_MODEL=openclaw:main');
// putenv('AURORADERM_WHATSAPP_OPENCLAW_GATEWAY_KEY_HEADER=Authorization');
// putenv('AURORADERM_WHATSAPP_OPENCLAW_GATEWAY_KEY_PREFIX=Bearer');
// URLs usadas al sugerir checkout/pago desde el flujo WhatsApp.
// putenv('AURORADERM_WHATSAPP_PAYMENT_SUCCESS_URL=https://pielarmonia.com/gracias');
// putenv('AURORADERM_WHATSAPP_PAYMENT_CANCEL_URL=https://pielarmonia.com/reservar');

// -- Operator auth (OpenClaw + ChatGPT/OpenAI OAuth) --------------------------
// Habilita el flujo canonico de autenticacion del operador.
// putenv('AURORADERM_OPERATOR_AUTH_MODE=openclaw_chatgpt');
// Modo principal del nucleo interno. Default recomendado: OpenClaw.
// Usa `legacy_password` solo si necesitas exponer el login clasico en la pantalla principal.
// putenv('AURORADERM_INTERNAL_CONSOLE_AUTH_PRIMARY=openclaw_chatgpt');
// Fallback web de contingencia: deja OpenClaw como primario y permite clave + 2FA
// solo cuando este flag se habilita explicitamente en el entorno.
// putenv('AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=false');
// Transporte del flujo OpenClaw:
// - web_broker: redirect web nativo desde cualquier computadora (recomendado para produccion)
// - local_helper: challenge local + helper en 127.0.0.1 (solo soporte local/manual)
// putenv('AURORADERM_OPERATOR_AUTH_TRANSPORT=web_broker');
// Perfil recomendado para una sola cuenta operativa autorizada:
// putenv('AURORADERM_ADMIN_EMAIL=tu_correo_windows@outlook.com');
// putenv('AURORADERM_OPERATOR_AUTH_ALLOWLIST=tu_correo_windows@outlook.com');
// Mantener en false para exigir allowlist explicita aun cuando el broker autentique correctamente.
// putenv('AURORADERM_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL=false');
// Solo activa `true` si quieres abrir el admin a cualquier identidad verificada por el broker remoto.
// putenv('AURORADERM_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL=true');
// Endpoints del broker OAuth/OpenID Connect remoto usados por web_broker.
// putenv('OPENCLAW_AUTH_BROKER_AUTHORIZE_URL=https://openclaw.example.com/oauth/authorize');
// putenv('OPENCLAW_AUTH_BROKER_TOKEN_URL=https://openclaw.example.com/oauth/token');
// putenv('OPENCLAW_AUTH_BROKER_USERINFO_URL=https://openclaw.example.com/oauth/userinfo');
// putenv('OPENCLAW_AUTH_BROKER_CLIENT_ID=cliente_openclaw_web');
// putenv('OPENCLAW_AUTH_BROKER_CLIENT_SECRET=secreto_opcional');
// putenv('OPENCLAW_AUTH_BROKER_JWKS_URL=https://openclaw.example.com/.well-known/jwks.json');
// putenv('OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER=https://openclaw.example.com');
// putenv('OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE=cliente_openclaw_web');
// putenv('OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED=true');
// putenv('OPENCLAW_AUTH_BROKER_CLOCK_SKEW_SECONDS=120');
// Cuenta sandbox para smoke live post-deploy del broker web.
// putenv('OPENCLAW_AUTH_BROKER_SMOKE_ENABLED=true');
// putenv('OPENCLAW_AUTH_BROKER_SMOKE_USERNAME=smoke.operator@pielarmonia.com');
// putenv('OPENCLAW_AUTH_BROKER_SMOKE_PASSWORD=clave_segura_rotada');
// putenv('OPENCLAW_AUTH_BROKER_SMOKE_TOTP_SECRET=BASE32_OPCIONAL');
// putenv('OPENCLAW_AUTH_BROKER_SMOKE_EXPECTED_EMAIL=smoke.operator@pielarmonia.com');
// Token compartido entre el bridge local y el servidor.
// putenv('AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN=token_bridge_largo_rotado');
// Secreto HMAC opcional; si no se define se reutiliza el token del bridge.
// putenv('AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET=secret_hmac_rotado');
// Header/prefijo usados por el bridge local hacia /api.php?resource=operator-auth-complete
// putenv('AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER=Authorization');
// putenv('AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX=Bearer');
// URL publica del servidor usada para construir helper links y validar el bridge local.
// putenv('AURORADERM_OPERATOR_AUTH_SERVER_BASE_URL=https://pielarmonia.com');
// URL base del helper local que corre en el laptop del operador.
// putenv('AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL=http://127.0.0.1:4173');
// URL base del gateway local OpenClaw que expone /v1/session y /v1/session/login.
// putenv('OPENCLAW_RUNTIME_BASE_URL=http://127.0.0.1:4141');
// API key opcional para el gateway local si no admite localhost anonimo.
// putenv('OPENCLAW_GATEWAY_API_KEY=token_gateway_local');
// putenv('OPENCLAW_GATEWAY_KEY_HEADER=Authorization');
// putenv('OPENCLAW_GATEWAY_KEY_PREFIX=Bearer');
// Device label opcional reportado al bridge firmado.
// putenv('OPENCLAW_HELPER_DEVICE_ID=operator-laptop-c1');
// Alias temporal soportado por compatibilidad; preferir OPENCLAW_HELPER_DEVICE_ID.
// putenv('AURORADERM_OPERATOR_AUTH_DEVICE_ID=operator-laptop-c1');
// TTL del challenge, sesion interna y tolerancia del timestamp firmado.
// putenv('AURORADERM_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS=300');
// putenv('AURORADERM_OPERATOR_AUTH_SESSION_TTL_SECONDS=1800');
// putenv('AURORADERM_OPERATOR_AUTH_BRIDGE_MAX_SKEW_SECONDS=300');
// Segundo factor requerido para el fallback web de contingencia.
// putenv('AURORADERM_ADMIN_2FA_SECRET=BASE32_TOTP_SECRET');

// ── Cron (recordatorios automáticos) ────────────────
// putenv('AURORADERM_CRON_SECRET=un_token_secreto_largo');
// Token opcional para acceder a health/metrics detallados desde tooling externo.
// Si no se define, los scripts de ops reutilizan AURORADERM_CRON_SECRET.
// putenv('AURORADERM_DIAGNOSTICS_ACCESS_TOKEN=token_diagnostico_largo');
// putenv('AURORADERM_DIAGNOSTICS_ACCESS_TOKEN_HEADER=Authorization');
// putenv('AURORADERM_DIAGNOSTICS_ACCESS_TOKEN_PREFIX=Bearer');
// Token dedicado y de solo lectura para verify-backup.php.
// No reutilizar AURORADERM_CRON_SECRET ni AURORADERM_DIAGNOSTICS_ACCESS_TOKEN.
// putenv('AURORADERM_BACKUP_VERIFY_TOKEN=token_verificacion_backup_largo');
// ── Rate limit (IP + usuario) ────────────────────────
// Proxies de confianza (para usar X-Forwarded-For).
// Por seguridad, X-Forwarded-For se ignora si la peticion no viene de una IP confiable.
// Default: 127.0.0.1,::1 (localhost).
// Si usas Cloudflare o Load Balancer, agrega sus IPs (CIDR soportado).
// putenv('AURORADERM_TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16');

// Habilita limite adicional por usuario/token (default true).
// putenv('AURORADERM_RATE_LIMIT_PER_USER_ENABLED=true');
// Max requests por usuario/token en la ventana (default = maxRequests del endpoint).
// putenv('AURORADERM_RATE_LIMIT_USER_MAX_REQUESTS=10');
// Ventana por usuario/token en segundos (default = windowSeconds del endpoint).
// putenv('AURORADERM_RATE_LIMIT_USER_WINDOW_SECONDS=60');

// ── Backups (salud + replicacion offsite) ───────────
// Edad maxima (horas) del ultimo backup para health check (1-168, default 24)
// putenv('AURORADERM_BACKUP_MAX_AGE_HOURS=24');
// Auto-refresh de backup en health cuando el ultimo esta stale (default true)
// putenv('AURORADERM_BACKUP_AUTO_REFRESH=true');
// Cooldown de auto-refresh en segundos (300-604800, default 600 = 10min)
// putenv('AURORADERM_BACKUP_AUTO_REFRESH_INTERVAL_SECONDS=600');
// Webhook/endpoint para subir snapshots offsite (multipart form-data)
// putenv('AURORADERM_BACKUP_OFFSITE_URL=https://tu-backup-endpoint.example/upload');
// Token opcional para autenticar el webhook de backup
// putenv('AURORADERM_BACKUP_OFFSITE_TOKEN=token_largo_rotado');
// Header opcional del token (default Authorization)
// putenv('AURORADERM_BACKUP_OFFSITE_TOKEN_HEADER=Authorization');
// Timeout de subida offsite en segundos (5-120, default 20)
// putenv('AURORADERM_BACKUP_OFFSITE_TIMEOUT_SECONDS=20');
// Replica local de snapshots (default true). Guardado en data/backups/offsite-local/
// putenv('AURORADERM_BACKUP_LOCAL_REPLICA=true');
// Receiver remoto (cuando este servidor actua como destino offsite)
// putenv('AURORADERM_BACKUP_RECEIVER_TOKEN=token_largo_rotado');
// Limite de subida en MB para backup-receiver.php (default 50)
// putenv('AURORADERM_BACKUP_RECEIVER_MAX_MB=50');
// Requerir checksum SHA-256 por header X-Backup-SHA256 (default true)
// putenv('AURORADERM_BACKUP_RECEIVER_REQUIRE_CHECKSUM=true');
// Retencion de backups recibidos en dias (default 30)
// putenv('AURORADERM_BACKUP_RECEIVER_RETENTION_DAYS=30');
// Maximo de archivos escaneados por corrida de limpieza (default 500)
// putenv('AURORADERM_BACKUP_RECEIVER_CLEANUP_MAX_FILES=500');
// Clave de cifrado para backup-receiver.php (si no se define, usa AURORADERM_DATA_ENCRYPTION_KEY)
// putenv('AURORADERM_BACKUP_RECEIVER_ENCRYPTION_KEY=clave_larga_rotada_o_base64:...');

// ── Base de Datos (opcional) ────────────────────────
// putenv('AURORADERM_DB_HOST=127.0.0.1');
// putenv('AURORADERM_DB_NAME=pielarmonia');
// putenv('AURORADERM_DB_USER=root');
// putenv('AURORADERM_DB_PASS=secret');
// Fallback automatico a almacenamiento JSON cuando SQLite no esta disponible (default true)
// putenv('AURORADERM_STORAGE_JSON_FALLBACK=true');
// Fallback de contenido publico cuando store esta vacio (default true)
// putenv('AURORADERM_DEFAULT_REVIEWS_ENABLED=true');
// Agenda fallback cuando no hay horarios configurados (default false para usar agenda real)
// putenv('AURORADERM_DEFAULT_AVAILABILITY_ENABLED=false');

// -- Agenda Real (Google Calendar) --------------------------------------------
// Fuente de agenda: "store" (local) o "google" (agenda real).
// putenv('AURORADERM_AVAILABILITY_SOURCE=google');
// Endurecimiento opcional: exigir Google Calendar activo. Si esta en true y la
// fuente no es google, se bloquean availability/booked-slots/reserva/reprogramacion.
// putenv('AURORADERM_REQUIRE_GOOGLE_CALENDAR=false');
// Si Google falla: bloquear reservas/slots (true recomendado para evitar sobreventa).
// putenv('AURORADERM_CALENDAR_BLOCK_ON_FAILURE=true');
// Modo de autenticacion Google Calendar:
// - auto (prioriza service account si existe, sino OAuth refresh token)
// - oauth_refresh_token (recomendado cuando no se permiten llaves SA)
// - service_account
// - none
// putenv('AURORADERM_CALENDAR_AUTH_MODE=oauth_refresh_token');
// Zona horaria de agenda.
// putenv('AURORADERM_CALENDAR_TIMEZONE=America/Guayaquil');
// Paso base de slot en minutos.
// putenv('AURORADERM_CALENDAR_SLOT_STEP_MIN=30');
// Duracion por servicio (min): clinica 30 / procedimientos 60.
// putenv('AURORADERM_SERVICE_DURATION_MAP=consulta:30,telefono:30,video:30,acne:30,cancer:30,laser:60,rejuvenecimiento:60');
// Service Account Google (server-to-server).
// putenv('AURORADERM_GOOGLE_SA_CLIENT_EMAIL=service-account@proyecto.iam.gserviceaccount.com');
// Clave privada en Base64 (contenido completo del private_key del JSON de Google).
// putenv('AURORADERM_GOOGLE_SA_PRIVATE_KEY_B64=BASE64_PRIVATE_KEY');
// Alternativa sin claves JSON (OAuth refresh token), util para organizaciones con
// politica iam.disableServiceAccountKeyCreation habilitada.
// putenv('AURORADERM_GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com');
// putenv('AURORADERM_GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx');
// putenv('AURORADERM_GOOGLE_OAUTH_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
// IDs de calendario por doctor.
// putenv('AURORADERM_GOOGLE_CALENDAR_ID_ROSERO=cal_id_rosero@group.calendar.google.com');
// putenv('AURORADERM_GOOGLE_CALENDAR_ID_NARVAEZ=cal_id_narvaez@group.calendar.google.com');
// TTL cache de disponibilidad (segundos).
// putenv('AURORADERM_CALENDAR_CACHE_TTL_SEC=60');

// ── Public Web V4 (superficie canónica) ───────────────
// Controla el gateway de "/" hacia /es o /en.
// true = V4 habilitado como superficie pública por defecto.
// putenv('AURORADERM_PUBLIC_V4_ENABLED=true');
// Ratio de tráfico a V4 entre 0 y 1 (usado cuando enabled=true).
// putenv('AURORADERM_PUBLIC_V4_RATIO=1');
// Fuerza locale de salida en root gateway: es | en (vacío = auto por Accept-Language).
// putenv('AURORADERM_PUBLIC_V4_FORCE_LOCALE=es');
// Kill-switch inmediato: true devuelve tráfico a /legacy.php.
// putenv('AURORADERM_PUBLIC_V4_KILL_SWITCH=false');

// ── Feature Flags ───────────────────────────────────
// putenv('FEATURE_NEW_BOOKING_UI=true');
// putenv('FEATURE_STRIPE_ELEMENTS=true');
// putenv('FEATURE_DARK_MODE=true');
// putenv('FEATURE_CHATGPT_INTEGRATION=true');

// ── Debug seguro (solo desarrollo) ───────────────────
// PRODUCCION: mantener en false. En true expone mensajes de excepcion al frontend.
putenv('AURORADERM_DEBUG_EXCEPTIONS=false');

// ── Monitoring / Sentry ───────────────────────────────
// Activar con DSN real de https://sentry.io (crear proyecto PHP + Browser).
// AURORADERM_SENTRY_DSN      = DSN para errores PHP backend (sentry.io > Settings > Client Keys)
// AURORADERM_SENTRY_DSN_PUBLIC = DSN para errores JS frontend (mismo proyecto o uno separado)
// AURORADERM_SENTRY_ENV      = nombre del entorno (ej: production, staging)
// putenv('AURORADERM_SENTRY_DSN=https://xxxxx@oXXXXX.ingest.sentry.io/YYYYYYY');
// putenv('AURORADERM_SENTRY_DSN_PUBLIC=https://xxxxx@oXXXXX.ingest.sentry.io/YYYYYYY');
// putenv('AURORADERM_SENTRY_ENV=production');

// ── Auditoria API (performance) ───────────────────────
// Por defecto los GET publicos no se auditan para reducir I/O.
// Activa solo si necesitas trazas completas.
// putenv('AURORADERM_AUDIT_PUBLIC_GET=false');
// Auditar health en cada request (normalmente false para evitar ruido)
// putenv('AURORADERM_AUDIT_HEALTH=false');

// ── Inventario avanzado / compatibilidad canónica ───────────────────────────
// Estas variables también están activas en runtime aunque no siempre sean parte
// del happy path. Se documentan aquí para evitar drift entre código y example.

// Compatibilidad de cifrado legacy (preferir AURORADERM_DATA_ENCRYPTION_KEY).
// putenv('AURORADERM_DATA_KEY=clave_larga_rotada_o_base64:...');

// Relay del agente interno del admin.
// putenv('AURORADERM_ADMIN_AGENT_RELAY_URL=https://tu-relay.example.com');
// putenv('AURORADERM_ADMIN_AGENT_API_KEY=token_largo_rotado');
// putenv('AURORADERM_ADMIN_AGENT_API_KEY_HEADER=Authorization');
// putenv('AURORADERM_ADMIN_AGENT_API_KEY_PREFIX=Bearer');
// putenv('AURORADERM_ADMIN_AGENT_MODEL=gpt-4.1-mini');
// putenv('AURORADERM_ADMIN_AGENT_TIMEOUT_SECONDS=12');
// Lista de canales / templates permitidos para salidas externas.
// putenv('AURORADERM_ADMIN_AGENT_EDITORIAL_ALLOWLIST=seguimiento_operativo');
// putenv('AURORADERM_ADMIN_AGENT_EXTERNAL_ALLOWLIST=whatsapp,email');
// putenv('AURORADERM_ADMIN_AGENT_EXTERNAL_TEMPLATE_ALLOWLIST=seguimiento_callback,seguimiento_operativo');
// Solo para desarrollo: respuesta mock del relay remoto.
// putenv('AURORADERM_ADMIN_AGENT_RELAY_MOCK_RESPONSE={"choices":[{"message":{"content":"ok"}}]}');

// Branding, catálogo clínico, pricing y uploads de soporte.
// putenv('AURORADERM_PRIMARY_DOCTOR_NAME=Dr. Javier Rosero');
// putenv('AURORADERM_PRIMARY_DOCTOR_MSP=12345');
// putenv('AURORADERM_PAYMENT_CURRENCY=USD');
// Accepta 0.15 o 15 para representar 15% de IVA.
// putenv('AURORADERM_VAT_RATE=15');
// Override opcional del catálogo de servicios.
// putenv('AURORADERM_SERVICES_CATALOG_FILE=/abs/path/services-catalog.json');
// Endpoint backend alternativo para Figo si el router no usa el default.
// putenv('AURORADERM_FIGO_ENDPOINT=https://tu-backend-figo.example/chat');
// Directorio/base URL para comprobantes de transferencia.
// putenv('AURORADERM_TRANSFER_UPLOAD_DIR=/abs/path/uploads/transfer-proofs');
// putenv('AURORADERM_TRANSFER_PUBLIC_BASE_URL=https://pielarmonia.com/uploads/transfer-proofs');

// Observabilidad y networking.
// Redis es opcional; si no se define, health/metrics lo reportan como disabled.
// putenv('AURORADERM_REDIS_HOST=127.0.0.1');
// CA bundle custom para cURL/streams cuando el servidor no confía en la CA por defecto.
// putenv('AURORADERM_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt');
// Microsoft Clarity (también se acepta el alias legacy PIELARMONIA_CLARITY_PROJECT_ID).
// putenv('MICROSOFT_CLARITY_PROJECT_ID=abcd1234');
// Logging remoto opcional.
// putenv('PAPERTRAIL_HOST=logs.papertrailapp.com');
// putenv('PAPERTRAIL_PORT=12345');

// OpenAI directo para flujos clínicos que aún no pasan por router OpenClaw.
// putenv('OPENAI_API_KEY=sk-proj-REEMPLAZAR');

// Compatibilidad adicional de Operator Auth.
// Alias legacy de allowlist; preferir AURORADERM_OPERATOR_AUTH_ALLOWLIST.
// putenv('AURORADERM_OPERATOR_AUTH_ALLOWED_EMAILS=doctor@auroraderm.com,recepcion@auroraderm.com');
// Scope OIDC adicional requerido por algunos brokers.
// putenv('OPENCLAW_AUTH_BROKER_SCOPE=openid profile email');
// Permitir que el cliente proponga modelo OpenClaw (default false por seguridad).
// putenv('OPENCLAW_ALLOW_CLIENT_MODEL=false');

// Compatibilidad avanzada de backups offsite.
// Alias legacy del webhook remoto; preferir AURORADERM_BACKUP_OFFSITE_*.
// putenv('AURORADERM_BACKUP_WEBHOOK_URL=https://tu-backup-endpoint.example/upload');
// putenv('AURORADERM_BACKUP_WEBHOOK_TOKEN=token_largo_rotado');
// putenv('AURORADERM_BACKUP_WEBHOOK_TOKEN_HEADER=Authorization');

// Compatibilidad avanzada de Figo / AI.
// Rutas alternativas equivalentes al endpoint principal.
// putenv('FIGO_ENDPOINT=https://tu-backend-figo.example/chat');
// putenv('FIGO_URL=https://tu-backend-figo.example/chat');
// putenv('FIGO_CHAT_API_URL=https://tu-backend-figo.example/chat');
// putenv('FIGO_CHAT_URL=https://tu-backend-figo.example/chat');
// Rutas a JSON config legados.
// putenv('FIGO_CHAT_CONFIG_PATH=/abs/path/figo-chat.config.json');
// putenv('FIGO_BACKEND_CONFIG_PATH=/abs/path/figo-backend.config.json');
// Endurecimiento extra del fallback local.
// putenv('FIGO_BACKEND_ALLOW_LOCAL_FALLBACK=false');
// putenv('FIGO_AI_ALLOW_LOCAL_FALLBACK=false');
// Compatibilidad de endpoint / key IA.
// putenv('FIGO_AI_URL=https://openrouter.ai/api/v1/chat/completions');
// putenv('FIGO_AI_KEY=sk-or-v1-REEMPLAZAR');
// putenv('FIGO_AI_API_KEY_HEADER=Authorization');
// putenv('FIGO_AI_API_KEY_PREFIX=Bearer');
// putenv('FIGO_AI_KEY_HEADER=Authorization');
// putenv('FIGO_AI_KEY_PREFIX=Bearer');
// Timeouts/ventanas avanzadas del cliente IA.
// putenv('FIGO_AI_TIMEOUT_SECONDS=8');
// putenv('FIGO_AI_CONNECT_TIMEOUT_SECONDS=3');
// putenv('FIGO_AI_FAILFAST_WINDOW_SECONDS=45');
// putenv('FIGO_AI_MAX_TOKENS=256');
// Overrides compat del gateway OpenClaw usado por Figo.
// putenv('FIGO_OPENCLAW_GATEWAY_ENDPOINT=http://127.0.0.1:4141/v1/responses');
// putenv('FIGO_OPENCLAW_GATEWAY_API_KEY=REEMPLAZAR_TOKEN_OPENCLAW');
// putenv('FIGO_OPENCLAW_GATEWAY_MODEL=openclaw:main');
// putenv('FIGO_OPENCLAW_GATEWAY_KEY_HEADER=Authorization');
// putenv('FIGO_OPENCLAW_GATEWAY_KEY_PREFIX=Bearer');
