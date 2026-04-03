# Aurora Derm — Tareas activas

> Filosofía: cada ticket es una cosa. Una pantalla, un endpoint, un comportamiento.
> Sin subtareas de coordinación. Sin docs de handoff. Sin claims.
> Se hace, se commitea, se cierra.

---

## Infraestructura del backend (bloque 0 — prereqs)

- [ ] **B-01** `GET /` responde JSON de estado (`ok`, `service`, `mode`, `health`)
      _Archivo_: `index.php` — ya existe, verificar que retorna el contrato del README
- [ ] **B-02** Validar que todos los endpoints de `lib/routes.php` responden sin 500 en dev local
      _Comando_: `npm run test:routes`
- [ ] **B-03** Crear `tests-node/backend-only-smoke.test.js` si no existe
      _Prueba_: health, queue-state, figo-config, operator-auth-status

---

## Sistema de turnos — UI nueva (bloque 1)

El backend del turnero está completo. Solo falta la UI. Tres pantallas, cada una un archivo HTML + un JS.

- [ ] **T-01** `kiosco.html` — Pantalla del kiosco de llegada
      _API_: `POST /api.php?resource=queue-checkin`, `POST /api.php?resource=queue-ticket`
      _Regla_: un archivo HTML, un archivo JS (`kiosco.js`), CSS inline o un archivo CSS máximo
      
- [ ] **T-02** `sala.html` — Pantalla de sala de espera (TV)
      _API_: `GET /api.php?resource=queue-state`, polling cada 5s
      _Regla_: sin dependencias externas, funciona offline si el server cae
      
- [ ] **T-03** `operador.html` — Consola del operador
      _API_: `POST queue-call-next`, `PATCH queue-ticket`, `POST queue-reprint`
      _Auth_: usa `admin-auth.php` con PIN de operador

---

## Dashboard médico — UI nueva (bloque 2)

- [ ] **A-01** `admin.html` — Shell mínimo del dashboard
      _Solo lo que el médico usa en consulta_: lista de pacientes del día, acceso a HCE, botón OpenClaw
      _Regla_: sin frameworks, sin build step, HTML + CSS + JS vanilla

- [ ] **A-02** Integrar OpenClaw chat en admin
      _API_: `POST /api.php?resource=openclaw-chat`, `GET openclaw-patient`
      _Depende de_: A-01

- [ ] **A-03** Vista de historia clínica en admin
      _API_: `GET clinical-history-session`, `POST clinical-history-message`
      _Depende de_: A-01

---

## Portal del paciente — UI nueva (bloque 3)

- [ ] **P-01** `portal/index.html` — Login del paciente (código por email)
      _API_: `POST patient-portal-auth-start`, `POST patient-portal-auth-complete`

- [ ] **P-02** `portal/dashboard.html` — Vista principal del paciente
      _API_: `GET patient-portal-dashboard`
      _Muestra_: próxima cita, último diagnóstico, documentos disponibles

- [ ] **P-03** `portal/pagos.html` — Historial de pagos
      _API_: `GET patient-portal-payments`

- [ ] **P-04** `portal/receta.html` — Ver receta médica (PDF)
      _API_: `GET patient-portal-prescription`, `GET openclaw-prescription`

- [ ] **P-05** `portal/plan.html` — Plan de tratamiento
      _API_: `GET patient-portal-plan`

---

## Sitio público (bloque 4)

- [ ] **W-01** Decidir stack del sitio público
      _Opciones_: Astro estático (ya existe en `src/apps/astro/`) o HTML puro
      _Prerequisito_: decidir antes de implementar T-01..T-03

- [ ] **W-02** Landing page principal (`/`)
      _Contenido_: servicios, booking, contacto — depende de W-01

---

## Reglas de cada ticket

1. **Un commit por ticket** con mensaje `feat(T-01): kiosco checkin UI`
2. **Corre `npm run prune` antes de pushear** — si detecta algo, bórralo primero
3. **Corre `npm run test:routes` después de cada cambio en routes.php**
4. **Sin TODOs en el código** — si algo no está listo, no entra

---

## Cómo marcar una tarea

Cambia `[ ]` por `[x]` y pushea.
