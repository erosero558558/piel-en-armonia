// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

async function readTurneroDemoState(page, stateId) {
    const raw = await page
        .locator(`[data-v6-turnero-demo-state="${stateId}"]`)
        .first()
        .textContent();
    return JSON.parse(String(raw || '{}'));
}

test.describe('Turnero presentation cut', () => {
    test('landing keeps the Flow OS promise and the Aurora Derm proof band close to the hero', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 1100 });
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        const hero = page.locator('.v6-suite-hero').first();
        const proofBand = page.locator('[data-v6-turnero-proof="landing"]').first();

        await expect(hero).toBeVisible();
        await expect(hero).toContainText('Aurora Derm');
        await expect(
            page.locator('[data-v6-turnero-proof-links="landing"] [data-v6-turnero-presentation-link]')
        ).toHaveCount(4);

        const geometry = await page.evaluate(() => {
            const proof = document.querySelector('[data-v6-turnero-proof="landing"]');
            return {
                viewportHeight: window.innerHeight,
                proofTop: proof ? proof.getBoundingClientRect().top : null,
            };
        });

        expect(geometry.proofTop).not.toBeNull();
        expect(Number(geometry.proofTop)).toBeLessThan(
            geometry.viewportHeight + 200
        );
        await expect(proofBand).toContainText(
            'Prueba operativa visible sobre un solo tenant'
        );
    });

    test('public presentation pages keep the Flow OS storyboard and canonical proof links', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/software/turnero-clinicas/');

        const laneLabels = await page
            .locator('[data-v6-suite-storyboard-lane]')
            .evaluateAll((nodes) =>
                nodes.map((node) =>
                    String(node.querySelector('p')?.textContent || '').trim()
                )
            );

        expect(laneLabels).toEqual([
            'Captured',
            'Triaged',
            'Scheduled',
            'In consult',
            'Closed',
        ]);

        const defaultProofHrefs = [
            '/admin.html#queue',
            '/es/software/turnero-clinicas/demo/',
            '/es/software/turnero-clinicas/estado-turno/',
            '/es/software/turnero-clinicas/dashboard/',
        ].sort();

        const routes = [
            {
                href: '/es/software/turnero-clinicas/',
                stateId: 'landing',
                expectedProofHrefs: defaultProofHrefs,
            },
            {
                href: '/es/software/turnero-clinicas/demo/',
                stateId: 'demo',
                expectedProofHrefs: defaultProofHrefs,
            },
            {
                href: '/es/software/turnero-clinicas/estado-turno/',
                stateId: 'status',
                expectedProofHrefs: defaultProofHrefs,
            },
            {
                href: '/es/software/turnero-clinicas/dashboard/',
                stateId: 'dashboard',
                expectedProofHrefs: [
                    '/admin.html#queue',
                    '/es/software/turnero-clinicas/',
                    '/es/software/turnero-clinicas/demo/',
                    '/es/software/turnero-clinicas/estado-turno/',
                ].sort(),
            },
        ];

        const states = [];

        for (const route of routes) {
            await gotoPublicRoute(page, route.href);

            const proofLinks = await page
                .locator('[data-v6-turnero-presentation-link]')
                .evaluateAll((nodes) =>
                    nodes
                        .map((node) => String(node.getAttribute('href') || '').trim())
                        .filter(Boolean)
                        .sort()
                );

            expect(proofLinks).toEqual(route.expectedProofHrefs);
            states.push(await readTurneroDemoState(page, route.stateId));
        }

        expect(states).toHaveLength(4);
        for (const state of states) {
            expect(state.version).toBe('turnero-demo-state-v1');
            expect(state.site.name).toBe('Aurora Derm Quito');
            expect(state.queue.currentTicket).toBe('A-041');
            expect(state.queue.nextTicket).toBe('A-042');
            expect(state.queue.averageWaitMinutes).toBe(8);
            expect(state.queue.noShowRatePct).toBe(6.2);
            expect(state.queue.servedToday).toBe(124);
        }
    });

    test('software surfaces expose the Flow OS stage chrome and next suggested step', async ({
        page,
    }) => {
        const surfaces = [
            {
                href: '/es/software/turnero-clinicas/demo/',
                pageKey: 'demo',
                title: 'Patient Flow Link',
                nextHref: '/es/software/turnero-clinicas/estado-turno/',
                nextLabel: 'Wait Room Display',
            },
            {
                href: '/es/software/turnero-clinicas/estado-turno/',
                pageKey: 'status',
                title: 'Wait Room Display',
                nextHref: '/es/software/turnero-clinicas/dashboard/',
                nextLabel: 'Clinic Dashboard',
            },
            {
                href: '/es/software/turnero-clinicas/dashboard/',
                pageKey: 'dashboard',
                title: 'Clinic Dashboard',
                nextHref: '/es/software/turnero-clinicas/',
                nextLabel: 'Flow OS',
            },
        ];

        for (const surface of surfaces) {
            await gotoPublicRoute(page, surface.href);

            const currentNode = page
                .locator('[data-v6-suite-surface-flow-current]')
                .first();

            await expect(currentNode).toBeVisible();
            await expect(currentNode).toContainText(surface.pageKey);
            await expect(currentNode).toContainText(surface.title);

            const nextNode = page.locator('[data-v6-suite-surface-flow-node="next"]').first();
            if (surface.pageKey === 'dashboard') {
                await expect(nextNode).toHaveCount(0);
                await expect(
                    page.locator('.v6-suite-actions--final a').first()
                ).toHaveAttribute('href', surface.nextHref);
            } else {
                await expect(nextNode).toBeVisible();
                await expect(nextNode).toContainText(surface.nextLabel);
                await expect(nextNode).toHaveAttribute('href', surface.nextHref);
            }
        }
    });
});
