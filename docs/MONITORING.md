# Monitoring Setup

This document outlines the setup for Basic Monitoring components: Uptime, Error Tracking, and Logs Aggregation.

## 1. Uptime Monitoring (UptimeRobot / Pingdom)

To ensure the application is reachable and the storage layer is operational, configure your uptime monitor (e.g., UptimeRobot) to check the following endpoint:

- **URL**: `https://pielarmonia.com/api.php?resource=health`
- **Method**: `GET`
- **Expected Status**: `200 OK`
- **Response**: JSON object with `{"ok": true, "status": "ok", ...}`

This endpoint verifies:
- Web server reachability.
- `data/` directory writability.
- Storage encryption status.

## 2. Error Tracking (Sentry)

Sentry is used for both backend (PHP) and frontend (JS) error tracking.

### Configuration
Set the following environment variables in your hosting panel or `.env` file (if supported):

- **Backend (PHP)**:
  ```bash
  PIELARMONIA_SENTRY_DSN="https://examplePublicKey@o0.ingest.sentry.io/0"
  ```
  *Tracks uncaught PHP exceptions and API errors.*

- **Frontend (JS)**:
  ```bash
  PIELARMONIA_SENTRY_DSN_PUBLIC="https://examplePublicKey@o0.ingest.sentry.io/0"
  ```
  *Tracks JavaScript errors in the browser via `js/monitoring-loader.js`.*

- **Environment Name** (Optional, defaults to 'production'):
  ```bash
  PIELARMONIA_SENTRY_ENV="production"
  ```

## 3. Logs Aggregation (Papertrail)

The application uses `Monolog` to send application logs and audit events to Papertrail via UDP syslog.

### Configuration
Create a Log Destination in Papertrail (e.g., `logsN.papertrailapp.com:XXXXX`) and set the following environment variables:

```bash
PAPERTRAIL_HOST="logsN.papertrailapp.com"
PAPERTRAIL_PORT="XXXXX"
```

### What is logged?
- **Errors**: All uncaught exceptions and `error_log` calls in the API.
- **Audit Events**: Business events like `api.access`, `appointments.created`, `payment.verified`, etc.
- **Slow Requests**: API requests taking longer than 2 seconds.

### Troubleshooting
If logs are not appearing in Papertrail:
1. Ensure the `sockets` extension is enabled in PHP (usually enabled by default).
2. Check if outbound UDP traffic on the specified port is allowed by the hosting firewall.
3. Check the standard server error log (`php://stderr`) as the application falls back to it if Papertrail is unreachable.
