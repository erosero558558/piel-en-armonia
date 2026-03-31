// @ts-check
const { test, expect } = require('@playwright/test');

async function stubLegacyRoomBootstrap(page) {
    await page.route('**/external_api.js', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: '',
        });
    });
    await page.route('**/js/telemedicine-room.js', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: '',
        });
    });
}

async function mountFakeTelemedicineApi(page, role, participants = []) {
    await page.evaluate(
        ({ teleRole, teleParticipants }) => {
            window.__teleCommands = [];
            window.__teleListeners = {};

            const api = {
                getParticipantsInfo() {
                    return teleParticipants;
                },
                addEventListener(name, callback) {
                    if (!window.__teleListeners[name]) {
                        window.__teleListeners[name] = [];
                    }
                    window.__teleListeners[name].push(callback);
                },
                executeCommand(name, ...args) {
                    window.__teleCommands.push({ name, args });
                },
            };

            window.__emitTelemedicineEvent = (name, payload) => {
                (window.__teleListeners[name] || []).forEach((callback) => callback(payload));
            };

            window.dispatchEvent(
                new CustomEvent('telemedicine:ready', {
                    detail: {
                        api,
                        role: teleRole,
                    },
                })
            );

            const loader = document.getElementById('telemedicine-loader');
            if (loader) {
                loader.style.display = 'none';
            }
        },
        { teleRole: role, teleParticipants: participants }
    );
}

test.describe('Telemedicine recording consent', () => {
    test('moderator requests explicit recording consent before messaging the patient', async ({
        page,
    }) => {
        const consentBodies = [];

        await stubLegacyRoomBootstrap(page);
        page.on('dialog', (dialog) => dialog.accept());

        await page.route('**/api.php?resource=telemedicine-recording-consent**', async (route) => {
            consentBodies.push(route.request().postData() || '');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        consent: {
                            requestId: 'trec-ui-001',
                            status: 'requested',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/telemedicina/sala/index.html?id=701');
        await mountFakeTelemedicineApi(page, 'moderator', [
            { participantId: 'pt-1', role: 'participant' },
        ]);

        await expect(page.locator('#record-btn')).toBeVisible();
        await page.locator('#record-btn').click();

        await expect
            .poll(() => consentBodies.length, { timeout: 5000 })
            .toBe(1);
        expect(consentBodies[0]).toContain('action=request');

        await expect
            .poll(async () => (await page.evaluate(() => window.__teleCommands)).length, {
                timeout: 5000,
            })
            .toBe(1);
        const commands = await page.evaluate(() => window.__teleCommands);
        expect(commands).toHaveLength(1);
        expect(commands[0].name).toBe('sendEndpointTextMessage');
        expect(commands[0].args[0]).toBe('pt-1');
        expect(JSON.parse(commands[0].args[1])).toEqual({
            type: 'RECORDING_REQUEST',
            requestId: 'trec-ui-001',
        });
    });

    test('participant accepts the consent modal and syncs the decision to backend metadata', async ({
        page,
    }) => {
        const consentBodies = [];

        await stubLegacyRoomBootstrap(page);

        await page.route('**/api.php?resource=telemedicine-recording-consent**', async (route) => {
            consentBodies.push(route.request().postData() || '');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        consent: {
                            requestId: 'trec-ui-002',
                            status: 'granted',
                        },
                    },
                }),
            });
        });

        await page.goto('/es/telemedicina/sala/index.html?token=rec-token-701');
        await mountFakeTelemedicineApi(page, 'participant');

        await page.evaluate(() => {
            window.__emitTelemedicineEvent('endpointTextMessageReceived', {
                data: {
                    text: JSON.stringify({
                        type: 'RECORDING_REQUEST',
                        requestId: 'trec-ui-002',
                    }),
                    senderInfo: { id: 'moderator-1' },
                },
            });
        });

        await expect(page.locator('#recording-consent-modal')).toBeVisible();
        await expect(page.locator('#recording-consent-modal')).toContainText(
            'Solo se guardará si aceptas de forma expresa'
        );

        await page.locator('#accept-recording-btn').click();

        await expect
            .poll(() => consentBodies.length, { timeout: 5000 })
            .toBe(1);
        expect(consentBodies[0]).toContain('action=grant');
        expect(consentBodies[0]).toContain('requestId=trec-ui-002');

        await expect
            .poll(async () => (await page.evaluate(() => window.__teleCommands)).length, {
                timeout: 5000,
            })
            .toBe(1);
        const commands = await page.evaluate(() => window.__teleCommands);
        expect(commands).toHaveLength(1);
        expect(commands[0].name).toBe('sendEndpointTextMessage');
        expect(commands[0].args[0]).toBe('moderator-1');
        expect(JSON.parse(commands[0].args[1])).toEqual({
            type: 'RECORDING_CONSENT_GRANTED',
            requestId: 'trec-ui-002',
        });
    });
});
