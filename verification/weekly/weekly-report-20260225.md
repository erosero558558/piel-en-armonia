# Weekly Production Report - Piel en Armonia

- generatedAt: 2026-02-25T18:41:26Z
- domain: https://pielarmonia.com
- reportDate: 2026-02-25

## Conversion

- source: metrics_counter
- view_booking: 322
- start_checkout: 1
- start_checkout_rate_pct: 0.31
- booking_confirmed: 1
- checkout_abandon: 9
- booking_error: 0
- checkout_error: 0
- booking_error_rate_pct: 0
- booking_confirmed_rate_pct: 100
- checkout_abandon_rate_pct: 900
- conversion_warning_sample_sufficient: False (start_checkout >= 10)
- conversion_min_warn_pct: 25
- conversion_drop_warn_pct: 15
- start_checkout_warning_sample_sufficient: True (view_booking >= 100)
- start_checkout_min_warn_pct: 0.25
- start_checkout_drop_warn_pct: 0.2
- previous_report_generated_at: 02/25/2026 18:20:32
- start_checkout_rate_delta_pct: -0.01
- booking_confirmed_rate_delta_pct: 0

## Calendar Health

- calendar_source: google
- calendar_mode: live
- calendar_reachable: True
- calendar_token_healthy: True
- calendar_last_success_at: 02/25/2026 13:30:16

## Observability

- sentry_backend_configured: True
- sentry_frontend_configured: True

## Retention

- appointments_total: 17
- appointments_non_cancelled: 3
- status_confirmed: 3
- status_completed: 0
- status_no_show: 0
- status_cancelled: 14
- no_show_rate_pct: 0
- completion_rate_pct: 0
- unique_patients: 2
- recurrent_patients: 1
- recurrence_rate_pct: 50
- recurrence_warning_sample_sufficient: False (unique_patients >= 5)
- recurrence_min_warn_pct: 30
- recurrence_drop_warn_pct: 15
- previous_report_generated_at: 02/25/2026 18:20:32
- no_show_rate_delta_pct: 0
- recurrence_rate_delta_pct: 0

## Latency Bench

- core_p95_max_ms: 679.11 (target <= 800)
- figo_post_p95_ms: 399.8 (target <= 2500)

| endpoint     | samples | avg_ms | p95_ms | max_ms | status_failures | network_failures |
| ------------ | ------: | -----: | -----: | -----: | --------------: | ---------------: |
| health       |       5 | 350.01 | 367.89 | 367.89 |               0 |                0 |
| reviews      |       5 | 343.41 |  349.9 |  349.9 |               0 |                0 |
| availability |       5 | 412.04 | 679.11 | 679.11 |               0 |                0 |
| figo-post    |       5 | 382.37 |  399.8 |  399.8 |               0 |                0 |

## Warnings

- warnings_total: 0
- warnings_critical: 0
- warnings_non_critical: 0

- none
