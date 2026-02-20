# Registros de Decisiones de Arquitectura (ADRs)

Este documento registra las decisiones de arquitectura significativas para el proyecto Piel en Armonía, su contexto y las consecuencias.

---

## ADR-001: Almacenamiento en Archivos JSON vs Base de Datos Relacional

**Estado:** Aceptado

**Contexto:**
El sistema necesita almacenar citas, reseñas y solicitudes de devolución de llamada. El volumen esperado es bajo (< 100 citas/mes) y la complejidad de las relaciones es mínima. El despliegue se realiza en un entorno de hosting compartido donde la gestión de bases de datos MySQL puede añadir complejidad operativa (backups, migraciones, credenciales).

**Decisión:**
Utilizar almacenamiento basado en archivos JSON (`data/store.json`) en lugar de una base de datos relacional (MySQL/PostgreSQL).
*   **Implementación:** `lib/storage.php` gestiona la lectura/escritura con bloqueo de archivos (`flock`) para evitar condiciones de carrera.
*   **Seguridad:** Los datos sensibles se cifran en reposo utilizando `AES-256-GCM` si se configura `PIELARMONIA_DATA_ENCRYPTION_KEY`.
*   **Backup:** Se generan copias automáticas en `data/backups/` antes de cada escritura.

**Consecuencias:**
*   **Positivas:** Simplicidad extrema en backups (copiar carpeta), portabilidad total, cero configuración de servidor de BD.
*   **Negativas:** No apto para alta concurrencia masiva o consultas complejas (JOINs). Escalabilidad vertical limitada por RAM (se carga todo el JSON).

---

## ADR-002: Arquitectura PHP Modular sin Framework

**Estado:** Aceptado

**Contexto:**
El proyecto requiere un backend ligero y rápido para servir una API REST y contenido estático. El uso de frameworks pesados (Laravel, Symfony) introduciría overhead innecesario y complejidad de despliegue en hostings compartidos básicos.

**Decisión:**
Implementar una arquitectura modular nativa en PHP 8.x sin dependencias de frameworks externos para el núcleo.
*   **Estructura:**
    *   `api.php`: Punto de entrada único (Router).
    *   `lib/`: Módulos funcionales (`business.php`, `validation.php`, `auth.php`).
    *   `data/`: Estado persistente.
*   **Inyección de Dependencias:** Manual mediante `require_once` ordenado en `api-lib.php`.

**Consecuencias:**
*   **Positivas:** Rendimiento máximo (arranque en milisegundos), control total del flujo, facilidad de auditoría de seguridad.
*   **Negativas:** Requiere implementar manualmente ruedas como enrutamiento y manejo de errores (ya resuelto en `api.php`).

---

## ADR-003: Rate Limiting Basado en Archivos (Sharding)

**Estado:** Aceptado

**Contexto:**
Es necesario proteger la API pública contra abusos y ataques de fuerza bruta. La infraestructura no garantiza la disponibilidad de Redis o Memcached persistente en todos los entornos de despliegue.

**Decisión:**
Implementar un sistema de limitación de velocidad basado en el sistema de archivos con "sharding" (fragmentación) de directorios.
*   **Mecanismo:** `lib/ratelimit.php` crea archivos efímeros en `data/ratelimit/XX/` basados en el hash de la IP y la acción.
*   **Limpieza:** Probabilística (1/50 requests) para eliminar archivos expirados sin cron jobs externos obligatorios.

**Consecuencias:**
*   **Positivas:** Funciona en cualquier servidor con disco, sin dependencias externas. El sharding evita problemas de rendimiento del sistema de archivos con muchos inodos en una sola carpeta.
*   **Negativas:** Ligeramente más lento que Redis en memoria. No comparte estado entre múltiples servidores web (sin sticky sessions).

---

## ADR-004: Sistema de Feature Flags Jerárquico

**Estado:** Aceptado

**Contexto:**
El despliegue continuo requiere la capacidad de activar/desactivar características (como nuevos flujos de UI o integraciones de pago) sin volver a desplegar código.

**Decisión:**
Implementar un sistema de Feature Flags (`lib/features.php`) con jerarquía de configuración.
*   **Prioridad:**
    1.  Variables de Entorno (`FEATURE_NAME=true`) - Para overrides rápidos de infraestructura.
    2.  Redis (si está disponible) - Para cambios en tiempo real sin reinicios.
    3.  Archivo `data/features.json` - Configuración persistente por defecto.
    4.  Valores por defecto en código.

**Consecuencias:**
*   **Positivas:** Flexibilidad total para gestionar funcionalidades en producción. Permite "Kill Switches" rápidos vía variables de entorno.
*   **Negativas:** Añade complejidad condicional en el código (`if (feature_enabled('...'))`).

---

## ADR-005: Abstracción de Base de Datos (PDO) Opcional

**Estado:** Aceptado

**Contexto:**
Aunque el almacenamiento principal es JSON (ADR-001), se requiere una capa de abstracción para futuras migraciones o módulos que requieran SQL.

**Decisión:**
Mantener `lib/db.php` como un wrapper ligero sobre PDO para conexiones MySQL.
*   **Uso Actual:** Opcional/Reservado. El núcleo del sistema de citas usa `lib/storage.php` (JSON).
*   **Objetivo:** Permitir conectar a bases de datos legadas o servicios analíticos si el negocio escala más allá de los límites del JSON.

**Consecuencias:**
*   **Positivas:** Prepara el terreno para escalabilidad futura sin reescribir todo.
*   **Negativas:** Código muerto si no se activa.
