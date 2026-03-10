<?php

declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/AppDownloadsCatalog.php';

if (!headers_sent()) {
    header('Content-Type: text/html; charset=UTF-8');
    apply_security_headers(true);
}

function app_downloads_page_bool($value, bool $default): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (!is_string($value) && !is_numeric($value)) {
        return $default;
    }

    $normalized = strtolower(trim((string) $value));
    if ($normalized === '') {
        return $default;
    }
    if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }
    if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }

    return $default;
}

function app_downloads_page_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function app_downloads_page_surface(array $catalog): string
{
    $requested = strtolower(trim((string) ($_GET['surface'] ?? 'operator')));
    return array_key_exists($requested, $catalog) ? $requested : 'operator';
}

function app_downloads_page_platform(string $surface): string
{
    if ($surface === 'sala_tv') {
        return 'android_tv';
    }

    $requested = strtolower(trim((string) ($_GET['platform'] ?? 'win')));
    return $requested === 'mac' ? 'mac' : 'win';
}

function app_downloads_page_station(): string
{
    $requested = strtolower(trim((string) ($_GET['station'] ?? 'c1')));
    return $requested === 'c2' ? 'c2' : 'c1';
}

function app_downloads_page_build_surface_url_safe(array $surfaceConfig, string $surface, string $station, bool $lock, bool $oneTap): string
{
    $path = (string) ($surfaceConfig['webFallbackUrl'] ?? '/');
    $query = [];

    if ($surface === 'operator') {
        $query['station'] = $station === 'c2' ? 'c2' : 'c1';
        $query['lock'] = $lock ? '1' : '0';
        $query['one_tap'] = $oneTap ? '1' : '0';
    }

    return $path . ($query !== [] ? '?' . http_build_query($query) : '');
}

function app_downloads_page_build_query(string $surface, string $platform, string $station, bool $lock, bool $oneTap): string
{
    $query = [
        'surface' => $surface,
        'platform' => $platform,
    ];

    if ($surface === 'operator') {
        $query['station'] = $station;
        $query['lock'] = $lock ? '1' : '0';
        $query['one_tap'] = $oneTap ? '1' : '0';
    }

    return http_build_query($query);
}

function app_downloads_page_absolute(string $path): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return $path;
    }

    return $scheme . '://' . $host . $path;
}

$catalog = read_app_downloads_catalog();
$surface = app_downloads_page_surface($catalog);
$platform = app_downloads_page_platform($surface);
$station = app_downloads_page_station();
$lock = app_downloads_page_bool($_GET['lock'] ?? ($surface === 'operator' ? '1' : '0'), $surface === 'operator');
$oneTap = app_downloads_page_bool($_GET['one_tap'] ?? '0', false);
$surfaceConfig = $catalog[$surface];
$targetKey = $surface === 'sala_tv' ? 'android_tv' : $platform;
$downloadTarget = $surfaceConfig['targets'][$targetKey] ?? null;
$preparedSurfaceUrl = app_downloads_page_build_surface_url_safe($surfaceConfig, $surface, $station, $lock, $oneTap);
$absolutePreparedSurfaceUrl = app_downloads_page_absolute($preparedSurfaceUrl);
$absoluteDownloadUrl = $downloadTarget !== null
    ? app_downloads_page_absolute((string) ($downloadTarget['url'] ?? ''))
    : '';
