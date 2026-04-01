## Sprint 37 — Infraestructura Clínica Profunda (Consulta Real)
**Owner:** `codex_backend` | **Prioridad:** LANZAMIENTO — sin esto el médico no puede trabajar con rigor legal.

> **Diagnóstico del capataz (2026-04-01):** El SOAP guarda `findings, procedures, plan` pero NO tiene
> `subjective` (relato del paciente), `objective` (examen físico estructurado), ni `assessment` (diagnóstico diferencial).
> La anamnesis no está conectada al SOAP. El médico dicta en el GPT pero los datos no se estructuran.
> El historial de evoluciones no tiene endpoint GET. Los resultados de lab se reciben pero no hay
> ingreso manual desde admin. El médico vive entre el GPT y el papel. Esto cambia aquí.

### 37.1 SOAP Clínico Completo (Requerimiento Legal Ecuador)

- [ ] **S37-01** `[M]` `[codex_backend]` SOAP 4 campos completos + validación — el endpoint `POST clinical-evolution` acepta `findings, procedures, plan` pero NO tiene `note_subjective` (relato del paciente = S del SOAP), `note_objective` (examen físico = O), `note_assessment` (diagnóstico diferencial = A). Añadir al payload y al JSONL: `soap.subjective` (motivo + historia de la enfermedad en palabras del paciente), `soap.objective` (examen físico: hallazgos, datos de vitales del día referenciados), `soap.assessment` (diagnóstico principal CIE-10 + diferencial en texto libre), `soap.plan` (tratamiento + seguimiento + indicaciones). Validación: si `type=soap` y cualquier campo SOAP está vacío → 400 con JSON `{ok:false, missing:["subjective"]}`. Verificable: `POST clinical-evolution` con `type:"soap", soap:{subjective:"", objective:"x", assessment:"L20.0", plan:"y"}` → `{ok:false, missing:["subjective"]}`.

- [ ] **S37-02** `[M]` `[codex_backend]` Anamnesis estructurada conectada al SOAP — hoy los antecedentes (personales, familiares, alergias, medicamentos, hábitos) viven en campos sueltos del intake. Crear endpoint `POST clinical-anamnesis` con body estructurado: `{caseId, sessionId, motivo_consulta, enfermedad_actual, antecedentes_personales:[{type,detail}], antecedentes_familiares:[{type,detail}], medicamentos_actuales:[{name,dose,frequency}], alergias:[{allergen,reaction,severity:"leve"|"moderada"|"severa"}], habitos:{tabaco_cigarrillos_dia, alcohol_drinks_week, ejercicio_freq, exposicion_solar}}`. Guardar en `draft.intake.structured_anamnesis`. Cuando el GPT llama `openclaw-patient`, debe incluir `structured_anamnesis` en el contexto enviado. Verificable: `POST clinical-anamnesis` con caseId → `{ok:true}`; luego `GET openclaw-patient?patient_id=X` → response incluye `structured_anamnesis` en el contexto clínico.

- [ ] **S37-03** `[S]` `[codex_backend]` Historial de evoluciones por caso — `GET /api.php?resource=clinical-evolution?caseId={id}&limit=10&offset=0` no existe. Sin esto el médico no puede ver las notas previas del mismo paciente. Leer del JSONL `data/cases/{id}/evolutions.jsonl`, parsear línea por línea, devolver array ordenado por fecha DESC con paginación. Si el archivo no existe → `{ok:true, evolutions:[], total:0}`. Verificable: después de guardar 2 evoluciones con `POST clinical-evolution` → `GET clinical-evolution?caseId=X` → `{evolutions:[...], total:2}`.

