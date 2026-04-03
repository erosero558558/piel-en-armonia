import re

with open('lib/routes.php', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'\[OpenclawController::class,\s*[\'"]patient[\'"]\]', f"[OpenclawKnowledgeFacade::class, 'patient']", content)

with open('lib/routes.php', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patient route updated!")
