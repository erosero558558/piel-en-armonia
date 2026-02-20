<?php
/**
 * Ejemplo de configuración de Piel en Armonía.
 * Copia este archivo como env.php y completa los valores.
 * env.php está en .gitignore y NO se sube al repositorio.
 */

// ── SMTP (Gmail) ──────────────────────────────────────
// putenv('PIELARMONIA_SMTP_HOST=smtp.gmail.com');
// putenv('PIELARMONIA_SMTP_PORT=587');
// putenv('PIELARMONIA_SMTP_USER=tu_email@gmail.com');
// putenv('PIELARMONIA_SMTP_PASS=contraseña_de_aplicación');
// putenv('PIELARMONIA_EMAIL_FROM=tu_email@gmail.com');
// putenv('PIELARMONIA_ADMIN_EMAIL=tu_email@gmail.com');

// ── Admin ─────────────────────────────────────────────
// putenv('PIELARMONIA_ADMIN_PASSWORD=tu_clave_admin');

// ── Stripe ────────────────────────────────────────────
// putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_live_...');
// putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_live_...');
// putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET=whsec_...');

// ── Orígenes permitidos (CORS) ────────────────────────
// putenv('PIELARMONIA_ALLOWED_ORIGIN=https://pielarmonia.com');

// ── CAPTCHA (Turnstile) ──────────────────────────────
// putenv('PIELARMONIA_TURNSTILE_SITE_KEY=0x4AAAAAAABcDeFgHiJkLmNo');
// putenv('PIELARMONIA_TURNSTILE_SECRET_KEY=0x4AAAAAAABcDeFgHiJkLmNoPqRsTuVwXyZ');

// ── Chatbot (Figo) ───────────────────────────────────
// IMPORTANTE: no apuntar al propio /figo-chat.php (genera recursión).
// Usa el endpoint HTTP real del backend de Clawbot/Figo.
// putenv('FIGO_CHAT_ENDPOINT=https://TU_BACKEND_FIGO/chat');
// putenv('FIGO_CHAT_TOKEN=TOKEN_ROTADO_DESDE_BOTFATHER');
// Opcional: forzar fallback local cuando el backend falle. Por defecto es auto (live si upstream esta sano).
// putenv('FIGO_CHAT_DEGRADED_MODE=true');
// Si usas backend local (figo-backend.php) con puente Telegram:
// putenv('FIGO_CHAT_ENDPOINT=https://pielarmonia.com/figo-backend.php');
// putenv('FIGO_TELEGRAM_BOT_TOKEN=TOKEN_BOTFATHER_ROTADO');
// putenv('FIGO_TELEGRAM_CHAT_ID=TU_CHAT_ID_TELEGRAM');
// putenv('FIGO_TELEGRAM_WEBHOOK_SECRET=TOKEN_SECRETO_WEBHOOK');

// ── IA para Figo (respuestas naturales) ──────────────
// Endpoint OpenAI-compatible (OpenRouter, Kimi, DeepSeek, OpenAI, Ollama, etc.)
// putenv('FIGO_AI_ENDPOINT=https://openrouter.ai/api/v1/chat/completions');
// putenv('FIGO_AI_API_KEY=sk-or-v1-REEMPLAZAR');
// putenv('FIGO_AI_MODEL=arcee-ai/trinity-large-preview:free');

// ── Cron (recordatorios automáticos) ────────────────
// putenv('PIELARMONIA_CRON_SECRET=un_token_secreto_largo');

// ── Backups (salud + replicacion offsite) ───────────
// Edad maxima (horas) del ultimo backup para health check (1-168, default 24)
// putenv('PIELARMONIA_BACKUP_MAX_AGE_HOURS=24');
// Webhook/endpoint para subir snapshots offsite (multipart form-data)
// putenv('PIELARMONIA_BACKUP_OFFSITE_URL=https://tu-backup-endpoint.example/upload');
// Token opcional para autenticar el webhook de backup
// putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN=token_largo_rotado');
// Header opcional del token (default Authorization)
// putenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER=Authorization');
// Timeout de subida offsite en segundos (5-120, default 20)
// putenv('PIELARMONIA_BACKUP_OFFSITE_TIMEOUT_SECONDS=20');

// ── Base de Datos (opcional) ────────────────────────
// putenv('PIELARMONIA_DB_HOST=127.0.0.1');
// putenv('PIELARMONIA_DB_NAME=pielarmonia');
// putenv('PIELARMONIA_DB_USER=root');
// putenv('PIELARMONIA_DB_PASS=secret');

// ── Feature Flags ───────────────────────────────────
// putenv('FEATURE_NEW_BOOKING_UI=true');
// putenv('FEATURE_STRIPE_ELEMENTS=true');
// putenv('FEATURE_DARK_MODE=true');
// putenv('FEATURE_CHATGPT_INTEGRATION=true');

// ── Debug seguro (solo desarrollo) ───────────────────
// En produccion mantener en false para no filtrar errores internos al frontend
// putenv('PIELARMONIA_DEBUG_EXCEPTIONS=false');

// ── Auditoria API (performance) ───────────────────────
// Por defecto los GET publicos no se auditan para reducir I/O.
// Activa solo si necesitas trazas completas.
// putenv('PIELARMONIA_AUDIT_PUBLIC_GET=false');
// Auditar health en cada request (normalmente false para evitar ruido)
// putenv('PIELARMONIA_AUDIT_HEALTH=false');