$setupQuery = app_downloads_page_build_query($surface, $platform, $station, $lock, $oneTap);
$surfaceCards = [
    'operator' => [
        'title' => 'Operador',
        'eyebrow' => 'Genius Numpad 1000',
        'description' => 'Llamado, re-llamado, completar y no show con el numpad en el PC del consultorio.',
    ],
    'kiosk' => [
        'title' => 'Kiosco',
        'eyebrow' => 'Recepción de pacientes',
        'description' => 'Check-in y emisión de ticket en un equipo separado para mostrador o mini PC.',
    ],
    'sala_tv' => [
        'title' => 'Sala TV',
        'eyebrow' => 'TCL C655 / Google TV',
        'description' => 'Pantalla de llamados para pacientes con APK Android TV y fallback web.',
    ],
];
$hardwareNotes = [
    'operator' => [
        'Conecta el receptor USB del Genius Numpad 1000 al PC operador, no a la TV.',
        'Si el Enter del numpad no llega como `NumpadEnter`, calibra la tecla externa dentro de la app.',
        'Usa `C1 fijo` o `C2 fijo` cuando ese equipo quede dedicado a un consultorio.',
    ],
    'kiosk' => [
        'Mantén la impresora térmica conectada antes del primer ticket real.',
        'Deja el equipo en fullscreen y usa autostart si el kiosco permanece encendido todo el día.',
        'La versión web sigue disponible como respaldo inmediato.',
    ],
    'sala_tv' => [
        'Instala la APK directamente en la TCL C655 y prioriza Ethernet sobre Wi-Fi.',
        'Valida audio, campanilla y reconexión antes de dejar la pantalla en producción.',
        'Mantén `sala-turnos.html` como fallback de respaldo desde navegador.',
    ],
];
$surfaceTitle = $surfaceCards[$surface]['title'];
$surfaceEyebrow = $surfaceCards[$surface]['eyebrow'];
$surfaceDescription = $surfaceCards[$surface]['description'];
$initialPayload = [
    'catalog' => $catalog,
    'state' => [
        'surface' => $surface,
        'platform' => $platform,
        'station' => $station,
        'lock' => $lock,
        'oneTap' => $oneTap,
    ],
    'copy' => $surfaceCards,
    'notes' => $hardwareNotes,
];
?>
<!doctype html>
<html lang="es">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Centro de instalacion turnero - Piel en Armonia</title>
        <meta
            name="description"
            content="Descarga Operador, Kiosco y Sala TV con el perfil correcto para cada equipo."
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="stylesheet" href="/app-downloads/app-downloads.css?v=app-downloads-20260310-v2" />
    </head>
    <body class="app-downloads-body">
        <main class="app-downloads-shell">
            <section class="app-downloads-hero">
                <div class="app-downloads-hero__copy">
                    <p class="app-downloads-kicker">Centro de instalacion</p>
                    <h1>Prepara cada equipo sin mezclar operador, kiosco y TV</h1>
                    <p>
                        Usa esta pagina para elegir el dispositivo correcto, descargar la app adecuada
                        y validar la ruta operativa antes de ponerla en uso.
                    </p>
                    <div class="app-downloads-hero__actions">
                        <a href="/admin.html#queue">Abrir admin de soporte</a>
                        <a href="<?php echo app_downloads_page_escape($surfaceConfig['guideUrl'] ?? '/app-downloads/'); ?>">
                            Centro base
                        </a>
                    </div>
                </div>
                <div class="app-downloads-surface-strip">
                    <?php foreach ($surfaceCards as $surfaceKey => $card): ?>
                        <a
                            href="/app-downloads/?<?php echo app_downloads_page_escape(app_downloads_page_build_query(
                                $surfaceKey,
                                $surfaceKey === 'sala_tv'
                                    ? 'android_tv'
                                    : ($platform === 'mac' ? 'mac' : 'win'),
                                $station,
                                $surfaceKey === 'operator' ? $lock : false,
                                $surfaceKey === 'operator' ? $oneTap : false
                            )); ?>"
                            data-surface-card="<?php echo app_downloads_page_escape($surfaceKey); ?>"
                            class="app-downloads-surface-card<?php echo $surfaceKey === $surface ? ' is-active' : ''; ?>"
                        >
                            <span><?php echo app_downloads_page_escape($card['eyebrow']); ?></span>
                            <strong><?php echo app_downloads_page_escape($card['title']); ?></strong>
                            <small><?php echo app_downloads_page_escape($card['description']); ?></small>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>

            <section class="app-downloads-grid">
                <form
                    id="appDownloadsConfigurator"
                    class="app-downloads-panel app-downloads-configurator"
                    method="get"
                    action="/app-downloads/"
                >
                    <div>
                        <p class="app-downloads-kicker">Preset del equipo</p>
                        <h2>Elegir dispositivo y perfil</h2>
                        <p>
                            Elige aquí el equipo real que vas a instalar. La recomendación cambia para
                            `Operador`, `Kiosco` y `Sala TV`.
                        </p>
                    </div>
                    <label class="app-downloads-field" for="appDownloadsSurface">
                        <span>Equipo</span>
                        <select id="appDownloadsSurface" name="surface">
                            <option value="operator"<?php echo $surface === 'operator' ? ' selected' : ''; ?>>Operador</option>
                            <option value="kiosk"<?php echo $surface === 'kiosk' ? ' selected' : ''; ?>>Kiosco</option>
                            <option value="sala_tv"<?php echo $surface === 'sala_tv' ? ' selected' : ''; ?>>Sala TV</option>
                        </select>
                    </label>
                    <label
                        class="app-downloads-field<?php echo $surface === 'sala_tv' ? ' is-hidden' : ''; ?>"
                        id="appDownloadsPlatformField"
                        for="appDownloadsPlatform"
                    >
                        <span>Plataforma</span>
                        <select id="appDownloadsPlatform" name="platform">
                            <option value="win"<?php echo $platform === 'win' ? ' selected' : ''; ?>>Windows</option>
                            <option value="mac"<?php echo $platform === 'mac' ? ' selected' : ''; ?>>macOS</option>
                        </select>
                    </label>
                    <div
                        id="appDownloadsOperatorFields"
                        class="app-downloads-operator-fields<?php echo $surface === 'operator' ? '' : ' is-hidden'; ?>"
                    >
                        <label class="app-downloads-field" for="appDownloadsStation">
                            <span>Consultorio</span>
                            <select id="appDownloadsStation" name="station">
                                <option value="c1"<?php echo $station === 'c1' ? ' selected' : ''; ?>>C1</option>
                                <option value="c2"<?php echo $station === 'c2' ? ' selected' : ''; ?>>C2</option>
                            </select>
                        </label>
                        <label class="app-downloads-toggle">
                            <input id="appDownloadsLock" name="lock" type="checkbox"<?php echo $lock ? ' checked' : ''; ?> />
                            <span>Fijar el equipo a ese consultorio</span>
                        </label>
                        <label class="app-downloads-toggle">
                            <input id="appDownloadsOneTap" name="one_tap" type="checkbox"<?php echo $oneTap ? ' checked' : ''; ?> />
                            <span>Activar modo 1 tecla</span>
                        </label>
                    </div>
                    <div class="app-downloads-query">
                        <span>Preset actual</span>
                        <code id="appDownloadsQueryPreview"><?php echo app_downloads_page_escape($setupQuery); ?></code>
                    </div>
                    <noscript>
                        <button type="submit" class="app-downloads-primary-btn">Actualizar preset</button>
                    </noscript>
                </form>

                <section class="app-downloads-panel app-downloads-result">
                    <div>
                        <p id="appDownloadsResultEyebrow" class="app-downloads-kicker">
                            <?php echo app_downloads_page_escape($surfaceEyebrow); ?>
                        </p>
                        <h2 id="appDownloadsResultTitle"><?php echo app_downloads_page_escape($surfaceTitle); ?></h2>
                        <p id="appDownloadsResultDescription">
                            <?php echo app_downloads_page_escape($surfaceDescription); ?>
                        </p>
                    </div>
                    <div class="app-downloads-result__meta">
                        <article>
                            <span>Version</span>
                            <strong id="appDownloadsVersion">
                                v<?php echo app_downloads_page_escape((string) ($surfaceConfig['version'] ?? '0.1.0')); ?>
                            </strong>
                        </article>
                        <article>
                            <span>Actualizado</span>
                            <strong id="appDownloadsUpdatedAt">
                                <?php echo app_downloads_page_escape((string) ($surfaceConfig['updatedAt'] ?? '')); ?>
                            </strong>
                        </article>
                    </div>
                    <div class="app-downloads-artifact-card">
                        <span>Descarga recomendada</span>
                        <strong id="appDownloadsTargetLabel">
                            <?php echo app_downloads_page_escape((string) (($downloadTarget['label'] ?? 'Sin artefacto'))); ?>
                        </strong>
                        <code id="appDownloadsTargetUrl">
                            <?php echo app_downloads_page_escape($absoluteDownloadUrl); ?>
                        </code>
                    </div>
                    <div class="app-downloads-artifact-card">
                        <span>Ruta operativa preparada</span>
                        <strong>Fallback web</strong>
                        <code id="appDownloadsPreparedUrl"><?php echo app_downloads_page_escape($absolutePreparedSurfaceUrl); ?></code>
                    </div>
                    <div class="app-downloads-actions">
                        <a
                            id="appDownloadsPrimaryAction"
                            href="<?php echo app_downloads_page_escape($absoluteDownloadUrl); ?>"
                            class="app-downloads-primary-btn"
                            <?php echo $surface !== 'sala_tv' ? 'download' : ''; ?>
                        >
                            <?php echo $surface === 'sala_tv' ? 'Descargar APK' : 'Descargar instalador'; ?>
                        </a>
                        <button
                            id="appDownloadsCopyDownloadBtn"
                            type="button"
                            data-copy-target="download"
                        >
                            Copiar descarga
                        </button>
                        <a id="appDownloadsOpenPreparedBtn" href="<?php echo app_downloads_page_escape($absolutePreparedSurfaceUrl); ?>" target="_blank" rel="noopener">
                            Abrir ruta preparada
                        </a>
                        <button
                            id="appDownloadsCopyPreparedBtn"
                            type="button"
                            data-copy-target="prepared"
                        >
                            Copiar ruta preparada
                        </button>
                        <a
                            id="appDownloadsQrBtn"
                            href="https://api.qrserver.com/v1/create-qr-code/?size=360x360&amp;data=<?php echo rawurlencode($surface === 'sala_tv' ? $absoluteDownloadUrl : $absolutePreparedSurfaceUrl); ?>"
                            target="_blank"
                            rel="noopener"
                        >
                            Mostrar QR
                        </a>
                    </div>
                    <section class="app-downloads-setup-card" aria-labelledby="appDownloadsSetupTitle">
                        <div class="app-downloads-setup-card__header">
                            <span>Estado de puesta en marcha</span>
                            <strong id="appDownloadsSetupTitle">Comprobando equipo</strong>
                        </div>
                        <p id="appDownloadsSetupSummary" class="app-downloads-setup-card__summary">
                            Verifica que el instalador y la ruta preparada respondan antes de pasar al equipo final.
                        </p>
                        <div id="appDownloadsSetupChecks" class="app-downloads-setup-checks"></div>
                    </section>
                    <ul id="appDownloadsNotes" class="app-downloads-notes">
                        <?php foreach ($hardwareNotes[$surface] as $note): ?>
                            <li><?php echo app_downloads_page_escape($note); ?></li>
                        <?php endforeach; ?>
                    </ul>
                </section>
            </section>
        </main>

        <div id="appDownloadsToast" class="app-downloads-toast" hidden></div>
        <script id="appDownloadsCatalogData" type="application/json"><?php echo json_encode($initialPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?></script>
        <script src="/app-downloads/app-downloads.js?v=app-downloads-20260310-v2"></script>
    </body>
</html>
