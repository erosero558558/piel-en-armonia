import re

def fix_refs(filepath):
    print("Fixing", filepath)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except: return

    methods = [
        'requireDoctorAuth',
        'requireAuth',
        'readStore',
        'mutateStore',
        'logClinicalAiAction',
        'buildFallbackPdf',
        'calculateAge',
        'patient'
    ]
    
    for m in methods:
        content = re.sub(r'self::' + m + r'\(', f'OpenclawController::{m}(', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

fix_refs('controllers/OpenclawKnowledgeFacade.php')
fix_refs('controllers/OpenclawClinicalFacade.php')
fix_refs('controllers/OpenclawTelemedicineFacade.php')

print("Extra refs fixed")
