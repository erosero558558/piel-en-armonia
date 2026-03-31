# Aurora Derm — Incident Response Playbook

> **Versión:** 1.0 · **Owner:** Ops primario + médico responsable  
> **Última revisión:** 2026-03-31  
> **Contacto de emergencia:** Ver `env.php` → `AURORADERM_OPS_EMERGENCY_PHONE`

---

## Tabla de SLAs

| Prioridad | Impacto                                | Tiempo de respuesta | Tiempo de resolución |
|-----------|----------------------------------------|---------------------|----------------------|
| **P1**    | Producción caída completa / datos en riesgo | **15 minutos** | **2 horas** |
| **P2**    | Funcionalidad crítica degradada        | **1 hora**          | **4 horas** |
| **P3**    | Bug severo sin pérdida de datos        | **4 horas**         | **24 horas** |
| **P4**    | Falla cosmética / mejora de UX         | Próximo sprint      | Próximo sprint |

---

## Clasificación de Incidentes

### 🔴 P1 — Sistema caído
- `/api.php?resource=health` devuelve 500 o no responde
- El store de datos está corrupto o inaccesible
- Filtración de datos de pacientes
- El login de admin no puede completarse

### 🟠 P2 — Funcionalidad crítica caída
- Queue/turnero no puede llamar turnos
- OpenClaw no responde (endpoints `/openclaw-*` devuelven 500)
- Booking público caído (pacientes no pueden agendar)
- Portal del paciente inaccessible

### 🟡 P3 — Bug severo
- PDF de recetas no genera
- Notificaciones WhatsApp no se envían
- Reportes de dashboard vacíos
- Alguna sección del admin devuelve error

### ⚪ P4 — Falla menor
- Elemento visual roto
- Texto incorrecto
- Slow load > 5s en alguna página

---

## Runbook P1 — Sistema caído

### 1. Confirmar el incidente (2 min)

```bash
# Verificar health del API
curl -s https://pielarmonia.com/api.php?resource=health | python3 -m json.tool

# Verificar estado del contenedor
docker ps | grep AURORADERM_app
docker logs AURORADERM_app --tail=50

# Verificar espacio en disco (store JSON puede crecer)
df -h /var/www/data
```

### 2. Diagnóstico rápido (5 min)

```bash
# ¿El store está accesible?
ls -la /var/www/data/store.json 2>/dev/null && echo "OK" || echo "MISSING"

# ¿Redis está vivo?
docker exec AURORADERM_redis redis-cli PING

# ¿Apache responde?
docker exec AURORADERM_app apache2ctl status 2>/dev/null || echo "APACHE ISSUE"

# ¿Hay errores PHP recientes?
docker logs AURORADERM_app 2>&1 | grep -i "Fatal error\|PHP Warning\|PHP Notice" | tail -20
```

### 3. Rollback de emergencia

```bash
# Opción A: Rollback al commit anterior
git log --oneline -10
git stash
git checkout <commit-hash-estable>
docker compose restart app

# Opción B: Restaurar backup del store
cp /var/www/data/backups/store-YYYY-MM-DD.json /var/www/data/store.json
docker compose restart app

# Verificar que volvió
curl -s https://pielarmonia.com/api.php?resource=health
```

### 4. Comunicar el incidente

1. Notificar al equipo médico: "Sistema en recuperación, ETA X minutos"
2. Si hay pacientes en sala: El turnero puede operar en modo manual (tableta del operador)
3. Actualizar `governance/incidents/YYYY-MM-DD-P1.md` con timeline

---

## Runbook P2 — OpenClaw caído

```bash
# Verificar router status
curl -s https://pielarmonia.com/api.php?resource=openclaw-router-status | python3 -m json.tool

# Correr diagnóstico
node bin/admin-openclaw-rollout-diagnostic.js --domain https://pielarmonia.com

# Si es falla de API key (OpenAI/Anthropic)
grep "AURORADERM_OPENCLAW_" env.php | head -5
# Verificar que las keys no estén vacías

# Restart del contenedor app (no borra datos)
docker compose restart app
```

---

## Runbook P2 — Queue/Turnero caído

```bash
# Estado del turnero
curl -s https://pielarmonia.com/api.php?resource=queue-state | python3 -m json.tool

# Check surfaces
node bin/resolve-turnero-release-plan.js

# Reload Apache (no destructivo)
docker exec AURORADERM_app apache2ctl graceful

# Si persiste: restart completo
docker compose restart app redis
```

---

## Runbook P2 — Booking público caído

```bash
# Verificar disponibilidad
curl -s https://pielarmonia.com/es/agendar/

# Verificar endpoints relacionados
curl -s "https://pielarmonia.com/api.php?resource=availability" | python3 -m json.tool
curl -s "https://pielarmonia.com/api.php?resource=services-catalog" | python3 -m json.tool

# Check de appointments
curl -s "https://pielarmonia.com/api.php?resource=booked-slots" | python3 -m json.tool
```

---

## Runbook — Recuperación del Store

> ⚠️ **Nunca editar `store.json` directamente en producción.**

```bash
# Ver backups disponibles
ls -la /var/www/data/backups/ | tail -20

# Verificar integridad del store actual
cat /var/www/data/store.json | python3 -m json.tool > /dev/null && echo "VALID JSON" || echo "CORRUPTED"

# Restaurar backup más reciente
LATEST=$(ls /var/www/data/backups/store-*.json | sort -r | head -1)
echo "Restaurando: $LATEST"
cp $LATEST /var/www/data/store.json
docker compose restart app

# Verificar
curl -s https://pielarmonia.com/api.php?resource=health
```

---

## Post-Mortem

Después de cerrar todo incidente P1/P2:

1. Crear `governance/incidents/YYYY-MM-DD-P{N}-{descripcion}.md`
2. Documentar: timeline, causa raíz, impacto, acciones correctivas
3. Abrir tarea en AGENT_BOARD.yaml si requiere fix técnico
4. Revisar si la causa raíz tiene relación con los sprints de seguridad (S7)

### Template de post-mortem

```markdown
# Incident YYYY-MM-DD — P1/P2

## Resumen
[1 párrafo]

## Timeline
- HH:MM — Detectado
- HH:MM — Primera respuesta  
- HH:MM — Causa identificada
- HH:MM — Mitigación aplicada
- HH:MM — Resuelto

## Causa raíz
[Descripción técnica]

## Impacto
- Usuarios afectados: N
- Duración: X minutos
- Datos en riesgo: Sí/No

## Acciones correctivas
- [ ] Tarea específica (asignada a: X, deadline: Y)
```

---

## Comandos de diagnóstico rápidos

```bash
# Health completo del sistema
node bin/resolve-turnero-release-plan.js

# Gate de admin rollout
node bin/admin-rollout-gate.js --domain https://pielarmonia.com --stage general

# OpenClaw diagnostic
node bin/admin-openclaw-rollout-diagnostic.js --domain https://pielarmonia.com

# Audit de governance
npm run gov:audit:json --silent

# Verify scripts
node bin/verify-scripts.js

# QA summary completo
npm run qa:summary
```

---

## Escalación

| Rol                  | Contacto                          | Cuándo escalar |
|----------------------|-----------------------------------|----------------|
| Ops primario         | Ver `env.php` → `OPS_PRIMARY`     | P1 desde inicio |
| Médico responsable   | Ver `env.php` → `MEDICAL_CONTACT` | Si hay datos de pacientes en riesgo |
| Proveedor de hosting | Hostinger/VPS support             | Si el servidor no responde desde fuera |

---

*Aurora Derm · Flow OS · docs/INCIDENT.md*
