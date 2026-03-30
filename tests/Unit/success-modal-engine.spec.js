const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const engineScript = fs.readFileSync(
    path.resolve(__dirname, '../../src/apps/success-modal/engine.js'),
    'utf8'
);

const MODAL_HTML = `
    <div id="successModal" class="modal">
        <p data-i18n="success_desc"></p>
        <div id="appointmentDetails"></div>
    </div>
`;

test.describe('Success Modal Engine Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('about:blank');
        await page.setContent(MODAL_HTML);
        await page.addScriptTag({ content: engineScript });
        await page.waitForFunction(
            () => typeof window.PielSuccessModalEngine !== 'undefined'
        );
    });

    test('renderiza QR y codigo de llegada cuando la cita trae checkinToken', async ({
        page,
    }) => {
        await page.evaluate(() => {
            window.URL.createObjectURL = () => 'blob:test-success-modal';
            window.URL.revokeObjectURL = () => {};

            window.PielSuccessModalEngine.init({
                getCurrentLang: () => 'es',
                getClinicAddress: () => 'Av. Republica del Salvador',
                getCurrentAppointment: () => ({
                    doctor: 'rosero',
                    date: '2026-03-30',
                    time: '09:30',
                    paymentMethod: 'cash',
                    paymentStatus: 'pending_cash',
                    price: '$40.00',
                    service: 'consulta',
                    checkinToken: 'CHK-QR-20260330',
                }),
            });

            window.PielSuccessModalEngine.showSuccessModal(true);
        });

        await expect(page.locator('#successModal')).toHaveClass(/active/);
        await expect(page.locator('[data-i18n="success_desc"]')).toContainText(
            'Enviamos un correo de confirmacion'
        );
        await expect(page.locator('#appointmentDetails')).toContainText(
            'Check-in rapido en kiosco'
        );
        await expect(page.locator('#appointmentDetails')).toContainText(
            'CHK-QR-20260330'
        );
        await expect(
            page.locator('#appointmentDetails img[alt="QR de check-in para kiosco"]')
        ).toHaveAttribute(
            'src',
            /api\.qrserver\.com\/v1\/create-qr-code\/\?size=220x220&data=CHK-QR-20260330/
        );
    });

    test('omite el bloque QR cuando la cita no trae checkinToken', async ({
        page,
    }) => {
        await page.evaluate(() => {
            window.URL.createObjectURL = () => 'blob:test-success-modal';
            window.URL.revokeObjectURL = () => {};

            window.PielSuccessModalEngine.init({
                getCurrentLang: () => 'es',
                getClinicAddress: () => 'Av. Republica del Salvador',
                getCurrentAppointment: () => ({
                    doctor: 'rosero',
                    date: '2026-03-30',
                    time: '09:30',
                    paymentMethod: 'cash',
                    paymentStatus: 'pending_cash',
                    price: '$40.00',
                    service: 'consulta',
                }),
            });

            window.PielSuccessModalEngine.showSuccessModal(false);
        });

        await expect(page.locator('#appointmentDetails')).not.toContainText(
            'Check-in rapido en kiosco'
        );
        await expect(page.locator('#appointmentDetails img')).toHaveCount(0);
    });
});
