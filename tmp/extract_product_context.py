with open('AGENTS.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if '## Backlog de Producto — Dirección Opus 4.6' in line:
        start_idx = i
        break

active_idx = -1
for i, line in enumerate(lines):
    if '## Sprint 35' in line or '## 35. Sprint' in line:
        active_idx = i
        break

if start_idx != -1 and active_idx != -1:
    preamble_to_keep = lines[:start_idx]
    context_lines = lines[start_idx:active_idx]
    active_lines = lines[active_idx:]
    
    with open('docs/PRODUCT_CONTEXT.md', 'w', encoding='utf-8') as f:
        f.writelines(context_lines)
        
    with open('AGENTS.md', 'w', encoding='utf-8') as f:
        preamble_to_keep.append('\n> **NOTA:** Las directrices de producto (identidad, CSS, tonos) han sido movidas a `docs/PRODUCT_CONTEXT.md`.\n\n')
        f.writelines(preamble_to_keep + active_lines)
