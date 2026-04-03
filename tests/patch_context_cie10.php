<?php

$lines = file('/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/controllers/OpenclawController.php');

$newPatient = <<<PHP
    public static function patient(array \$context): void
    {
        require_once __DIR__ . '/../lib/openclaw/facades/OpenclawContextFacade.php';
        OpenclawContextFacade::patient(\$context);
    }
PHP;

$newCie10Suggest = <<<PHP
    public static function cie10Suggest(array \$context): void
    {
        require_once __DIR__ . '/../lib/openclaw/facades/OpenclawCie10Facade.php';
        OpenclawCie10Facade::cie10Suggest(\$context);
    }
PHP;

$newProtocol = <<<PHP
    public static function protocol(array \$context): void
    {
        require_once __DIR__ . '/../lib/openclaw/facades/OpenclawCie10Facade.php';
        OpenclawCie10Facade::protocol(\$context);
    }
PHP;

// Must be in descending order to avoid shift!
array_splice($lines, 1149, 1190 - 1150 + 1, array("")); // genericProtocol (1150-1190)
array_splice($lines, 321, 341 - 322 + 1, array($newProtocol . "\n")); // protocol (322-341)
array_splice($lines, 236, 316 - 237 + 1, array($newCie10Suggest . "\n")); // cie10Suggest (237-316)
array_splice($lines, 28, 228 - 29 + 1, array($newPatient . "\n")); // patient (29-228)

file_put_contents('/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm/controllers/OpenclawController.php', implode("", $lines));
