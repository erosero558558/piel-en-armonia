# Auditoría de Scripts NPM (S7-12)

Esta es la lista de scripts identificados que apuntan a archivos archivados (o contienen terminología legacy como `generate-s211` o `archive`), extraídos de `package.json`.

| Script | Ejecución | Estado | Justificación |
|---|---|---|---|
| `agent:board:archive:preview` | `node bin/archive-agent-board.js --json` | `[OFFICIAL]` | Parte del motor de orquestación actual para archivar tareas completadas del AGENTS.md. |
| `agent:board:archive:apply` | `node bin/archive-agent-board.js --apply --json` | `[OFFICIAL]` | Parte del pipeline de CI/CD para efectuar el archivado. |
| `agent:test` | (Llamado a tests incluyendo `archive-agent-board.test.js`) | `[OFFICIAL]` | Suite de pruebas de CI/CD principal. |

**Nota**: No se han encontrado comandos que contengan `generate-s211`.