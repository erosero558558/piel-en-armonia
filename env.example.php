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
// putenv('FIGO_CHAT_DEGRADED_MODE=true');
// Si usas backend local (figo-backend.php) con puente Telegram:
// putenv('FIGO_CHAT_ENDPOINT=https://pielarmonia.com/figo-backend.php');
// putenv('FIGO_TELEGRAM_BOT_TOKEN=TOKEN_BOTFATHER_ROTADO');
// putenv('FIGO_TELEGRAM_CHAT_ID=TU_CHAT_ID_TELEGRAM');
// putenv('FIGO_TELEGRAM_WEBHOOK_SECRET=TOKEN_SECRETO_WEBHOOK');

// ── IA para Figo (respuestas naturales) ──────────────
// Endpoint OpenAI-compatible (Kimi, DeepSeek, OpenAI, Ollama, etc.)
// putenv('FIGO_AI_ENDPOINT=https://api.moonshot.cn/v1/chat/completions');
// putenv('FIGO_AI_API_KEY=tu_api_key');
// putenv('FIGO_AI_MODEL=moonshot-v1-8k');

// ── Cron (recordatorios automáticos) ────────────────
// putenv('PIELARMONIA_CRON_SECRET=un_token_secreto_largo');
