<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/onboarding/OnboardingService.php';

/**
 * OnboardingController — S18-02 + S18-03.
 *
 * Endpoints:
 *   GET  /api.php?resource=onboarding-progress&clinic_id=X   → progress
 *   POST /api.php?resource=onboarding-step                   → update step
 *   GET  /api.php?resource=walkthrough-config&surface=admin  → walkthrough steps S18-03
 */
final class OnboardingController
{
    // ── S18-02: Onboarding progress ───────────────────────────────

    private static function progress(array $context): void
    {
        require_admin_auth();

        $store    = is_array($context['store'] ?? null) ? $context['store'] : [];
        $clinicId = trim((string) ($_GET['clinic_id'] ?? 'default'));

        $progress = OnboardingService::getProgress($store, $clinicId);

        json_response(['ok' => true, 'data' => $progress]);
    }

    private static function updateStep(array $context): void
    {
        require_admin_auth();

        $store    = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload  = require_json_body();

        $clinicId = trim((string) ($payload['clinic_id'] ?? 'default'));
        $stepId   = trim((string) ($payload['step_id'] ?? ''));
        $status   = trim((string) ($payload['status'] ?? 'done'));
        $blocker  = trim((string) ($payload['blocker'] ?? ''));
        $stepPayload = is_array($payload['payload'] ?? null) ? $payload['payload'] : [];

        if ($stepId === '') {
            json_response(['ok' => false, 'error' => 'step_id requerido'], 400);
            return;
        }

        $result = OnboardingService::updateStep($store, $clinicId, $stepId, $status, $blocker, $stepPayload);
        if (($result['ok'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => $result['error'] ?? 'Error'], 422);
            return;
        }

        $nextStore = is_array($result['store'] ?? null) ? $result['store'] : $store;
        if (!write_store($nextStore, false)) {
            json_response(['ok' => false, 'error' => 'No se pudo guardar el progreso'], 500);
            return;
        }

        json_response(['ok' => true, 'data' => [
            'progress' => $result['progress'],
            'step' => $stepId,
            'percent' => $result['progress']['percent'] ?? 0,
            'blockers' => array_values(array_filter(array_column($result['progress']['steps'], 'blocker')))
        ]]);
    }

    // ── S18-03: Walkthrough config ────────────────────────────────

    /**
     * Returns the contextual walkthrough steps for a given surface (admin/operator/kiosk).
     * The frontend stores completion in localStorage and calls this to get steps.
     */
    private static function walkthroughConfig(array $context): void
    {
        $surface = strtolower(trim((string) ($_GET['surface'] ?? 'admin')));

        $steps = match ($surface) {
            'operator' => self::operatorWalkthroughSteps(),
            'kiosk'    => self::kioskWalkthroughSteps(),
            default    => self::adminWalkthroughSteps(),
        };

        json_response([
            'ok'   => true,
            'data' => [
                'surface'    => $surface,
                'version'    => '1.0.0',
                'canSkip'    => true,
                'steps'      => $steps,
                'stepCount'  => count($steps),
                'storageKey' => 'aurora_walkthrough_done_' . $surface,
            ],
        ]);
    }

    // ── Walkthrough step definitions ──────────────────────────────

