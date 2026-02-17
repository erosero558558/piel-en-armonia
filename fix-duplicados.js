// Agregar al inicio de script.js después de las variables de configuración
let isProcessingMessage = false;

// Reemplazar la función processWithKimi completa
async function processWithKimi(message) {
    if (isProcessingMessage) {
        console.log('⏳ Ya procesando, ignorando duplicado');
        return;
    }
    isProcessingMessage = true;
    
    showTypingIndicator();
    console.log('📝 Procesando mensaje:', message);
    
    try {
        if (shouldUseRealAI()) {
            console.log('🤖 Intentando usar IA real...');
            await tryRealAI(message);
        } else {
            console.log('💬 Usando respuestas locales (modo offline)');
            setTimeout(() => {
                removeTypingIndicator();
                processLocalResponse(message, false);
            }, 600);
        }
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        processLocalResponse(message, false);
    } finally {
        isProcessingMessage = false;
    }
}
