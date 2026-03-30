<?php
declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../telemedicine/ClinicalMediaService.php';
require_once __DIR__ . '/ClinicalHistorySessionService.php';
require_once __DIR__ . '/ClinicalHistoryDocumentService.php';
require_once __DIR__ . '/ClinicalHistoryValidationService.php';

final class ClinicalHistoryService
{
    private ClinicalHistoryAIService $ai;

    public ClinicalHistorySessionService $sessionService;
    public ClinicalHistoryDocumentService $documentService;
    public ClinicalHistoryValidationService $validationService;

    public function __construct(?ClinicalHistoryAIService $ai = null)
    {
        $this->ai = $ai ?? new ClinicalHistoryAIService();
        $this->sessionService = new ClinicalHistorySessionService($this, $this->ai);
        $this->documentService = new ClinicalHistoryDocumentService($this, $this->ai);
        $this->validationService = new ClinicalHistoryValidationService($this, $this->ai);
    }

    public function invokeServiceMethod(string $name, array $args)
    {
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->sessionService, $name)) return $this->sessionService->$name(...$args);
        if (method_exists($this->documentService, $name)) return $this->documentService->$name(...$args);
        if (method_exists($this->documentService, $name)) return $this->documentService->$name(...$args);
        if (method_exists($this->documentService, $name)) return $this->documentService->$name(...$args);
        if (method_exists($this->documentService, $name)) return $this->documentService->$name(...$args);
        if (method_exists($this->documentService, $name)) return $this->documentService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);
        if (method_exists($this->validationService, $name)) return $this->validationService->$name(...$args);

        throw new BadMethodCallException("Método no encontrado en delegación de dominio Clínico: " . $name);
    }

    public function __call(string $name, array $args)
    {
        return $this->invokeServiceMethod($name, $args);
    }

}
