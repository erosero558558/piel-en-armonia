# Aurora Derm — Tareas Activas (Versión API Backend Pura / MySQL)

> Filosofía: Simplicidad máxima. Aurora Derm opera estrictamente como un motor lógico (Backend API) conectado a una base de datos relacional MySQL. Todas las interfaces gráficas y artefactos visuales han sido purgados para eliminar deuda técnica.

## División de Trabajo
| Rol | Responsabilidad |
|---|---|
| **API Dev** | Controladores PHP, servicios, enrutamiento, validaciones. |
| **DB Dev** | Migración SQL, PDO (`lib/db.php`), queries, schema `database.sql`. |

---

## Bloque 1 — Infraestructura y Configuración
- [ ] **INF-01** `[Backend]` Asegurar que `index.php` actúe como router limpio y rechace tráfico no-API.
- [ ] **INF-02** `[Database]` Confirmar conexión exitosa desde `lib/db.php` al servidor MySQL usando credenciales de `env.php`.
- [ ] **INF-03** `[Backend]` Revisar que `.htaccess` únicamente sirva el index PHP y prohíba accesos directos.

## Bloque 2 — Migración de Arquitectura (JSON -> MySQL)
- [ ] **DB-01** `[Database]` Ejecutar `database.sql` en servidor local para poblar esquema (patients, cases, appointments, evolutions).
- [ ] **DB-02** `[Backend]` Refactorizar modelo de PACIENTES: quitar `file_get_contents('data/patients...')` y usar `INSERT/SELECT` en tabla `patients`.
- [ ] **DB-03** `[Backend]` Refactorizar modelo de TURNOS (Appointments): reemplazar `data/appointments` por sentencias SQL nativas.
- [ ] **DB-04** `[Backend]` Refactorizar capa CLINICA (Notas SOAP / Evolutions): Migrar la lógica de Openclaw hacia MySQL (tabla `evolutions` y `prescriptions`).

## Bloque 3 — Limpieza Residual
- [ ] **CLN-01** `[Backend]` Revisar `/controllers/` y borrar dependencias a clases de Frontend o `HTMLRenderers` perdidos.
- [ ] **CLN-02** `[Backend]` Extraer lógica core que sigue fuertemente acoplada a "rutas visuales" y recablearla como endpoints JSON `(ok/data/error)`.

---
> **Regla de Oro**: Ningún ticket debe sugerir construir "UI", "Pantallas", "Botones" ni "Servicios Web Visuales". Si dice HTML o CSS, no pertenece a este repositorio.
