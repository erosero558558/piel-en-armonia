# Monitoring Setup

Este archivo ha sido obsoleto y el contenido unificado con la documentación canónica de monitoreo para asegurar una "Single Source of Truth".

👉 **Por favor consulta la guía unificada aquí: [MONITORING.md](./MONITORING.md)**

---

> **Nota sobre hosts de QA:** El canonical bare PHP server for local QA remains `127.0.0.1:8011`
> (via `php -S 127.0.0.1:8011 -t . bin/local-stage-router.php`).
> El puerto `localhost:8080` pertenece exclusivamente al stack Docker de monitoreo
> (Prometheus + Grafana). No confundir ambos entornos al interpretar métricas.

