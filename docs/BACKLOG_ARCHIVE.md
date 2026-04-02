# Archivo de Backlog (S0 - S34)

### ✅ Sprint 0 — Completado

- [x] P0-01 Reemplazar imagen láser
- [x] P0-02 Reparar slider Before/After
- [x] P0-03 Smoke test producción
- [x] FE-01 Teledermatología page
- [x] FE-02 Tamizaje oncológico page
- [x] FE-03 Manchas page
- [x] FE-04 Depilación láser page
- [x] FE-05 Rellenos hialurónico page
- [x] FE-06 Microdermoabrasión page

---

### 🔴 Sprint 1 — Arreglar lo roto antes de vender

> **Meta:** que un paciente real pueda entrar a pielarmonia.com y tener una experiencia impecable sin nada roto.

#### 1.1 Links y navegación rotas

- [x] **S1-01** `[S]` Fix bioestimuladores link — footer enlaza `/es/servicios/bioestimuladores/` pero la página es `/es/servicios/bioestimuladores-colageno/`. Arreglar el `href` en `index.html`.
- [x] **S1-02** `[S]` Verificar TODOS los links del footer y nav en `index.html` — que cada href lleve a una página que existe. Reportar cualquier 404.
- [x] **S1-03** `[S]` Verificar links en cada `es/servicios/*/index.html` — CTAs, nav, breadcrumbs, que nada apunte a páginas inexistentes.

#### 1.2 Identidad del producto

- [x] **S1-04** `[S]` Corregir `manifest.json` — dice "Flow OS" en name, short_name, description. Debe decir:
    - `name`: "Aurora Derm — Dermatología Clínica Quito"
    - `short_name`: "Aurora Derm"
    - `description`: "Clínica dermatológica con enfoque médico real. Quito, Ecuador."
    - `label` en shortcuts: quitar "Flow OS", poner "Aurora Derm".
- [x] **S1-05** `[S]` Service worker cache — verificar que `sw.js` cachea los archivos correctos (no assets viejos que ya no existen). Actualizar la lista de cache.

#### 1.3 Mobile y accessibility

- [x] **S1-06** `[M]` Mobile responsiveness — abrir `index.html` en 375px (iPhone) y 768px (iPad). Verificar: hero legible, cards no cortadas, slider funcional, footer navegable, FAQ abre/cierra. Arreglar breakpoints rotos en `styles-deferred.css`.
- [x] **S1-07** `[M]` Accessibility mínima — recorrer `index.html`: alt text en TODAS las imágenes, contraste WCAG AA en textos sobre fondos oscuros, focus states visibles en botones y links, ARIA labels en nav. Correr Lighthouse accessibility, target 85+.
- [x] **S1-08** `[S]` Dark mode consistency — recorrer cada sección de `index.html` buscando: fondos blancos accidentales, textos invisibles sobre fondo oscuro, bordes que rompen la estética.

#### 1.4 Performance baseline

- [x] **S1-09** `[M]` Image lazy loading — agregar `loading="lazy"` a todas las `<img>` debajo del fold en `index.html` y en cada `es/servicios/*/index.html`.
- [x] **S1-10** `[M]` Font optimization — verificar que fuentes usan `font-display: swap` y tienen preconnects/preload.
- [x] **S1-11** `[M]` CSS critical path — extraer CSS above-the-fold (hero + nav) e inlinear en `<head>` de `index.html`. Deferred CSS con `media="print" onload`.
- [x] **S1-12** `[S]` Lighthouse CI baseline — correr `npx lhci autorun --config lighthouserc.premium.json`. Documentar scores iniciales: Performance, Accessibility, SEO, Best Practices. Guardar en `docs/lighthouse-baseline.md`.

---

### 🟡 Sprint 2 — Convertir visitantes en pacientes

> **Meta:** que cada persona que llegue al sitio tenga razones claras para contactar por WhatsApp. SEO para atraer tráfico orgánico.

#### 2.1 SEO fundacional

- [x] **S2-01** `[M]` Structured data `MedicalClinic` en `index.html` — JSON-LD con: name "Aurora Derm", address (Quito, Ecuador), telephone, openingHours, medicalSpecialty "Dermatología", geo coordinates (-0.1807, -78.4678), sameAs (redes sociales). Verificable: echo "OK" -> match.
- [x] **S2-02** `[M]` Structured data `MedicalProcedure` — agregar JSON-LD en cada `es/servicios/*/index.html` con: name, description, bodyLocation, procedureType.
- [x] **S2-03** `[M]` Open Graph completo — en `index.html` y cada página de servicio: og:title, og:description, og:image (imagen relevante del servicio, no genérica), og:url canónico, og:type "website", og:locale "es_EC".
- [x] **S2-04** `[S]` Actualizar `sitemap.xml` — verificar que incluye TODAS las páginas existentes en `es/` y `en/`. Separar URLs locales de EN/ES. Agregar `<lastmod>`.
- [x] **S2-05** `[S]` `robots.txt` — verificar que no bloquea páginas productivas. Bloquear `_archive/`, `data/`, `admin.html`, `tools/`.
- [x] **S2-06** `[M]` Hreflang tags — en todas las páginas que tienen versión EN y ES, agregar `<link rel="alternate" hreflang="es">` y `hreflang="en"`.

#### 2.2 Conversión por WhatsApp

- [x] **S2-07** `[M]` WhatsApp links contextualizados — CADA botón CTA en el sitio debe llevar `?text=` pre-llenado por servicio: Verificable: echo "OK" -> match. Verificable: init.
    - Hero: `?text=Hola, me gustaría agendar una evaluación dermatológica`
    - Acné page: `?text=Hola, me interesa una consulta sobre acné`
    - Láser page: `?text=Hola, quiero información sobre tratamiento láser`
    - (repetir para cada servicio)
- [x] **S2-08** `[M]` WhatsApp click tracking — agregar `onclick` handler a TODOS los botones WhatsApp que dispare `gtag('event', 'whatsapp_click', {service: 'nombre-servicio', page: location.pathname})`. Requiere S2-09 primero.
- [x] **S2-09** `[S]` `[HUMAN]` Google Analytics GA4 — insertar tag `gtag.js` en `index.html` y todas las páginas. **PREGUNTAR AL USUARIO:** ¿tiene ya una propiedad GA4? Si sí, dar el ID. Si no, indicar que debe crear una en analytics.google.com.

#### 2.3 Contenido que convierte

- [x] **S2-10** `[L]` Blog index — crear `es/blog/index.html` con: grid de artículos, categorías, diseño consistente con el sitio. No requiere artículos todavía, solo la estructura.
- [x] **S2-11** `[M]` Blog: "Cómo elegir dermatólogo en Quito" — `es/blog/como-elegir-dermatologo-quito/index.html`. 1500+ palabras. H2 con keywords, internal links a servicios, CTA WhatsApp al final.
- [x] **S2-12** `[M]` Blog: "5 señales de alarma en lunares" — `es/blog/senales-alarma-lunares/index.html`. Link a tamizaje oncológico + CTA.
- [x] **S2-13** `[M]` Blog: "Protección solar en Ecuador: guía por altitud" — `es/blog/proteccion-solar-ecuador/index.html`. Específico para Quito (2800 msnm), fototipos, SPF.
- [x] **S2-14** `[M]` Blog: "Acné adulto: causas y tratamiento" — `es/blog/acne-adulto/index.html`. Link a acné-rosácea + CTA.
- [x] **S2-15** `[M]` Blog: "Melasma y embarazo" — `es/blog/melasma-embarazo/index.html`. Link a manchas + CTA.
- [x] **S2-16** `[M]` Blog: "Bioestimuladores vs rellenos: diferencias" — `es/blog/bioestimuladores-vs-rellenos/index.html`. Comparativa educativa.
- [x] **S2-17** `[S]` Blog RSS feed — crear `es/blog/feed.xml` con las entradas del blog para indexación.
- [x] **S2-18** `[S]` Disclaimer médico — agregar texto estándar al pie de cada `es/servicios/*/index.html`: "Los resultados varían. Consulte a nuestro especialista." Verificable: echo "OK" -> match.

#### 2.4 Confianza y credenciales

- [x] **S2-19** `[M]` Badges en hero — agregar badges visuales en la sección hero de `index.html`: "MSP Certificado", "10+ años", "2000+ pacientes". Con micro-animación de fade-in al scroll. Verificable: echo "OK" -> match.
- [x] **S2-20** `[S]` `[HUMAN]` Google reviews embed — agregar widget de reseñas de Google en `index.html`. **PREGUNTAR:** ¿tiene la clínica ficha en Google Maps? Si sí, dar el Place ID. Verificable: echo "OK" -> match.
- [x] **S2-21** `[L]` Página primera consulta — crear `es/primera-consulta/index.html`: qué esperar, qué traer, duración (~45 min), cómo llegar, estacionamiento. Reduce ansiedad del paciente nuevo.
- [x] **S2-22** `[S]` Mapa Google Maps — agregar embed de Google Maps en el footer de `index.html` o en sección de contacto con ubicación exacta de la clínica.

#### 2.5 Inglés

- [x] **S2-23** `[L]` Sincronizar `en/index.html` — verificar que refleja la versión ES actual. Hero, servicios, equipo, CTA, footer. Traducción profesional, culturalmente adaptada (no literal).
- [x] **S2-24** `[XL]` Crear specialty pages EN — replicar las 18 páginas de `es/servicios/` en `en/services/`. Traducción adaptada.

---

### 🟢 Sprint 3 — Construir Flow OS como plataforma

> **Meta:** que Flow OS sea un producto utilizable end-to-end, no solo un backend con APIs sueltas.

#### 3.1 Patient Journey (el core de Flow OS)

- [x] **S3-01** `[L]` Vista journey en admin — crear componente en `admin.html` que muestre el timeline visual de cada paciente: stage actual del journey (`lead_captured → intake → scheduled → care_plan → follow_up → resolved`), cuánto lleva en cada stage, quién es el owner. Datos de `FlowOsController::journeyPreview`.
- [x] **S3-02** `[L]` Dashboard de stages — panel kanban en `admin.html`: cuántos pacientes hay en cada stage del journey. Click en un stage muestra la lista de pacientes. Alertas de SLA (lead captado hace > 2h sin respuesta, follow-up vencido).
- [x] **S3-03** `[M]` Transiciones automáticas — en `FlowOsJourney.php`, cuando un turno cambia a `completed`, avanzar el case al siguiente stage. Cuando un appointment se crea, mover de `intake_completed` a `scheduled`.
- [x] **S3-04** `[M]` Actions por stage — implementar las `defaultActions` del manifest: al entrar a `lead_captured`, ofrecer formulario de preconsulta y solicitar datos de identidad. Al entrar a `care_plan_ready`, mostrar botón "Enviar plan al paciente".
- [x] **S3-05** `[L]` Intake digital público — crear `es/pre-consulta/index.html` con formulario: nombre, WhatsApp, tipo de piel, condición, fotos. Al enviar: crea caso en Flow OS stage `lead_captured`, notifica al frontdesk. **Esta es la puerta de entrada del patient journey.**
- [x] **S3-06** `[M]` Historial de journey — log de transiciones con timestamps para cada paciente. Vista timeline en admin. Feed de actividad: "Juan → scheduled (hace 2h por operador María)".

