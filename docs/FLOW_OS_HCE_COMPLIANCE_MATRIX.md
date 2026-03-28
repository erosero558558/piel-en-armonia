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
| Archivo activa/pasiva con regla de 5 anos | A.M. 5216-A | `archiveState`, `lastAttentionAt`, politica de paso a pasiva | `recordMeta` | P0 | Adoptado |
| Copia certificada en 48h | A.M. 5216-A | Solicitud, SLA y constancia de entrega | `copyRequests` / `DisclosureLog` | P0 | Adoptado |
| Marcacion y manejo confidencial | A.M. 5216-A | Label `CONFIDENCIAL` en record/documentos | `recordMeta` / documentos | P0 | Adoptado |
| Proteccion reforzada de identidad en casos sensibles | A.M. 5216-A | `identityProtectionMode` y acceso restringido | `recordMeta` / seguridad | P0 | Adoptado |
| Consentimiento como proceso deliberativo | A.M. 5316 | No checkbox aislado; registro estructurado del proceso | `ConsentRecord` | P0 | Adoptado |
| Aceptacion, negativa y revocacion | A.M. 5316 | Estados formales del consentimiento | `ConsentRecord` | P0 | Adoptado |
| Quien informo, cuando, riesgos, alternativas y capacidad | A.M. 5316 | Campos explicitos y auditables | `ConsentRecord` | P0 | Adoptado |
| Compartir con acompanante solo por autorizacion explicita | A.M. 5316 | Autorizacion de disclosure a tercero | `ConsentRecord` / `DisclosureLog` | P0 | Adoptado |
| Comunicacion en entorno privado | A.M. 5316 | Campo expreso de confirmacion | `ConsentRecord` | P0 | Adoptado |
| Formulario HCU de admision | Instructivo MSP octubre 2020 | Mantener identificacion y apertura del expediente/episodio sobre base HCU | `PatientRecord/HCU` / admision | P0 | Referencia oficial confirmada |
| Formulario HCU de evolucion y prescripciones (`HCU-form.005/2008`) | Instructivo MSP octubre 2020 | La nota final y la receta viven en el mismo flujo clinico defendible | `FinalClinicalNote` / `Prescription` | P0 | Adoptado |
| Formulario HCU de interconsulta (`HCU-form.007/2008`) | Instructivo MSP octubre 2020 | La interconsulta entra como documento/accion clinica separada del chat | `ClinicalEncounter` / futuro modulo de interconsulta | P1 | Pendiente |
| Formulario HCU de consentimiento (`HCU-form.024`) | A.M. 5316 | Consentimiento estructurado, revocable y auditable | `ConsentRecord` | P0 | Adoptado |
| Receta y certificado dentro del mismo episodio | Decision de producto | No saltar de superficie para documentos de salida | `Prescription` / `MedicalCertificate` | P0 | Adoptado |
| Aprobacion humana final defendible | Decision de producto + A.M. 5216-A | `approve_final_note` con aprobador, fecha, version y checklist | `ClinicalApproval` | P0 | Adoptado |
| Bloqueos medico-legales minimos | Decision de producto + A.M. 5216-A/5316 | bloquear por faltantes, consentimiento, alerta critica, IA pendiente y posologia ambigua | `ClinicalHistoryLegalReadiness` | P0 | Adoptado |
| Formularios basicos y de especialidad MSP | Catalogo oficial consolidado MSP pendiente | Catalogo normativo final de campos obligatorios | motor de formularios | OPEN_DEP | Abierto parcial |
| Manual de Conservacion de Historias Clinicas A.M. 0457 | Referencia oficial confirmada por A.M. 5216-A; texto completo oficial pendiente | Reglas completas de archivo y conservacion | records governance | OPEN_DEP | Referencia confirmada |

## Reglas de interpretacion

### Regla 1
Ningun modulo conversacional reemplaza el documento clinico final persistido.

### Regla 2
Ninguna aprobacion final se permite solo por `reviewStatus`; debe existir constancia de aprobacion.

### Regla 3
Mientras siga abierta la dependencia del texto completo de `A.M. 0457` y del catalogo oficial consolidado de formularios, no se declara cumplimiento completo por formulario MSP.

### Regla 4
`Media Flow` queda fuera de esta matriz porque ya no pertenece al producto HCE activo.

## Uso
Esta matriz debe servir para:

- abrir slices de backend y frontend;
- revisar gaps antes de vender;
- decidir que blockers son regulatorios y cuales son solo UX;
- enlazar evidencia tecnica con fuente oficial del MSP.
