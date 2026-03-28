# FlowOS HCE Ecuador Foundation

## Proposito
Re-fundar la historia clinica de FlowOS como una **HCE defendible para consultorio privado en Ecuador**, separando por completo el producto clinico de cualquier semantica editorial o de `Media Flow`.

## Tesis del producto
FlowOS HCE Ecuador no es un chat medico.
Es una **Historia Clinica Unica longitudinal** con:

- expediente unico por paciente;
- episodios clinicos enlazados al caso operativo de FlowOS;
- cabina clinica IA como interfaz principal;
- nota viva estructurada;
- cierre medico-legal defendible.

Principio rector:

**entrada libre, salida normativa ecuatoriana**

## Base normativa oficial ya adoptada

### Acuerdo Ministerial 5216-A
Fuente oficial MSP:
`https://www.salud.gob.ec/wp-content/uploads/2021/09/Acuerdo-Ministerial-5216.pdf`

Esta re-fundacion asume como obligatorios, desde el dia 0, estos principios:

- la historia clinica es unica, tecnico-legal, obligatoria y confidencial;
- la redaccion debe ser precisa, comprensible y completa;
- los datos clinicos deben manejarse con separacion o acceso restringido respecto de datos identificativos;
- debe existir trazabilidad de uso de la informacion: lectura, edicion, exportacion, copia y entrega;
- el archivo electronico debe operar con claves personales y acceso por personal autorizado;
- debe existir archivo activo/pasivo con conservacion parametrizada por tipologia de unidad; para unidades de menor complejidad, el manual oficial trabaja sobre `5 anos activo + 5 anos pasivo`;
- debe existir solicitud y entrega de copia certificada con SLA de 48 horas;
- la documentacion y las salidas deben tratarse como `CONFIDENCIAL`;
- deben existir mecanismos reforzados para proteger identidad en casos sensibles.

### Acuerdo Ministerial 5316
Fuente oficial MSP:
`https://www.salud.gob.ec/wp-content/uploads/2022/09/A.M.5316-Consentimiento-Informado_-AM-5316.pdf`

Esta re-fundacion asume como obligatorios, desde el dia 0, estos principios:

- el consentimiento informado es proceso de comunicacion y deliberacion, no checkbox;
- deben modelarse aceptacion, negativa y revocacion;
- debe registrarse quien informo, cuando, que se explico, riesgos, alternativas y capacidad para decidir;
- debe existir autorizacion explicita cuando se comparta informacion con acompanantes;
- la comunicacion debe poder registrarse como realizada en entorno privado.

## Cierre documental de Fase 0 para consultorio V1
La dependencia de fuentes oficiales ya no esta abierta para el alcance `consultorio defendible V1`.
Ya quedaron anexadas:

- el manual oficial de archivo/custodia asociado al `A.M. 0457`;
- el Registro Oficial que aprueba y difunde ese manual;
- el instructivo MSP 2020 que enumera formularios HCU aplicables al consultorio base;
- `A.M. 5316` para consentimiento informado.

Fuentes base anexadas:

- `A.M. 0457` / Manual de Normas de Conservacion de las Historias Clinicas y aplicacion del Tarjetero Indice Automatizado;
- instructivo oficial MSP de octubre 2020;
- `A.M. 5316`.

La dependencia que sigue abierta ya no es de **fuente**, sino de **implementacion**:

- paridad total de formularios HCU en producto;
- parametrizacion de conservacion por tipologia exacta de unidad;
- catalogo hospitalario y de especialidades fuera del consultorio V1.

Regla operativa:

**no se inventan campos normativos obligatorios fuera de fuente oficial o decision de producto explicitamente marcada.**

Mientras siga abierta la brecha de implementacion:

- no se declara cumplimiento integral de toda la red hospitalaria MSP;
- los formularios no cubiertos deben quedar marcados como `parcial` o `pendiente`;
- cualquier checklist adicional debe marcarse como `decision de producto`, no como formulario MSP ya cerrado.

