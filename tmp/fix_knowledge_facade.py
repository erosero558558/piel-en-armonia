import re

f_path = 'controllers/OpenclawKnowledgeFacade.php'
with open(f_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "── patient ────────" in line:
        new_lines.append("class OpenclawKnowledgeFacade\n{\n")
    if i == len(lines) - 1 and line.strip() == "}":
        pass  # Skip the very last brace if it matches the class OpenclawController EOF
    elif i == len(lines) - 2 and line.strip() == "}":
        pass  # Sometimes the brace is on the second to last line
    else:
        new_lines.append(line)

with open(f_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed OpenclawKnowledgeFacade syntax")
