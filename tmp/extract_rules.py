with open('AGENTS.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = 0
end_idx = -1
for i, line in enumerate(lines):
    if '## Backlog de Producto — Dirección Opus 4.6' in line or '## Sprint 35' in line or '## 35. Sprint' in line:
        end_idx = i
        break

if end_idx != -1:
    rules = lines[0:end_idx]
    active_sprints = lines[end_idx:]
    
    with open('docs/ORCHESTRATION_CONTEXT.md', 'w', encoding='utf-8') as f:
        f.writelines(rules)
        
    with open('AGENTS.md', 'w', encoding='utf-8') as f:
        f.write('# AGENTS.md — Backlog Activo\n\n> **NOTA:** Las directrices de orquestación de agentes han sido movidas a `docs/ORCHESTRATION_CONTEXT.md`.\n\n')
        f.writelines(active_sprints)