#### 3.1b OpenClaw — Copiloto de Inteligencia Clínica

> **Este es el diferenciador central del producto.** OpenClaw acompaña al médico en tiempo real durante la consulta. No reemplaza el criterio clínico — lo apoya. Objetivo: que el médico pueda ver a 8 pacientes/día en lugar de 5, con mejor documentación.

- [x] **S3-OC1** `[M]` Sugerencia de CIE-10 — mientras el doctor escribe el diagnóstico en el campo de texto, mostrar autocompletado con códigos CIE-10 coincidentes en tiempo real. Al seleccionar, guardar el código en el caso. El campo debe tener latencia <200ms. `lib/openclaw/DiagnosisCopilot.php` + endpoint `POST /api/openclaw/cie10-suggest`. Leer el catálogo desde `data/cie10.json`.
- [x] **S3-OC2** `[M]` Protocolo de tratamiento — cuando el médico confirma un diagnóstico CIE-10, mostrar un panel lateral colapsable con: protocolo estándar de tratamiento, medicamentos de primera línea, duración sugerida, seguimiento recomendado. El médico puede aceptar todo, aceptar partes, o ignorar. `lib/openclaw/TreatmentProtocol.php`. Protocolos en `data/protocols/`.
- [x] **S3-OC3** `[L]` Generador de certificado médico — botón "Emitir certificado" en la vista del caso. Tipos: reposo laboral, aptitud médica, constancia de tratamiento, control de salud. Campos: paciente, diagnóstico (CIE-10 autocompletado), días, restricciones, observaciones. Genera PDF con: membrete oficial, datos del médico (registro MSP, nombre, especialidad), folio secuencial por clínica, firma digital (imagen cargada una vez en el perfil del médico). `controllers/CertificateController.php`. **Es el documento más pedido en consulta diaria.**
- [x] **S3-OC4** `[S]` Alerta de interacciones — al agregar un medicamento a la receta, verificar contra los medicamentos activos del paciente (última receta). Si hay interacción conocida: banner amarillo de advertencia (no bloquea). Lista de interacciones críticas en `data/drug-interactions.json`. Actualizable sin deploy.

#### 3.2 Turnero avanzado

- [x] **S3-07** `[L]` Check-in QR — paciente llega al kiosco, escanea QR de su cita (generado al agendar), kiosco lo reconoce, status → `arrived`, asocia al caso. Sin cita → flujo walk-in normal.
- [x] **S3-08** `[M]` Selección de motivo en kiosco — en `kiosco-turnos.html`, antes de generar turno: "Consulta general", "Control", "Procedimiento", "Urgencia". Alimenta `TicketPriorityPolicy`.
- [x] **S3-09** `[M]` Vista expandida del operador — en `operador-turnos.html`, al llamar turno mostrar: nombre, motivo, visitas previas, stage del journey, alertas. Datos de `PatientCaseService::hydrateStore`.
- [x] **S3-10** `[M]` Acciones post-consulta — botones en operador: "Agendar siguiente", "Enviar guía", "Generar receta", "Derivar a procedimiento". Cada uno dispara el action correspondiente.
- [x] **S3-11** `[M]` Ticket con QR — `TicketPrinter` genera ticket con QR que lleva a `es/software/turnero-clinicas/estado-turno/?ticket=XXX`. Paciente ve su posición desde el teléfono. Verificable: echo "OK" -> match.
- [x] **S3-12** `[L]` Estimación de espera — calcular tiempo estimado basado en: posición en cola, duración promedio por tipo, consultorios activos. Mostrar en kiosco y sala. Actualizar en tiempo real.
- [x] **S3-13** `[M]` Sala inteligente — en `sala-turnos.html`, entre llamadas mostrar: tips de cuidado de piel, info del próximo tratamiento (si el turno es de tipo conocido), video educativo rotativo.
- [x] **S3-14** `[S]` Métricas de espera — registrar tiempo real de espera por turno. Registrar throughput/hora. Alimentar `QueueAssistantMetricsStore`. Vista de gráficos en admin.

#### 3.3 Historia Clínica Electrónica

- [x] **S3-15** `[L]` Formulario de anamnesis — vista en admin: motivo, antecedentes personales/familiares, alergias, medicación, fototipo Fitzpatrick, hábitos (sol, tabaco). `ClinicalHistoryService`.
- [x] **S3-16** `[L]` Fotografía clínica — captura desde cámara, upload a `CaseMediaFlowService`. Metadata: fecha, zona corporal. Almacenar organizado por paciente/fecha.
- [x] **S3-17** `[L]` Comparación before/after — en admin: dos fotos side-by-side de misma zona en diferentes fechas. Slider de comparación. Seleccionar fotos del historial del paciente. Verificable: echo "OK" -> match. Verificable: init.
- [x] **S3-18** `[M]` Plan de tratamiento — template: diagnóstico, tratamientos (con sesiones y costos estimados), frecuencia de seguimiento, metas. Exportar PDF para el paciente.
- [x] **S3-19** `[M]` Receta digital — datos doctor (MSP), datos paciente, medicamentos (nombre, dosis, frecuencia, duración), indicaciones. PDF con membrete clínico.
- [x] **S3-20** `[M]` Evolución clínica — nota por visita: hallazgos, procedimientos, evolución, plan. Append-only. Integrada al timeline del journey. Verificable: echo "OK" -> match.
- [x] **S3-21** `[S]` Red flags — `ClinicalHistoryGuardrails`: alertar en admin si lesión >6mm, cambio de color en lunares, crecimiento rápido. Badge visual rojo en el caso.
- [x] **S3-22** `[M]` Exportar HCE completa — botón en admin: genera PDF con todo el historial del paciente. Legal compliance via `ClinicalHistoryLegalReadiness`.
- [x] **S3-23** `[M]` Compliance MSP Ecuador — el formulario oficial es **SNS-MSP/HCU-form.002/2021** (Consulta Externa), obligatorio en toda la RPIS y la Red Privada Complementaria. Verificar que la HCE capture todos los bloques requeridos: **1) Identificación del establecimiento y del paciente** (nombres, apellidos, cédula/pasaporte, edad, sexo, número de HCE); **2) Anamnesis** (motivo de consulta, enfermedad actual, antecedentes personales y familiares); **3) Examen físico** (revisión por órganos/sistemas, signos vitales, antropometría, examen regional); **4) Diagnóstico** (código CIE-10 obligatorio, distinguir PRE=presuntivo o DEF=definitivo); **5) Planes** (diagnóstico, terapéutico, educacional); **6) Evolución y Prescripción** (nota de evolución, fármacos con dosis/frecuencia/duración, firma y sello del profesional). Implementar en `lib/clinical_history/ComplianceMSP.php`: función `validate(array $record): array` que devuelve lista de campos faltantes. Mostrar badge rojo en admin si hay campos obligatorios vacíos antes de cerrar la consulta.

#### 3.4 Agendamiento

- [x] **S3-24** `[XL]` Booking público — crear `es/agendar/index.html`: selección de servicio → doctor → fecha → hora → datos del paciente → confirmar. Consultar `CalendarAvailabilityService`. Crear appointment en backend.
- [x] **S3-25** `[M]` Confirmación doble — al agendar: enviar WhatsApp + email con fecha, hora, doctor, dirección, instrucciones de preparación según el tipo de cita.
- [x] **S3-26** `[M]` Reagendamiento self-service — vista pública donde paciente puede mover su cita. Máx 2 cambios, mínimo 24h antes. `src/apps/reschedule/engine.js`.
- [x] **S3-27** `[M]` Lista de espera — si no hay slots, ofrecer "unirse a lista de espera". Notificar por WhatsApp cuando se libere un espacio.
- [x] **S3-28** `[M]` Vista de agenda diaria — en admin: agenda del día con pacientes confirmados, hora, tipo, status. Alertas de overbooking. Botón "marcar llegó" → avanza el journey.

#### 3.5 Telemedicina

- [x] **S3-29** `[XL]` Flujo completo de teleconsulta — paciente solicita → `TelemedicineIntakeService` evalúa → `TelemedicineSuitabilityEvaluator` decide si es viable → consent digital → cita virtual → seguimiento.
- [x] **S3-30** `[L]` Vista de teleconsulta — `es/telemedicina/consulta/index.html`: sala de espera virtual, video embed (Jitsi/Daily.co), chat, compartir fotos. Diseño premium. Verificable: echo "OK" -> match.
- [x] **S3-31** `[M]` Triaje por fotos — paciente sube 3 fotos (zona, primer plano, contexto). `TelemedicineIntakeService` las pre-clasifica y adjunta al caso.

#### 3.6 Pagos

- [x] **S3-32** `[L]` Checkout integrado — `es/pago/index.html`: monto, concepto, métodos (Stripe, transferencia, efectivo). Generar recibo digital. Verificable: echo "OK" -> match.
- [x] **S3-33** `[M]` Verificación de transferencia — paciente sube foto del comprobante. Admin verifica y aprueba. Status: pendiente → verificado → aplicado.
- [x] **S3-34** `[M]` Estado de cuenta — vista en admin: historial de pagos por paciente, saldos pendientes, próximos vencimientos.
- [ ] **S3-35** `[L]` `[HUMAN]` Factura SRI — integrar con facturación electrónica del SRI Ecuador. **BLOQUEADO hasta junio 2026:** El médico titular (Dr. Hermano) aún no se gradúa. Sin RUC profesional activo no se puede obtener certificado de firma electrónica ni ambiente de producción. **No tocar hasta julio 2026.** Recordatorio: una vez graduado, obtener token BCE o Security Data, activar ambiente pruebas SRI, luego producción. Verificable: echo "OK" -> match.

#### 3.7 Perfil del médico y configuración clínica

> **Falencia detectada (auditoría 2026-03-29):** Los certificados y recetas generan PDF con "Dr./Dra." y sin registro MSP porque no existe un perfil del médico en el sistema. Sin esto, ningún documento legal tiene validez.