- [ ] **S37-04** `[M]` `[codex_backend]` Prescripción con campos estructurados y validación de completitud — `openclaw-prescription` guarda medicamentos pero no valida campos mínimos de seguridad. Cada ítem de prescripción debe tener `{name, dose_amount, dose_unit:"mg"|"ml"|"UI"|"g"|"mcg"|"%", frequency_hours:int, duration_days:int, route:"oral"|"IM"|"IV"|"topico"|"inhalado"|"sublingual", instructions}`. Si faltan → 400 con `{ok:false, validation_errors:[{field:"dose_amount", item_index:0}]}`. Si el medicamento coincide con `data/controlled-substances.json` → requerir campo adicional `justification` o 422. Verificable: `POST openclaw-prescription` sin `dose_amount` en el primer item → `{ok:false, validation_errors:[{field:"dose_amount", item_index:0}]}`.

### 37.2 Resultados de Laboratorio e Imágenes (Admin Manual)

- [ ] **S37-05** `[M]` `[codex_backend]` Resultado de lab: ingreso manual desde admin — el médico recibe el papel del laboratorio y no puede cargarlo. `POST receive-lab-result` existe pero no tiene validación completa ni trigger de alerta crítica. Añadir: (1) validación de `session_id` activa, (2) para cada valor con `status:"critical"` → llamar inmediatamente a `bin/notify-lab-critical.php` con guard de `realpath`, (3) marcar en el sesión `has_critical_lab_pending:true` visible para el médico en el doctor-dashboard. Registrar en `data/hce-access-log.jsonl` con `action:"lab_result_received"`. Verificable: `POST receive-lab-result` con `values:[{status:"critical"}]` → `{ok:true, alert_triggered:true}` y entrada en `data/hce-access-log.jsonl`.

- [ ] **S37-06** `[S]` `[codex_backend]` Resultado de lab: control de visibilidad para el paciente — hoy todos los resultados son visibles en el portal del paciente (`patient-portal-labs`). Añadir campo `shared_with_patient: bool` (default `false`) al resultado de lab. Solo los marcados `true` aparecen en el portal. El médico puede marcar via `POST admin-lab-result-share` con `{session_id, lab_order_id, shared:true}`. Verificable: lab con `shared:false` → `GET patient-portal-labs` no lo muestra; `POST admin-lab-result-share` → `shared:true` → sí aparece.

- [ ] **S37-07** `[M]` `[codex_backend]` Orden de imagen: recepción de informe completo — existe `create-imaging-order` y `issue-imaging-order` pero falta `receive-imaging-result` como endpoint standalone con todos los campos: `{session_id, order_id, type:"rx"|"eco"|"tac"|"rm", findings, impression, radiologist_name, study_date, file_base64}`. Si se envía `file_base64` del PDF del informe, guardar en `data/imaging/{order_id}.pdf` con permisos 0640. Indexar en el draft. Verificable: `POST receive-imaging-result` con `order_id` existente → `{ok:true}`; `GET clinical-history?caseId=X` → incluye `imaging_results` con el hallazgo y la impresión.

### 37.3 Seguimiento Clínico Post-Consulta

- [ ] **S37-08** `[M]` `[codex_backend]` Control programado desde la evolución SOAP — al cerrar un SOAP con `plan` que menciona la palabra "control en X días", el sistema debe extraer el número y crear automáticamente un `pending_followup` con `{caseId, evolutionId, days_from_now:X, reason, appointment_type:"control"}`. Si ya existe un control programado para ese caso en los próximos 30 días → devolver `{ok:true, existing_followup:{id,date}, new_followup_skipped:true}` para no duplicar. Verificable: `POST clinical-evolution` con `soap.plan:"control en 14 días"` → `store.pending_followups` tiene nueva entrada con `days_from_now:14` y `source:"soap_plan"`.

- [ ] **S37-09** `[S]` `[codex_backend]` Panel de crónicos enriquecido — `bin/check-chronic-followup.php` hoy solo loguea. Extender: cuando detecta crónico sin visita en >60 días, insertar en `store.pending_reactivations[]` con `{patientId, caseId, last_visit_date, chronic_diagnosis, days_since_visit, contact_next_step:"whatsapp"|"call"|"email"}`. El doctor-dashboard lee este array para mostrar la lista operativa. Verificable: `php bin/check-chronic-followup.php --dry-run --json` → JSON con lista de pacientes, sus días sin visita, y el diagnóstico crónico registrado.

