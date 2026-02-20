# Guía de Contribución

Gracias por tu interés en contribuir a Piel en Armonía. Este documento describe el proceso para configurar el entorno de desarrollo y enviar cambios.

## 1. Configuración del Entorno

### Requisitos Previos
*   **PHP 8.0+** (Recomendado 8.2) con extensiones `mbstring`, `json`, `openssl`, `gd`.
*   **Node.js 18+** y npm.
*   **Git**.

### Instalación
1.  Clonar el repositorio:
    ```bash
    git clone https://github.com/tu-usuario/pielarmonia.git
    cd pielarmonia
    ```

2.  Instalar dependencias de Node.js:
    ```bash
    npm install
    ```

3.  Instalar navegadores para pruebas E2E (Playwright):
    ```bash
    npx playwright install chromium
    ```

4.  Iniciar servidor local:
    ```bash
    php -S localhost:8080
    ```
    Ahora puedes acceder a `http://localhost:8080`.

## 2. Estándares de Código

### JavaScript
Utilizamos **ESLint** para asegurar la calidad del código JS.
*   Ejecutar linter: `npm run lint:js`
*   Configuración: `eslint.config.js` (Soporte para ES Modules y CommonJS).

### PHP
Nos adherimos a buenas prácticas de PHP moderno y verificamos la sintaxis.
*   Verificar sintaxis: `npm run lint:php`
*   Estilo: Mantener consistencia con el código existente (espaciado, llaves, tipos estrictos `declare(strict_types=1);`).

## 3. Pruebas (Testing)

Es obligatorio que todos los cambios pasen las pruebas automatizadas antes de enviar un PR.

### Unitarias (PHP)
Prueban la lógica de negocio en `lib/`.
```bash
npm run test:php
# O directamente: bash tests/run-php-tests.sh
```

### End-to-End (Playwright)
Prueban el flujo completo de usuario en el navegador.
```bash
# Ejecutar todos los tests (headless)
npm test

# Ejecutar con interfaz visual
npm run test:ui
```

## 4. Proceso de Pull Request (PR)

1.  **Branching:** Crea una rama descriptiva desde `main`:
    *   `feature/nueva-funcionalidad`
    *   `bugfix/arreglo-critico`
    *   `docs/actualizacion-guia`

2.  **Commits:** Usa mensajes claros y en imperativo.
    *   Bien: `Add appointment validation logic`
    *   Mal: `fix bug`

3.  **Descripción:** En el PR, describe *qué* cambiaste y *por qué*. Adjunta capturas de pantalla si es un cambio visual.

4.  **Review:** Espera la aprobación de un mantenedor. El CI ejecutará automáticamente los tests.

## 5. Reporte de Bugs

Si encuentras un error, por favor abre un Issue en GitHub incluyendo:
*   Pasos para reproducir.
*   Comportamiento esperado vs real.
*   Capturas de pantalla o logs si aplica.
