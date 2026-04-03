import re

with open('lib/routes.php', 'r', encoding='utf-8') as f:
    content = f.read()

mappings = {
    'OpenclawKnowledgeFacade': ['cie10Suggest', 'protocol', 'suggestCie10', 'getTreatmentProtocol'],
    'OpenclawClinicalFacade': ['saveDiagnosis', 'saveEvolution', 'saveChronicCondition', 'saveEvolutionNote'],
    'OpenclawTelemedicineFacade': ['routerStatus', 'nextPatient', 'closeTelemedicine', 'fastClose']
}

for facade, methods in mappings.items():
    for m in methods:
        content = re.sub(r'\[OpenclawController::class,\s*[\'"]' + m + r'[\'"]\]', f"[{facade}::class, '{m}']", content)

with open('lib/routes.php', 'w', encoding='utf-8') as f:
    f.write(content)

print("Remaining routes updated!")
