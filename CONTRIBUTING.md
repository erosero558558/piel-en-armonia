# Contribuir a Aurora Derm

> **Shim de compatibilidad.** El contenido canónico vive en:
>
> - **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — Guía completa de contribución

---

## Setup rápido

```bash
# Setup del servidor local canónico (helper portable Windows o Unix)
php -S 127.0.0.1:8011 -t . bin/local-stage-router.php
```

Variables:
- `TEST_BASE_URL`: URL base para tests automatizados
- `TEST_LOCAL_SERVER_PORT`: Puerto local (default: 8011)

El helper `tests/test_server.php` provee `start_test_php_server()` / `stop_test_php_server()` como alternativa portable en lugar de arrancar servidores con shell POSIX (`& echo $!`). Funciona correctamente en Windows o Unix.

Consulta [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) para la guía completa.