### 37.4 Integridad y Auditoría Clínica

- [ ] **S37-10** `[M]` `[codex_backend]` Hash de integridad en evoluciones JSONL — `data/cases/{id}/evolutions.jsonl` puede ser editado manualmente. Al guardar cada registro, añadir `integrityHash: sha256(json_encode(record_sin_hash))`. Al leer via `GET clinical-evolution`, verificar: si `sha256(record sin el campo integrityHash) !== record.integrityHash` → marcar `tampered:true` en esa entrada. Loguear en `data/hce-access-log.jsonl` con `action:"integrity_violation"`. Verificable: editar manualmente una línea del JSONL → `GET clinical-evolution?caseId=X` → esa entrada tiene `tampered:true`.

- [ ] **S37-11** `[S]` `[codex_backend]` Audit log de acceso a evoluciones — extender el log que ya existe para `GET openclaw-patient` para que también cubra: `GET clinical-evolution` (`action:"read_evolution"`), `GET clinical-history` (`action:"read_history"`), `POST clinical-anamnesis` (`action:"write_anamnesis"`). Crear endpoint `GET hce-audit-log?caseId=X&limit=20` solo para doctores autenticados. Verificable: 3 llamadas a `GET clinical-evolution?caseId=X` → `GET hce-audit-log?caseId=X` → ≥3 entradas con `action:"read_evolution"`.

---

## Sprint 38 — UI Clínica Rigurosa (Panel del Médico)
**Owner:** `[UI]` `codex_frontend` | **Prioridad:** ALTA — el médico usa esto 8 horas diarias.

> **Diagnóstico del capataz (2026-04-01):** El admin tiene componentes Liquid Glass premium. Pero el flujo de trabajo
> del médico en consulta está fragmentado. El SOAP es un single textarea — no guía al médico por los 4 pasos.
> La prescripción no tiene campos individuales de dosis (el médico escribe "ibuprofeno 400mg c/8h" en texto libre).
> La anamnesis no tiene campos específicos de alergias+medicamentos. El médico va al GPT porque la UI no lo guía.
> Hay componentes glass pero no hay flujo. Este sprint conecta todo.

### 38.1 Formulario SOAP Estructurado (4 Paneles)

- [ ] **S38-01** `[XL]` `[UI]` `[codex_frontend]` SOAP form 4 paneles en HCE — en `src/apps/admin-v3/sections/clinical-history/`, **reemplazar el textarea único** de "nota de evolución" por 4 paneles colapsables glass con indicador de completitud (🔴 vacío → 🟢 completo):
  **Panel S — Subjetivo:** textarea grande, placeholder "Motivo de consulta y relato en palabras del paciente". Counter de palabras recomendado: mínimo 30.
  **Panel O — Objetivo:** grid 2col: campos numéricos para TA sistólica/diastólica (mmHg), FC (bpm), FR (rpm), Temp (°C), SpO2 (%), Peso (kg), IMC (calculado auto). Más textarea "Examen físico por sistemas".
  **Panel A — Assessment:** campo CIE-10 con el `CIE10Search` (ya existe `js/cie10-search.js`) + diagnóstico diferencial como lista dinámica (añadir/quitar items).
  **Panel P — Plan:** textarea con categorías togglables: "Medicamentos", "Indicaciones de reposo", "Próximo control en X días", "Derivación a especialista".
  Al guardar → llama `POST clinical-evolution` con `type:"soap"` y el SOAP estructurado. Verificable: `grep "soap-panel\|soap-subjective\|soap-objective\|soap-assessment\|soap-plan" src/apps/admin-v3/sections/clinical-history/render/index.js` → ≥4 matches; abrir un caso en admin → 4 paneles visibles con indicadores de completitud.