    private static function adminWalkthroughSteps(): array
    {
        return [
            [
                'id'          => 'emit_ticket',
                'step'        => 1,
                'title'       => 'Emite tu primer turno de prueba',
                'description' => 'Ve a la sección Turnos y crea un turno de prueba para ver cómo funciona el sistema.',
                'target'      => '#nav-turnos',
                'targetHint'  => 'Clic en "Turnos" en el menú lateral',
                'action'      => 'click_nav',
                'canSkip'     => true,
            ],
            [
                'id'          => 'view_agenda',
                'step'        => 2,
                'title'       => 'Revisa la agenda del día',
                'description' => 'En "Agenda" puedes ver todas las citas del día, semana y mes. Filtra por médico o consultorio.',
                'target'      => '#nav-agenda',
                'targetHint'  => 'Clic en "Agenda" en el menú lateral',
                'action'      => 'click_nav',
                'canSkip'     => true,
            ],
            [
                'id'          => 'view_dashboard',
                'step'        => 3,
                'title'       => 'Explora el dashboard',
                'description' => 'El dashboard muestra métricas clave: pacientes atendidos, conversión, ingresos del mes y alertas activas.',
                'target'      => '#nav-dashboard',
                'targetHint'  => 'Clic en "Dashboard" en el menú lateral',
                'action'      => 'click_nav',
                'canSkip'     => true,
            ],
            [
                'id'          => 'configure_clinic',
                'step'        => 4,
                'title'       => 'Configura tu clínica',
                'description' => 'Agrega tu logo, elige colores y configura el horario de atención desde "Configuración".',
                'target'      => '#nav-config',
                'targetHint'  => 'Clic en "Configuración" en el menú lateral',
                'action'      => 'click_nav',
                'canSkip'     => true,
            ],
            [
                'id'          => 'finish',
                'step'        => 5,
                'title'       => '¡Todo listo!',
                'description' => 'Ya conoces las secciones principales de Aurora Derm. Puedes reactivar este tutorial desde el menú "Ayuda" en cualquier momento.',
                'target'      => null,
                'targetHint'  => '',
                'action'      => 'complete',
                'canSkip'     => false,
            ],
        ];
    }

    private static function operatorWalkthroughSteps(): array
    {
        return [
            [
                'id'          => 'call_turn',
                'step'        => 1,
                'title'       => 'Llama al próximo turno',
                'description' => 'Presiona el botón "Llamar siguiente" para anunciar el turno en el display y en el kiosk.',
                'target'      => '#btn-llamar-turno',
                'targetHint'  => 'Botón "Llamar siguiente" en la parte superior',
                'action'      => 'click',
                'canSkip'     => true,
            ],
            [
                'id'          => 'mark_attended',
                'step'        => 2,
                'title'       => 'Marca el turno como atendido',
                'description' => 'Cuando el paciente entre al consultorio, presiona "Atendido" para liberar el turno.',
                'target'      => '#btn-atender',
                'targetHint'  => 'Botón "Atendido" en el turno activo',
                'action'      => 'click',
                'canSkip'     => true,
            ],
            [
                'id'          => 'view_queue',
                'step'        => 3,
                'title'       => 'Ve la cola completa',
                'description' => 'La cola muestra todos los turnos pendientes, en espera y llamados del día.',
                'target'      => '#queue-list',
                'targetHint'  => 'Lista de turnos en el panel central',
                'action'      => 'highlight',
                'canSkip'     => true,
            ],
            [
                'id'          => 'finish',
                'step'        => 4,
                'title'       => '¡Listo para operar!',
                'description' => 'Ya sabes cómo gestionar la cola de turnos. Reactiva este tutorial desde "Ayuda".',
                'target'      => null,
                'targetHint'  => '',
                'action'      => 'complete',
                'canSkip'     => false,
            ],
        ];
    }

    private static function kioskWalkthroughSteps(): array
    {
        return [
            [
                'id'          => 'take_ticket',
                'step'        => 1,
                'title'       => 'Toma tu turno',
                'description' => 'Toca el botón del servicio que necesitas para obtener tu número de turno.',
                'target'      => '.service-btn',
                'targetHint'  => 'Botones de servicios en pantalla',
                'action'      => 'highlight',
                'canSkip'     => false,
            ],
            [
                'id'          => 'view_number',
                'step'        => 2,
                'title'       => 'Tu número aparece aquí',
                'description' => 'Este es tu número de turno. Espera a que sea llamado en pantalla o por audio.',
                'target'      => '#ticket-number',
                'targetHint'  => 'Número en pantalla',
                'action'      => 'highlight',
                'canSkip'     => false,
            ],
        ];
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:onboarding-progress':
                self::progress($context);
                return;
            case 'GET:onboarding-status':
                self::progress($context);
                return;
            case 'POST:onboarding-step':
                self::updateStep($context);
                return;
            case 'GET:walkthrough-config':
                self::walkthroughConfig($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'progress':
                            self::progress($context);
                            return;
                        case 'progress':
                            self::progress($context);
                            return;
                        case 'updateStep':
                            self::updateStep($context);
                            return;
                        case 'walkthroughConfig':
                            self::walkthroughConfig($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
