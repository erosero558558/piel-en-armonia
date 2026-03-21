# Flow OS Runtime Slice

`patient-flow-os` se mantiene como path tecnico de compatibilidad. El nombre
canonico del producto es `Flow OS`.

En este repo, `Aurora Derm` funciona como tenant de referencia para el corte
comercial actual: un piloto pagado para una clinica dermatologica ambulatoria
de una sola sede.

## Quickstart

```bash
npm install
npm run build
npm test
```

## Alcance vigente

- `Flow OS` es el producto B2B que se vende.
- `Aurora Derm` es la clinica de referencia para demos y QA comercial.
- El v1 pagado se congela en cinco etapas: `captured -> triaged -> scheduled -> in_consult -> closed`.
- La IA queda en modo asistivo: recomienda, prepara acciones y requiere aprobacion humana explicita.

## Superficies canonicas

- `Ops Console`: superficie principal de operacion y venta.
- `Patient Flow Link`: vista paciente conectada al mismo `patientCase`.
- `Wait Room Display`: lectura publica de cola sobre el mismo tenant.
- `Clinic Dashboard`: lectura gerencial del mismo recorrido operativo.

## Que incluye esta slice

- `packages/core`: contratos canonicos de patient cases, approvals, actions y Copilot.
- `packages/agent-runtime`: motor `decide/prepare` del `PatientCase Copilot`.
- `apps/api`: runtime bootstrap con snapshots, approvals, audit y surfaces.
- `apps/ops-console`: shell de la consola operativa para los casos activos.

## Tenant demo

El bootstrap incluye `tnt_aurora` / `aurora-derm` con casos distribuidos en
las cinco etapas del piloto pagado. Ese tenant se usa para validar que
`Ops Console`, `Patient Flow Link`, `Wait Room Display` y `Clinic Dashboard`
leen el mismo caso y el mismo tenant.

## Filosofia del copiloto

El primer release del copiloto no es un chat libre. Es un motor que responde:

- que sigue
- por que sigue eso
- que riesgo hay si no se hace
- que accion deja preparada
- que gate humano aplica
