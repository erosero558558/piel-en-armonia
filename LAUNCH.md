# LAUNCH.md — Checklist de Lanzamiento: Junio 2026

> **Contexto:** Aurora Derm arranca operaciones en junio 2026.
> Tu hermano y su novia (ambos médicos) comenzarán a atender pacientes.
> Este documento define qué DEBE funcionar el día 1. Todo lo demás es mejora postcarga.

---

## 🎯 Criterio de "listo para junio"

Un médico sin experiencia digital puede:
1. Registrar a un paciente nuevo en menos de 3 minutos
2. Emitir un turno sin papel
3. Ver el historial de la visita anterior
4. Enviar una receta por WhatsApp
5. Agendar una teleconsulta

Todo esto sin llamar al soporte técnico.

---

## ✅ Ya funciona (no tocar antes de junio)

- [x] Sitio web público con servicios y WhatsApp contextualizado
- [x] Blog médico con 6 artículos + RSS
- [x] Structured data + OG tags + sitemap
- [x] Turnero digital (kiosco + operador + sala)
- [x] Admin con dashboard de pacientes (kanban de stages)
- [x] Flow OS Journey con transiciones automáticas
- [x] Intake digital público (`es/pre-consulta/`)
- [x] Historia clínica básica en admin

---

## 🔴 Crítico — Debe estar listo antes de junio

Estas tareas bloquean el uso diario de la clínica. Sin ellas, el médico no puede trabajar.

### Turnero y agenda
- [ ] **S3-06** Historial de journey (timeline de paciente en admin)
- [ ] **S3-08** Selección de motivo en kiosco (sin esto, el turnero no diferencia tipos de cita)
- [ ] **S3-11** Ticket con QR (paciente sabe su posición en cola sin preguntar)
- [ ] **S3-24** Booking público (paciente puede agendar desde el sitio — clave para reducir llamadas)

### Historia clínica
- [ ] **S3-15** Formulario de anamnesis (el médico necesita registrar el motivo y antecedentes)
- [ ] **S3-18** Plan de tratamiento (template para el plan del paciente)
- [ ] **S3-19** Receta digital (genera PDF con logo, datos, medicamentos — WhatsApp-ready)
- [ ] **S3-20** Evolución clínica (nota por visita — legalmente necesario)

### OpenClaw — IA copiloto del médico
- [ ] **S3-OC1** `[M]` Sugerencia de CIE-10 — mientras el doctor escribe el diagnóstico, sugerir códigos CIE-10 coincidentes. Autocompletar. Guardar el código en el caso. `lib/openclaw/DiagnosisCopilot.php`.
- [ ] **S3-OC2** `[M]` Protocolo de tratamiento sugerido — basado en el diagnóstico seleccionado, mostrar un panel colapsable con el protocolo estándar de la clínica. El médico puede aceptar/modificar. `lib/openclaw/TreatmentProtocol.php`.
- [ ] **S3-OC3** `[L]` Generador de certificado médico — formulario en admin: tipo (reposo, aptitud, tratamiento), días, diagnóstico (CIE-10), observaciones. Genera PDF con membrete clínico, firma digital, folio secuencial. `controllers/CertificateController.php`.
- [ ] **S3-OC4** `[S]` Alerta de interacciones — al registrar medicamentos en la receta, verificar si hay interacciones conocidas con medicamentos previos del paciente. Alerta visual (no bloquea, solo informa).

### Comunicación
- [ ] **S5-10** Recordatorio 24h por WhatsApp (reduce no-shows — crítico para una clínica nueva)

---

## 🟡 Importante — Idealmente antes de junio, pero la clínica funciona sin esto

- [ ] **S3-28** Vista de agenda diaria (el médico ve su día de un vistazo)
- [ ] **S3-16** Fotografía clínica (documentar lesiones con foto — importante para dermatología)
- [ ] **S3-17** Before/after comparación (el paciente ve su evolución)
- [ ] **S5-02** Login del paciente (portal de seguimiento)
- [ ] **S5-03** Dashboard del paciente (ver su próxima cita y plan)
- [ ] **S3-22** Exportar HCE completa (PDF para el paciente si cambia de médico)
- [ ] **S5-14** WhatsApp bot IA (responde preguntas fuera de horario)

---

## 🔵 Post-lanzamiento — Después de que la clínica esté operativa

Todo el Sprint 4, Sprint 5 y Sprint 6 puede ir después de junio.
Primero: que el médico use el sistema cómodamente.
Después: vendérselo a otras clínicas.

- Sprint 4: IA avanzada, SaaS pricing, analytics
- Sprint 5: Portal mobile del paciente, telemedicina nativa, notificaciones push
- Sprint 6: Onboarding multi-clínica, Stripe, API pública

---

## Reglas para simplificar uso del médico

> Los médicos usan el celular en la consulta. El sistema debe funcionar en móvil.
> Los médicos tienen 7 minutos por paciente. No hay tiempo para interfaces complejas.
> Los médicos no leen manuales. Todo debe ser evidente a primera vista.

En cada tarea marcada como crítica, el criterio de calidad es:
**¿Un médico sin entrenamiento puede completar esta acción en <2 minutos?**

Si la respuesta es no, la tarea está mal diseñada. Hay que simplificarla.

---

## Responder antes de que los agentes continúen

Preguntas para el dueño del producto (responde aquí en LAUNCH.md):

**¿Cuántos doctores van a arrancar en junio?**
```
[Respuesta]: 2 (hermano + novia)
```

**¿Tienen nombre definitivo para la clínica? ¿"Aurora Derm" es el nombre final?**
```
[Respuesta]: [pendiente]
```

**¿El médico usará el admin desde una tablet/celular o computador de escritorio?**
```
[Respuesta]: [pendiente]
```

**¿Cuántas consultas esperan tener en el primer mes?**
```
[Respuesta]: [pendiente]
```

---

_Actualizado: 2026-03-29_
_Para regenerar el estado de tareas: `node bin/sync-backlog.js`_