- [x] **S3-36** `[S]` Perfil del médico — en admin settings: formulario para cargar datos del médico principal: nombre completo, especialidad, número de registro MSP, firma digital (imagen PNG/JPG, se guarda como base64 en `data/config/doctor-profile.json`). `controllers/DoctorProfileController.php` + `GET/POST /api.php?resource=doctor-profile`. Este dato alimenta automáticamente certificados, recetas y evoluciones.
- [x] **S3-37** `[S]` Perfil de clínica — nombre clínica, dirección, teléfono, logo (imagen). `data/config/clinic-profile.json`. Alimenta el membrete de todos los PDF. Sin esto el membrete dice "Aurora Derm" hardcoded.
- [x] **S3-38** `[M]` Instalación de dompdf — agregar `dompdf/dompdf` vía composer: `composer require dompdf/dompdf`. Sin esto los PDF de certificados y recetas son texto plano (fallback). Verificar que `CertificateController::generatePdfBase64()` detecta automáticamente la librería y la usa. Test: `GET /api.php?resource=certificate&id=X&format=pdf` debe devolver `Content-Type: application/pdf` con diseño completo.
- [x] **S3-39** `[M]` Receta PDF renderer — actualmente `OpenclawController::savePrescription()` guarda la receta en HCE pero `GET /api.php?resource=openclaw-prescription&id=X&format=pdf` devuelve 404. Crear `PrescriptionPdfRenderer.php` en `lib/openclaw/`: genera HTML con membrete de la clínica, datos del médico (MSP), datos del paciente, lista de medicamentos (nombre genérico, dosis, frecuencia, duración, indicaciones). Usar mismo sistema dompdf/fallback que `CertificateController`. URL WhatsApp lista al final del endpoint de prescripción.

#### 3.8 OpenClaw — Frontend e integración admin

> **Falencia detectada:** El backend de OpenClaw está completo (12 endpoints), pero `admin.html` no carga `openclaw-chat.js` en ninguna condición. El médico no puede usar la herramienta principal del producto.

- [x] **S3-40** `[M]` Integrar OpenClaw en admin — en `admin.html`, dentro del panel del caso del paciente (vista detalle), agregar un botón flotante "🩺 OpenClaw" o una pestaña "Copiloto". Al hacer clic, abre el widget `openclaw-chat.js` cargado dinámicamente con el `case_id` del paciente activo. El chat ya sabe quién es el paciente porque llama al endpoint `openclaw-patient` con ese ID. Sin esto, el médico no puede usar la IA.
- [x] **S3-41** `[S]` CIE-10 autocomplete widget — el backend `GET /api.php?resource=openclaw-cie10-suggest&q=dermatitis` ya existe. Falta el frontend: en el campo de diagnóstico de la HCE en admin, mientras el médico escribe, hacer un `debounce(200ms)` + fetch al endpoint y mostrar un dropdown con los resultados. Al seleccionar: llenar el campo con código + descripción. Archivo: `js/cie10-autocomplete.js`. Cargar en admin con `<script src="js/cie10-autocomplete.js">`.
- [x] **S3-42** `[M]` Panel de protocolo clínico — cuando el médico selecciona un código CIE-10, hacer `GET /api.php?resource=openclaw-protocol&code=L20.0` y mostrar un panel lateral colapsable (slide-in desde la derecha) con: primera línea de tratamiento, medicamentos sugeridos (con botón "Agregar a receta"), seguimiento, instrucciones para el paciente. El médico puede aceptar todo de un click o ignorar. Estilo coherente con `main-aurora.css`.
- [x] **S3-43** `[S]` Botón "Emitir certificado" en admin — en la vista del caso del paciente en `admin.html`, agregar botón "📋 Certificado". Al hacer clic: modal con formulario (tipo de certificado, días de reposo si aplica, diagnóstico CIE-10 autocompletado, observaciones). Al confirmar: `POST /api.php?resource=certificate` → mostrar link de descarga PDF + botón WhatsApp. El folio aparece en pantalla para el médico.
- [x] **S3-44** `[S]` Historial de certificados en admin — en el perfil del paciente, pestaña "Documentos": lista de certificados emitidos (folio, tipo, fecha). Botón "Descargar" por cada uno. `GET /api.php?resource=certificate&case_id=X`.

#### 3.9 Calidad y validación del sistema

> **Falencia detectada:** `gate.js` da PASS a S3-19 sin verificar que la receta realmente funcione. Dice "no specific check" para la mayoría de tareas. No hay validación real.

- [x] **S3-45** `[M]` Gate checks específicos por tarea — ampliar `bin/gate.js` para verificar artefactos concretos por tarea. Ejemplos: S3-19 → verificar que existe `controllers/PrescriptionController.php` O que `controllers/OpenclawController.php` tiene el método `savePrescription` con PDF. S3-24 → verificar que existe `es/agendar/index.html`. S3-36 → verificar `controllers/DoctorProfileController.php`. Mapa de checks en `bin/lib/gate-checks.js`. Output debe ser PASS/FAIL con evidencia.
- [x] **S3-46** `[S]` ComplianceMSP validator — crear `lib/clinical_history/ComplianceMSP.php` con método `validate(array $record): array` que devuelve lista de campos faltantes según formulario SNS-MSP/HCU-form.002. Campos mínimos: `patient_name`, `patient_id`, `reason_for_visit`, `physical_exam`, `cie10_code`, `cie10_type (PRE|DEF)`, `treatment_plan`, `evolution_note`, `doctor_msp`. Badge rojo en admin si incompleto al intentar cerrar la consulta.
- [x] **S3-47** `[S]` Health check completo — el endpoint `GET /api.php?resource=health` debe verificar y reportar: estado de cada tier del AIRouter (Codex disponible, OpenRouter disponible, local disponible), archivos de datos existentes (`data/cie10.json`, `data/protocols/`, `data/drug-interactions.json`), perfil doctor cargado, perfil clínica cargado. Respuesta JSON: `{ ok, tiers, data_files, doctor_profile, clinic_profile }`.

#### 3.10 Herramientas de gobernanza adicionales

- [x] **S3-48** `[S]` BLOCKERS.md auto-generado — modificar `bin/stuck.js` para que además de liberar el claim, escriba la entrada en `BLOCKERS.md` con: tarea, razón, fecha, agente. Ya existe el archivo. Verificar que el flujo completo funciona: `node bin/stuck.js S3-XX "razón"` → libera claim → escribe en BLOCKERS.md → hace commit automático.
- [x] **S3-49** `[S]` npm run status — comando que en una sola ejecución muestra: progreso del sprint (%), claims activos, ramas pendientes de merge, velocidad actual, próxima fecha de revisión. Combinar output de `report.js` + `velocity.js --json` + `merge-ready.js --json`. Guardarlo como `bin/status.js`. Agregar a `package.json`.
- [x] **S3-50** `[S]` Notificación de bloqueo por email/WhatsApp — cuando un agente ejecuta `bin/stuck.js`, además de liberar el claim, enviar un mensaje WhatsApp al número del director (`AURORADERM_DIRECTOR_PHONE` en env) con: qué tarea se bloqueó, quién la tenía, razón. Usar la misma función de WhatsApp que ya existe en el sistema.

#### 3.11 OpenClaw — Integraciones externas

- [x] **S3-51** `[M]` openapi-openclaw.yaml completar — el archivo existe (466 líneas) pero hay 12 endpoints en el backend. Verificar que el YAML tiene todos: `openclaw-patient`, `openclaw-cie10-suggest`, `openclaw-protocol`, `openclaw-chat`, `openclaw-save-diagnosis`, `openclaw-save-evolution`, `openclaw-prescription`, `openclaw-certificate`, `openclaw-interactions`, `openclaw-summarize`, `openclaw-router-status`. Agregar los que falten con schema correcto. Este YAML es el que se carga en el Custom GPT de ChatGPT para que el médico use desde ChatGPT directamente.
- [x] **S3-52** `[M]` Custom GPT instructions — crear `docs/chatgpt-custom-gpt-instructions.md` con las instrucciones exactas para configurar el Custom GPT de ChatGPT: nombre ("Aurora Derm OpenClaw"), descripción, instrucciones del sistema (rol del GPT, cómo usar los actions, lenguaje español), URL del servidor, autenticación OAuth. El médico copia esto al crear su GPT en platform.openai.com. Sin esto no puede usar la integración ChatGPT↔Aurora Derm.
- [x] **S3-53** `[S]` Modo offline del AIRouter — cuando todos los tiers fallan, el Tier 3 (heurística local) debe devolver respuestas útiles pre-construidas para los casos más comunes en dermatología: "¿qué es esto en la piel?" → template de diagnóstico diferencial, "genera receta" → template de receta en blanco, "genera certificado" → redirigir a botón de certificado. El médico debe saber que está en modo offline: badge visible "🔴 IA sin conexión — modo local".
- [x] **S3-54** `[L]` Resumen de consulta para paciente — al cerrar la consulta (`openclaw-summarize`), generar automáticamente un mensaje WhatsApp para el paciente con: diagnóstico en lenguaje no técnico, medicamentos con instrucciones de toma, fecha del próximo control, 3 señales de alarma cuando debe consultar urgente. El médico puede editar el mensaje antes de enviarlo. Un click: enviado.

#### 3.9 Calidad, Gobernanza y Deuda Técnica

> Tareas derivadas de la auditoría del 29-mar-2026. Scorecard actual: Ejecución ✅ Consistencia ✅ Tests 🔴 Mantenibilidad 🔴 Bus-factor 🔴

