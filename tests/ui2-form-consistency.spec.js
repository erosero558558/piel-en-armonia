// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForShellV6Runtime } = require('./helpers/public-v6');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

async function waitForAdminReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

test.describe('UI2-17 form consistency', () => {
    test('pre-consulta links inline messages and marks valid fields as success', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/pre-consulta/');
        await waitForShellV6Runtime(page);

        await expect(page.locator('#pre-name')).toHaveClass(/\binput\b/);
        await expect(page.locator('#pre-skin-type')).toHaveClass(/\bselect\b/);
        await expect(page.locator('#pre-condition')).toHaveClass(/\btextarea\b/);
        await expect(page.locator('[data-preconsultation-submit]')).toHaveClass(
            /\bbtn-primary\b/
        );

        await page.locator('[data-preconsultation-submit]').click();

        await expect(page.locator('#pre-name')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
        await expect(page.locator('#pre-name-error')).toBeVisible();
        await expect(page.locator('#pre-name-error')).toContainText('nombre');

        await page.fill('#pre-name', 'Paciente Demo');
        await page.fill('#pre-whatsapp', '+593999111222');
        await page.selectOption('#pre-skin-type', 'mixta');
        await page.fill(
            '#pre-condition',
            'Brote nuevo con picor y cambio de color desde hace dos semanas.'
        );
        await page.check('#pre-consent');

        await expect(page.locator('#pre-name')).toHaveAttribute(
            'data-validation-state',
            'success'
        );
        await expect(page.locator('#pre-whatsapp')).toHaveAttribute(
            'data-validation-state',
            'success'
        );
        await expect(page.locator('#pre-consent')).toHaveAttribute(
            'data-validation-state',
            'success'
        );
    });

    test('admin login and settings expose system classes with described by wiring', async ({
        page,
    }) => {
        await installLegacyAdminAuthMock(page, {
            csrfToken: 'csrf_test_token',
        });
        await installBasicAdminApiMocks(page);

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await expect(page.locator('#adminPassword')).toHaveClass(/\binput\b/);
        await expect(page.locator('#adminPassword')).toHaveAttribute(
            'aria-describedby',
            /adminLoginStatusMessage/
        );
        await expect(page.locator('#loginBtn')).toHaveClass(/\bbtn-primary\b/);

        await page
            .locator('#adminSidebar .nav-item[data-section="settings"]')
            .click();

        await expect(page.locator('#settings')).toHaveClass(/active/);
        await expect(page.locator('#doctorProfileFullName')).toHaveClass(
            /\binput\b/
        );
        await expect(page.locator('#doctorProfileFullName')).toHaveAttribute(
            'aria-describedby',
            /doctorProfileSaveMeta/
        );
        await expect(page.locator('#clinicProfilePhone')).toHaveClass(
            /\binput\b/
        );
        await expect(page.locator('#doctorProfileSaveBtn')).toHaveClass(
            /\bbtn-primary\b/
        );
    });
});
