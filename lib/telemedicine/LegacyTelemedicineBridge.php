<?php

declare(strict_types=1);

require_once __DIR__ . '/TelemedicineChannelMapper.php';
require_once __DIR__ . '/TelemedicineIntakeService.php';

final class LegacyTelemedicineBridge
{
    private TelemedicineIntakeService $intakeService;

    public function __construct()
    {
        $this->intakeService = new TelemedicineIntakeService();
    }

    public function createPaymentIntentDraft(array $store, array $appointment, array $paymentIntent = []): array
    {
        if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
            return ['store' => $store, 'appointment' => $appointment, 'intake' => null];
        }

        return $this->intakeService->createOrUpdateDraft($store, $appointment, $paymentIntent);
    }

    public function finalizeBookedAppointment(array $store, array $appointment): array
    {
        if (!TelemedicineChannelMapper::isTelemedicineService((string) ($appointment['service'] ?? ''))) {
            return ['store' => $store, 'appointment' => $appointment, 'intake' => null];
        }

        return $this->intakeService->finalizeBooking($store, $appointment);
    }
}