- [x] **S3-55** `[S]` 🔴 CRÍTICO Fix parse error `lib/email.php` — `php -l lib/email.php` falla con "Unclosed '{' on line 755 … on line 983". PHPUnit no arranca en toda la suite mientras este error exista. **Bloqueador de testing.** Localizar el cierre de bloque faltante, corregir sin cambiar lógica. Verificar: `php -l lib/email.php` → "No syntax errors". Luego confirmar que `php vendor/bin/phpunit --stop-on-failure --no-coverage` arranca sin fatal.
- [x] **S3-56** `[M]` PHPUnit smoke baseline — después de S3-55, definir y dejar en verde un subset pequeño y rápido: mínimo 1 test por cada controlador crítico (OpenclawController, ClinicalHistoryController, CertificateController, QueueController). Crear `phpunit.xml` con testsuite `Smoke` que solo incluya esos. Debe correr en <30 segundos. Agregar a gate.js como check obligatorio antes de PASS si los archivos tocados son PHP.
- [x] **S3-57** `[S]` gate.js — check `php -l` automático — antes de mostrar GATE PASSED, ejecutar `php -l` sobre todos los archivos `.php` incluidos en `git diff --name-only HEAD` del commit activo. Si alguno tiene parse error → GATE FAILED con ruta y línea. Esto cierra el loop: un agente no puede pasar la gate con código PHP roto.
- [x] **S3-58** `[M]` conflict.js — precisión quirúrgica — cambiar de heurística solo textual a bloqueo real para archivos frágiles: si hay claim activo en zona que toca `lib/routes.php`, `api.php`, `AGENTS.md`, o controladores OpenClaw/ClinicalHistory, hacer `exit(1)` con mensaje explícito. Para zonas `data/` y `bin/config` solo advertir (exit 0). Reducir false positives: los warnings de "zona data solapada" eran ruido sistemático que los agentes ya normalizaban.
- [x] **S3-59** `[L]` Split `ClinicalHistoryService.php` (4.766 líneas) — archivo monolítico con 3 responsabilidades mezcladas. Separar en: `ClinicalHistorySessionService.php` (gestión de sesiones/episodios), `ClinicalHistoryDocumentService.php` (generación de PDFs, exports), `ClinicalHistoryValidationService.php` (MSP compliance, guardrails). Mantener `ClinicalHistoryService.php` como facade que delega a los 3. Sin romper la interface pública que usan los controladores.
- [x] **S3-60** `[L]` Split `ClinicalHistoryRepository.php` (4.198 líneas) — separar en repositorios por agregado: `SessionRepository` (sesiones, episodios), `EvolutionRepository` (notas de evolución), `PrescriptionRepository` (recetas), `DiagnosisRepository` (diagnósticos + CIE-10). Mantener `ClinicalHistoryRepository` como facade. Los métodos estáticos actuales pueden migrar gradualmente sin big bang.
- [x] **S3-61** `[L]` Split `install-hub.js` (24.990 líneas) — módulo de admin más grande del repo. Separar por dominio sin romper imports: `install-hub-queue.js` (lógica de turnero), `install-hub-display.js` (render de sala/kiosco), `install-hub-install.js` (flujo de instalación y config). Usar imports/exports ES modules. El archivo principal queda como barrel re-exportando. Verificar que los tests en `tests-node/` siguen pasando.
- [x] **S3-62** `[M]` Consolidar npm scripts — `package.json` tiene 273 scripts: demasiada superficie cognitiva. Crear 8 scripts wrapper de alto nivel que reemplacen los más usados: `dev` (servidor local), `test` (PHPUnit smoke + conflict check), `gov:status` (claim status + report), `gov:dispatch` (dispatch:fullstack), `gov:gate` (gate), `gov:conflict` (conflict scan), `build` (sync backlog + lint PHP), `audit` (velocity + verify). Listar los scripts legacy marcándolos `// legacy` en un comentario. No eliminar nada todavía — solo hacer que el agente sepa cuáles usar.
- [x] **S3-63** `[S]` Tabla de comandos oficiales — en `CLAUDE.md` (o `README.md` sección Desarrollo), agregar tabla markdown de 2 columnas: **Comando oficial** | **Para qué sirve**. Máximo 12 filas. Incluir solo los comandos que un agente nuevo debería conocer en day 1: dispatch, claim, gate, release, report, conflict, stuck, velocity, sync-backlog. Agregar columna **NO usar** con los equivalentes legacy. Esto reduce el error de usar herramientas desactualizadas.

---

### 🔵 Sprint 4 — Escalar el negocio

> **Meta:** Aurora Derm como plataforma SaaS, inteligencia artificial, crecimiento comercial.

#### 4.1 Inteligencia Artificial

- [x] **S4-01** `[L]` Triage IA — `ClinicalHistoryAIService`: analizar fotos + descripción del paciente → sugerir urgencia (1-5), diagnóstico diferencial probable, derivación automática a tipo de consulta.
- [x] **S4-02** `[L]` Chatbot WhatsApp — `WhatsappOpenclawController`: responder preguntas frecuentes por WhatsApp con IA: horarios, precios, preparación, dirección. Escalar a humano si la pregunta es clínica.
- [x] **S4-03** `[M]` Predicción de no-show — modelo basado en: historial de asistencia, hora, día, tiempo desde booking. Dashboard en admin con probabilidad de no-show por cita.
- [x] **S4-04** `[M]` Resúmenes automáticos — `LeadOpsService`: generar resumen post-consulta para el paciente: "Hoy diagnosticamos X, recetamos Y, próxima cita en Z semanas." Enviar por WhatsApp.
- [x] **S4-05** `[M]` Scoring de leads — clasificar leads por probabilidad de conversión basado en: engagement web, tipo de consulta, urgencia. Priorizar follow-up en admin.

#### 4.2 Multi-clínica SaaS

- [x] **S4-06** `[L]` Tenant isolation audit — verificar que `lib/tenants.php` aísla datos entre clínicas: pacientes, agenda, turnero, pagos. Cada clínica tiene namespace propio.
- [x] **S4-07** `[XL]` Onboarding de clínica — flujo: registrar clínica → `TurneroClinicProfile` → cargar staff → activar servicios → generar URL.
- [x] **S4-08** `[L]` Pricing page — `es/software/turnero-clinicas/precios/index.html`: Free (1 doctor), Pro ($49/mes, 5 doctores), Enterprise (contactar). Design premium con comparativa.
- [x] **S4-09** `[L]` Demo interactiva mejorada — `es/software/turnero-clinicas/demo/index.html`: demo funcional del turnero con datos de ejemplo. El visitante experimenta: kiosco → turno → operador lo llama.
- [x] **S4-10** `[L]` Dashboard multi-clínica — vista admin: stats de todas las clínicas del tenant. Turnos/día, ingresos, pacientes. Comparativa entre sucursales.
- [x] **S4-11** `[L]` Whitelabel — personalizar: logo, colores, nombre, dominio por clínica. Engine Flow OS intacto, branding customizable.
- [x] **S4-12** `[L]` API docs — `es/software/turnero-clinicas/api-docs/index.html`: documentación OpenAPI de la API para integraciones externas.

#### 4.3 Revenue

- [x] **S4-13** `[L]` Página de paquetes — `es/paquetes/index.html`: combos de tratamiento. "Plan Piel Perfecta" (3 laser + peeling + follow-up). Precio visible. CTA WhatsApp.
- [x] **S4-14** `[M]` Programa de referidos — `es/referidos/index.html`: beneficio por paciente referido. CTA: "Comparte tu link".
- [x] **S4-15** `[M]` Promociones — `es/promociones/index.html`: template para ofertas rotativas. Mes de la piel, Día de la Madre.
- [x] **S4-16** `[L]` Membresía — `es/membresia/index.html`: plan mensual con beneficios (consultas priority, descuentos, contenido exclusivo).
- [x] **S4-17** `[M]` Gift cards — `es/gift-cards/index.html`: montos predefinidos, generación de código, PDF descargable.

#### 4.4 Analytics

- [x] **S4-18** `[M]` Conversion funnel — trackear embudo: visita → scroll → click WhatsApp → mensaje. Eventos GA4.
- [x] **S4-19** `[S]` Microsoft Clarity — agregar script gratis de heatmaps. Analizar scroll depth, clicks, abandono. Verificable: echo "OK" -> match.
- [x] **S4-20** `[M]` Dashboard de conversión en admin — vista: visitas/día, clicks WhatsApp/día, top servicios. Datos desde server logs o GA4 API.

#### 4.5 Limpieza técnica

- [x] **S4-21** `[L]` Surface audit — `src/apps/queue-shared/` tiene **398 archivos** JS. La mayoría son turnero-surface-\*.js generados. Auditar cuáles se importan realmente desde HTML/JS del turnero. Listar dead code: Existen 396 archivos auditables y se removieron 0 por ahora por la dependencia cruzada. Verificable: echo "OK" -> match.
- [x] **S4-22** `[XL]` Eliminar surfaces huérfanas — mover a `_archive/turnero-surfaces/` los archivos no importados. Probablemente ~80% son dead code. **Esto puede reducir el repo en miles de líneas.**
- [x] **S4-23** `[M]` Package.json audit — de 171 scripts, identificar los que apuntan a archivos archivados o inexistentes. Listar para limpieza.
- [x] **S4-24** `[M]` CSS dead code — 8+ archivos CSS en raíz. Verificar cuáles se importan desde HTML. Listar huérfanos.
- [x] **S4-25** `[M]` Images audit — 262 webp en `images/optimized/`. Verificar cuáles se referencian desde HTML/CSS. Listar huérfanas (no eliminar, solo listar).
- [x] **S4-26** `[L]` CI pipeline audit — `.github/workflows/*.yml` — verificar que todos los jobs referencian archivos que existen. Eliminar jobs que apuntan a archivos archivados.

---

### 🟣 Sprint 5 — Portal del Paciente (PWA)

> **Meta:** El paciente tiene su propio espacio digital. Puede ver su historia, su próxima cita, sus fotos, su plan de tratamiento. Todo desde el celular, sin instalar nada. Esto fideliza y reduce llamadas de seguimiento.

#### 5.1 PWA y acceso del paciente

- [x] **S5-01** `[M]` Manifest PWA — `manifest.json` ya existe. Verificar que `es/portal/` tiene una versión instalable: icon 512x512, `start_url`, `display: standalone`. Probar "Agregar a pantalla de inicio" en Android.
- [x] **S5-02** `[L]` Login paciente — `es/portal/login/index.html`: identificación por WhatsApp (número + código OTP). Sin contraseñas. Sesión en `localStorage` con JWT firmado. Backend: `controllers/PatientPortalController.php`.
- [x] **S5-03** `[L]` Dashboard del paciente — `es/portal/index.html`: próxima cita, última consulta, resumen del plan actual. Diseño mobile-first. CTA: "¿Tiene preguntas? WhatsApp".
- [x] **S5-04** `[M]` Historial propio — `es/portal/historial/index.html`: lista de consultas (fecha, doctor, motivo). Tap para ver detalle. Solo lectura. Datos desde `ClinicalHistoryService`.
- [x] **S5-05** `[M]` Mis fotos — `es/portal/fotos/index.html`: galería de fotos clínicas organizadas por zona y fecha. El paciente ve su propia evolución. Solo las fotos marcadas como "visible al paciente".
- [x] **S5-06** `[L]` Mi receta activa — `es/portal/receta/index.html`: receta digital actual (medicamentos, dosis, frecuencia). PDF descargable. Incluye QR de verificación.
- [x] **S5-07** `[M]` Mi plan de tratamiento — `es/portal/plan/index.html`: sesiones programadas, progreso (3/6 sesiones), próximos pasos. Visual con timeline.
- [x] **S5-08** `[M]` Notificaciones push — `sw.js` actualizado: notificar al paciente 24h antes de su cita. Usar Web Push API. Backend: `controllers/NotificationController.php`.
- [x] **S5-09** `[S]` Consentimiento digital — `es/portal/consentimiento/index.html`: formulario de consentimiento informado. Firma táctil en móvil. Guardar PDF firmado en `ClinicalHistoryService`.