- [ ] **S38-02** `[L]` `[UI]` `[codex_frontend]` Formulario de anamnesis estructurado — pestaña "Anamnesis" en la HCE con 5 secciones glass:
  **(1) Antecedentes personales:** lista expandible con tipos predefinidos (DM, HTA, IAM, asma, depresión, cáncer de piel, etc.) + descripción libre texto.
  **(2) Antecedentes familiares:** mismo patrón con relación de parentesco.
  **(3) Alergias:** tabla editable — columnas: Alérgeno | Reacción | Severidad (leve🟡/moderada🟠/severa🔴). Botón "+" para agregar. Badge count en la pestaña.
  **(4) Medicamentos actuales:** tabla — Nombre | Dosis | Frecuencia | Duración. Misma estructura que S38-03.
  **(5) Hábitos:** toggles + cuantitativos — cigarrillos/día, unidades alcohol/semana, min ejercicio/semana, exposición solar (estima).
  Guardar → `POST clinical-anamnesis`. Verificable: `grep "anamnesis-form\|antecedentes-section\|alergias-table\|medicamentos-table" src/apps/admin-v3/sections/clinical-history/` → ≥4 matches; guardar anamnesis → `POST clinical-anamnesis` recibe `structured_anamnesis` con el JSON completo.

- [ ] **S38-03** `[L]` `[UI]` `[codex_frontend]` Prescripción con dosificador estructurado — reemplazar el textarea libre de receta por items estructurados. Por cada medicamento: `[Campo nombre con autocompletado]` + `[Dosis: número]` + `[Unidad: mg/ml/UI/g/%]` + `[Vía: select]` + `[Frecuencia: cada N horas]` + `[Duración: N días]` + `[Instrucciones especiales: textarea pequeño]`. Botón "Agregar medicamento" añade un item nuevo. Preview de la receta a la derecha en tiempo real (formato documento con membrete). Envío llama `POST openclaw-prescription` con items estructurados del S37-04. Verificable: `grep "prescription-item\|dose-input\|frequency-select\|duration-days\|route-select" src/apps/admin-v3/sections/clinical-history/render/render-documents.js` → ≥4 matches.

### 38.2 Resultados de Laboratorio con Semáforo

- [ ] **S38-04** `[L]` `[UI]` `[codex_frontend]` Tabla de resultados de lab — pestaña "Laboratorio" en la HCE del admin. Tabla con columnas: Prueba | Resultado | Unidad | Referencia | Estado (🟢/🟡/🔴). Filtros: "Solo críticos", "Pendientes resultado", "Con resultado". Cada fila tiene toggle "Compartir con paciente" → llama `POST admin-lab-result-share`. Un resultado crítico sin revisar muestra banner amber pulsante en la cabecera del caso. Boton "Ingresar resultado" que abre el drawer de S38-05. Verificable: `grep "lab-result-row\|lab-critical-banner\|share-lab-toggle\|lab-filter" src/apps/admin-v3/sections/clinical-history/` → ≥4 matches.

- [ ] **S38-05** `[M]` `[UI]` `[codex_frontend]` Drawer de ingreso manual de resultado de lab — botón "Ingresar resultado" abre panel lateral glass derecho con: selección de la orden existente (dropdown), campos de valor+unidad+valor-de-referencia, toggle de estado (normal/elevado/crítico), textarea notas, toggle "Compartir con paciente ahora". Al guardar llama `POST receive-lab-result`. Si el estado es crítico → toast rojo con sonido (Audio API: `new Audio('sfx/alert-critical.mp3').play()`) + el banner en S38-04. Verificable: `grep "lab-manual-drawer\|critical-alert-sound\|lab-result-submit" src/apps/admin-v3/sections/clinical-history/` → ≥3 matches.

