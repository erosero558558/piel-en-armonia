# EN/ES Gap Audit

Fecha de auditoria: `2026-04-01`

## Resumen

- Inventario real actual: `62` paginas `index.html` en `es/` y `30` en `en/`.
- El ticket original de `S7-18` hablaba de `39` vs `30`; ese conteo ya quedo desactualizado por crecimiento posterior de la superficie ES.
- De las `62` paginas ES:
  - `28` ya tienen equivalente EN verificable en disco.
  - `5` tienen mapping EN claro, pero el archivo EN todavia no existe.
  - `29` no tienen mapping EN definido hoy.

## Cobertura ya resuelta

- La familia `es/servicios/*` ya tiene paridad EN completa bajo `en/services/*`, incluyendo el indice.
- La familia legal publica ya tiene paridad EN:
  - `es/legal/aviso-medico/` -> `en/legal/medical-disclaimer/`
  - `es/legal/cookies/` -> `en/legal/cookies/`
  - `es/legal/privacidad/` -> `en/legal/privacy/`
  - `es/legal/terminos/` -> `en/legal/terms/`
- La landing principal de software y sus rutas `index/demo/dashboard` tambien tienen equivalente EN.
- `es/telemedicina/` ya tiene equivalente EN en `en/telemedicine/`.

## Alta prioridad

Estas son las brechas publicas mas valiosas para crecimiento o conversion. No tienen mapping EN definido hoy y deberian convertirse en backlog explicito de traduccion, no en deuda invisible.

| Pagina ES | Equivalente EN actual | Estado | Scope |
| --- | --- | --- | --- |
| `es/agendar/index.html` | `n/a` | `no_mapping` | `public_growth` |
| `es/blog/index.html` | `n/a` | `no_mapping` | `public_growth` |
| `es/pre-consulta/index.html` | `n/a` | `no_mapping` | `public_growth` |

Propuesta de prioridad:

- `es/agendar/`: alta por impacto directo en conversion.
- `es/blog/`: alta por SEO y discoverability.
- `es/pre-consulta/`: alta por soporte a intake previo y continuidad de flujo.

## Media prioridad

Estas rutas ya tienen un equivalente EN razonable esperado o son contenido publico reutilizable, pero no bloquean la conversion base tanto como booking y pre-consulta.

| Pagina ES | Equivalente EN esperado | Estado | Scope |
| --- | --- | --- | --- |
| `es/blog/acne-adulto/index.html` | `n/a` | `no_mapping` | `content` |
| `es/blog/bioestimuladores-vs-rellenos/index.html` | `n/a` | `no_mapping` | `content` |
| `es/blog/como-elegir-dermatologo-quito/index.html` | `n/a` | `no_mapping` | `content` |
| `es/blog/melasma-embarazo/index.html` | `n/a` | `no_mapping` | `content` |
| `es/blog/proteccion-solar-ecuador/index.html` | `n/a` | `no_mapping` | `content` |
| `es/blog/senales-alarma-lunares/index.html` | `n/a` | `no_mapping` | `content` |
| `es/software/turnero-clinicas/caso-aurora-derm/index.html` | `en/software/clinic-flow-suite/aurora-derm-case-study/index.html` | `missing` | `public_product` |
| `es/software/turnero-clinicas/empezar/index.html` | `en/software/clinic-flow-suite/buyer-pack/index.html` | `missing` | `public_product` |
| `es/software/turnero-clinicas/precios/index.html` | `en/software/clinic-flow-suite/buyer-pack/index.html` | `missing` | `public_product` |
| `es/telemedicina/consulta/index.html` | `en/telemedicine/consulta/index.html` | `missing` | `public_product` |
| `es/telemedicina/sala/index.html` | `en/telemedicine/sala/index.html` | `missing` | `public_product` |

Notas:

- `empezar/` y `precios/` hoy colapsan conceptualmente en `buyer-pack`; antes de traducir conviene decidir si EN mantiene una sola ruta o si se separan dos superficies.
- Las 6 entradas del blog son candidatas naturales despues de abrir el indice EN.
- `telemedicina/consulta/` y `telemedicina/sala/` tienen mapping bastante directo y son buenas candidatas para un sprint corto de paridad funcional.

## Baja prioridad o fuera de foco de paridad publica

Estas rutas hoy existen solo en ES, pero varias pertenecen a portal autenticado, operaciones o soportes locales. No conviene meterlas en la misma cola que marketing y conversion.

| Pagina ES | Equivalente EN actual | Estado | Scope |
| --- | --- | --- | --- |
| `es/bienvenida-medico/index.html` | `n/a` | `no_mapping` | `ops_or_support` |
| `es/gift-cards/index.html` | `n/a` | `no_mapping` | `public_misc` |
| `es/membresia/index.html` | `n/a` | `no_mapping` | `public_misc` |
| `es/mi-turno/index.html` | `n/a` | `no_mapping` | `ops_or_support` |
| `es/pago/index.html` | `n/a` | `no_mapping` | `public_misc` |
| `es/paquetes/index.html` | `n/a` | `no_mapping` | `public_misc` |
| `es/portal/consentimiento/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/fotos/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/historial/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/login/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/pagos/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/plan/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/receta/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/portal/referidos/index.html` | `n/a` | `no_mapping` | `authenticated_portal` |
| `es/primera-consulta/index.html` | `n/a` | `no_mapping` | `public_misc` |
| `es/promociones/index.html` | `n/a` | `no_mapping` | `public_misc` |
| `es/referidos/index.html` | `n/a` | `no_mapping` | `public_misc` |
| `es/status/index.html` | `n/a` | `no_mapping` | `ops_or_support` |
| `es/verificar-documento/index.html` | `n/a` | `no_mapping` | `ops_or_support` |

## Conclusiones operativas

- La deuda de paridad ya no esta en `servicios`; ese frente quedo cubierto.
- La brecha EN/ES realmente accionable hoy se concentra en:
  - booking y pre-intake publico
  - indice y cluster editorial del blog
  - dos superficies de telemedicina
  - tres superficies de software EN que ya tienen slug objetivo claro
- Si se busca un cierre incremental, el mejor siguiente lote seria:
  - `es/agendar/`
  - `es/blog/`
  - `es/pre-consulta/`
  - `es/telemedicina/consulta/`
  - `es/telemedicina/sala/`
