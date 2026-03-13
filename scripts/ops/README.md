# Active Ops Scripts

Arbol canonico de implementaciones PowerShell activas del repositorio.

Subcarpetas:

- `admin/`: gates y contingencia del runtime admin.
- `deploy/`: empaquetado y soporte de despliegue.
- `prod/`: verificaciones, smoke, monitoreo y reportes de produccion.
- `setup/`: scripts de configuracion puntual para integraciones operativas.
- `turnero/`: checklists y smoke operativo de las superficies nativas del turnero.

Los archivos de raiz se mantienen como wrappers compatibles para no romper
`package.json`, workflows ni runbooks existentes.

Contrato local:

- `TEST_BASE_URL` gobierna las suites que reutilizan un servidor de
  desarrollo/pruebas local.
- `LOCAL_VERIFY_BASE_URL` queda reservado para verificaciones del host servido
  por Nginx en scripts de deploy live.
- `checklist:admin:openclaw-auth:local` imprime el checklist canonico del
  laptop operador para el login OpenClaw del admin.
- `checklist:turnero:operator:pilot` imprime el checklist canonico del piloto
  Windows de `Turnero Operador`.
- `publish:turnero:operator:pilot` publica el bundle `pilot` del operador en
  hosting usando FTP/FTPS local o deja el plan con `-DryRun`.
- `smoke:admin:openclaw-auth:local` ejecuta el smoke local no interactivo del
  login OpenClaw del admin contra `admin-auth.php`.
