# Monitoring Setup - UptimeRobot

To ensure high availability and quick response to downtime, we use UptimeRobot to monitor the application's health.

## Endpoint

The application exposes a health check endpoint:
- **URL**: `https://pielarmonia.com/api.php?resource=health`
- **Method**: `GET`
- **Expected Status**: `200 OK`
- **Expected Response Body**: `{"ok":true, "status":"ok", ...}`

## Configuration Steps

1.  **Create Account/Login**: Go to [uptimerobot.com](https://uptimerobot.com/) and log in.
2.  **Add New Monitor**:
    - Click **"Add New Monitor"**.
    - **Monitor Type**: Select "HTTP(s)".
    - **Friendly Name**: `PielArmonia Health`.
    - **URL (or IP)**: `https://pielarmonia.com/api.php?resource=health`
    - **Monitoring Interval**: `5 minutes` (or shorter if on paid plan).
    - **Monitor Timeout**: `30 seconds`.
3.  **Advanced Settings** (Recommended):
    - **Keyword Monitoring**: Enable.
    - **Keyword to find**: `"ok":true` (Case insensitive).
    - This ensures that not only the server responds (200 OK), but the application logic is also healthy (i.e., storage is writable).
4.  **Alert Contacts**:
    - Select the email addresses or integrations (Slack, Telegram) to notify upon downtime.
5.  **Create Monitor**.

## Verification

After creation, the monitor should show as **UP** within a few minutes. If it shows **DOWN**:
- Check if the site is accessible.
- Check if the `/api.php?resource=health` endpoint is returning `200 OK`.
- Verify no firewall rules are blocking UptimeRobot IPs.

## Maintenance

During planned maintenance or deployments, you can pause the monitor to avoid false alarms.