### 38.3 Timeline Clínica por Tipo de Evento

- [ ] **S38-06** `[XL]` `[UI]` `[codex_frontend]` Timeline cronológica de alta densidad — reemplazar la vista plana de eventos del paciente por un timeline vertical ordenado por fecha con íconos por tipo:
  🩺 Consulta presencial | 💊 Receta emitida | 📋 Certificado | 🧪 Laboratorio | 📷 Foto clínica | 📞 Teleconsulta | ⚠️ Resultado crítico.
  Al hacer click en cualquier evento → el item se expande con el detalle completo: para una consulta, muestra los 4 paneles SOAP colapsables con los datos guardados. Para una receta, muestra los ítems estructurados. Indicador visual de "tiempo entre visitas" como espaciado proporcional entre nodos o pill "32 días". Verificable: `grep "timeline-event-type\|timeline-expand\|soap-in-timeline\|time-between-visits" src/apps/admin-v3/sections/clinical-history/render/render-timeline.js` → ≥3 matches.

### 38.4 Checklist de Consulta (Guía al Médico)

- [ ] **S38-07** `[M]` `[UI]` `[codex_frontend]` Barra de progreso de la consulta — en la cabecera del caso activo (componente `UI5-02` sticky), añadir una fila de progreso con 5 steps: `[✓/○ Anamnesis] [✓/○ Signos vitales] [✓/○ SOAP] [✓/○ Prescripción] [✓/○ Cierre]`. Estado leído del draft current: si `draft.intake.structured_anamnesis` → ✓ Anamnesis. Si `draft.intake.vitalSigns.heartRate > 0` → ✓ Vitales. Si la sesión tiene evolución type:soap con los 4 campos → ✓ SOAP. Cada step hace click → scroll suave al formulario correspondiente. Verificable: `grep "consultation-progress\|progress-step\|step-anamnesis\|step-soap" src/apps/admin-v3/sections/clinical-history/render/index.js` → ≥4 matches.

- [ ] **S38-08** `[M]` `[UI]` `[codex_frontend]` Alerta de consulta incompleta al cerrar — cuando el médico intenta cerrar un caso (botón "Cerrar consulta") sin haber guardado una nota SOAP, mostrar modal glass de confirmación: "Esta consulta no tiene nota de evolución SOAP. ¿Deseas agregar una nota mínima antes de cerrar? (Requerido por el MSP Ecuador)" — 3 opciones: "Agregar nota SOAP", "Cerrar como nota libre", "Cancelar". Si cierra sin SOAP → marcar el caso con `evolution_missing:true` en el store. En el listado de casos de la agenda, un ícono ambar ⚠️ indica casos sin SOAP. Verificable: `grep "evolution-missing\|close-without-soap\|soap-required-modal" src/apps/admin-v3/sections/clinical-history/render/index.js` → ≥2 matches.

### 38.5 Teleconsulta Funcional en la UI

- [ ] **S38-09** `[L]` `[UI]` `[codex_frontend]` Vista de teleconsulta integrada — `es/telemedicina/consulta/index.html` existe pero sin funcionalidad real. Implementar:
  **(1) Sala de espera del médico:** nombre del paciente, foto si existe, diagnóstico previo, tiempo en espera.
  **(2) Sala de consulta:** iframe de Jitsi Meet con `room = roomId del appointment` desde `api.php?resource=telemedicine-room`. Panel lateral derecho con: anamnesis previa, vitales auto-reportados del paciente, botón "Subir foto diagnóstica" que llama `POST patient-portal-photo-upload`.
  **(3) Cierre de teleconsulta:** botón "Finalizar consulta" → abre el formulario SOAP de S38-01 inline. Al guardar → llama `POST openclaw-close-telemedicine`. Verificable: `grep "jitsi-frame\|tele-hce-panel\|foto-upload-teleconsulta\|close-tele-soap" es/telemedicina/consulta/index.html` → ≥4 matches.
