<?php

$lines = file('/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/controllers/OpenclawController.php');

$savePrescription = implode("", array_slice($lines, 551, 821 - 551 + 1));
$getPrescriptionPdf = implode("", array_slice($lines, 822, 848 - 822 + 1));
$checkInteractions = implode("", array_slice($lines, 950, 1291 - 950 + 1));
$helpers = implode("", array_slice($lines, 1774, 1902 - 1774 + 1));

// Replacements to decouple
$savePrescription = str_replace('self::normalizePrescriptionItemsPayload', 'OpenclawPrescriptionFacade::normalizePrescriptionItemsPayload', $savePrescription);
$savePrescription = str_replace('self::readStore', 'OpenclawController::readStore', $savePrescription);
$savePrescription = str_replace('self::mutateStore', 'OpenclawController::mutateStore', $savePrescription);
$savePrescription = str_replace('self::requireDoctorAuth()', 'OpenclawController::requireDoctorAuth()', $savePrescription);
$savePrescription = str_replace('self::logClinicalAiAction', 'OpenclawController::logClinicalAiAction', $savePrescription);
$savePrescription = str_replace('$result = self::', '$result = OpenclawController::', $savePrescription);

$getPrescriptionPdf = str_replace('self::readStore', 'OpenclawController::readStore', $getPrescriptionPdf);

$checkInteractions = str_replace('self::requireAuth()', 'OpenclawController::requireAuth()', $checkInteractions);
$checkInteractions = str_replace('self::normalize', 'OpenclawPrescriptionFacade::normalize', $checkInteractions);
$checkInteractions = str_replace('self::resolveActiveMedicationsForCase', 'OpenclawPrescriptionFacade::resolveActiveMedicationsForCase', $checkInteractions);
$checkInteractions = str_replace('self::medicationMatchesInteraction', 'OpenclawPrescriptionFacade::medicationMatchesInteraction', $checkInteractions);

$helpers = str_replace('self::normalize', 'OpenclawPrescriptionFacade::normalize', $helpers);
$helpers = str_replace('self::readStore', 'OpenclawController::readStore', $helpers);

$class = "<?php\n\ndeclare(strict_types=1);\n\nrequire_once __DIR__ . '/../../clinical_history/ClinicalHistoryRepository.php';\nrequire_once __DIR__ . '/../../clinical_history/ClinicalHistoryService.php';\nrequire_once __DIR__ . '/../../../controllers/OpenclawController.php';\n\nfinal class OpenclawPrescriptionFacade\n{\n";
$class .= $savePrescription . "\n\n";
$class .= $getPrescriptionPdf . "\n\n";
$class .= $checkInteractions . "\n\n";
$class .= $helpers . "\n";
$class .= "}\n";

file_put_contents('/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/lib/openclaw/facades/OpenclawPrescriptionFacade.php', $class);
