# 🚀 Cómo Subir Cambios a GitHub

## Método 1: Doble clic (Más fácil)

1. **Guarda tus cambios** en los archivos (Ctrl+S)
2. **Doble clic** en `subir-cambios.bat`
3. Espera que termine
4. ¡Listo! ✅

---

## Método 2: PowerShell (Recomendado)

### Abrir PowerShell en la carpeta:
- Click derecho en la carpeta → "Abrir en Terminal" o
- Shift + Click derecho → "Abrir ventana de PowerShell aquí"

### Subir cambios:
```powershell
# Subir con mensaje personalizado
.\subir-cambios.ps1 "Arreglé el chatbot"

# O con mensaje por defecto ("update")
.\subir-cambios.ps1
```

---

## Método 3: Comandos manuales (Control total)

```bash
# Ver qué cambió
git status

# Agregar cambios
git add .

# Guardar con mensaje
git commit -m "Descripción del cambio"

# Subir a GitHub
git push origin main
```

---

## 📋 Flujo de trabajo diario

```
1. Editas archivos en VS Code
2. Guardas (Ctrl+S)
3. Doble clic en "subir-cambios.bat"
4. Esperas 5 segundos
5. ¡Cambios en GitHub! 🎉
```

---

## ⚠️ Mensajes de error comunes

### "No hay cambios pendientes"
→ No editaste ningún archivo o ya están guardados

### "Error al subir a GitHub"
→ Revisa tu conexión a internet

### "No estás en un repositorio Git"
→ Ejecuta el script desde la carpeta correcta

---

## 🔗 Verificar que subió

Ve a: https://github.com/erosero558558/piel-en-armonia

Deberías ver tus cambios allí.
