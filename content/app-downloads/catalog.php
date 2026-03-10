<?php

declare(strict_types=1);

return [
    'operator' => [
        'version' => '0.1.0',
        'webFallbackUrl' => '/operador-turnos.html',
        'guideUrl' => '/app-downloads/?surface=operator',
        'targets' => [
            'win' => [
                'url' => '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                'label' => 'Windows',
            ],
            'mac' => [
                'url' => '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                'label' => 'macOS',
            ],
        ],
    ],
    'kiosk' => [
        'version' => '0.1.0',
        'webFallbackUrl' => '/kiosco-turnos.html',
        'guideUrl' => '/app-downloads/?surface=kiosk',
        'targets' => [
            'win' => [
                'url' => '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                'label' => 'Windows',
            ],
            'mac' => [
                'url' => '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                'label' => 'macOS',
            ],
        ],
    ],
    'sala_tv' => [
        'version' => '0.1.0',
        'webFallbackUrl' => '/sala-turnos.html',
        'guideUrl' => '/app-downloads/?surface=sala_tv',
        'targets' => [
            'android_tv' => [
                'url' => '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                'label' => 'Android TV APK',
            ],
        ],
    ],
];
