<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/TurneroClinicProfile.php';

final class BrandingController
{
    public static function meta(array $context): void
    {
        $profile = read_turnero_clinic_profile();
        $branding = $profile['branding'] ?? [];

        json_response([
            'ok' => true,
            'data' => [
                'name' => (string) ($branding['name'] ?? 'Aurora Derm'),
                'short_name' => (string) ($branding['short_name'] ?? 'Aurora'),
                'city' => (string) ($branding['city'] ?? 'Quito'),
                'logo_url' => (string) ($branding['logo_url'] ?? ''),
            ],
        ]);
    }
    public static function manifest(array $context): void
    {
        $profile = read_turnero_clinic_profile();
        $branding = $profile['branding'] ?? [];
        $theme = $branding['theme'] ?? [];

        $manifestPath = __DIR__ . '/../manifest.json';
        if (!file_exists($manifestPath)) {
            http_response_code(404);
            echo json_encode(['error' => 'Base manifest not found']);
            exit;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true) ?? [];

        if (!empty($branding['name'])) {
            $manifest['name'] = $branding['name'];
            $manifest['short_name'] = $branding['name'];
        }

        if (!empty($theme['primary_color'])) {
            $manifest['theme_color'] = $theme['primary_color'];
        }

        header('Content-Type: application/manifest+json; charset=utf-8');
        header('Cache-Control: public, max-age=60');
        echo json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function css(array $context): void
    {
        $profile = read_turnero_clinic_profile();
        $theme = $profile['branding']['theme'] ?? [];

        $primaryHex = $theme['primary_color'] ?? '#248a65';
        $accentHex = $theme['accent_color'] ?? '#e6aa16';

        $primaryHsl = self::hexToHsl($primaryHex);
        $accentHsl = self::hexToHsl($accentHex);

        $hP = $primaryHsl[0];
        $sP = $primaryHsl[1];
        $lP = $primaryHsl[2];

        $hA = $accentHsl[0];
        $sA = $accentHsl[1];
        $lA = $accentHsl[2];

        // Generate discrete tokens for primary (aurora)
        $a50  = self::formatHsl($hP, max(0, $sP - 0), min(100, $lP + 60));
        $a100 = self::formatHsl($hP, max(0, $sP - 5), min(100, $lP + 54));
        $a200 = self::formatHsl($hP, max(0, $sP - 10), min(100, $lP + 42));
        $a400 = self::formatHsl($hP, max(0, $sP - 5), min(100, $lP + 12));
        $a600 = self::formatHsl($hP, $sP, $lP); // Base
        $a800 = self::formatHsl($hP, min(100, $sP + 5), max(0, $lP - 14));
        $a900 = self::formatHsl($hP, min(100, $sP + 10), max(0, $lP - 22));

        // Generate discrete tokens for accent (gold)
        $g300 = self::formatHsl($hA, min(100, $sA + 5), min(100, $lA + 23));
        $g500 = self::formatHsl($hA, $sA, $lA); // Base
        $g700 = self::formatHsl($hA, max(0, $sA - 5), max(0, $lA - 14));

        $css = "/* Dynamic Whitelabel Branding CSS */\n:root {\n";
        $css .= "  --color-aurora-50: {$a50};\n";
        $css .= "  --color-aurora-100: {$a100};\n";
        $css .= "  --color-aurora-200: {$a200};\n";
        $css .= "  --color-aurora-400: {$a400};\n";
        $css .= "  --color-aurora-600: {$a600};\n";
        $css .= "  --color-aurora-800: {$a800};\n";
        $css .= "  --color-aurora-900: {$a900};\n\n";

        $css .= "  --color-gold-300: {$g300};\n";
        $css .= "  --color-gold-500: {$g500};\n";
        $css .= "  --color-gold-700: {$g700};\n";
        $css .= "}\n";

        header('Content-Type: text/css; charset=utf-8');
        header('Cache-Control: public, max-age=60'); // short cache to allow fast updates
        echo $css;
        exit;
    }

    private static function hexToHsl(string $hex): array
    {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        $r = hexdec(substr($hex, 0, 2)) / 255;
        $g = hexdec(substr($hex, 2, 2)) / 255;
        $b = hexdec(substr($hex, 4, 2)) / 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;

        if ($max === $min) {
            $h = $s = 0; // achromatic
        } else {
            $d = $max - $min;
            $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
            switch ($max) {
                case $r:
                    $h = ($g - $b) / $d + ($g < $b ? 6 : 0);
                    break;
                case $g:
                    $h = ($b - $r) / $d + 2;
                    break;
                case $b:
                    $h = ($r - $g) / $d + 4;
                    break;
            }
            $h /= 6;
        }

        return [
            intval(round($h * 360)),
            intval(round($s * 100)),
            intval(round($l * 100))
        ];
    }

    private static function formatHsl(int $h, int $s, int $l): string
    {
        return "hsl({$h}, {$s}%, {$l}%)";
    }
}
