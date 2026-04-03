import re

with open('controllers/ClinicalHistoryController.php', 'r', encoding='utf-8') as f:
    content = f.read()

def get_method_body(method_name, code):
    pattern = re.compile(rf"([ \t]*(?:/\*\*.*?\*/\n)?[ \t]*public static function {method_name}\s*\(.*?\).*?)\n    public static function ", re.DOTALL)
    match = pattern.search(code)
    if match:
        return match.group(1)
    # If it's the last method before the end of the class
    pattern = re.compile(rf"([ \t]*(?:/\*\*.*?\*/\n)?[ \t]*public static function {method_name}\s*\(.*?\).*?)\n}}\s*$", re.DOTALL)
    match = pattern.search(code)
    if match:
        return match.group(1)
    # If not found, try without docblock
    pattern = re.compile(rf"([ \t]*public static function {method_name}\s*\(.*?\).*?)\n    (?:public static function|// ──|\}})", re.DOTALL)
    match = pattern.search(code)
    if match:
        return match.group(1)
    
    print(f"Could not find method {method_name} fully")
    return None

methods = {
    'ClinicalLabResultsController': [
        'receiveLabResult', 'receiveImagingResult', 'receiveInterconsultReport', 'uploadClinicalLabPdf', 'reportAdverseReaction', 'adminLabShare'
    ],
    'ClinicalVitalsController': [
        'saveVitals', 'vitalsHistory'
    ],
    'ClinicalMediaController': [
        'uploadMedia', 'getClinicalPhotos', 'uploadClinicalPhoto'
    ]
}

extracted = {}
for facade, m_list in methods.items():
    extracted[facade] = []
    for m in m_list:
        body = get_method_body(m, content)
        if body:
            extracted[facade].append(body)

for facade, bodies in extracted.items():
    if not bodies: continue
    with open(f'controllers/{facade}.php', 'w', encoding='utf-8') as f:
        f.write("<?php\n\ndeclare(strict_types=1);\n\nclass " + facade + "\n{\n" + "\n\n".join(bodies) + "\n}\n")
    print(f"Wrote {facade}.php ({len(bodies)} methods)")

