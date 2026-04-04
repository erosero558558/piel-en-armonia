# Aurora Derm — Tareas Activas (Versión API Backend Pura / MySQL)

> Filosofía: Simplicidad máxima. Aurora Derm opera estrictamente como un motor lógico (Backend API) conectado a una base de datos relacional MySQL. Todas las interfaces gráficas y artefactos visuales han sido purgados para eliminar deuda técnica.

## División de Trabajo
| Rol | Responsabilidad |
|---|---|
| **API Dev** | Controladores PHP, servicios, enrutamiento, validaciones. |
| **DB Dev** | Migración SQL, PDO (`lib/db.php`), queries, schema `database.sql`. |

---

## Bloque 1 — Infraestructura y Configuración
- [x] **INF-01** `[Backend]` Asegurar que `index.php` actúe como router limpio y rechace tráfico no-API.
- [x] **INF-02** `[Database]` Confirmar conexión exitosa desde `lib/db.php` al servidor MySQL usando credenciales de `env.php`.
- [x] **INF-03** `[Backend]` Revisar que `.htaccess` únicamente sirva el index PHP y prohíba accesos directos.

## Bloque 2 — Migración de Arquitectura (JSON -> MySQL)
- [x] **DB-01** `[Database]` Ejecutar `database.sql` en servidor local para poblar esquema (patients, cases, appointments, evolutions).
- [x] **DB-02** `[Backend]` Refactorizar modelo de PACIENTES: quitar `file_get_contents('data/patients...')` y usar `INSERT/SELECT` en tabla `patients`.
- [x] **DB-03** `[Backend]` Refactorizar modelo de TURNOS (Appointments): reemplazar `data/appointments` por sentencias SQL nativas.
- [x] **DB-04** `[Backend]` Refactorizar capa CLINICA (Notas SOAP / Evolutions): Migrar la lógica de Openclaw hacia MySQL (tabla `evolutions` y `prescriptions`).

## Bloque 3 — Limpieza Residual
- [x] **CLN-01** `[Backend]` Revisar `/controllers/` y borrar dependencias a clases de Frontend o `HTMLRenderers` perdidos.
- [x] **CLN-02** `[Backend]` Extraer lógica core que sigue fuertemente acoplada a "rutas visuales" y recablearla como endpoints JSON `(ok/data/error)`.
- [x] **CLN-03** `[Backend]` Escrutinio profundo a librerías y portales: Erradicar HTML y adaptadores de `Dompdf` de `CertificateGeneratorService` y wrappers gráficos huérfanos de `PatientPortalController` y `PortalViewService`.

---
> **Regla de Oro**: Ningún ticket debe sugerir construir "UI", "Pantallas", "Botones" ni "Servicios Web Visuales" dentro del core API. Si dice HTML o CSS, no pertenece a la médula espinal.

## Bloque 4 — Maduración Evolutiva (Fase de Escalamiento Clínico)
Esta hoja de ruta está diseñada bajo el Modelo de Arquitectura Biomimética para que la clínica crezca sana, resistente a traumas y con una homeostasis técnica perfecta.

### 🫁 Sistema Respiratorio Autónomo
- [x] **EVO-01** `[Jobs/Cron]` Configurar *Cronjobs* recurrentes que latan en el fondo revisando la tabla `appointments` para ejecutar acciones pre-programadas sin esperar estímulo exterior.

### 🩸 Sistema Inmunológico T y Memoria Genética
- [ ] **EVO-02** `[Backup/Memory]` Implementar vaciado programado de SQLite/MySQL hacia almacenaje encriptado externo (S3) asegurando que el hipocampo jamás sufra amnesia.
- [ ] **EVO-03** `[CI/CD/Tests]` Generar flujos de GitHub Actions acoplados a *Pruebas Unitarias (Células T)*. Cualquier código nuevo inyectado debe someterse al ataque inmunológico antes de subirse a la sangre de producción.

### 🗣️ Sistema Endocrino y de Notificaciones (Exocrino)
- [ ] **EJ-10** `[Codex]` P2 — Smoke suite: CertificateSmokeTest, QueueSmokeTest, ClinicalHistorySmokeTest con 0 errores fatales.
      _Depende de_: EJ-09

- [ ] **EJ-V01** `[Codex]` P1 — Verificar `POST /clinical-evolution` en runtime con datos reales.
      _Prueba_: `curl -X POST /api.php?resource=clinical-evolution` con payload SOAP válido
      _Criterio_: HTTP 200 + `{"ok":true,"data":{"id":"..."}}` + fila insertada en SQLite
      _Contexto_: Gemini construyó `ClinicalEvolutionService.php`. La sintaxis es válida y la ruta
      está registrada, pero el endpoint no fue ejecutado en runtime. Verificar antes de declararlo hecho.
- [ ] **EVO-04** `[Comms]` Desarrollar "*Cuerdas Vocales*": Conectar microservicios de emisión (Twilio/SMTP/WhatsApp) para que la plataforma hable con el entorno sobre turnos próximos de su agenda.

### 🍽️ Aparato Digestivo (Facturación Quirúrgica)
- [ ] **EVO-05** `[Payments/Billing]` Ingestar Pasarelas de Pago clínicas de grado superior (Kushki, Stripe) para deglutir las agendas convertidas en transacciones lícitas de manera automática.

### 🏃 Sistema Suprarrenal (Adrenalina y Carga Masiva)
- [ ] **EVO-06** `[DevOps]` Dockerizar las células PHP. Empaquetar la API en micro-ambientes maleables mediante `Dockerfile/Kubernetes` aptos para multiplicarse de golpe en caso de estrés agudo de marketing (*Auto-Scaling*).

### 👁️ Órganos Sensoriales
- [ ] **EVO-07** `[Frontend]` Eyectar el cerebro actual (Backend) hacia los nervios motores terminales (*Endpoints* web): Crear oficialmente el cliente consumible (Dashboard Médico y Kiosco Frontend en React/Astro).

### 🔬 Sistema Linfático
- [ ] **EVO-08** `[Analytics/Data]` Crear sumideros pasivos asíncronos para que PowerBI absorba resultados mensuales, previniendo que analítica profunda ensucie o debilite la velocidad arterial del corazón MySQL primario.

### 🌊 Torrente Sanguíneo en Tiempo Real
- [ ] **EVO-09** `[WebSockets]` Implementar Server-Sent Events (SSE) o capa WSS para que el pulso de la clínica no sufra *Latency* reactivo (poll) y bombee nativamente sinapsis en vivo hacia todos los monitores del ecosistema.
