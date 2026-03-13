const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Chat Engine Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/test-chat-engine**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<html><body><div id="chatMessages"></div></body></html>',
            });
        });
        await page.goto('/test-chat-engine');
        const enginePath = path.resolve(
            __dirname,
            '../../src/apps/chat/engine.js'
        );
        const content = fs.readFileSync(enginePath, 'utf8');
        await page.addScriptTag({ content: content, type: 'module' });
        await page.waitForFunction(
            () => window.Piel && window.Piel.FigoChatEngine
        );
    });

    test('init initializes with dependencies', async ({ page }) => {
        const result = await page.evaluate(() => {
            return window.Piel.FigoChatEngine.init({
                getConversationContext: () => [],
                getChatHistory: () => [],
            });
        });
        expect(result).toBeTruthy();
    });

    test('processWithKimi falls back to local response on network error', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            let lastMessage = null;
            const deps = {
                addBotMessage: (msg) => {
                    lastMessage = msg;
                },
                getConversationContext: () => [],
                setConversationContext: () => {},
                getChatHistory: () => [],
                setChatHistory: () => {},
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
                debugLog: () => {},
            };
            window.Piel.FigoChatEngine.init(deps);

            // Mock fetch to fail so it triggers local fallback
            window.fetch = () => Promise.reject(new Error('Network error'));

            // We assume processWithKimi catches the error and calls processLocalResponse
            await window.Piel.FigoChatEngine.processWithKimi('hola');

            return lastMessage;
        });

        // Check for local response content
        expect(result).toContain('Soy <strong>Figo</strong>');
    });

    test('processWithKimi handles appointment booking intent', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            let bookingStarted = false;
            const deps = {
                startChatBooking: () => {
                    bookingStarted = true;
                },
                getConversationContext: () => [],
                getChatHistory: () => [],
            };
            window.Piel.FigoChatEngine.init(deps);

            await window.Piel.FigoChatEngine.processWithKimi(
                'quiero agendar una cita'
            );
            return bookingStarted;
        });
        expect(result).toBe(true);
    });

    test('processWithKimi keeps out-of-scope questions limited to clinic context', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            let lastMessage = null;
            const deps = {
                addBotMessage: (msg) => {
                    lastMessage = msg;
                },
                getConversationContext: () => [],
                getChatHistory: () => [],
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
            };
            window.Piel.FigoChatEngine.init(deps);

            await window.Piel.FigoChatEngine.processWithKimi(
                'capital de ecuador'
            );
            return lastMessage;
        });

        expect(result).toContain('Aurora Derm');
        expect(result).toContain('Reservar cita');
        expect(result).not.toContain('Quito');
    });

    test('processWithKimi returns detailed payment steps on local fallback', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            let lastMessage = null;
            const deps = {
                addBotMessage: (msg) => {
                    lastMessage = msg;
                },
                getConversationContext: () => [],
                setConversationContext: () => {},
                getChatHistory: () => [],
                setChatHistory: () => {},
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
                debugLog: () => {},
            };
            window.Piel.FigoChatEngine.init(deps);

            // Force local fallback branch after real-ai attempt.
            window.fetch = () => Promise.reject(new Error('Network error'));
            await window.Piel.FigoChatEngine.processWithKimi(
                'como pago por transferencia y facturacion'
            );

            return lastMessage;
        });

        expect(result).toContain('Transferencia (paso a paso)');
        expect(result).toContain('Facturacion');
    });

    test('processWithKimi sends clinical intake payload and hydrates transcript from backend', async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const requests = [];
            let savedSession = null;
            let savedHistory = [];
            let savedContext = [];
            let renderCalls = 0;

            const deps = {
                getChatMode: () => 'clinical_intake',
                getClinicalRouteContext: () => ({
                    mode: 'clinical_intake',
                    surface: 'patient_link',
                }),
                getClinicalHistorySession: () => null,
                setClinicalHistorySession: (session) => {
                    savedSession = session;
                },
                clearClinicalHistorySession: () => {
                    savedSession = null;
                },
                renderChatHistory: (history) => {
                    savedHistory = Array.isArray(history)
                        ? history
                        : savedHistory;
                    renderCalls += 1;
                },
                addBotMessage: () => {},
                getConversationContext: () => [],
                setConversationContext: (value) => {
                    savedContext = Array.isArray(value) ? value : [];
                },
                getChatHistory: () => [],
                setChatHistory: (value) => {
                    savedHistory = Array.isArray(value) ? value : [];
                },
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
                debugLog: () => {},
            };

            window.Piel.FigoChatEngine.init(deps);

            window.fetch = async (url, options = {}) => {
                requests.push({
                    url,
                    method: options.method || 'GET',
                    body: options.body ? JSON.parse(options.body) : null,
                });

                return new Response(
                    JSON.stringify({
                        id: 'clinical-1',
                        choices: [
                            {
                                message: {
                                    content:
                                        'Gracias por contarmelo.\n\nDesde cuando te pica exactamente?',
                                },
                            },
                        ],
                        mode: 'live',
                        source: 'clinical_intake',
                        clinicalIntake: {
                            session: {
                                sessionId: 'sess-100',
                                caseId: 'case-100',
                                surface: 'patient_link',
                                transcript: [
                                    {
                                        role: 'user',
                                        content: 'Me pica mucho la piel',
                                        createdAt: '2026-03-12T10:00:00.000Z',
                                    },
                                    {
                                        role: 'assistant',
                                        content:
                                            'Gracias por contarmelo. Desde cuando te pica exactamente?',
                                        createdAt: '2026-03-12T10:00:02.000Z',
                                    },
                                ],
                                metadata: {
                                    patientIntake: {
                                        mode: 'clinical_intake',
                                        sessionId: 'sess-100',
                                        caseId: 'case-100',
                                        surface: 'patient_link',
                                        resumeUrl:
                                            'https://aurora.test/?mode=clinical_intake&sessionId=sess-100&caseId=case-100',
                                    },
                                },
                            },
                            draft: {
                                reviewStatus: 'review_required',
                            },
                            response: {
                                reply: 'Gracias por contarmelo.',
                                nextQuestion:
                                    'Desde cuando te pica exactamente?',
                            },
                            ai: {
                                mode: 'live',
                                pollAfterMs: 0,
                            },
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
            };

            await window.Piel.FigoChatEngine.processWithKimi(
                'Me pica mucho la piel'
            );

            return {
                request: requests[0],
                savedSession,
                savedHistory,
                savedContext,
                renderCalls,
            };
        });

        expect(result.request.method).toBe('POST');
        expect(result.request.body.mode).toBe('clinical_intake');
        expect(result.request.body.message).toBe('Me pica mucho la piel');
        expect(result.request.body.surface).toBe('patient_link');
        expect(result.request.body.messages).toEqual([]);
        expect(result.savedSession.sessionId).toBe('sess-100');
        expect(result.savedHistory).toHaveLength(2);
        expect(result.savedHistory[0].type).toBe('user');
        expect(result.savedHistory[1].type).toBe('bot');
        expect(result.savedContext).toHaveLength(2);
        expect(result.renderCalls).toBe(1);
    });

    test('ensureClinicalSessionHydrated fetches public session and re-renders transcript', async ({
        page,
    }) => {
        await page.evaluate(() => {
            window.history.replaceState(
                {},
                '',
                '/test-chat-engine?mode=clinical_intake&sessionId=sess-200&caseId=case-200'
            );
        });
        const result = await page.evaluate(async () => {
            const requests = [];
            let savedSession = null;
            let savedHistory = [];
            let renderCalls = 0;

            const deps = {
                getChatMode: () => 'clinical_intake',
                getClinicalRouteContext: () => ({
                    mode: 'clinical_intake',
                    sessionId: 'sess-200',
                    caseId: 'case-200',
                    surface: 'patient_link',
                }),
                getClinicalHistorySession: () => null,
                setClinicalHistorySession: (session) => {
                    savedSession = session;
                },
                clearClinicalHistorySession: () => {
                    savedSession = null;
                },
                renderChatHistory: (history) => {
                    savedHistory = Array.isArray(history)
                        ? history
                        : savedHistory;
                    renderCalls += 1;
                },
                addBotMessage: () => {},
                getConversationContext: () => [],
                setConversationContext: () => {},
                getChatHistory: () => [],
                setChatHistory: (value) => {
                    savedHistory = Array.isArray(value) ? value : [];
                },
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
                debugLog: () => {},
            };

            window.Piel.FigoChatEngine.init(deps);

            window.fetch = async (url, options = {}) => {
                requests.push({
                    url,
                    method: options.method || 'GET',
                });

                return new Response(
                    JSON.stringify({
                        ok: true,
                        data: {
                            session: {
                                sessionId: 'sess-200',
                                caseId: 'case-200',
                                surface: 'patient_link',
                                transcript: [
                                    {
                                        role: 'assistant',
                                        content:
                                            'Necesito confirmar si la picazon empeora por la noche.',
                                        createdAt: '2026-03-12T10:30:00.000Z',
                                    },
                                ],
                                metadata: {
                                    patientIntake: {
                                        mode: 'clinical_intake',
                                        sessionId: 'sess-200',
                                        caseId: 'case-200',
                                        surface: 'patient_link',
                                        resumeUrl:
                                            'https://aurora.test/?mode=clinical_intake&sessionId=sess-200&caseId=case-200',
                                    },
                                    pendingPatientAction: {
                                        question:
                                            'Necesito confirmar si la picazon empeora por la noche.',
                                    },
                                },
                            },
                            draft: {},
                            response: {
                                reply: 'Necesito confirmar si la picazon empeora por la noche.',
                            },
                            ai: {
                                mode: 'live',
                            },
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );
            };

            await window.Piel.FigoChatEngine.ensureClinicalSessionHydrated({
                render: true,
            });

            return {
                request: requests[0],
                savedSession,
                savedHistory,
                renderCalls,
            };
        });

        expect(result.request.method).toBe('GET');
        expect(result.request.url).toContain('clinical-history-session');
        expect(result.request.url).toContain('sessionId=sess-200');
        expect(result.request.url).toContain('caseId=case-200');
        expect(result.savedSession.sessionId).toBe('sess-200');
        expect(result.savedHistory).toHaveLength(1);
        expect(result.savedHistory[0].type).toBe('bot');
        expect(result.renderCalls).toBe(1);
    });
});
