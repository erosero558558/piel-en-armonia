# Flow OS First Slice

## Objetivo

Alinear la documentacion operativa de Aurora-Derm con un contrato minimo y verificable del patient journey para la first slice de Flow OS.

## Artefactos canonicos

- `docs/FLOW_OS_FIRST_SLICE.md`
- `data/flow-os/manifest.v1.json`
- `src/domain/flow-os/load-manifest.js`
- `src/domain/flow-os/patient-journey.js`

## Journey minimo

Las cinco etapas canonicas de esta slice son:

- `captured`
- `triaged`
- `scheduled`
- `in_consult`
- `closed`

## Transiciones permitidas

- `captured -> triaged`
- `triaged -> scheduled`
- `triaged -> closed`
- `scheduled -> in_consult`
- `scheduled -> closed`
- `in_consult -> closed`
- `closed` es terminal y no tiene transiciones salientes.

## Mapeo de compatibilidad con Patient Flow OS

- `captured -> intake`
- `triaged -> qualified | awaiting_booking`
- `scheduled -> booked | pre_visit_ready`
- `in_consult -> arrived | queued | in_consult`
- `closed -> closed`

## Validacion

Desde la raiz del repo:

```bash
node - <<'NODE'
const { loadFlowOsManifest } = require('./src/domain/flow-os/load-manifest.js');
const manifest = loadFlowOsManifest();
console.log(JSON.stringify({ stages: manifest.journeyStages.length, version: manifest.version }, null, 2));
NODE
```

```bash
node - <<'NODE'
const journey = require('./src/domain/flow-os/patient-journey.js');
console.log(JSON.stringify({
  canSchedule: journey.canTransition('triaged', 'scheduled'),
  summary: journey.summarizeJourney('scheduled')
}, null, 2));
NODE
```

## No alcance

Esta slice no abre features nuevas ni mezcla cambios con CI, turnero, OpenClaw, web publica ni `src/apps/patient-flow-os/**`.
