# Developer Onboarding: Aurora Derm (Flow OS)

¡Bienvenido al código base de Aurora Derm! 
Este repositorio alberga la plataforma (con nombre en clave **Flow OS**) que da soporte a las operaciones diarias de una clínica dermatológica real en Quito, Ecuador.

Este documento destila la complejidad técnica para que puedas entender exactamente cómo funciona el servidor, dónde cambiar el frontend, y cómo se estructuran nuestros entornos.

---

## 🏗 Arquitectura de Alto Nivel

A nivel macro, Flow OS abandona arquitecturas altamente fragmentadas (microservicios estresantes, node-clusters sin sentido) en favor de un **monolito PHP estructurado, rápido y nativo** (`api.php`), emparejado de vistas frontend desacopladas que dialogan puramente vía fetch (`admin.html`, Vanilla JS modular en `/js/`, Astro V6).

### 1. El Backend (PHP 8.2+)
Carecemos en gran medida de frameworks hinchados (no Laravel, no Symfony pesado). Nuestro motor base es una API JSON impulsada por `api.php`.
*   **Enrutador Central:** Cuando un fetch golpea `/api.php?resource=appointments&action=index`, el request es capturado e interpretado por `lib/routes.php`.
*   **Controladores:** Ubicados en `/controllers/`, aquí se aloja la lógica de validación de negocio. (e.j. `AppointmentController.php`, `PatientPortalController.php`).
*   **Servicios Lógicos:** Las reglas del "Mundo Médico" (cómo se forma una evolución clínica SOAP, qué pasa si se suben fotos) delegan los casos de uso atómicos al directorio `/lib/`.

### 2. El Frontend 
*   **Sección Pública (Pacientes):** Landing pages informativas en localizaciones como `es/` y componentes modernos de la carpeta `src/apps/astro/`. Si hay Astro involucrado, lo procesamos para escupir puro HTML/CSS prenderizado.
*   **Panel Administrativo:** El archivo fundamental `admin.html`. Las interacciones del DOM y de red están fragmentadas en Vanilla Web Components y sub-secciones dentro del directorio `js/`. (Por ejemplo, si necesitas arreglar los pagos del portal, el archivo primario es `js/portal-payments.js`).

### 3. State & Persistencia ("¿Dónde está la Base de Datos?")
El proyecto cuenta con un sistema de archivos persistidos orientados al volumen y backups rápidos en producción o en el despliegue final sobre servidores cloud, consumidos eficientemente por los repositorios en el tier Data de `/lib/`. Se trata de una mezcla entre repositorios de lectura de logs analíticos pre-compilados y capas transaccionales, siempre gobernadas a través de endpoints en `/api.php`.

---

## 🚀 Entorno de Desarrollo (Local Setup)

Entrar al loop de desarrollo requiere que corras tu propio server para poder testear tus endpoints sin CORS issues.

1.  **Asegura tus herramientas básicas:** Debes contar mínimamente con Node.js 18+ (para Playwright y utilidades linter) y PHP 8.2 (para el runtime general), clonado sobre tu máquina principal Unix/Mac o WSL.
2.  **Instala los paquetes auxiliares HTML/Assets:** 
    ```bash
    npm install
    ```
3.  **Bootstrapea el servidor local de desarrollo PHP:**
    Ejecutar el host es tan crudo y directo como arrancar el webserver embebido de PHP enrutado hacia una utilidad auxiliar nativa:
    ```bash
    php -S 127.0.0.1:8011 -t . bin/local-stage-router.php
    ```
    *(Ése es tu único comando core backend. Ya puedes abrir http://127.0.0.1:8011/admin.html y ver el panel).*

---

## 🕵🏾‍♂️ ¿Qué hago si rompo algo? (Testing)

No dejes pasar código riesgoso sin probar. Tenemos dos aristas obligatorias:
*   **Pruebas Lógicas PHP (Tests Unitarios):** Pasan asertivamente todos los esquemas bajo `/tests/`.
    ```bash
    npm run test:php  # Correr suit backend internamente
    ```
*   **Pruebas de Vuelo Real (End-to-End / Playwright):** Lanzan navegadores de verdad para certificar workflows pacientes, turneros y agendamiento.
    ```bash
    npx playwright test   # Todo el UI automation suite
    ```

---

## 🗺 Directorio de Vuelo (Frontera Canónica raíz)

Si estás buscando archivos con los que empezar, esto es lo que verás nada más inicializar tu repositorio:

| Archivo / Carpeta | ¿Debería editarlo? | ¿Qué hace? |
| :--- | :--- | :--- |
| `controllers/` | **Sí.** | Dónde vivirán todas tus nuevas rutas/callbacks PHP. |
| `js/` | **Sí.** | Modularización del cliente frontend Vanilla JS. |
| `lib/` | **Sí.** | Reglas de routing general, clases DAO y core functions de Aurora. |
| `src/apps/astro` | **Sí.** | Si te asignaron tareas UX en la web public-facing (Landing). |
| `admin.html`, `index.html` | A veces | Shells index para los endpoints de visualización e inyección estática. |
| `README.md` | Ocasionalmente | Hub rápido general. |
| `AGENTS.md` | **Ojo.** | Es el task board automatizado del repo impulsado por markdown. |

---

Si dominaste esto, ya sabes más del 90% para operar el proyecto real. Tus siguientes estaciones (opcionales) son `docs/CONTRIBUTING.md` para las convenciones precisas de PRs y Pulls, o `docs/OPERATIONS_INDEX.md` para revisar los runbooks en caliente. 

*¡Feliz desarrollo de software médico!*
