# Guía de Pruebas (Testing)

Este documento detalla la estrategia de pruebas para asegurar la calidad y estabilidad del proyecto Piel en Armonía.

## Estrategia de Pruebas

Seguimos una versión simplificada de la **Pirámide de Pruebas**:

1.  **Pruebas Unitarias (Base):** Pruebas rápidas y aisladas para la lógica de negocio en PHP (`lib/`).
2.  **Pruebas de Integración/E2E (Cima):** Pruebas de flujo completo en navegador real con Playwright.

## 1. Pruebas Unitarias (PHP)

Las pruebas unitarias verifican funciones individuales, validaciones y lógica de negocio sin depender de la base de datos o servicios externos (mockeados).

### Ubicación
`tests/*.php` (Archivos prefijados con `test_` o `verify-`).

### Ejecución
El script `tests/run-php-tests.sh` busca y ejecuta todos los archivos de prueba PHP secuencialmente.

```bash
# Ejecutar toda la suite PHP
bash tests/run-php-tests.sh

# Ejecutar un test específico
php tests/test_validation.php
```

### Cómo escribir un test
Crea un archivo `tests/test_mi_funcion.php`:

```php
<?php
require_once __DIR__ . '/../lib/mi_modulo.php';

function test_caso_exito() {
    $resultado = mi_funcion('input');
    assert($resultado === 'esperado', 'Fallo en caso exito');
}

test_caso_exito();
echo "OK\n";
```

Asegúrate de limpiar cualquier estado global o archivos temporales creados.

## 2. Pruebas End-to-End (E2E) con Playwright

Las pruebas E2E simulan un usuario real navegando por la aplicación, reservando citas y accediendo al panel de administración.

### Ubicación
`*.spec.js` en la raíz o subcarpetas de tests.

### Configuración
`playwright.config.js` define los navegadores, URLs base y timeouts.

### Ejecución

```bash
# Ejecutar todos los tests (headless)
npx playwright test

# Ejecutar con interfaz gráfica (útil para debug)
npx playwright test --ui

# Ejecutar un archivo específico
npx playwright test tests/homepage.spec.js
```

### Escribir un test E2E

```javascript
// tests/ejemplo.spec.js
import { test, expect } from '@playwright/test';

test('Página de inicio carga correctamente', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Piel en Armonía/);
  await expect(page.locator('h1')).toBeVisible();
});
```

## 3. Integración Continua (CI)

Cada Pull Request y commit en `main` dispara el flujo de trabajo `.github/workflows/ci.yml`.

### Pasos del CI:
1.  **Linting:** Verifica estilo de código JS y sintaxis PHP.
2.  **Unit Tests:** Ejecuta `tests/run-php-tests.sh`.
3.  **E2E Tests:** Ejecuta Playwright en un servidor PHP temporal.
4.  **Security Audit:** Escaneo básico de vulnerabilidades.

⚠️ **Importante:** El despliegue automático a producción solo ocurre si **todos** los pasos del CI son exitosos (Verde).

## Cobertura y Calidad

*   No requerimos un % estricto de cobertura, pero **toda nueva funcionalidad debe tener al menos un test**.
*   Los bugs críticos reportados deben incluir un test que reproduzca el fallo (TDD) antes de ser arreglados.
