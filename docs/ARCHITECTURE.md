# Registros de Decisiones de Arquitectura (ADRs)

Este documento registra las decisiones de arquitectura significativas del repo.

Marco canonico actual:

- `Flow OS` es la plataforma.
- `Aurora Derm` es la operacion clinica activa sobre esa plataforma.
- `admin`, `queue/turnero`, `OpenClaw` y `LeadOps` son subsistemas del mismo stack.
- `patient-flow-os`, `sony_v3` y `PIELARMONIA_*` permanecen como compatibilidad tecnica mientras termina el rebrand.

Mapa rapido:

- entrada y narrativa: `README.md`, `docs/FLOW_OS_FOUNDATION.md`
- frontend y shells: `src/apps/**`, `admin.html`, `admin.js`
- backend y contratos: `api.php`, `controllers/**`, `lib/**`
- operacion y runbooks: `docs/OPERATIONS_INDEX.md`, `docs/RUNBOOKS.md`, `scripts/ops/**`

---

## ADR-001: Almacenamiento en Archivos JSON vs Base de Datos Relacional

**Estado:** Aceptado

**Contexto:**
El sistema necesita almacenar citas, reseñas y solicitudes de devolución de llamada. El volumen esperado es bajo (< 100 citas/mes) y la complejidad de las relaciones es mínima. El despliegue se realiza en un entorno de hosting compartido donde la gestión de bases de datos MySQL puede añadir complejidad operativa (backups, migraciones, credenciales).

**Decisión:**
Utilizar almacenamiento basado en archivos JSON (`data/store.json`) en lugar de una base de datos relacional (MySQL/PostgreSQL).

- **Implementación:** `lib/storage.php` gestiona la lectura/escritura con bloqueo de archivos (`flock`) para evitar condiciones de carrera.
- **Seguridad:** Los datos sensibles se cifran en reposo utilizando `AES-256-GCM` si se configura `AURORADERM_DATA_ENCRYPTION_KEY`.
- **Backup:** Se generan copias automáticas en `data/backups/` antes de cada escritura.

**Consecuencias:**

- **Positivas:** Simplicidad extrema en backups (copiar carpeta), portabilidad total, cero configuración de servidor de BD.
- **Negativas:** No apto para alta concurrencia masiva o consultas complejas (JOINs). Escalabilidad vertical limitada por RAM (se carga todo el JSON).

---

## ADR-002: Arquitectura PHP Modular sin Framework

**Estado:** Aceptado

**Contexto:**
El proyecto requiere un backend ligero y rápido para servir una API REST y contenido estático. El uso de frameworks pesados (Laravel, Symfony) introduciría overhead innecesario y complejidad de despliegue en hostings compartidos básicos.

**Decisión:**
Implementar una arquitectura modular nativa en PHP 8.x sin dependencias de frameworks externos para el núcleo.

- **Estructura:**
    - `api.php`: Punto de entrada único (Router).
    - `lib/`: Módulos funcionales (`business.php`, `validation.php`, `auth.php`).
    - `data/`: Estado persistente.
- **Inyección de Dependencias:** Manual mediante `require_once` ordenado en `api-lib.php`.

**Consecuencias:**

- **Positivas:** Rendimiento máximo (arranque en milisegundos), control total del flujo, facilidad de auditoría de seguridad.
- **Negativas:** Requiere implementar manualmente ruedas como enrutamiento y manejo de errores (ya resuelto en `api.php`).

---

## ADR-003: Rate Limiting Basado en Archivos (Sharding)

**Estado:** Aceptado

**Contexto:**
Es necesario proteger la API pública contra abusos y ataques de fuerza bruta. La infraestructura no garantiza la disponibilidad de Redis o Memcached persistente en todos los entornos de despliegue.

**Decisión:**
Implementar un sistema de limitación de velocidad basado en el sistema de archivos con "sharding" (fragmentación) de directorios.

- **Mecanismo:** `lib/ratelimit.php` crea archivos efímeros en `data/ratelimit/XX/` basados en el hash de la IP y la acción.
- **Limpieza:** Probabilística (1/50 requests) para eliminar archivos expirados sin cron jobs externos obligatorios.

**Consecuencias:**

- **Positivas:** Funciona en cualquier servidor con disco, sin dependencias externas. El sharding evita problemas de rendimiento del sistema de archivos con muchos inodos en una sola carpeta.
- **Negativas:** Ligeramente más lento que Redis en memoria. No comparte estado entre múltiples servidores web (sin sticky sessions).

---

## ADR-004: Sistema de Feature Flags Jerárquico

**Estado:** Aceptado

