# FlowOS HCE MSP 0457 and Forms Scope

## Objetivo

Cerrar la Fase 0 normativa de HCE para el alcance **consultorio defendible V1** con fuente oficial MSP, separando:

- lo que ya esta cubierto en producto;
- lo que solo esta cubierto de forma parcial;
- lo que sigue pendiente;
- y lo que queda fuera del alcance V1 por pertenecer a hospitalizacion o especialidades no priorizadas.

## Fuentes oficiales anexadas

### 1. Manual oficial de archivo y conservacion

- Manual de Normas de Conservacion de las Historias Clinicas y aplicacion del Tarjetero Indice Automatizado:
  `https://aplicaciones.msp.gob.ec/salud/archivosdigitales/documentosDirecciones/dnn/archivos/MANUAL%20DE%20MANEJO%20DE%20ARCHIVO%20DE%20LA%20HISTORIA.pdf`
- Registro Oficial / Acuerdo Ministerial 0457 que aprueba y difunde ese manual:
  `https://aplicaciones.msp.gob.ec/salud/archivosdigitales/documentosDirecciones/dnn/archivos/HISTORIA%20CL%C3%8DNICA%20%C3%9ANICA.pdf`

### 2. Formularios HCU confirmados por fuente oficial MSP

- Instructivo de aplicacion de historia clinica, octubre 2020:
  `https://www.salud.gob.ec/wp-content/uploads/2020/12/Instructivo-de-Aplicacion_historia_clinica_doc-Octubre-2020.pdf`

### 3. Consentimiento informado oficial

- Acuerdo Ministerial 5316:
  `https://www.salud.gob.ec/wp-content/uploads/2022/09/A.M.5316-Consentimiento-Informado_-AM-5316.pdf`

## Lo que el Manual 0457 obliga y como lo interpretamos en FlowOS

### Archivo y conservacion

- El manual no fija una sola regla de "5 anos total".
- La regla oficial es:
    - archivo activo: 5 anos;
    - archivo pasivo: 5 o 10 anos segun tipologia de unidad;
    - vida total: 10 o 15 anos.
- Para `Centro de Salud` y `Subcentro de Salud`, la tabla oficial marca `5 anos activo + 5 anos pasivo = 10 anos`.
- Inferencia de producto para `consultorio defendible V1`:
  usamos como minimo operativo `5 anos activo + 5 anos pasivo`, y dejamos la parametrizacion por tipologia como gap explicito, no como cierre normativo total.

### Archivo central y salida controlada

- La historia clinica debe reposar en un archivo central activo/pasivo, ordenado segun la ultima atencion.
- La historia no debe salir libremente de la unidad operativa; para tramites legales el manual habla de entrega de resumen con autorizacion escrita.
- En FlowOS esto se traduce en:
    - disclosure conservador;
    - copia certificada controlada;
    - audit trail de acceso/entrega;
    - nada de exportacion libre sin registro.

### Integridad documental

- Todos los formularios y documentos adicionales deben conservarse juntos y en orden cronologico.
- Los resultados de apoyo diagnostico deben archivarse con los formularios correspondientes.
- Esto obliga a que `nota`, `receta`, `consentimiento`, `solicitudes` y `soportes` no queden dispersos como mensajes o adjuntos sueltos sin episodio.

### Tarjetero indice automatizado

- El manual define indice automatizado de pacientes, datos primarios/ secundarios y respaldos periodicos.
- Para FlowOS esto aterriza en:
    - HCU unica por paciente;
    - identificacion y filiacion separadas de lo clinico;
    - estado del registro `activa/pasiva/eliminada`;
    - respaldos y trazabilidad del indice.

## Catalogo oficial de formularios aplicables al consultorio defendible V1

