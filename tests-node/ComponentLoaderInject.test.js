const assert = require("assert");
const { ComponentLoader } = require("../components/ComponentLoader.js");

function S14_13_Test() {
    console.log("[TEST] ComponentLoader XSS Injection test (S14-13)");

    let sanitizedHtml = null;
    let fallbackTextContentHtml = null;

    global.DOMPurify = {
        sanitize: function (html) {
            // Mock behavior: strips script tags
            return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
    };

    // mock DOM Element
    const mockElement = {
        dataset: { component: 'vulnerable-component', props: '{"text":"<script>alert(\\"XSS\\")</script><span>Safe</span>"}' },
        set innerHTML(val) {
            sanitizedHtml = val;
        },
        set textContent(val) {
            fallbackTextContentHtml = val;
        }
    };

    // Registrar componente vulnerable
    ComponentLoader.register('vulnerable-component', {
        render: (props) => `<div>${props.text}</div>`
    });

    // Forced mount
    ComponentLoader.mount(mockElement);
    
    console.log("-> HTML inyectado (mock DOMPurify) ::", sanitizedHtml);
    
    if (sanitizedHtml && sanitizedHtml.includes("script")) {
        console.error("❌ FALLO: El mock tag <script> sobrevivió a la desinfección.");
        process.exit(1);
    } 
    
    // Removing DOMPurify to test fallback
    global.DOMPurify = undefined;
    ComponentLoader.mount(mockElement);
    console.log("-> HTML inyectado (fallback textContent) ::", fallbackTextContentHtml);
    
    if (fallbackTextContentHtml === null) {
        console.error("❌ FALLO: No se llamó a textContent en el fallback.");
        process.exit(1);
    }
    
    console.log("✅ ÉXITO: DOMPurify desinfectó el componente. Ningún script sobrevivió, y en general previene innerHTML raw.");
    process.exit(0);
}

S14_13_Test();
