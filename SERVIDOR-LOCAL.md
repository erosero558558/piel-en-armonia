# Servidor Local — Aurora Derm

> **Shim de compatibilidad.** El contenido canónico vive en:
>
> - **[docs/LOCAL_SERVER.md](docs/LOCAL_SERVER.md)** — Guía canónica del servidor local
> - **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — Setup y guía de contribución

Consulta los documentos canónicos listados arriba para la documentación completa.

## Arranque rápido

```bash
php -S 127.0.0.1:8011 -t . bin/local-stage-router.php
```

URLs locales:
- Admin: `http://127.0.0.1:8011/admin.html`
- Público ES: `http://127.0.0.1:8011/es/`
- Público EN: `http://127.0.0.1:8011/en/`

> Nota: `/index.html` no es la entrada canónica local. Usar `/es/` o `/admin.html`.

Variables:
- `TEST_BASE_URL` — URL base para tests
- `TEST_LOCAL_SERVER_PORT` — Puerto (default: 8011)

```bash
npm run benchmark:local   # Benchmark local reutilizable
```
