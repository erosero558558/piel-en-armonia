# 🔑 Cómo Obtener una Nueva API Key de Kimi (Moonshot AI)

## ❌ El problema

Tu API key actual ha expirado o es inválida:
```
sk-kimi-TnFawV0TNOCtwksuNbsA52gasgfNdicpNqO2nfGWH8p4z6tg8W5oFX8RIIMwbvld
```

## ✅ Solución: Obtener nueva API key

### Paso 1: Registrarte en Moonshot AI
1. Ve a: https://platform.moonshot.cn/
2. Haz clic en **"注册"** (Registrarse) o **"Sign Up"**
3. Crea una cuenta con tu email
4. Verifica tu email

### Paso 2: Obtener API Key
1. Inicia sesión en https://platform.moonshot.cn/
2. Ve a la sección **"API Keys"** o **"密钥管理"**
3. Haz clic en **"Create API Key"** o **"创建密钥"**
4. Copia la nueva API key (empieza con `sk-`)

### Paso 3: Actualizar en tu sitio

Tienes dos opciones:

#### Opción A: Hardcodear la nueva key (más fácil)

1. Abre `script-simple.js`
2. Busca esta línea:
```javascript
api_key: 'sk-kimi-TnFawV0TNOCtwksuNbsA52gasgfNdicpNqO2nfGWH8p4z6tg8W5oFX8RIIMwbvld',
```

3. Reemplaza con tu nueva key:
```javascript
api_key: 'sk-tu-nueva-api-key-aqui',
```

4. Sube el archivo actualizado a tu hosting

#### Opción B: Input en el chatbot (más seguro)

El usuario ingresa su propia API key. Pero esto es más complejo de implementar.

---

## 💰 Precios de Kimi API

| Modelo | Precio |
|--------|--------|
| moonshot-v1-8k | ~$0.006 por 1K tokens |
| moonshot-v1-32k | ~$0.012 por 1K tokens |

**Crédito gratuito:** Al registrarte, Kimi suele dar crédito gratuito para probar.

---

## 🔧 Alternativa: Usar sin IA (modo offline)

Si no quieres complicarte con la API, el chatbot **ya funciona perfectamente** con respuestas locales inteligentes. Los pacientes pueden:

- Ver servicios y precios
- Saber cómo agendar
- Obtener información de contacto
- Ver ubicación y horarios

**Solo necesitas cambiar el mensaje de bienvenida** para no mencionar "IA".

---

## 📞 ¿Necesitas ayuda?

Si tienes problemas para obtener la API key:
1. La página de Moonshot está en chino, usa el traductor de Chrome
2. Puedes pagar con tarjeta internacional si necesitas crédito
3. O usa el chatbot en modo offline (funciona igual)

---

## ⚡ Rápido: Probar si la nueva key funciona

1. Obtén tu nueva key en https://platform.moonshot.cn/
2. Edita `script-simple.js` y reemplaza la key
3. Sube a tu hosting
4. Prueba en `test-ia.html`
