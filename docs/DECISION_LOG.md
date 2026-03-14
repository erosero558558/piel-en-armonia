# Decision Log

## 2026-03-14 - Alcance del piloto turnero web por clinica

- Status: Accepted
- Context: La estrategia activa A2.0 requiere reabrir `queue/turnero` como un piloto web por clinica. El riesgo era reducir el alcance a una salida parcial y dejar una segunda decision pendiente dentro de la misma ola.
- Decision: El piloto A2.0 se define como una entrega web por clinica en cuatro superficies: `admin basic`, `operador`, `kiosco` y `sala`.
- Constraints: El piloto no depende de Electron, APK Android TV ni centro de descargas como blockers de salida. La fuente de verdad sera `clinic-profile`, con bloqueos por canon, readiness y smoke/gate de salida.
- Why: Esta opcion elimina deuda de decision, mantiene una demo punta a punta legible y conserva reversibilidad operativa al trabajar solo sobre superficies web ya existentes.
- Consequences: Backend y frontend deben cerrar el mismo contrato por clinica en las cuatro superficies. Si una superficie no cumple canon, se bloquea; no se abre una variante parcial del release.
- Review date: 2026-03-28
- Not doing now: `expert mode` del hub admin, instaladores Electron, `desktop-updates`, APK Android TV, centro de descargas como flujo principal, multi-tenant entre clinicas, agenda publica, pagos y superficies comerciales.
