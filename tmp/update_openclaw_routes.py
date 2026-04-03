import re

with open('lib/routes.php', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace references for Prescription
methods_presc = ['savePrescription', 'getPrescriptionPdf', 'checkInteractions']
for m in methods_presc:
    content = re.sub(r'\[OpenclawController::class,\s*[\'"]' + m + r'[\'"]\]', f"[OpenclawPrescriptionFacade::class, '{m}']", content)

# Replace references for Certificate
methods_cert = ['generateCertificate', 'getCertificatePdf']
for m in methods_cert:
    content = re.sub(r'\[OpenclawController::class,\s*[\'"]' + m + r'[\'"]\]', f"[OpenclawCertificateFacade::class, '{m}']", content)

with open('lib/routes.php', 'w', encoding='utf-8') as f:
    f.write(content)

print("Routes updated for OpenClaw facades!")
