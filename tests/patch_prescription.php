<?php

$lines = file('/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/controllers/OpenclawController.php');

// Define replacements
$newSavePrescription = <<<PHP
    public static function savePrescription(array \$context): void
    {
        require_once __DIR__ . '/../lib/openclaw/facades/OpenclawPrescriptionFacade.php';
        OpenclawPrescriptionFacade::savePrescription(\$context);
    }
PHP;

$newGetPrescriptionPdf = <<<PHP
    public static function getPrescriptionPdf(array \$context): void
    {
        require_once __DIR__ . '/../lib/openclaw/facades/OpenclawPrescriptionFacade.php';
        OpenclawPrescriptionFacade::getPrescriptionPdf(\$context);
    }
PHP;

$newCheckInteractions = <<<PHP
    public static function checkInteractions(array \$context): void
    {
        require_once __DIR__ . '/../lib/openclaw/facades/OpenclawPrescriptionFacade.php';
        OpenclawPrescriptionFacade::checkInteractions(\$context);
    }
PHP;

// Replace lines
array_splice($lines, 1774, 1902 - 1774 + 1, array("")); // Helpers (1775-1902)
array_splice($lines, 950, 1291 - 950 + 1, array($newCheckInteractions . "\n")); // checkInteractions (951-1291)
array_splice($lines, 822, 848 - 822 + 1, array($newGetPrescriptionPdf . "\n")); // getPrescriptionPdf (823-848)
array_splice($lines, 551, 821 - 551 + 1, array($newSavePrescription . "\n")); // savePrescription (552-821)

// Note: array_splice in descending order of indices to avoid shifting issues when splicing!

file_put_contents('/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/controllers/OpenclawController.php', implode("", $lines));
