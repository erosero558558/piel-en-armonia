# Service Landing Quality Audit

Fecha: 2026-03-30
Task: `S12-02`

## Objetivo

Medir cuáles landings de servicios informan, pero todavía convierten débilmente por faltar señales claras de decisión: CTA claro, before/after, precio referencial, testimonio y FAQ.

## Metodología

Rubric de 100 puntos, con 20 puntos por criterio:

- `CTA claro`: la página indica un siguiente paso visible hacia WhatsApp o reserva.
- `Before/after`: muestra evidencia visual comparativa o casos reales.
- `Precio referencial`: publica un rango, ancla o inversión orientativa del servicio.
- `Testimonio`: incluye prueba social explícita del paciente o cita atribuible.
- `FAQ`: resuelve dudas frecuentes en el cuerpo de la landing.

Regla de lectura:

- El score mide conversión editorial en la landing, no SEO técnico.
- Los componentes globales del shell no cuentan como precio ni testimonio.
- Cuando varias páginas empatan en score, la prioridad de rediseño se rompe por intención comercial, sensibilidad al riesgo percibido y desalineación del mensaje.

## Hallazgos Globales

- `19/19` páginas tienen CTA claro.
- `19/19` páginas tienen FAQ.
- `0/19` páginas muestran before/after o casos reales.
- `0/19` páginas muestran precio referencial.
- `0/19` páginas muestran testimonios.
- Resultado: el set actual informa bien el proceso clínico, pero casi no reduce fricción comercial ni ansiedad de compra.

## Score Por Página

| Página | Template | CTA | Before/after | Precio | Testimonio | FAQ | Score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| acne-rosacea | v6 | si | no | no | no | si | 40 |
| bioestimuladores-colageno | v6 | si | no | no | no | si | 40 |
| botox | v6 | si | no | no | no | si | 40 |
| cancer-piel | v6 | si | no | no | no | si | 40 |
| cicatrices | v6 | si | no | no | no | si | 40 |
| depilacion-laser | v6 | si | no | no | no | si | 40 |
| dermatologia-pediatrica | v6 | si | no | no | no | si | 40 |
| diagnostico-integral | v6 | si | no | no | no | si | 40 |
| granitos-brazos-piernas | v6 | si | no | no | no | si | 40 |
| laser-dermatologico | legacy | si | no | no | no | si | 40 |
| manchas | v6 | si | no | no | no | si | 40 |
| mesoterapia | v6 | si | no | no | no | si | 40 |
| microdermoabrasion | v6 | si | no | no | no | si | 40 |
| peeling-quimico | v6 | si | no | no | no | si | 40 |
| piel-cabello-unas | v6 | si | no | no | no | si | 40 |
| rellenos-hialuronico | v6 | si | no | no | no | si | 40 |
| tamizaje-oncologico | v6 | si | no | no | no | si | 40 |
| teledermatologia | v6 | si | no | no | no | si | 40 |
| verrugas | v6 | si | no | no | no | si | 40 |

## Top 5 Con Rediseño Prioritario

### 1. `laser-dermatologico`

Prioridad más alta por tres razones:

- Usa template `legacy`, mientras el resto del set ya está en `v6`.
- Es un procedimiento de alta intención donde la falta de evidencia visual y ancla de precio pesa más.
- El CTA existe, pero la página no convierte la promesa clínica en prueba concreta.

Rediseño recomendado:

- Módulo before/after con disclaimer médico.
- Bloque de inversión orientativa por rango de sesión.
- Testimonio corto sobre seguridad, recuperación y resultados esperables.

### 2. `depilacion-laser`

Prioridad alta por intención transaccional fuerte y porque el usuario suele comparar precio, número de sesiones y tolerancia.

Rediseño recomendado:

- Tabla de zonas o paquetes con precio desde.
- Before/after de reducción de densidad folicular.
- Testimonio sobre comodidad, número de sesiones y control médico.

### 3. `rellenos-hialuronico`

Prioridad alta por riesgo percibido. Sin prueba social ni ancla económica, la página exige demasiada confianza para un servicio electivo.

Rediseño recomendado:

- Casos de volumen natural con foco en sutileza, no dramatismo.
- Precio referencial por zona o rango por jeringa.
- Testimonio orientado a naturalidad y seguridad.

### 4. `microdermoabrasion`

Prioridad alta por ser una categoría fácilmente comoditizada. Si no se diferencia con evidencia y precio, se vuelve intercambiable frente a cualquier competidor local.

Rediseño recomendado:

- Comparativas visuales de textura y luminosidad.
- Precio orientativo por sesión y paquete.
- Testimonio breve de resultados visibles en piel opaca o congestionada.

### 5. `botox`

Prioridad alta por volumen de búsqueda comparativa y por sensibilidad del usuario a dos objeciones: verse artificial y pagar de más.

Rediseño recomendado:

- Before/after centrado en resultado natural.
- Precio desde por zonas frecuentes.
- Testimonio que refuerce naturalidad, duración y seguimiento.

## Segunda Ola Recomendada

- `peeling-quimico`
- `bioestimuladores-colageno`
- `mesoterapia`
- `manchas`

Estas páginas comparten el mismo hueco de conversión, pero quedaron detrás del top 5 porque su urgencia comercial es ligeramente menor o porque compiten menos por decisión rápida que las cinco anteriores.

## Observaciones Secundarias

- Hay páginas de procedimientos que todavía quedan posicionadas con framing demasiado genérico o de diagnóstico, por ejemplo `depilacion-laser`, `rellenos-hialuronico` y `microdermoabrasion`. Aunque esta tarea no pedía corregir copy, esa ambigüedad también debilita la conversión.
- El patrón actual está muy optimizado para explicar y tranquilizar, pero no para cerrar la duda económica ni para transferir confianza desde evidencia social o visual.

## Recomendación Operativa

Secuencia sugerida para Sprint 12:

1. Rediseñar el top 5 con un bloque reusable de `proof + pricing + testimony`.
2. Reusar ese bloque en la segunda ola.
3. Mantener FAQ y CTA actual, que ya funcionan como base mínima.
