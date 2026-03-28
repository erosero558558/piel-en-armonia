# FlowOS HCE Ecuador Traceability Matrix

## Objetivo
Dejar trazabilidad directa entre fuente oficial MSP, decision de producto y artefacto tecnico del repo.

## Fuentes oficiales confirmadas

### MSP Ecuador
- A.M. 5216-A:
  `https://www.salud.gob.ec/wp-content/uploads/2021/09/Acuerdo-Ministerial-5216.pdf`
- A.M. 5316:
  `https://www.salud.gob.ec/wp-content/uploads/2022/09/A.M.5316-Consentimiento-Informado_-AM-5316.pdf`
- Manual de Normas de Conservacion de las Historias Clinicas y aplicacion del Tarjetero Indice Automatizado:
  `https://aplicaciones.msp.gob.ec/salud/archivosdigitales/documentosDirecciones/dnn/archivos/MANUAL%20DE%20MANEJO%20DE%20ARCHIVO%20DE%20LA%20HISTORIA.pdf`
- Registro Oficial / A.M. 0457 que aprueba y difunde el manual:
  `https://aplicaciones.msp.gob.ec/salud/archivosdigitales/documentosDirecciones/dnn/archivos/HISTORIA%20CL%C3%8DNICA%20%C3%9ANICA.pdf`
- Instructivo MSP de aplicacion de historia clinica, octubre 2020:
  `https://www.salud.gob.ec/wp-content/uploads/2021/09/INSTRUCTIVO-DE-APLICACION-HISTORIA-CLINICA.docx-Octubre-2020.pdf`

### Confirmaciones normativas ya extraidas

- el manual oficial `A.M. 0457` ya esta anexado por fuente MSP y confirma archivo activo/pasivo, eliminacion, archivo central, trazabilidad documental y tarjetero indice automatizado;
- el instructivo MSP de 2020 confirma los formularios HCU `001 admision`, `005 evolucion y prescripciones`, `007 interconsulta`, `010A solicitud de laboratorio` y `012A solicitud de imagenologia`;
- `A.M. 5316` aterriza el consentimiento informado sobre `HCU-form.024`.

## Dependencias remanentes de implementacion

Lo que queda abierto ya no es la fuente oficial, sino la implementacion o parametrizacion:

- paridad documental completa de `HCU-form.001`, `HCU-form.005` y `HCU-form.024`;
- implementacion de `HCU-form.007`, `HCU-form.010A` y `HCU-form.012A`;
- parametrizacion exacta de conservacion/eliminacion por tipologia de unidad;
- catalogo hospitalario y de especialidades fuera del consultorio V1.

## Matriz

