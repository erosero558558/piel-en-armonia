# Weekly Production Report - Piel en Armonia

- generatedAt: 2026-03-02T17:23:32Z
- domain: https://pielarmonia.com
- reportDate: 2026-03-02

## Conversion

- source: metrics_counter
- view_booking: 494
- start_checkout: 1
- start_checkout_rate_pct: 0.2
- booking_confirmed: 1
- checkout_abandon: 18
- booking_error: 0
- checkout_error: 0
- booking_error_rate_pct: 0
- booking_confirmed_rate_pct: 100
- checkout_abandon_rate_pct: 1800
- conversion_warning_sample_sufficient: False (start_checkout >= 10)
- conversion_min_warn_pct: 25
- conversion_drop_warn_pct: 15
- start_checkout_warning_sample_sufficient: True (view_booking >= 100)
- start_checkout_min_warn_pct: 0.25
- start_checkout_drop_warn_pct: 0.2
- previous_report_generated_at: 2026-02-27T05:23:49Z
- start_checkout_rate_delta_pct: -0.02
- booking_confirmed_rate_delta_pct: 0

## Service Funnel

- source: missing
- rows: 0
- rows_detail_sample: 0 (detail_views >= 25)
- rows_checkout_sample: 0 (checkout_starts >= 5)
- alert_count: 0
- alert_codes: none
- alert_list: none
- checkout_to_confirmed_min_warn_pct: 35
- detail_to_confirmed_min_warn_pct: 8

- none

## Calendar Health

- calendar_source: google
- calendar_mode: live
- calendar_reachable: True
- calendar_token_healthy: True
- calendar_last_success_at: 2026-03-02T12:21:45-05:00

## Observability

- sentry_backend_configured: True
- sentry_frontend_configured: True

## Services Catalog

- services_catalog_source: file
- services_catalog_configured: True
- services_catalog_version: 2026.1
- services_catalog_count: 13

## Service Priorities

- service_priorities_source: catalog_only
- service_priorities_catalog_source: file
- service_priorities_catalog_version: 2026.1
- service_priorities_services_count: 13
- service_priorities_categories_count: 3
- service_priorities_featured_count: 3
- service_priorities_sort: hybrid
- service_priorities_audience:

## Retention

- appointments_total: 27
- appointments_non_cancelled: 3
- status_confirmed: 3
- status_completed: 0
- status_no_show: 0
- status_cancelled: 24
- no_show_rate_pct: 0
- completion_rate_pct: 0
- unique_patients: 2
- recurrent_patients: 1
- recurrence_rate_pct: 50
- recurrence_warning_sample_sufficient: False (unique_patients >= 5)
- recurrence_min_warn_pct: 30
- recurrence_drop_warn_pct: 15
- previous_report_generated_at: 2026-02-27T05:23:49Z
- no_show_rate_delta_pct: 0
- recurrence_rate_delta_pct: 0
- retention_baseline_source: persisted_file
- retention_baseline_generated_at: 02/25/2026 18:41:26
- retention_baseline_no_show_rate_pct: 0
- retention_baseline_recurrence_rate_pct: 50
- retention_trend_ready: True

## Retention Report Alerts

- source: unreachable
- days: 30
- alert_count: 0
- warn_count: 0
- critical_count: 0
- alert_codes: none
- error: Error en el servidor remoto: (401) No autorizado.

- none

## Idempotency

- requests_with_key: 0
- new: 0
- replay: 0
- conflict: 0
- unknown: 0
- replay_rate_pct: 0
- conflict_rate_pct: 0
- conflict_warning_sample_sufficient: False (requests_with_key >= 10)
- conflict_warn_pct_threshold: 5

## Latency Bench

- core_p95_max_ms: 671.16 (target <= 800)
- figo_post_p95_ms: 424.06 (target <= 2500)

| endpoint     | samples | avg_ms | p95_ms | max_ms | status_failures | network_failures |
| ------------ | ------: | -----: | -----: | -----: | --------------: | ---------------: |
| health       |      15 | 360.63 | 399.58 | 399.58 |               0 |                0 |
| reviews      |      15 |  369.8 |  547.1 |  547.1 |               0 |                0 |
| availability |      15 | 378.22 | 671.16 | 671.16 |               0 |                0 |
| figo-post    |      15 | 397.23 | 424.06 | 424.06 |               0 |                0 |

## Warnings

- warnings_total: 3
- warnings_critical: 0
- warnings_non_critical: 3

- retention_report_unreachable
- service_priorities_catalog_only
- start_checkout_rate_baja_0.2pct

## Warning Details

- code: retention_report_unreachable | severity: non_critical | impact: retention | runbook: docs/RUNBOOKS.md#31-monitoreo-diario
- code: service_priorities_catalog_only | severity: non_critical | impact: conversion | runbook: docs/RUNBOOKS.md#31-monitoreo-diario
- code: start_checkout_rate_baja_0.2pct | severity: non_critical | impact: conversion | runbook: docs/RUNBOOKS.md#31-monitoreo-diario

## Weekly Cycle Guardrail

- critical_free_cycle_target: 2
- consecutive_no_critical_weeks: 3
- cycle_ready: True
- cycle_status: ready
- cycle_reason: target_met
- last_critical_generated_at: none
- history_count: 3

- generatedAt: 2026-03-02T17:23:32Z | critical: 0 | total: 3 | source: current_run
- generatedAt: 2026-02-27T05:23:49Z | critical: 0 | total: 3 | source: history_file
- generatedAt: 2026-02-25T18:41:26Z | critical: 0 | total: 0 | source: history_file

## Incident Triage (<= 15 min)

- minute_0_5: run
  pm run gate:prod:fast and check health/availability/chat status.
- minute_5_10: pick first critical warning and follow
  unbookRef.
- minute_10_15: if still degraded, escalate and open/refresh incident issue [ALERTA PROD].

## Release Guardrails

- release_decision: warn
- release_reason: non_critical_warnings
- release_action: Allow release with monitoring and follow-up hardening task.
