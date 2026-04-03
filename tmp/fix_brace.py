import os

f_path = 'controllers/OpenclawKnowledgeFacade.php'
with open(f_path, 'a', encoding='utf-8') as f:
    f.write("\n}\n")

print("Added closing brace")
