import re

with open('lib/routes.php', 'r', encoding='utf-8') as f:
    content = f.read()

target = """    $router->add('GET', 'clinical-history-gallery', [ClinicalHistoryController::class, 'galleryGet']);
    $router->add('GET', 'clinical-photos', [ClinicalMediaController::class, 'getClinicalPhotos']);
    $router->add('POST', 'clinical-photo-upload', [ClinicalMediaController::class, 'uploadClinicalPhoto']);
    $router->add('GET', 'clinical-record', [ClinicalHistoryController::class, 'recordGet']);
    $router->add('PATCH', 'clinical-record', [ClinicalHistoryController::class, 'recordPatch']);
    $router->add('POST', 'clinical-episode-action', [ClinicalHistoryController::class, 'episodeActionPost']);
    $router->add('POST', 'clinical-evolution', [ClinicalHistoryController::class, 'saveEvolution']);
    $router->add('GET', 'clinical-evolution', [ClinicalHistoryController::class, 'listEvolutions']);
    $router->add('POST', 'clinical-anamnesis', [ClinicalHistoryController::class, 'saveAnamnesis']);
    $router->add('GET', 'care-plan-pdf', [ClinicalHistoryController::class, 'getCarePlanPdf']);
    $router->add('POST', 'clinical-media-upload', [ClinicalMediaController::class, 'uploadMedia']);

    // Facades Explicit Routing
    $router->add('POST', 'clinical-vitals', [ClinicalVitalsController::class, 'saveVitals']);
    $router->add('GET', 'patient-vitals-history', [ClinicalVitalsController::class, 'vitalsHistory']);
    $router->add('POST', 'receive-lab-result', [ClinicalLabResultsController::class, 'receiveLabResult']);
    $router->add('POST', 'clinical-lab-pdf-upload', [ClinicalLabResultsController::class, 'uploadClinicalLabPdf']);
    $router->add('POST', 'receive-imaging-result', [ClinicalLabResultsController::class, 'receiveImagingResult']);
    $router->add('POST', 'receive-interconsult-report', [ClinicalLabResultsController::class, 'receiveInterconsultReport']);
    $router->add('POST', 'adverse-reaction-report', [ClinicalLabResultsController::class, 'reportAdverseReaction']);
    $router->add('POST', 'admin-lab-result-share', [ClinicalLabResultsController::class, 'adminLabShare']);"""

original = re.search(r"    \$router->add\('GET', 'clinical-history-gallery'.*?\$router->add\('POST', 'clinical-media-upload', \[ClinicalHistoryController::class, 'uploadMedia'\]\);", content, re.DOTALL)

if original:
    content = content[:original.start()] + target + content[original.end():]
    with open('lib/routes.php', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced routes successfully!")
else:
    print("Could not find routes block to replace!")
