// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Home deferred hydration', () => {
    test('hydrates deferred sections and chatbot widget', async ({ page }) => {
        await page.goto('/');

        const serviciosSection = page.locator('#servicios');
        await expect(serviciosSection).toBeVisible();
        await expect(serviciosSection).not.toHaveClass(/deferred-content/, {
            timeout: 15000,
        });

        const chatbotToggle = page.locator('#chatbotWidget .chatbot-toggle');
        await expect(chatbotToggle).toBeVisible({ timeout: 15000 });

        const hasMeaningfulContent = await serviciosSection.evaluate((node) => {
            const text = (node.textContent || '').trim();
            return text.length > 200 && !text.includes('Cargando contenido...');
        });

        expect(hasMeaningfulContent).toBeTruthy();
    });
});