**Contexto:**
El despliegue continuo requiere la capacidad de activar/desactivar características (como nuevos flujos de UI o integraciones de pago) sin volver a desplegar código.

**Decisión:**
Implementar un sistema de Feature Flags (`lib/features.php`) con jerarquía de configuración.

- **Prioridad:**
    1.  Variables de Entorno (`FEATURE_NAME=true`) - Para overrides rápidos de infraestructura.
    2.  Redis (si está disponible) - Para cambios en tiempo real sin reinicios.
    3.  Archivo `data/features.json` - Configuración persistente por defecto.
    4.  Valores por defecto en código.

**Consecuencias:**

- **Positivas:** Flexibilidad total para gestionar funcionalidades en producción. Permite "Kill Switches" rápidos vía variables de entorno.
- **Negativas:** Añade complejidad condicional en el código (`if (feature_enabled('...'))`).

---

## ADR-005: Abstracción de Base de Datos (PDO) Opcional

**Estado:** Aceptado

**Contexto:**
Aunque el almacenamiento principal es JSON (ADR-001), se requiere una capa de abstracción para futuras migraciones o módulos que requieran SQL.

**Decisión:**
Mantener `lib/db.php` como un wrapper ligero sobre PDO para conexiones MySQL.

- **Uso Actual:** Opcional/Reservado. El núcleo del sistema de citas usa `lib/storage.php` (JSON).
- **Objetivo:** Permitir conectar a bases de datos legadas o servicios analíticos si el negocio escala más allá de los límites del JSON.

**Consecuencias:**

- **Positivas:** Prepara el terreno para escalabilidad futura sin reescribir todo.
- **Negativas:** Código muerto si no se activa.

---

## ADR-006: No abrir un cuarto subfrente durante el piloto web por clínica

**Estado:** Aceptado

**Fecha:** 2026-03-14

**Contexto:**
La estrategia activa `STRAT-2026-03-turnero-web-pilot` ya define el corte operativo mínimo para cerrar A2.0: un lane `frontend` para las superficies web visibles, un lane `backend_ops` para `clinic-profile`, `queue state`, readiness y gates, y un lane `transversal` reservado solo para desbloqueos puntuales de runtime. El objetivo vigente es demostrar una clínica de punta a punta en `admin basic`, `operator`, `kiosk` y `display`, sin depender de instaladores nativos ni distribución desktop.

En el estado actual:

- `SF-frontend-turnero-web-pilot` y `SF-backend-turnero-web-pilot` son los únicos subfrentes primarios activos.
- `SF-transversal-turnero-web-pilot` existe como soporte excepcional, no como frente permanente de entrega.
- La estrategia no tiene conflictos activos ni overflow de WIP, y el riesgo de dispersión operativo es bajo mientras se mantenga la partición actual.

**Decisión:**
No abrir un subfrente adicional mientras siga vigente A2.0 del piloto web por clínica.

- Todo lo que mueva la demo visible permanece en `frontend`.
- Todo lo que sostenga canon, readiness, smoke y gate permanece en `backend_ops`.
- Cualquier bloqueo real de runtime/OpenClaw entra como excepción temporal en `transversal`, no como subfrente permanente.
- Todo candidato a subfrente nuevo queda `parked` hasta que demuestre simultáneamente:
    - backlog propio y acotado;
    - ownership de archivos realmente distinto;
    - capacidad de mover por sí solo un exit criterion de `strategy.active`.

**Consecuencias:**

- **Positivas:** Mantiene foco en el piloto web, evita handoffs innecesarios, conserva la partición mínima para un equipo pequeño y protege el `dispersion_score` operativo.
- **Negativas:** Trabajo futuro de runtime permanente, instaladores nativos o distribución desktop se difiere hasta después de A2.0 o hasta que aparezca un bloqueo estructural recurrente.

**Versión mínima viable:**
La implementación mínima viable de esta decisión es no cambiar el board ni la estrategia activa: se preservan los subfrentes actuales y solo se permite soporte transversal por excepción temporal.

**Kill condition:**
Se descarta la idea de un subfrente nuevo si sigue siendo soporte, desbloqueo puntual o trabajo futuro sin backlog propio. Si no cumple las tres condiciones de apertura, no merece existir como subfrente.

**Reevaluación:**
La decisión se revisa únicamente si ocurre una de estas condiciones:

- El runtime/OpenClaw deja de ser excepción y pasa a ser camino crítico permanente del piloto.
- La salida del piloto empieza a depender de instaladores nativos o distribución desktop hoy fuera de alcance.
- Aparece un backlog separado, con archivos y aceptación propios, que ya no cabe limpiamente en `frontend` o `backend_ops`.
