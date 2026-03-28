# FlowOS HCE Ecuador Traceability Matrix

## Objetivo
Dejar trazabilidad directa entre fuente oficial MSP, decision de producto y artefacto tecnico del repo.

## Fuentes oficiales confirmadas

### MSP Ecuador
- A.M. 5216-A:
  `https://www.salud.gob.ec/wp-content/uploads/2021/09/Acuerdo-Ministerial-5216.pdf`
- A.M. 5316:
  `https://www.salud.gob.ec/wp-content/uploads/2022/09/A.M.5316-Consentimiento-Informado_-AM-5316.pdf`
- Instructivo MSP de aplicacion de historia clinica, octubre 2020:
  `https://www.salud.gob.ec/wp-content/uploads/2021/09/INSTRUCTIVO-DE-APLICACION-HISTORIA-CLINICA.docx-Octubre-2020.pdf`

### Confirmaciones normativas ya extraidas

- `A.M. 5216-A` confirma la referencia operativa al `A.M. 0457` para archivo y conservacion de historias clinicas;
- el instructivo MSP de 2020 confirma los formularios HCU `001 admision`, `005 evolucion y prescripciones` y `007 interconsulta`;
- `A.M. 5316` aterriza el consentimiento informado sobre `HCU-form.024`.

## Dependencias oficiales todavia abiertas

- texto oficial completo de `A.M. 0457` Manual de Normas de Conservacion de las Historias Clinicas
- catalogo oficial consolidado MSP que enumera formularios basicos y de especialidad

Mientras sigan abiertas:

- no se congela el catalogo final de campos obligatorios por formulario;
- los bloqueos de V1 se consideran base medico-legal transitoria y no mapeo final por formulario.

## Matriz

| Obligacion | Fuente | Decision de producto | Artefacto tecnico actual |
|---|---|---|---|
| HCE unica longitudinal | A.M. 5216-A | 1 paciente = 1 HCU | `draft.patientRecordId`, `patientRecord.recordId` |
| Episodio/encuentro activo | Decision FlowOS | cada `patientCase` apunta al episodio correcto | `draft.episodeId`, `draft.encounterId`, `activeEpisode`, `encounter` |
| Documento tecnico-legal final | A.M. 5216-A | la nota final no es el chat | `documents.finalNote`, `approval` |
| Confidencialidad | A.M. 5216-A | salidas marcadas y tratadas como confidenciales | `recordMeta.confidentialityLabel`, `documents.*.confidential` |
| Activa/pasiva a 5 anos | A.M. 5216-A | politica base de archivo | `recordMeta.archiveState`, `recordMeta.passiveAfterYears`, `recordMeta.lastAttentionAt` |
| Referencia de conservacion `A.M. 0457` | A.M. 5216-A | la capa de records governance debe terminar de aterrizar archivo/custodia contra esa norma | `recordMeta`, roadmap de records governance |
| Copia certificada 48h | A.M. 5216-A | flujo auditable de copia/entrega | `recordMeta.copyDeliverySlaHours`, `copyRequests`, `DisclosureLog` |
| Trazabilidad de acceso/uso | A.M. 5216-A | toda accion relevante debe dejar huella | `AccessAudit` objetivo, `audit_log_event(...)` actual |
| HCU-form.001 admision | Instructivo MSP octubre 2020 | apertura del expediente y del episodio sobre base HCU | `PatientRecord/HCU`, apertura de episodio |
| HCU-form.005 evolucion y prescripciones | Instructivo MSP octubre 2020 | la nota final y la receta salen del mismo cockpit | `documents.finalNote`, `documents.prescription` |
| HCU-form.007 interconsulta | Instructivo MSP octubre 2020 | la interconsulta no se modela como chat; queda pendiente como documento/accion formal | backlog HCE v2 |
| Consentimiento como proceso | A.M. 5316 | campos estructurados, no checkbox aislado | `draft.consent`, `consent` |
| HCU-form.024 consentimiento informado | A.M. 5316 | consentimiento aceptado, negado o revocado con trazabilidad | `consent.status`, `acceptedAt`, `declinedAt`, `revokedAt` |
| Aceptacion / negativa / revocacion | A.M. 5316 | estados explicitos del consentimiento | `consent.status`, `acceptedAt`, `declinedAt`, `revokedAt` |
| Quien informo / que explico / riesgos / alternativas / capacidad | A.M. 5316 | checklist narrativo estructurado | `consent.informedBy`, `explainedWhat`, `risksExplained`, `alternativesExplained`, `capacityAssessment` |
| Compartir con acompanante solo con autorizacion | A.M. 5316 | disclosure controlado | `consent.companionShareAuthorized` |
| Entorno privado de comunicacion | A.M. 5316 | confirmacion expresa | `consent.privateCommunicationConfirmed` |
| Aprobacion humana final | Decision FlowOS + A.M. 5216-A | no aprobar por simple status | `episodeAction approve_final_note`, `approval` |
| Checklist de cierre defendible | Decision FlowOS | bloqueo por faltantes reales | `ClinicalHistoryLegalReadiness`, `legalReadiness`, `approvalBlockedReasons` |
| Receta y certificado dentro del flujo clinico | Decision FlowOS | V1 minima = nota + receta + certificado | `documents.prescription`, `documents.certificate` |
| Media Flow fuera del cockpit clinico | Decision FlowOS | editorial no comparte workspace con HCE | `src/apps/admin-v3/sections/clinical-history/render/index.js`, `src/apps/admin-v3/ui/frame/templates/sections/clinical-history.js` |

## Criterio de cierre de Fase 0
Fase 0 solo se considera cerrada cuando esta matriz tenga:

- fuentes oficiales anexadas para 5216-A y 5316;
- fuente oficial anexada para A.M. 0457;
- fuente oficial anexada para formularios basicos y de especialidad;
- cada campo obligatorio V1 trazado a una fuente o marcado explicitamente como decision de producto.
