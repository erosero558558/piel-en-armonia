# FlowOS HCE Compliance Matrix

## Objetivo

Traducir la normativa MSP y las decisiones de producto de FlowOS a una matriz accionable para desarrollo, validacion y venta responsable.

## Leyenda

- `P0`: obligatorio para V1 defendible
- `P1`: obligatorio para escalamiento serio
- `OPEN_DEP`: dependencia normativa abierta; no se declara cumplimiento final mientras siga abierta

| Requisito | Fuente oficial | Requisito funcional | Modulo FlowOS/HCE | Prioridad | Estado |
|---|---|---|---|---|---|
| Historia clinica unica | A.M. 5216-A | Un expediente unico longitudinal por paciente | `PatientRecord/HCU` | P0 | Adoptado |
| Documento tecnico-legal, obligatorio y confidencial | A.M. 5216-A | La HCE no puede ser solo chat ni borrador informal | `FinalClinicalNote` | P0 | Adoptado |
| Redaccion precisa, comprensible y completa | A.M. 5216-A | La nota final debe cerrarse con checklist minimo | `ClinicalApproval` | P0 | Adoptado |
| Separacion/restriccion entre datos clinicos e identificativos | A.M. 5216-A | Controles de acceso y vistas diferenciadas | `AccessAudit` / seguridad | P0 | Adoptado |
| Trazabilidad de uso de la informacion | A.M. 5216-A | Registrar lectura, edicion, exportacion, copia y entrega | `AccessAudit` / `DisclosureLog` | P0 | Adoptado |
| Acceso archivado electronico con claves personales | A.M. 5216-A | Acceso autenticado, personal y auditable | auth + `AccessAudit` | P0 | Adoptado |
| Archivo activa/pasiva con conservacion por tipologia | A.M. 5216-A + Manual A.M. 0457 | `archiveState`, `lastAttentionAt`, politica de paso a pasiva y permanencia pasiva | `recordMeta` | P0 | Parcial |
| Copia certificada en 48h | A.M. 5216-A | Solicitud, SLA y constancia de entrega | `copyRequests` / `DisclosureLog` | P0 | Adoptado |
| Marcacion y manejo confidencial | A.M. 5216-A | Label `CONFIDENCIAL` en record/documentos | `recordMeta` / documentos | P0 | Adoptado |
| Proteccion reforzada de identidad en casos sensibles | A.M. 5216-A | `identityProtectionMode` y acceso restringido | `recordMeta` / seguridad | P0 | Adoptado |
| Consentimiento como proceso deliberativo | A.M. 5316 | No checkbox aislado; registro estructurado del proceso | `ConsentRecord` | P0 | Adoptado |
| Aceptacion, negativa y revocacion | A.M. 5316 | Estados formales del consentimiento | `ConsentRecord` | P0 | Adoptado |
| Quien informo, cuando, riesgos, alternativas y capacidad | A.M. 5316 | Campos explicitos y auditables | `ConsentRecord` | P0 | Adoptado |
| Compartir con acompanante solo por autorizacion explicita | A.M. 5316 | Autorizacion de disclosure a tercero | `ConsentRecord` / `DisclosureLog` | P0 | Adoptado |
| Comunicacion en entorno privado | A.M. 5316 | Campo expreso de confirmacion | `ConsentRecord` | P0 | Adoptado |
| Formulario HCU de admision (`HCU-form.001/2008`) | Instructivo MSP octubre 2020 | Mantener identificacion y apertura del expediente/episodio sobre base HCU | `PatientRecord/HCU` / admision | P0 | Parcial |
| Formulario HCU de evolucion y prescripciones (`HCU-form.005/2008`) | Instructivo MSP octubre 2020 | La nota final y la receta viven en el mismo flujo clinico defendible | `FinalClinicalNote` / `Prescription` | P0 | Parcial |
| Formulario HCU de interconsulta (`HCU-form.007/2008`) | Instructivo MSP octubre 2020 | La interconsulta entra como documento/accion clinica separada del chat y admite informe estructurado del consultado | `ClinicalEncounter`, `interconsultations[]`, `documents.interconsultForms[]`, `documents.interconsultReports[]` | P1 | Parcial: emision e informe recibido trazables; siguen diferidos portal externo, firma avanzada y respuesta externa federada |
| Formulario HCU de solicitud de laboratorio (`HCU-form.010A/2008`) | Instructivo MSP octubre 2020 | Solicitud formal de examenes de laboratorio cuando aplique | `labOrders[]`, `activeLabOrder`, `documents.labOrders`, `legalReadiness.hcu010AStatus` | P1 | Parcial: emision/cancelacion trazables y gate clinico por orden requerida; siguen diferidos integracion externa, firma avanzada y PDF literal MSP |
| Formulario HCU de solicitud de imagenologia (`HCU-form.012A/2008`) | Instructivo MSP octubre 2020 | Solicitud formal de imagenologia cuando aplique | `imagingOrders[]`, `activeImagingOrder`, `documents.imagingOrders[]`, `legalReadiness.hcu012AStatus` | P1 | Parcial: emision/cancelacion trazables y gate clinico por orden requerida; siguen diferidos resultado/informe, integracion externa, firma avanzada y PDF literal MSP |
| Formulario HCU de consentimiento (`HCU-form.024`) | A.M. 5316 | Consentimiento estructurado por procedimiento, revocable y auditable | `ConsentRecord`, `consentPackets`, `documents.consentForms` | P0 | Parcial: sin firma avanzada/biometrica ni PDF literal MSP |
| Receta y certificado dentro del mismo episodio | Decision de producto | No saltar de superficie para documentos de salida | `Prescription` / `MedicalCertificate` | P0 | Adoptado |
| Aprobacion humana final defendible | Decision de producto + A.M. 5216-A | `approve_final_note` con aprobador, fecha, version y checklist | `ClinicalApproval` | P0 | Adoptado |
| Bloqueos medico-legales minimos | Decision de producto + A.M. 5216-A/5316 | bloquear por faltantes, consentimiento, alerta critica, IA pendiente y posologia ambigua | `ClinicalHistoryLegalReadiness` | P0 | Adoptado |
| Catalogo oficial de formularios aplicables al consultorio defendible V1 | Instructivo MSP octubre 2020 + A.M. 5316 | Catalogo normativo base para HCE ambulatoria V1 | matriz HCE + roadmap por formulario | P0 | Fuente oficial anexada |
| Catalogo MSP hospitalario y de especialidades fuera del consultorio V1 | Catalogo MSP extendido no cerrado en esta slice | No declarar cobertura hospitalaria completa | roadmap posterior | OPEN_DEP | Fuera de alcance V1 |
| Manual de Conservacion de Historias Clinicas A.M. 0457 | Manual oficial MSP + Registro Oficial del A.M. 0457 | Reglas de archivo, eliminacion y tarjetero indice automatizado | records governance | P0 | Fuente oficial anexada / implementacion parcial |

## Reglas de interpretacion

### Regla 1

Ningun modulo conversacional reemplaza el documento clinico final persistido.

### Regla 2

Ninguna aprobacion final se permite solo por `reviewStatus`; debe existir constancia de aprobacion.

### Regla 3

Mientras una obligacion siga marcada como `Parcial`, `Pendiente` o `Fuera de alcance V1`, no se declara cumplimiento integral de formulario MSP.

### Regla 4

`Media Flow` queda fuera de esta matriz porque ya no pertenece al producto HCE activo.

## Uso

Esta matriz debe servir para:

- abrir slices de backend y frontend;
- revisar gaps antes de vender;
- decidir que blockers son regulatorios y cuales son solo UX;
- enlazar evidencia tecnica con fuente oficial del MSP.
