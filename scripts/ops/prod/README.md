# Production Ops Scripts

Implementaciones canonicas de los scripts operativos de produccion.

Entrypoints estables:

- `BENCH-API-PRODUCCION.ps1`
- `GATE-POSTDEPLOY.ps1`
- `MONITOR-PRODUCCION.ps1`
- `REPORTE-SEMANAL-PRODUCCION.ps1`
- `SMOKE-PRODUCCION.ps1`
- `VERIFICAR-DESPLIEGUE.ps1`

Los archivos de raiz se mantienen como wrappers compatibles para no romper
`package.json`, workflows ni uso manual existente.
