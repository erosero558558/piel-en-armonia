# Auditoría de Dashboard de Grafana (S7-32)

Este documento contiene la auditoría de los paneles existentes en `grafana/dashboard.json`, contrastando las métricas requeridas contra las emisones reales en el código fuente de Aurora Derm (PHP/Prometheus).

## Resumen de Estado

| ID | Panel | Métrica de Prometheus | Estado | Notas |
|---|---|---|---|---|
| 1 | API Latency | `http_request_duration_seconds` | ✅ **live** | Emitida correctamente en `lib/ApiKernel.php`. |
| 2 | Conversion Funnel (1h) | `conversion_funnel_events_total` | ✅ **live** | Eventos del funnel emitidos en `lib/ApiKernel.php`. |
| 3 | Revenue per Day | `pielarmonia_revenue_daily_total` | ❌ **roto** (o decorativo) | No hay rastros de la emisión de esta métrica en el backend. Aparece en scripts legacy de PowerShell pero no en PHP. |
| 4 | No-Show Rate | `pielarmonia_no_show_rate` | ❌ **roto** (o decorativo) | Ausente en el código fuente de la aplicación. |
| 5 | HTTP Status Codes | `http_request_duration_seconds_count` | ✅ **live** | Emisión acoplada a la latencia de API, con la etiqueta `status`. |
| 6 | PHP Memory Usage (p95) | `php_memory_usage_bytes` | ✅ **live** | Emitida mediante `memory_get_peak_usage()` en `lib/ApiKernel.php`. |
| 7 | Store File Size | `pielarmonia_store_file_size_bytes` | ❌ **roto** (o decorativo) | Ausente en el código. Nunca se informa el tamaño del JSON a Prometheus. |
| 8 | Store Read Latency (p99) | `store_read_duration_seconds` | ✅ **live** | Emitida correctamente en las operaciones del repositorio. |
| 9 | Popular Services | `pielarmonia_service_popularity_total` | ❌ **roto** (o decorativo) | Ausente en el código fuente de la aplicación. |
| 10 | Avg Lead Time (30d) | `pielarmonia_lead_time_seconds_avg` | ❌ **roto** (o decorativo) | Ausente en el código fuente de la aplicación. |
| 11 | Appointments by Status | `pielarmonia_appointments_total` | ❌ **roto** (o decorativo) | No se emite mediante Prometheus. |

### Conclusión y Siguientes Pasos
Seis de los once paneles están visualizando métricas fantasma (`roto` o `decorativo`). Estas métricas relativas al negocio ("Revenue", "Appointments", "Services") o operacionales pasivas ("File Size") deben implementarse como un exportador nativo, o eliminarse del dashboard para evitar la ilusión de "No Data" ante un posible incidente operativo.