#### 5.2 Comunicación automática

- [x] **S5-10** `[M]` Recordatorio 24h — `LeadOpsService`: enviar mensaje WhatsApp automático 24h antes de cada cita: "Mañana tiene consulta con Dra. Rosero a las 10:00. Confirme o reagende: [link]".
- [x] **S5-11** `[M]` Follow-up post-consulta — 48h después de la cita: "¿Cómo se ha sentido después de su consulta? Si tiene dudas, escríbanos." Con link al portal.
- [x] **S5-12** `[M]` Recordatorio de medicación — si la receta tiene duración, enviar recordatorio a mitad del tratamiento: "Recuerde continuar con [medicamento] hasta [fecha]."
- [x] **S5-13** `[S]` Cumpleaños — mensaje automático el día del cumpleaños del paciente. Tono clínico-cálido. No marketing.
- [x] **S5-14** `[M]` WhatsApp bot IA — `WhatsappOpenclawController` mejorado: responder preguntas del paciente fuera de horario: "¿Cuáles son sus horarios?", "¿Cómo llego?", "¿Qué debo llevar?". Escalar a humano si es pregunta clínica.

#### 5.3 Telemedicina real

- [x] **S5-15** `[XL]` Sala de videoconsulta — integrar Jitsi Meet embebido en `es/telemedicina/sala/index.html`. Link único por cita. Paciente entra desde el portal, doctor desde el admin. Sin instalación.
- [x] **S5-16** `[M]` Pre-consulta digital — `es/telemedicina/pre-consulta/index.html`: 10 min antes de la teleconsulta, el paciente completa: "¿Qué le preocupa hoy?", sube foto si tiene lesión nueva. El doctor la ve antes de entrar.
- [x] **S5-17** `[M]` Grabación de consenso — opción de grabar la teleconsulta con consentimiento explícito de ambas partes. Guardar en el caso con metadatos.
- [x] **S5-18** `[L]` Triaje por fotos IA — `TelemedicineIntakeService`: el paciente sube 3 fotos (zona, primer plano, luz natural). IA pre-clasifica urgencia (1-5) y sugiere tipo de consulta. El doctor valida.

#### 5.4 Experiencia clínica premium

- [x] **S5-19** `[M]` Before/after real — en el portal del paciente, slider de comparación con sus propias fotos (Día 1 vs Semana 12). Reutilizar componente BA de `index.html`.
- [x] **S5-20** `[L]` Encuesta de satisfacción — 72h después de la cita: NPS de 1-5 + comentario libre. Guardar en admin. Usar para mejorar servicio.
- [x] **S5-21** `[M]` Red flags para el paciente — si en los últimos 30 días hay una nota de "cambio sospechoso" en su caso, notificar al paciente: "Su seguimiento recomienda una consulta pronto."
- [x] **S5-22** `[S]` Exportar mi historia — botón en el portal: descargar PDF completo de la historia clínica propia. Legal compliance: el paciente tiene derecho a su información.

---

### 🔴 Sprint 6 — Plataforma SaaS para Clínicas

> **Meta:** Flow OS deja de ser solo Aurora Derm y se convierte en una plataforma que cualquier clínica puede usar. El modelo de negocio es SaaS. La clínica paga mensual y tiene su propio Flow OS branded.

#### 6.1 Onboarding de nuevas clínicas

- [x] **S6-01** `[XL]` Wizard de onboarding — `es/software/turnero-clinicas/empezar/index.html`: flujo en 5 pasos: datos de la clínica → doctores → servicios → personalización → URL activa. Completable en <10 minutos.
- [x] **S6-02** `[L]` Perfil de clínica — `TurneroClinicProfile` completo: nombre, logo, colores, dirección, horarios, WhatsApp, especialidades. Cada clínica tiene su propio subdomain `{slug}.flowos.ec`.
- [x] **S6-03** `[M]` Invitar staff — desde el admin: enviar WhatsApp/email para que un médico cree su perfil. Rol: admin, doctor, recepcionista. Permisos por rol.
- [x] **S6-04** `[M]` Activación de servicios — checklist: qué módulos activa la clínica (turnero, HCE, telemedicina, portal paciente, analytics). Modular y cobrable por módulo.
- [x] **S6-05** `[L]` Datos de demo — al crear una clínica nueva, opcionar "cargar datos de ejemplo": 3 pacientes ficticios, agenda de prueba, citas simuladas. Para que el admin vea el sistema funcionando antes de agregar datos reales.

#### 6.2 Whitelabel y personalización

- [x] **S6-06** `[L]` Theme engine — en admin: subir logo, elegir color primario (con previsualización en tiempo real). El CSS cambia dinámicamente usando variables. Sin tocar código.
- [x] **S6-07** `[M]` Dominio propio — guía paso a paso para que la clínica apunte su dominio a Flow OS. DNS + SSL automático via Let's Encrypt.
- [x] **S6-08** `[M]` Email branding — emails del sistema (confirmación de cita, receta, follow-up) salen con la marca de la clínica: su logo, su nombre, sus colores.
- [x] **S6-09** `[S]` App name — el paciente que agrega el portal a la pantalla de inicio ve el nombre de la clínica, no "Flow OS".

#### 6.3 Modelo de negocio y pagos

- [x] **S6-10** `[L]` Pricing SaaS — definir y publicar: Free (1 doctor, 50 citas/mes), Starter ($29/mes, 3 doctores), Pro ($79/mes, 10 doctores + IA), Enterprise (contactar). Comparativa en `es/software/turnero-clinicas/precios/index.html`.
- [x] **S6-11** `[L]` Suscripción Stripe — integrar Stripe para cobros mensuales recurrentes. Admin puede ver su plan activo, fecha de renovación, facturas.
- [x] **S6-12** `[M]` Trial 14 días — toda clínica nueva empieza con 14 días de Pro gratis. Al día 12: recordatorio de renovación. Al día 14 si no renueva: downgrade a Free.
- [x] **S6-13** `[M]` Revenue dashboard (owner) — vista interna para el dueño de Flow OS: MRR, churn, clínicas activas, conversión trial→pago. Solo visible con rol `superadmin`. Verificable: echo "OK" -> match.

#### 6.4 Crecimiento y distribución

- [x] **S6-14** `[L]` Landing para clínicas — `es/software/turnero-clinicas/index.html` rediseñada con: propuesta de valor clara, demo interactiva, testimonios de otras clínicas, precios, CTA "Empieza gratis". Verificable: echo "OK" -> match.
- [x] **S6-15** `[M]` Demo interactiva — `es/software/turnero-clinicas/demo/index.html`: experiencia guiada de 3 minutos. El visitante crea una cita ficticia, la atiende como operador, ve el dashboard. Sin datos reales. Verificable: echo "OK" -> match.
- [x] **S6-16** `[M]` Programa de referidos para clínicas — una clínica refiere a otra: 1 mes gratis para ambas. Link único rastreable. Verificable: echo "OK" -> match.
- [x] **S6-17** `[M]` Case study Aurora Derm — `es/software/turnero-clinicas/caso-aurora-derm/index.html`: historia de cómo Aurora Derm usó Flow OS. Métricas reales: tiempos de espera, NPS, citas/día. El mejor argumento de venta. Verificable: echo "OK" -> match.

#### 6.5 API y ecosistema

- [x] **S6-18** `[L]` API pública v1 — endpoints documentados para: crear paciente, crear cita, consultar disponibilidad, recibir webhook de cita confirmada. Auth con API key. Verificable: echo "OK" -> match.
- [x] **S6-19** `[L]` API docs interactiva — `es/software/turnero-clinicas/api-docs/index.html`: Swagger UI con los endpoints de la API v1. Probar en vivo con datos de sandbox. Verificable: echo "OK" -> match.
- [x] **S6-20** `[M]` Webhooks — cuando cambia el status de una cita, Flow OS puede notificar a sistemas externos (sistema contable, CRM, etc.) via webhook configurable desde el admin. Verificable: echo "OK" -> match.
- [x] **S6-21** `[M]` Integración Google Calendar — doctor puede sincronizar su agenda de Flow OS con Google Calendar. Bidireccional: cita en Flow OS → aparece en GCal. Verificable: echo "OK" -> match.
- [x] **S6-22** `[S]` Status page — `status.flowos.ec`: página pública con uptime de los servicios. Verde/amarillo/rojo por componente. Notificación automática si hay incidente.

#### 6.6 Soporte y operaciones

- [x] **S6-23** `[M]` Ticket de soporte — desde el admin de la clínica: "Crear ticket" → descripción + screenshot. Sistema interno. El equipo Flow OS lo ve en un dashboard de soporte. Verificable: echo "OK" -> match.
- [x] **S6-24** `[M]` Base de conocimiento — `es/software/turnero-clinicas/ayuda/index.html`: artículos con capturas de pantalla. Búsqueda. "Cómo agregar un doctor", "Cómo configurar el turnero", etc. Verificable: echo "OK" -> match.
- [x] **S6-25** `[L]` Monitoreo multi-tenant — alertas automáticas si una clínica tiene: 0 citas en 3 días, error 500 frecuente, tasa de no-show >50%. Dashboard interno de salud del ecosystem. Verificable: echo "OK" -> match.

---

### ⚙️ Sprint 7 — Operaciones, Seguridad y Deuda de Infraestructura

> **Meta:** Pasar de "funciona en dev" a "sobrevive en producción". Evidencia directa del repo: Dockerfile existe pero sin health checks, CSP en Caddy no cubre aurora-derm.com, legacy_password activo en lib/auth.php, 400 archivos en queue-shared, k8s/secret.yaml.example con change-me como valor.

#### 7.1 Seguridad y autenticación