| Obligacion | Fuente oficial | Decision de producto | Artefacto tecnico actual | Estado V1 |
|---|---|---|---|---|
| HCE unica longitudinal | A.M. 5216-A | 1 paciente = 1 HCU | `draft.patientRecordId`, `patientRecord.recordId` | Cubierto |
| Episodio/encuentro activo | Decision FlowOS | cada `patientCase` apunta al episodio correcto | `draft.episodeId`, `draft.encounterId`, `activeEpisode`, `encounter` | Cubierto |
| Documento tecnico-legal final | A.M. 5216-A | la nota final no es el chat | `documents.finalNote`, `approval` | Cubierto |
| Confidencialidad | A.M. 5216-A + Manual 0457 | salidas marcadas y tratadas como confidenciales | `recordMeta.confidentialityLabel`, `documents.*.confidential` | Cubierto |
| Archivo activo/pasivo y permanencia | Manual 0457 | archivo activo 5 anos y pasivo 5 o 10 segun tipologia | `recordMeta.archiveState`, `recordMeta.passiveAfterYears`, `recordMeta.lastAttentionAt` | Parcial |
| Eliminacion formal de historia clinica | Manual 0457 | no basta cambiar estado; requiere regla y procedimiento | roadmap records governance | Pendiente |
| Tarjetero indice automatizado | Manual 0457 | indice unico de pacientes, datos primarios/secundarios y respaldos | `PatientRecord/HCU`, indice de paciente y roadmap backups | Parcial |
| Copia certificada 48h | A.M. 5216-A | flujo auditable de copia/entrega | `recordMeta.copyDeliverySlaHours`, `copyRequests`, `DisclosureLog` | Cubierto |
| Trazabilidad de acceso/uso | A.M. 5216-A + Manual 0457 | toda accion relevante debe dejar huella | `accessAudit`, `DisclosureLog`, `copyRequests` | Cubierto |
| HCU-form.001 admision | Instructivo MSP octubre 2020 | apertura del expediente y del episodio sobre base HCU | `PatientRecord/HCU`, apertura de episodio | Parcial |
| HCU-form.005 evolucion y prescripciones | Instructivo MSP octubre 2020 | la nota final y la receta salen del mismo cockpit | `documents.finalNote`, `documents.prescription` | Parcial |
| HCU-form.007 interconsulta | Instructivo MSP octubre 2020 | la interconsulta no se modela como chat; queda pendiente como documento/accion formal | backlog HCE v2 | Pendiente |
| HCU-form.010A solicitud de laboratorio | Instructivo MSP octubre 2020 | solicitud formal de examenes cuando aplique | backlog ordenes diagnosticas | Pendiente |
| HCU-form.012A solicitud de imagenologia | Instructivo MSP octubre 2020 | solicitud formal de imagenologia cuando aplique | backlog ordenes diagnosticas | Pendiente |
| Consentimiento como proceso | A.M. 5316 | campos estructurados, no checkbox aislado | `draft.consent`, `consent` | Cubierto |
| HCU-form.024 consentimiento informado | A.M. 5316 | consentimiento aceptado, negado o revocado con trazabilidad por procedimiento | `consentPackets[]`, `activeConsentPacket`, `documents.consentForms[]`, bridge `consent` | Parcial: sin firma avanzada/biometrica ni PDF literal MSP |
| Aceptacion / negativa / revocacion | A.M. 5316 | estados explicitos del consentimiento | `consent.status`, `acceptedAt`, `declinedAt`, `revokedAt` | Cubierto |
| Quien informo / que explico / riesgos / alternativas / capacidad | A.M. 5316 | checklist narrativo estructurado | `consent.informedBy`, `explainedWhat`, `risksExplained`, `alternativesExplained`, `capacityAssessment` | Cubierto |
| Compartir con acompanante solo con autorizacion | A.M. 5316 | disclosure controlado | `consent.companionShareAuthorized` | Cubierto |
| Entorno privado de comunicacion | A.M. 5316 | confirmacion expresa | `consent.privateCommunicationConfirmed` | Cubierto |
| Aprobacion humana final | Decision FlowOS + A.M. 5216-A | no aprobar por simple status | `episodeAction approve_final_note`, `approval` | Cubierto |
| Checklist de cierre defendible | Decision FlowOS | bloqueo por faltantes reales | `ClinicalHistoryLegalReadiness`, `legalReadiness`, `approvalBlockedReasons` | Cubierto |
| Receta y certificado dentro del flujo clinico | Decision FlowOS | V1 minima = nota + receta + certificado | `documents.prescription`, `documents.certificate` | Cubierto |
| Media Flow fuera del cockpit clinico | Decision FlowOS | editorial no comparte workspace con HCE | `src/apps/admin-v3/sections/clinical-history/render/index.js`, `src/apps/admin-v3/ui/frame/templates/sections/clinical-history.js` | Cubierto |

## Criterio de cierre de Fase 0
Fase 0 para `consultorio defendible V1` solo se considera cerrada cuando esta matriz tenga:

- fuentes oficiales anexadas para 5216-A y 5316;
- fuente oficial anexada para A.M. 0457;
- fuente oficial anexada para formularios aplicables al consultorio V1;
- cada obligacion V1 marcada como `Cubierto`, `Parcial`, `Pendiente` o `Fuera de alcance V1`;
- cada campo obligatorio V1 trazado a una fuente o marcado explicitamente como decision de producto.
