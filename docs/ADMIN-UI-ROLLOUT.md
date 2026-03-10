# Admin UI Rollout (V3 Only)

## Estado actual

El admin opera en modo `sony_v3 only`.

- `GET /admin.html` siempre arranca en `sony_v3`
- no existe seleccion runtime por query
- no existe seleccion runtime por `localStorage.adminUiVariant`
- no existe fallback runtime a `sony_v2` o `legacy`
- el rollback se hace por `revert + deploy`

## Contrato operativo

- Shell canonico: `admin.html`
- Runtime canonico: `admin.js` generado desde `src/apps/admin/index.js`
- UI activa: `sony_v3`
- Stylesheet canonico: `admin-v3.css`
- `js/admin-runtime.js` queda solo como alias de compatibilidad hacia `admin.js`

## Compatibilidad heredada

Los siguientes inputs se aceptan solo como ruido heredado y se limpian:

- `admin_ui=legacy|sony_v2|sony_v3`
- `admin_ui_reset=1`
- `localStorage.adminUiVariant`

No cambian la UI final. El admin sigue arrancando en `sony_v3`.

## Validacion recomendada

```powershell
npm run test:admin:runtime-smoke
npm run test:frontend:qa:admin
npm run gate:admin:rollout
```

## Gate operativo

`GATE-ADMIN-ROLLOUT.ps1` valida:

- `admin.html` responde correctamente
- el shell referencia `admin-v3.css`
- el shell no referencia `styles.min.css`, `admin.min.css`, `admin.css` ni `admin-v2.css`
- la CSP sigue endurecida
- las suites `admin-ui-runtime-smoke` y `admin-v3-runtime` pasan

## Rollback

No existe rollback por variante.

Procedimiento:

1. Identificar el commit problemático.
2. Revertir el cambio en Git.
3. Desplegar el revert.
4. Re-ejecutar:

```powershell
npm run gate:admin:rollout
```

## Higiene de bundles

Despues de regenerar `admin.js`:

```powershell
npx rollup -c rollup.config.mjs
npm run chunks:admin:prune
```

O usar el build canonico del repo:

```powershell
npm run build
```

## Notas

- `sony_v2` y `legacy` pueden seguir existiendo como codigo muerto temporal en el repo.
- No pueden seguir siendo parte del runtime, del gate ni de la operacion diaria.
- `admin.html` debe cargar `admin.js` directamente; el bridge heredado no forma parte del shell canonico.
