# Self-Hosted Monitoring Setup

This guide explains how to spin up a local or self-hosted Grafana + Prometheus stack to monitor the PielArmonia application.

## Prerequisites

- Docker and Docker Compose installed.
- The PHP application running on port `8080` (or update `prometheus.docker.yml`).

## Configuration Files

- `docker-compose.monitoring.yml`: Orchestrates Prometheus and Grafana containers.
- `prometheus.docker.yml`: Prometheus configuration file. Defaults to scraping `host.docker.internal:8080`.
- `grafana/dashboard.json`: The Grafana dashboard definition.
- `grafana/provisioning/`: Configuration to automatically load datasources and dashboards.

## Running the Monitoring Stack

1. Start your PHP application (e.g., using built-in server):
   ```bash
   php -S 0.0.0.0:8080
   ```
   *Note: Ensure it binds to `0.0.0.0` or uses `host.docker.internal` correctly.*

2. Start the monitoring stack:
   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

3. Access the services:
   - **Prometheus**: [http://localhost:9090](http://localhost:9090)
   - **Grafana**: [http://localhost:3000](http://localhost:3000) (Login: `admin` / `admin`)

## Verification

1. Go to Prometheus -> **Status** -> **Targets**. Verify that `pielarmonia` target is UP.
2. Go to Grafana -> **Dashboards** -> **Piel en Armonía Metrics**. You should see the panels populating with data.

## Troubleshooting

- If Prometheus target is DOWN, check if `host.docker.internal` resolves correctly on your OS.
- If using Linux, you might need `network_mode: host` or ensure the firewall allows Docker to talk to host.
- Check logs: `docker-compose -f docker-compose.monitoring.yml logs -f`
