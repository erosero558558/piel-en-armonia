const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function buildOpenclawChatScript() {
    const scriptPath = path.resolve(__dirname, '../../js/openclaw-chat.js');
    const source = fs.readFileSync(scriptPath, 'utf8');
    return `${source}\nwindow.OpenclawChat = OpenclawChat;\n`;
}

const openclawChatScript = buildOpenclawChatScript();

test.describe('OpenClaw Chat Offline Badge', () => {
    test('shows the local offline badge when the router falls back to tier 3', async ({
        page,
    }) => {
        await page.goto('about:blank');
        await page.setContent(
            '<div data-openclaw data-patient-id="PAT-001" data-case-id="CASE-001"></div>'
        );

        await page.evaluate(() => {
            const patientContext = {
                ok: true,
                name: 'Paciente Demo',
                age: 34,
                sex: 'F',
                diagnoses_history: [],
                medications_active: [],
                allergies: [],
                ai_summary: 'Consulta previa estable.',
                visits: [],
            };

            const degradedChatPayload = {
                ok: true,
                provider: 'local_heuristic',
                tier: 'tier_3',
                degraded: true,
                degraded_notice:
                    '🔴 IA sin conexión — modo local. OpenClaw está respondiendo con plantillas locales mientras se recupera la IA.',
                offline_badge: '🔴 IA sin conexión — modo local',
                choices: [
                    {
                        message: {
                            role: 'assistant',
                            content:
                                '### Plantilla offline de receta en blanco\n- Medicamento:\n- Presentación:\n- Dosis:\n- Vía:\n- Frecuencia:\n- Duración:\n- Indicaciones al paciente:',
                        },
                    },
                ],
            };

            window.fetch = async (url) => {
                const href = String(url);
                if (href.includes('/context')) {
                    return new Response(JSON.stringify(patientContext), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                if (href.includes('/chat')) {
                    return new Response(JSON.stringify(degradedChatPayload), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                throw new Error(`Unexpected fetch call: ${href}`);
            };
        });

        await page.addScriptTag({ content: openclawChatScript });
        await page.evaluate(() => window.OpenclawChat.mount('[data-openclaw]'));

        await expect(page.locator('#oc-input')).toBeVisible();

        await page.evaluate(() => window.OpenclawChat.sendMessage('genera receta'));

        await expect(page.locator('#oc-offline-badge')).toBeVisible();
        await expect(page.locator('#oc-offline-badge')).toHaveText(
            '🔴 IA sin conexión — modo local'
        );
        await expect(page.locator('#oc-offline-badge')).toHaveAttribute(
            'title',
            /plantillas locales/
        );
        await expect(page.locator('.oc-msg-ai').last()).toContainText(
            'Plantilla offline de receta en blanco'
        );
        await expect(page.locator('.oc-msg-ai').last()).toContainText(
            'Indicaciones al paciente'
        );
    });
});