## Formularios HCU oficialmente confirmados para esta base

Por fuente oficial MSP ya podemos tomar como confirmados para la base de producto:

- `SNS-MSP/HCU-form.001/2008`: admision;
- `SNS-MSP/HCU-form.005/2008`: evolucion y prescripciones;
- `SNS-MSP/HCU-form.007/2008`: interconsulta;
- `SNS-MSP/HCU-form.024`: consentimiento informado.

Para el alcance `consultorio defendible V1`, el catalogo base deja de estar “a ciegas”.
Lo que sigue pendiente es llevar esos formularios a paridad documental completa donde aplique.

## Decisiones de producto

### 1. `Media Flow` sale de HCE
`Media Flow` deja de compartir workspace con historia clinica.
Se preserva como modulo dormido o producto aparte, pero no participa del cockpit clinico ni del cierre medico-legal.

### 2. Unidad canonica

- 1 paciente = 1 historia clinica unica longitudinal
- cada atencion = 1 episodio/encuentro dentro del expediente
- cada `patientCase` de FlowOS debe apuntar al episodio clinico activo o al mas relevante

### 3. Cobertura V1

- consultorio privado defendible
- adulto ambulatorio general
- dermatologia entra como overlay posterior sobre este nucleo

### 4. UX canonica

- banda superior: paciente + episodio activo + estado legal
- centro: cabina clinica IA
- lateral: nota viva estructurada
- rail de salida: receta, certificado, consentimiento y aprobacion final

### 5. Salidas minimas defendibles de V1

- nota clinica final
- receta / plan
- certificado

## Modelo canonico

### Capa operativa FlowOS

- `patientCase`
- journey
- tareas
- follow-up
- contexto operativo del episodio activo

### Capa clinica HCE

- `PatientRecord/HCU`
- `ClinicalEpisode`
- `ClinicalEncounter`
- `LiveNoteDraft`
- `FinalClinicalNote`
- `Prescription`
- `MedicalCertificate`
- `ConsentRecord`
- `ClinicalApproval`
- `AccessAudit`
- `DisclosureLog`

## Regla fuerte de aprobacion
Aprobar no significa cambiar `reviewStatus`.
Aprobar significa cerrar una version clinica defendible con:

- `approvedBy`
- `approvedAt`
- `noteVersion`
- `checklistSnapshot`
- huella de sugerencias IA / estado IA reconciliado

La aprobacion debe bloquearse, como minimo, cuando exista cualquiera de estos estados:

- faltan datos clinicos minimos;
- consentimiento exigible incompleto o revocado;
- alerta clinica critica abierta;
- posologia ambigua con tratamiento propuesto;
- IA pendiente sin reconciliar.

## Guardrails del sistema

### Prohibido

- usar el chat como documento clinico final;
- cerrar automaticamente sin aprobacion humana;
- mezclar editorial/publicacion con la HCE;
- borrar la trazabilidad de acceso, cambios o sugerencias IA;
- afirmar que la HCE ya cubre toda la red MSP hospitalaria o todos los formularios de especialidad.

### Obligatorio

- mantener la historia clinica como documento final estructurado;
- preservar trazabilidad de acceso, exportacion, copia y entrega;
- distinguir borrador IA de documento final aprobado;
- registrar consentimiento como proceso, no como casilla aislada;
- tratar la documentacion como confidencial por diseno.

## Fases de entrega

### Fase 0
Matriz normativa oficial trazable de Ecuador.

Estado actual:

- fuentes oficiales cerradas para `A.M. 0457`, formularios consultorio V1 y `A.M. 5316`;
- brecha remanente: implementacion parcial/pending por formulario.

### Fase 1
Dominio HCE nuevo + puente legacy desde `clinical-history-review`.

### Fase 2
Cabina clinica `chat + nota viva`.

### Fase 3
Receta, certificado, consentimiento y aprobacion defendible.

### Fase 4
Archivo, copias certificadas, auditoria de acceso y readiness legal de cola.