| Formulario oficial | Fuente oficial | Aplicabilidad V1 | Mapeo HCE / FlowOS | Estado |
|---|---|---|---|---|
| `SNS-MSP/HCU-form.001/2008` Admision | Instructivo MSP 2020, anexo 7 | Obligatorio para apertura de HCU y primera admision | `PatientRecord/HCU`, apertura de episodio, identificacion/filiacion | Parcial |
| `SNS-MSP/HCU-form.005/2008` Evolucion y prescripciones | Instructivo MSP 2020, anexo 8 | Nucleo documental ambulatorio | `FinalClinicalNote`, `Prescription` | Parcial |
| `SNS-MSP/HCU-form.007/2008` Interconsulta | Instructivo MSP 2020, anexo 9 | Aplicable cuando el consultorio emite o recibe interconsulta | `interconsultations[]`, `activeInterconsultation`, `documents.interconsultForms[]`, `documents.interconsultReports[]`, `legalReadiness.hcu007Status`, `legalReadiness.hcu007ReportStatus` | Parcial: emision/cancelacion e informe recibido implementados; siguen diferidos portal externo y firma avanzada |
| `SNS-MSP/HCU-form.010A/2008` Solicitud de laboratorio clinico | Instructivo MSP 2020, anexo 10 | Aplicable cuando el caso requiere examenes de laboratorio | `labOrders[]`, `activeLabOrder`, `documents.labOrders`, `legalReadiness.hcu010AStatus` | Parcial: emision/cancelacion y bloqueo clinico cuando la orden requerida no ha sido emitida; siguen diferidos integracion externa, firma avanzada y PDF literal |
| `SNS-MSP/HCU-form.012A/2008` Solicitud de imagenologia | Instructivo MSP 2020, anexo 11 | Aplicable cuando el caso requiere imagenologia | `imagingOrders[]`, `activeImagingOrder`, `documents.imagingOrders[]`, `documents.imagingReports[]`, `legalReadiness.hcu012AStatus`, `legalReadiness.hcu012AReportStatus` | Parcial: emision/cancelacion, resultado radiologico recibido y bloqueo clinico cuando la orden requerida no ha sido emitida; siguen diferidos integracion externa, firma avanzada y PDF literal |
| `SNS-MSP/HCU-form.024` Consentimiento informado | A.M. 5316 y su modelo de gestion | Obligatorio cuando el procedimiento lo requiere | `ConsentRecord`, `consentPackets`, `documents.consentForms`, `DisclosureLog`, `ClinicalApproval` | Parcial: atestacion estructurada V1, sin firma avanzada/biometrica |

## Lectura honesta del estado actual

### Cubierto en producto

- consentimiento como proceso y no checkbox;
- aceptacion, negativa y revocacion;
- trazabilidad de acceso, disclosure y copia certificada;
- aprobacion humana final defendible;
- panel de gobernanza documental en la cabina HCE;
- `Media Flow` fuera del workspace clinico.

### Parcial

- paridad completa de `HCU-form.001`;
- paridad completa de `HCU-form.005`;
- formulario oficial final de `HCU-form.024`, aun sin firma avanzada/biometrica ni replica PDF literal del MSP;
- politica de conservacion parametrizada por tipologia exacta;
- eliminacion formal del archivo pasivo y actas del comite de historia clinica.

### Pendiente

- portal externo y circuito federado para respuesta del consultado sobre `HCU-form.007`;
- integracion externa, viewer/circuito federado y soporte posterior a `HCU-form.012A`;
- catalogo hospitalario y de especialidades fuera del consultorio V1.

## Regla de cierre de Fase 0

Para el alcance `consultorio defendible V1`, Fase 0 se considera cerrada cuando:

- existe fuente oficial anexada del manual `A.M. 0457`;
- existe fuente oficial anexada del catalogo de formularios aplicables a V1;
- cada obligacion queda marcada como `cubierta`, `parcial`, `pendiente` o `fuera de alcance V1`;
- no se inventan campos "obligatorios MSP" que no esten trazados a fuente oficial o a una decision explicita de producto.

## Lo que no estamos afirmando

- No afirmamos cumplimiento integral de toda la red hospitalaria MSP.
- No afirmamos cierre del catalogo completo de especialidades.
- No afirmamos que `5 anos` sea la regla total de conservacion.
- No afirmamos paridad PDF/formulario exacta de todos los HCU-form existentes.