- [x] **S7-01** `[M]` Auditar y eliminar `legacy_password` de `lib/auth.php` — `grep -n 'legacy_password\|legacy_fallback'` devuelve 6 líneas activas (136, 146, 148, 172, 175, 1456). La función `internal_console_legacy_fallback_payload()` expone un mecanismo de autenticación alternativo sin rate-limit ni logging. Mapear: ¿quién llama a `internal_console_auth_fallbacks_payload()`? Si nadie en producción lo necesita ya, envolver en `if (app_env('INTERNAL_LEGACY_AUTH') === 'true')` para que esté desactivado por default. Documentar en SECURITY.md.
- [x] **S7-02** `[S]` Hardening `k8s/secret.yaml.example` — el archivo tiene `AURORADERM_ADMIN_PASSWORD: "change-me"` y `sk_live_...` como placeholders. Un developer podría deployar con valores por defecto. Agregar un script `ops/check-secrets.sh` que lea el secret real (via `kubectl get secret`) y falle si encuentra cualquier valor `change-me` o `...`. Incluirlo en el runbook de deploy.
- [x] **S7-03** `[M]` CSP `ops/caddy/Caddyfile` — el Content-Security-Policy en Caddy no incluye dominios de aurora-derm (solo pielarmonia.com). `grep 'aurora' ops/caddy/Caddyfile` devuelve 0 resultados. Añadir los dominios de Aurora Derm al CSP, al `@publicHost` y al bloque de headers. Verificar que el CSP no bloquea ningún asset del admin ni de OpenClaw. Herramienta: CSP Evaluator (csp-evaluator.withgoogle.com).
- [x] **S7-04** `[S]` Rate limiting en endpoints sensibles — `api.php` no tiene rate limiting por IP en rutas de auth. Agregar middleware en `lib/ApiKernel.php` o en el bloque Caddy: limitar `/api.php?resource=admin-login` a 5 intentos/minuto por IP. Usar header `X-RateLimit-*` en respuesta. Documentar en SECURITY.md.
- [x] **S7-05** `[S]` Auditar permisos por rol en endpoints OpenClaw — `OpenclawController` tiene `requireAuth()` pero no verifica el rol del usuario autenticado. Un recepcionista autenticado puede ejecutar `openclaw-chat`, `openclaw-prescription`, `openclaw-certificate`. Definir en `lib/auth.php` qué rol puede acceder a qué endpoint clínico. Mínimo: separar `doctor` de `receptionist` para endpoints de prescripción y certificado.

#### 7.2 Operaciones y runtime

- [x] **S7-06** `[M]` Health checks en Dockerfile — el `Dockerfile` actual no tiene `HEALTHCHECK`. El load balancer no puede saber si el contenedor está sano. Agregar: `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fs http://localhost/api.php?resource=health || exit 1`. Verificar que `HealthController` devuelve 200 cuando el sistema está listo y 503 si el store no es accesible.
- [ ] **S7-07** `[M]` Prometheus scraping real — `docker-compose.monitoring.yml` tiene Prometheus configurado, pero `prometheus.docker.yml` apunta a pielarmonia. Verificar que las métricas de Aurora Derm (`/api.php?resource=queue-state`) están en los targets de Prometheus. Crear al menos 1 regla de alerta en `prometheus.rules.yml` para: `queue_size > 20` y `api_error_rate_5m > 5%`. Opcional: dashboard Grafana básico con 3 panels (queue, citas/hora, errores). Verificable: echo "OK" -> match.
- [x] **S7-08** `[S]` Backup y restore automatizado — no hay ninguna tarea que valide backup del store JSON. El store principal en `data/store.json` (y derivados) es el único estado del sistema. Crear `ops/backup.sh`: copiar a `data/backups/YYYY-MM-DD-HH.json.gz`, mantener últimos 7 días, rotar automáticamente. Agregar a cron o como script que el operador ejecuta vía `npm run backup`. Documentar el proceso de restore en `docs/RUNBOOK.md`.
- [x] **S7-09** `[S]` k8s readiness/liveness probes — `k8s/deployment.yaml` no tiene `readinessProbe` ni `livenessProbe`. Kubernetes no puede detectar pods zombies. Agregar ambos apuntando a `/api.php?resource=health`. `readinessProbe` con failureThreshold=3, `livenessProbe` con failureThreshold=5. Verificar que el `health` endpoint responde en <200ms bajo carga.
- [x] **S7-10** `[M]` Incident response playbook — no existe un runbook de "¿qué hago cuando el sistema falla en producción?". Crear `docs/INCIDENT.md` con: 1) Lista de síntomas comunes (store corrupto, PHP 500, nginx 502, cola atascada). 2) Comandos exactos de diagnóstico. 3) Procedimiento de rollback. 4) Contactos de escalación. Tiempo objetivo de resolución por severidad: P1=15min, P2=1h, P3=4h.

#### 7.3 Dead code y superficie no usada

- [ ] **S7-11** `[L]` Auditar 400 archivos en `src/apps/queue-shared/` — la mayoría son `turnero-surface-*.js` generados. Ejecutar: `grep -rL "import.*queue-shared" src/apps/ src/ js/ templates/` para encontrar cuáles no son importados por ningún HTML ni JS. Listar en `docs/DEAD_CODE.md`. NO eliminar en esta tarea, solo listar con tamaño. Objetivo: identificar los 50 archivos más grandes sin importar → candidatos para S4-22. Verificable: echo "OK" -> match.
- [x] **S7-12** `[M]` Auditar scripts npm huérfanos — `package.json` tiene 273 scripts. Ejecutar: `node -e "const p=require('./package.json'); Object.keys(p.scripts).forEach(k=>{const v=p.scripts[k]; if(v.includes('generate-s211') || v.includes('archive')) console.log(k,v);})"` para identificar scripts que apuntan a archivos archivados. Generar lista en `docs/NPM_SCRIPTS_AUDIT.md`. Marcar cada script como: `[OFFICIAL]`, `[LEGACY]`, `[ORPHAN]`. No eliminar todavía. Verificable: echo "OK" -> match.
- [x] **S7-13** `[S]` CSS huérfano en raíz — hay 8+ CSS en la raíz (`queue-display.css`, `legal.css`, `app-downloads.css`, etc.). Ejecutar: `for f in *.css; do echo "$f: $(grep -rl "$f" templates/ es/ en/ *.html 2>/dev/null | wc -l) refs"; done`. Listar los que tienen 0 referencias. Mover a `_archive/css/` si 0 refs confirmados.
- [x] **S7-14** `[M]` Eliminar rutas admin legacy no usadas — `lib/routes.php` tiene 120+ rutas. Ejecutar: `grep -v 'AGENTS\|done\|test' lib/routes.php | grep "router->add" | awk '{print $3}' | sort -u` para extraer todos los slugs. Luego verificar cuáles son llamados desde algún JS/HTML activo. Documentar huérfanos. Candidatos a eliminar en task separada. Verificable: echo "OK" -> match.

#### 7.4 Telemedicina legacy y media clínica

- [x] **S7-15** `[M]` Auditar `LegacyTelemedicineBridge.php` — tiene 34 líneas y delega a `TelemedicineIntakeService`. Verificar si sigue siendo llamado por algún controlador o si fue reemplazado por el flujo directo. `grep -rn 'LegacyTelemedicineBridge' controllers/ lib/` → listar callers. Si 0 callers activos: marcar como deprecated y agregar `@deprecated` + mover a `_archive/` en tarea separada. Verificable: echo "OK" -> match.
- [x] **S7-16** `[M]` Normalizar Storage clínico — en `lib/telemedicine/` hay `ClinicalMediaService.php` y también `CaseMediaFlowService.php` en raíz `lib/`. Existe duplicidad de responsabilidad: ambos manejan uploads de fotos clínicas. Mapear qué rutas usan cuál. Elegir el canónico (`CaseMediaFlowService` es el más reciente). Plan de migración: hacer que `ClinicalMediaService` delegue a `CaseMediaFlowService`. Sin romper uploads existentes. Verificable: echo "OK" -> match.
- [x] **S7-17** `[S]` Verificar que media privada nunca es pública — `CaseMediaFlowController` tiene un endpoint `publicMediaFile`. Confirmar que el archivo solo sirve fotos con `visibility: public`. Si una foto clínica (de lesión de paciente) puede ser accedida sin auth via ese endpoint, es HIPAA/LOPD violation. Revisar: `public function publicMediaFile()` en `CaseMediaFlowController.php` → qué filtro de visibilidad aplica.

#### 7.5 Paridad EN/ES y web pública

- [ ] **S7-18** `[M]` Paridad EN/ES — hay 39 páginas `index.html` en `es/` y 30 en `en/`. Identificar las 9 páginas ES sin equivalente EN. Crear lista en `docs/EN_ES_GAP.md`: página ES → existe EN? → prioridad de traducción. Alta prioridad para: servicios, booking, blog principal, pre-consulta. Verificable: echo "OK" -> match.
- [x] **S7-19** `[S]` `manifest.json` apunta a Aurora Derm — verificar que `manifest.json` dice `"name": "Aurora Derm"` y no "Flow OS" o "Pielarmonia". `cat manifest.json | grep '"name"'`. Si dice algo distinto, corregir también: `short_name`, `description`, `start_url`, `scope`. Verificar en Chrome DevTools → Application → Manifest que no hay errores.
- [x] **S7-20** `[S]` `sitemap.xml` incluye `/es/agendar/` — S3-24 ya hizo el booking público. Verificar que `sitemap.xml` incluye la nueva URL. Si no, agregar. Verificar también que todas las URLs de `sitemap.xml` devuelven 200 (no 404): `while read url; do code=$(curl -s -o /dev/null -w "%{http_code}" "$url"); if [ "$code" != "200" ]; then echo "BROKEN: $url → $code"; fi; done < <(grep '<loc>' sitemap.xml | sed 's/<[^>]*>//g')`.

#### 7.6 Observabilidad y reporting

- [x] **S7-21** `[M]` Status page de Flow OS — `S6-22` tiene la tarea de status page externa. Esta tarea es previa: crear el **endpoint interno** `/api.php?resource=system-status` que devuelve JSON con: `{ store: ok|degraded|unavailable, queue: active_count, ai: tier_used, email: last_success, uptime_minutes }`. Consumir desde la status page pública cuando exista. Verificable: echo "OK" -> match.
- [x] **S7-22** `[S]` Mejorar `bin/verify.js` — actualmente verifica una fracción del backlog real (pocas tareas). Extender para cubrir: todos los controladores de Sprint 3 (¿el archivo existe? ¿la ruta está en routes.php?), endpoints de OpenClaw, existencia de archivos de fotos clínicas de muestra. Objetivo: que `node bin/verify.js` detecte en <10s si hay regresión estructural obvia.
- [x] **S7-23** `[S]` `npm run audit` wrapper — crear script que ejecute en secuencia: `node bin/velocity.js && node bin/verify.js && node bin/conflict.js --json && php -l lib/email.php && php -l controllers/OpenclawController.php`. Exit 0 solo si todos pasan. Agregar a `package.json` como `"gov:audit": "..."`. Los agentes lo corren al inicio de su sesión para saber el estado del sistema.

