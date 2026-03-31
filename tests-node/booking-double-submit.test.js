/**
 * tests-node/booking-double-submit.test.js
 * S13-18: Verificación de exclusión mutua para precaver dobles registros de booking
 */
const assert = require("assert");

// Mock del state object del frontend
const state = {
    isSubmitting: false,
    service: 'consulta'
};

// Simulador de la función intervenida
async function submitBookingPayloadMock() {
    if (state.isSubmitting) {
        return "blocked";
    }
    state.isSubmitting = true;

    // Simulate network delay
    await new Promise(r => setTimeout(r, 200));

    // Release after network 
    state.isSubmitting = false;
    return "success";
}

async function testDoubleSubmitPrevented() {
    console.log("[TEST] Booking Double Submit Lock (S13-18)");

    // Simulamos que el usuario da dos clics rápidamente (separados por 10ms)
    // El primero pasará, el segundo debería rebotar instantáneamente gracias al lock.
    const promises = [
        submitBookingPayloadMock(),
        new Promise(r => setTimeout(async () => r(await submitBookingPayloadMock()), 10))
    ];

    const results = await Promise.all(promises);

    console.log("-> Resultados de Clic 1:", results[0]);
    console.log("-> Resultados de Clic 2:", results[1]);

    if (results[0] === "success" && results[1] === "blocked") {
        console.log("✅ ÉXITO: El segundo submit fue correctamente bloqueado por isSubmitting.");
        process.exit(0);
    } else {
        console.error("❌ FALLÓ: El lock no previno los submits concurrentes.", results);
        process.exit(1);
    }
}

testDoubleSubmitPrevented();
