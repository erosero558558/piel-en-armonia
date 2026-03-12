<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/CaseMediaFlowService.php';

final class CaseMediaFlowController
{
    public static function queue(array $context): void
    {
        self::requireAdmin($context);
        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::queue(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store()
            ),
        ]);
    }

    public static function caseGet(array $context): void
    {
        self::requireAdmin($context);
        $caseId = trim((string) ($_GET['caseId'] ?? ''));
        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::getCase(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $caseId
            ),
        ]);
    }

    public static function proposalGenerate(array $context): void
    {
        self::requireAdmin($context);
        $payload = require_json_body();

        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::generateProposal(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ], 201);
    }

    public static function proposalReview(array $context): void
    {
        self::requireAdmin($context);
        $payload = require_json_body();

        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::reviewProposal(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ]);
    }

    public static function publicationState(array $context): void
    {
        self::requireAdmin($context);
        $payload = require_json_body();

        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::publicationState(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $payload
            ),
        ]);
    }

    public static function privateAsset(array $context): void
    {
        self::requireAdmin($context);
        $asset = CaseMediaFlowService::resolvePrivateAsset(
            isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
            $_GET
        );
        self::streamFile($asset);
    }

    public static function publicStories(array $context): void
    {
        $locale = trim((string) ($_GET['locale'] ?? 'es'));
        json_response([
            'ok' => true,
            'data' => CaseMediaFlowService::publicStories(
                isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store(),
                $locale
            ),
        ]);
    }

    public static function publicMediaFile(array $context): void
    {
        $asset = CaseMediaFlowService::resolvePublicMediaFile($_GET);
        self::streamFile($asset);
    }

    /**
     * @param array<string,mixed> $asset
     */
    private static function streamFile(array $asset): void
    {
        $path = (string) ($asset['path'] ?? '');
        if ($path === '' || !is_file($path)) {
            json_response(['ok' => false, 'error' => 'Archivo no encontrado'], 404);
        }

        if (!headers_sent()) {
            header('Content-Type: ' . (string) ($asset['mime'] ?? 'application/octet-stream'));
            header('Content-Length: ' . (string) filesize($path));
            header('Cache-Control: public, max-age=300');
            header('Content-Disposition: inline; filename="' . basename((string) ($asset['filename'] ?? basename($path))) . '"');
        }

        readfile($path);
    }

    private static function requireAdmin(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }
}