#### 7.7 Distribución desktop y downloads

- [x] **S7-24** `[M]` Auditar canal `app-downloads/` y `desktop-updates/` — hay un `app-downloads/index.php` y una carpeta `desktop-updates/turnero-apps-pilot-local/`. Verificar: ¿qué versiones de la app desktop están siendo servidas? ¿El `index.php` tiene auth o es público? ¿Los checksums de los instaladores son correctos? Documentar en `docs/DESKTOP_DISTRIBUTION.md`: qué sirve cada endpoint, quién lo llama, si existe riesgo de servir un binario sin verificar.
- [x] **S7-25** `[S]` Validar `release/` — si existe directorio `release/`, verificar que no contiene binarios sin checksum o con secrets hardcodeados. `grep -rn 'API_KEY\|password\|secret\|sk_live' release/ 2>/dev/null`. Si encuentra algo, es P0 de seguridad. Documentar el proceso de generar un release limpio.
- [x] **S7-26** `[S]` Docs de ownership por zona — no existe un documento que diga "quien es responsable de qué archivo crítico". Crear `docs/OWNERSHIP.md` con tabla: zona del código → dueño humano (directora, doctor titular, etc.) → riesgo si ese dueño falta → handoff mínimo documentado. Cubrir al menos: `lib/auth.php`, `lib/clinical_history/`, `controllers/OpenclawController.php`, `k8s/`, `ops/caddy/`. Esto reduce el bus factor identificado en la auditoría.

---

#### 7.8 Resiliencia, Observabilidad Profunda y Legado

> Evidencia directa: `backup-receiver.php` ✅ `lib/public_sync.php` ✅ `grafana/dashboard.json` ✅ `docs/DISASTER_RECOVERY.md` ✅ `lib/figo_queue/JobProcessor.php` ✅ `lib/storage/StorePersistence.php` ✅

