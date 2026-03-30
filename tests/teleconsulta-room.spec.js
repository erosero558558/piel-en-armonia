// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
} = require('./helpers/public-v6');

const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
    'base64'
);

test.describe('Teleconsultation room', () => {
    test('renders the waiting room and personalizes meeting context from query params', async ({
        page,
    }) => {
        await gotoPublicRoute(
            page,
            '/es/telemedicina/consulta/?room=Control%20Acne%2003&doctor=Dra.%20Rosero&patient=Ana%20Perez'
        );

        await expect(page.locator('body')).toHaveAttribute(
            'data-public-template-id',
            'teleconsultation_room_v6'
        );
        await expect(page.locator('[data-v6-tele-room-hero]')).toBeVisible();
        await expect(
            page.locator('[data-tele-room-field="room"]').first()
        ).toContainText('Control-Acne-03');
        await expect(
            page.locator('[data-tele-room-field="doctor"]').first()
        ).toContainText('Dra. Rosero');
        await expect(
            page.locator('[data-tele-room-field="patient"]').first()
        ).toContainText('Ana Perez');
        await expectNoLegacyPublicShell(page);

        await page.locator('[data-tele-room-launch]').click();
        await expect(page.locator('[data-tele-room-iframe]')).toHaveAttribute(
            'src',
            /meet\.jit\.si\/Control-Acne-03/
        );
        await expect(page.locator('[data-tele-room-launch-status]')).toContainText(
            'La sala ya esta lista'
        );
    });

    test('uploads photos and folds them into the WhatsApp handoff', async ({
        page,
    }) => {
        let uploadCount = 0;

        await page.route('**/api.php?resource=transfer-proof', async (route) => {
            uploadCount += 1;
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    data: {
                        transferProofName: `lesion-${uploadCount}.png`,
                        transferProofUrl: `https://pielarmonia.com/uploads/transfer-proofs/lesion-${uploadCount}.png`,
                        transferProofPath: `/uploads/transfer-proofs/lesion-${uploadCount}.png`,
                    },
                }),
            });
        });

        await gotoPublicRoute(
            page,
            '/es/telemedicina/consulta/?room=Seguimiento%20Rosacea&doctor=Dra.%20Rosero&patient=Luis'
        );

        await expect(
            page.locator('[data-tele-room-role-card="zona"]')
        ).toContainText('Zona');
        await expect(
            page.locator('[data-tele-room-role-card="primer_plano"]')
        ).toContainText('Primer plano');
        await expect(
            page.locator('[data-tele-room-role-card="contexto"]')
        ).toContainText('Contexto');

        await page.locator('[data-tele-room-photo-input]').setInputFiles([
            {
                name: 'foto-1.png',
                mimeType: 'image/png',
                buffer: tinyPng,
            },
            {
                name: 'foto-2.png',
                mimeType: 'image/png',
                buffer: tinyPng,
            },
        ]);

        await expect(
            page.locator('[data-tele-room-photo-preview] article')
        ).toHaveCount(2);
        await expect(
            page.locator('[data-tele-room-photo-preview] article').nth(0)
        ).toContainText('Zona');
        await expect(
            page.locator('[data-tele-room-photo-preview] article').nth(1)
        ).toContainText('Primer plano');

        await page.locator('[data-tele-room-photo-submit]').click();

        await expect(
            page.locator('[data-tele-room-upload-results] article')
        ).toHaveCount(2);
        await expect(
            page.locator('[data-tele-room-upload-results] article').nth(0)
        ).toContainText('Zona');
        await expect(
            page.locator('[data-tele-room-upload-results] article').nth(1)
        ).toContainText('Primer plano');
        await expect(page.locator('[data-tele-room-photo-status]')).toContainText(
            '2 foto(s) listas'
        );
        expect(uploadCount).toBe(2);

        await page
            .locator('[data-tele-room-message]')
            .fill('La lesion se ve mas roja hoy.');

        const href = await page
            .locator('[data-tele-room-chat-cta]')
            .first()
            .getAttribute('href');
        const decodedHref = decodeURIComponent(href || '');

        expect(decodedHref).toContain('Sala: Seguimiento-Rosacea');
        expect(decodedHref).toContain('Paciente: Luis');
        expect(decodedHref).toContain('Doctor/a: Dra. Rosero');
        expect(decodedHref).toContain('La lesion se ve mas roja hoy.');
        expect(decodedHref).toContain('1. Zona: https://pielarmonia.com/uploads/transfer-proofs/lesion-1.png');
        expect(decodedHref).toContain(
            '2. Primer plano: https://pielarmonia.com/uploads/transfer-proofs/lesion-2.png'
        );
        expect(decodedHref).toContain(
            'https://pielarmonia.com/uploads/transfer-proofs/lesion-1.png'
        );
        expect(decodedHref).toContain(
            'https://pielarmonia.com/uploads/transfer-proofs/lesion-2.png'
        );
    });
});