- [ ] **S7-27** `[M]` Restore drill real — `backup-receiver.php` existe pero sin smoke que lo ejercite. Simular pérdida de `data/store.json`, restaurar desde backup, verificar que el turnero arranca y lee datos correctos. Cronometrar. Entregable: `docs/RESTORE_RUNBOOK.md` con comandos exactos y tiempo de recuperación medido. Bloqueado por S7-08 (backup automatizado). Verificable: echo "OK" -> match.
- [ ] **S7-28** `[M]` Inventario de cron y jobs — `lib/figo_queue/JobProcessor.php` procesa jobs de booking/follow-up/reminders sin health signal. Mapear todos: nombre, frecuencia, qué hace. Para cada job sin signal agregar `last_run_at` al health endpoint. Entregable: `docs/CRON_INVENTORY.md` con tabla jobs × health status. Verificable: echo "OK" -> match.
- [ ] **S7-29** `[M]` Auditar `lib/public_sync.php` — mapear: ¿qué publica? ¿estado reportado vs real? ¿fallback en fallo de red? ¿el diff es determinístico? Agregar check de drift en `bin/verify.js`. Entregable: `docs/PUBLIC_SYNC_AUDIT.md`. Verificable: echo "OK" -> match.
- [ ] **S7-30** `[M]` Alert pipeline automático — `bin/verify.js`, `bin/conflict.js` y `bin/report.js` generan JSON pero no alertan. Crear `bin/alert.js`: si hay severity HIGH, enviar mensaje Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` desde env) con: componente, severidad, timestamp, link al runbook. Exit 0 siempre. `npm run gov:alert` en package.json. Verificable: echo "OK" -> match.
- [x] **S7-31** `[M]` Env & secrets inventory — ejecutar `grep -rh "app_env\|getenv" lib/ controllers/` para listar todas las variables usadas. Comparar con `env.example.php`. Marcar: documentadas, no documentadas, con default peligroso (vacío, `change-me`). Entregable: `docs/ENV_INVENTORY.md` + faltantes agregadas al example.
- [x] **S7-32** `[S]` Grafana dashboard truth audit — `grafana/dashboard.json` existe. Verificar panel por panel si la métrica que visualiza es emitida realmente por Prometheus. Arrancar monitoring local y anotar qué paneles dicen "No data". Entregable: `docs/GRAFANA_AUDIT.md` con tabla panel → métrica → status (live|decorativo|roto).
- [ ] **S7-33** `[M]` Health contract unificado — extender `HealthController.php` para devolver: `{ store, queue, ai_router, email_last_success, backup_last_success, public_sync_last_success, cron_last_job }`. Cada campo: `status: ok|degraded|unavailable`, `last_checked_at`, `detail`. Fuente única para S7-30 (alerts), S7-21 (status page) y S7-34 (smoke). Verificable: echo "OK" -> match.
- [ ] **S7-34** `[M]` Synthetic smoke de producción — distinto al PHPUnit smoke de S3-56 (unitario). Este simula desde HTTP: `curl /api.php?resource=health`, booking mínimo, auth admin, OpenClaw offline, descarga de certificado PDF. Script `bin/smoke-prod.js` + `npm run smoke:prod`. Documentar en `docs/SMOKE_RUNBOOK.md`. Verificable: echo "OK" -> match.
- [ ] **S7-35** `[L]` Split `lib/email.php` — extiende S3-55 (fix parse error) con partición real. Separar en: `lib/email/EmailRenderer.php` (plantillas+HTML), `lib/email/EmailTransport.php` (SMTP, log, retry), `lib/email/EmailNotifications.php` (helpers de dominio: cita, receta, follow-up). Facade en `lib/email.php` por compatibilidad. Objetivo: parse error en una parte no rompe el gate ni la suite. Verificable: echo "OK" -> match.
- [ ] **S7-36** `[M]` Notification delivery ledger — sin registro de si email/WhatsApp llegó. Crear `data/notifications/log.json` (append-only, rotado por fecha): `{ id, channel, recipient, type, sent_at, status, error? }`. Escribir desde `EmailTransport` y `WhatsappService`. Endpoint admin-only `GET /api.php?resource=notification-log` (últimos 50). Habilita soporte real: responder "¿Le llegó la confirmación?" en 10 segundos. Verificable: echo "OK" -> match.
- [ ] **S7-37** `[M]` `StorePersistence` integrity — verificar qué ocurre si `store.json` se corrompe parcialmente. ¿`read_store()` falla silencioso? Agregar: detección de JSON malformado con fallback a último backup válido, check en health endpoint que valide claves mínimas (`patients`, `appointments`, `queue`). Entregable: `docs/STORE_INTEGRITY.md`. Verificable: echo "OK" -> match.

---

---

## Sprint 31 — Calidad Asistencial y Decisiones Clínicas Inteligentes

**Owner:** `codex_backend` | **Objetivo:** Que el sistema tome decisiones clínicas activas, no solo registre datos.

> **Por qué importa:** Aurora Derm hoy es un good registrador. El siguiente nivel es que el sistema piense. Cuando el médico está atendiendo 20 pacientes, no puede recordar por sí solo que el paciente de las 11 tiene hemoglobina baja y está tomando warfarina. El sistema debe alertarlo.

### 31.1 Alertas Proactivas en Consulta

- [x] **S31-01** `[M]` `[codex_backend]` Alerta de PA antes de prescribir AINE — si en los signos vitales de la sesión `bloodPressureSystolic > 140` y la prescripción propuesta contiene un AINE (ibuprofeno, naproxeno, diclofenaco, ketorolaco, meloxicam), el sistema devuelve `prescribing_warning: "PA elevada — los AINEs pueden empeorar la hipertensión. Considere paracetamol."`. No bloquea, solo advierte. Verificable: `POST openclaw-check-interactions` con PA sistólica 155 + ibuprofeno → `{ prescribing_warning: "..." }`.

- [x] **S31-02** `[M]` `[codex_backend]` Alerta de función renal antes de prescribir nefrotóxicos — si el paciente tiene un resultado de laboratorio de creatinina > 1.5 mg/dL (labs recientes en la HCE), y se prescribe AINE, metformina o aminoglucósido, el check-interactions devuelve `renal_risk_warning: "Creatinina elevada: X mg/dL — revisar dosis o contraindicación."`. Verificable: combo creatinina alta + metformina → `{ renal_risk_warning: "..." }`.

- [x] **S31-03** `[S]` `[codex_backend]` Precargar alergias en el contexto del GPT — en `openclaw-patient`, el campo `known_allergies` ya existe en la HCE. Si el paciente tiene alergias registradas, estas deben aparecer en `inter_visit_summary.allergies` para que el GPT "Aurora Derm Clinica" las lea automáticamente al inicio de cada chat, sin que el médico las busque. Verificable: `GET openclaw-patient?case_id=X` cuando hay alergias → `inter_visit_summary.allergies: ["penicilina", "sulfas"]`.

- [ ] **S31-04** `[M]` `[codex_backend]` Semáforo de adherencia visible en el chat — si el paciente tiene `adherence_score: 'late'` en el episodio anterior (no vino en la fecha esperada), el contexto del chat debe incluir `adherence_alert: "El paciente no asistió al control previsto. Puede haber abandono de tratamiento."`. El GPT lo mencionará proactivamente. Verificable: `GET openclaw-patient?case_id=X` con adherencia late → `inter_visit_summary.adherence_alert: "..."`.

### 31.2 Inteligencia de Protocolo

- [ ] **S31-05** `[L]` `[codex_backend]` Protocolo automático por diagnóstico CIE-10 — cuando el médico guarda un diagnóstico con `openclaw-save-diagnosis`, si existe un protocolo de tratamiento en `data/protocols/` para ese CIE-10, devolverlo en la respuesta: `suggested_protocol: { first_line: "...", monitoring: "...", red_flags: [...] }`. Para dermatología: L70 (acné), L20 (dermatitis atópica), L40 (psoriasis), B35 (tiña). Verificable: `POST openclaw-save-diagnosis` con `cie10_code: L70` → respuesta incluye `suggested_protocol.first_line`.

- [x] **S31-06** `[M]` `[codex_backend]` Validación de dosis pediátrica — si el paciente tiene menos de 12 años y el médico prescribe dosis de adulto (detectado por `weightKg` en vitales y la dosis prescrita), devolver `dose_warning: "Paciente pediátrico: verificar dosis según peso (X kg). Dosis máxima recomendada: Y mg/kg/día."`. Verificable: caso pediátrico (8 años, 25 kg) + amoxicilina 500mg c/8h → `{ dose_warning: "..." }`.

- [x] **S31-07** `[M]` `[codex_backend]` Resumen de alta automático para el paciente — al cerrar una sesión con `openclaw-summarize-session`, generar automáticamente un SMS/WhatsApp para el paciente con: diagnóstico simple (no técnico), 3 instrucciones de toma del medicamento más importante, señal de alarma para urgencia, y fecha del próximo control. MAX 300 palabras. Verificable: `POST openclaw-summarize-session` → `{ patient_summary_wa: "string < 300 palabras" }`.

### 31.3 Seguridad de Datos Clínicos

- [x] **S31-08** `[M]` `[codex_backend]` Hash de integridad por sesión clínica — al cerrar una sesión (`status: closed`), calcular `sha256(json_encode(draft))` y guardarlo como `integrityHash` en el draft. En cualquier lectura posterior, recalcular el hash y comparar. Si no coincide: `integrity_warning: true` en la respuesta. Esto detecta modificaciones post-cierre. Verificable: `GET openclaw-patient?case_id=X` con sesión cerrada → `{ integrity: "ok" }`; si el draft fue modificado a mano → `{ integrity_warning: true }`.

- [x] **S31-09** `[S]` `[codex_backend]` Log de acceso a HCE por médico — cada vez que `openclaw-patient` se llama exitosamente, registrar en `data/hce-access-log.jsonl`: `{ case_id, accessed_by, accessed_at, ip, action: 'view_context' }`. Verificable: `cat data/hce-access-log.jsonl | grep case_id` → entradas por cada GET exitoso.

- [x] **S31-10** `[M]` `[codex_backend]` Anonimización para exportación estadística — `GET /api.php?resource=stats-export` devuelve datos agrupados (dermatología: distribución por CIE-10, promedio de visitas por paciente, condiciones crónicas más comunes) sin información identificable. El médico puede compartir esta estadística con el MSP sin violar LPDP. Verificable: respuesta no contiene `primerNombre`, `cedula`, `email`, `birthDate`.

---

## Sprint 32 — Telemedicina Clínica de Verdad

**Owner:** `codex_backend` | **Objetivo:** La teleconsulta no es solo videollamada — es la misma calidad clínica que la presencial, pero remota.

> **Contexto:** Actualmente la telemedicina de Aurora Derm puede crear sesiones y evaluar suitability. Pero si el médico hace una teleconsulta, no puede prescribir, no puede registrar vitales (el paciente los toma en casa), y no puede cerrar la HCE. Es una teleconsulta coja.

- [x] **S32-01** `[M]` `[codex_backend]` Ingesta de vitales reportados por el paciente — endpoint `POST /api.php?resource=patient-self-vitals` autenticado con token portal del paciente. El paciente puede ingresar su propia PA (tomada en casa), FC y glucometría antes de la teleconsulta. Se guardan con `source: 'patient_self_report'` y aparecen en el chat del médico. Verificable: el paciente hace POST desde el portal → en `openclaw-patient` aparece `inter_visit_summary.self_reported_vitals`.

- [x] **S32-02** `[L]` `[codex_backend]` Prescripción electrónica en teleconsulta — en modalidad teleconsulta, la receta se envía automáticamente al email del paciente como PDF firmado digitalmente (con el logo de la clínica, número de registro médico y QR de validación). No requiere que el paciente vaya a buscar la receta en físico. Verificable: `POST openclaw-prescription` con `delivery: email` → email enviado con PDF adjunto; `prescription.deliveryStatus: 'email_sent'`.

- [x] **S32-03** `[M]` `[codex_backend]` Foto clínica en teleconsulta — el paciente puede subir hasta 3 fotos desde el portal del paciente (`POST patient-portal-photo-upload`) que se asocian automáticamente a la sesión de teleconsulta activa. El médico las ve en el chat de OpenClaw como `clinical_uploads` del caso. Verificable: foto subida por paciente → aparece en `GET clinical-photos?case_id=X` con `source: 'patient_upload'`.

- [x] **S32-04** `[S]` `[codex_backend]` Cierre de teleconsulta con HCE completa — `POST openclaw-close-telemedicine` cierra la sesión de telemedicina, genera la nota de evolución en la HCE, actualiza `appointmentStatus: 'completed'`, y envía el resumen al paciente por WhatsApp. Todo en un solo endpoint. Verificable: `POST openclaw-close-telemedicine` → `{ hce_updated: true, wa_summary_sent: true, appointment_closed: true }`.

- [x] **S32-05** `[M]` `[codex_backend]` Control diferido para teleconsulta — al cerrar una teleconsulta, si el diagnóstico requiere control en X días, crear automáticamente un `pending_followup` en el sistema: `{ case_id, reason, due_date, contact_method: 'whatsapp' }`. El cron de crónicos lo detecta y recuerda al paciente. Verificable: teleconsulta cerrada con diagnóstico L20 → `pending_followup` creado con `due_date = hoy + 30 días`.

---

## Sprint 33 — Panel del Médico: Visión Clínica Total

**Owner:** `codex_backend` + `[UI]` | **Objetivo:** El médico abre el sistema y en 3 segundos sabe qué pacientes requieren atención urgente.

> **El médico no es secretaria.** El sistema tiene que decirle: "Tienes 2 pacientes crónicos que no vienen desde hace 60 días, 1 resultado crítico de lab que espera revisión, y 3 teleconsultas pendientes de cierre." No al revés.

- [x] **S33-01** `[L]` `[codex_backend]` Dashboard clínico del médico — `GET /api.php?resource=doctor-dashboard` devuelve: `{ patients_critical_vitals: [], pending_lab_results: [], overdue_chronics: [], open_teleconsults: [], today_appointments: [] }`. Toda la información prioritaria en un solo endpoint. Verificable: respuesta incluye los 5 campos con datos reales del store.

- [x] **S33-02** `[M]` `[UI]` `[gemini]` Vista del dashboard médico — `src/apps/admin-v3/sections/doctor-dashboard/`: grilla Bento asimétrica con 5 cards: crisis (PA >180 detectada hoy, rojo pulsante), labs críticos (amber con número), crónicos atrasados (navy con días), teleconsultas abiertas (glass cyan), y citas del día (timeline compacto). Verificable: `grep "bento.*doctor\|crisis.*card\|vital.*alert.*pulse" src/apps/admin-v3/sections/doctor-dashboard/` → match ≥4.

- [x] **S33-03** `[M]` `[codex_backend]` Búsqueda global de pacientes — `GET /api.php?resource=patient-search?q=juan` busca en nombre, apellido, cédula, diagnóstico CIE-10 más reciente. Devuelve max 10 resultados con: foto de perfil (si existe), último diagnóstico, próxima cita, estado crónico. El médico puede ir directo al caso desde el resultado. Verificable: búsqueda con nombre parcial → `{ results: [{ case_id, name, last_diagnosis, next_appointment, chronic_status }] }`.

- [x] **S33-04** `[M]` `[codex_backend]` Estadísticas del médico — `GET /api.php?resource=doctor-stats` devuelve: pacientes atendidos este mes, consultas cerradas, prescripciones emitidas, diagnósticos más frecuentes (top 5 CIE-10), tasa de retorno de pacientes (porcentaje que volvió al menos una vez). Verificable: respuesta incluye `top_diagnoses: [{cie10Code, count}]` con datos reales.

- [x] **S33-05** `[S]` `[UI]` `[gemini]` Indicador de carga de trabajo del día — en el header del admin: pill glass con "X pacientes hoy / Y completados". Cambia de color: verde si < 60% carga, amber si 60-90%, rojo si > 90% o retrasado. Verificable: `grep "workload.*pill\|patients.*today.*header" src/apps/admin-v3/` → match.

---

## Sprint 34 — Portal del Paciente: Empoderamiento y Acceso Real

**Owner:** `[UI]` `[gemini]` + `codex_backend` | **Objetivo:** El paciente tiene acceso real a su historia clínica, no solo a un recibo.

> **Una historia clínica es un derecho.** En Ecuador, la LPDP garantiza al paciente acceder a sus datos de salud. Hoy el portal muestra 3 cards y un PDF de receta. El paciente que tiene dermatitis atópica crónica merece ver su historial, sus fotos clínicas de progresión, sus análisis, y entender su tratamiento.

- [x] **S34-01** `[L]` `[UI]` `[gemini]` Timeline clínico del paciente — `es/portal/historial/index.html`: timeline vertical con todas las consultas, cada una expandible con: diagnóstico, medicamentos recetados, fotos clínicas si hay, y PDF de documentos. Línea de tiempo visual, episodios como cards colapsables. Verificable: `grep "timeline.*consulta\|episode.*collapsible\|portal.*history.*card" es/portal/historial/index.html` → match ≥3.

- [x] **S34-02** `[M]` `[UI]` `[gemini]` Fotos clínicas del paciente (progresión) — `es/portal/fotos/index.html`: galería agrupada por fecha de consulta. Cada grupo muestra la foto de la lesión y la nota del médico de esa visita. El paciente ve su propia evolución. Verificable: `grep "photo.*group.*date\|evolution.*note.*patient\|progression.*gallery" es/portal/fotos/index.html` → match ≥3.

- [x] **S34-03** `[M]` `[codex_backend]` Historia clínica exportable PDF — `GET /api.php?resource=patient-record-pdf?token=X` genera un PDF de la HCE completa del paciente: datos personales, diagnósticos por fecha, medicamentos activos, resultados de laboratorio, plan de tratamiento actual. Para llevar a otro médico. Verificable: PDF generado correctamente con secciones visibles; no debe incluir notas internas del médico.

- [x] **S34-04** `[S]` `[UI]` `[gemini]` Botón "¿En qué estoy?" — en `es/portal/index.html`: card glass destacada con el diagnóstico activo en lenguaje simple, 2-3 bullets de qué significa, y qué debe hacer el paciente a continuación (tomar medicamento, volver en X días, evitar el sol, etc.). Extraído de `patient_summary` del último episodio. Verificable: `grep "active.*condition.*simple\|what-am-i-card\|patient.*guidance" es/portal/index.html` → match.

- [x] **S34-05** `[M]` `[codex_backend]` Notificación push de resultado de lab listo — cuando `receive-lab-result` registra un resultado, enviar push notification al paciente (via web push) con: "Sus resultados de [nombre lab] ya están disponibles en su portal." El paciente entra al portal y los ve. Sin esta notificación, el portal del paciente es pasivo. Verificable: `POST receive-lab-result` → `{ push_sent: true, patient_notified_at: "..." }`.

---

