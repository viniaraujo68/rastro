import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/messages.js';
import { capture, mockBackend, signIn } from './support/index.js';

const GUARDED_ROUTES = ['/', '/devices', '/settings'] as const;

interface ButtonNaming {
	outerHTML: string;
	named: boolean;
}

const namelessButtons = (page: Page): Promise<ButtonNaming[]> =>
	page.locator('button:visible').evaluateAll((nodes) =>
		nodes
			.map((node) => {
				const label = node.getAttribute('aria-label')?.trim() ?? '';
				const labelledBy = node.getAttribute('aria-labelledby')?.trim() ?? '';
				const title = node.getAttribute('title')?.trim() ?? '';
				const text = (node.textContent ?? '').trim();
				return {
					outerHTML: node.outerHTML.slice(0, 120),
					named: Boolean(label || labelledBy || title || text)
				};
			})
			.filter((entry) => !entry.named)
	);

const visibleNav = (page: Page) =>
	page.getByRole('navigation', { name: t('nav.main') }).filter({ visible: true });

test('the login page carries a single top-level heading', async ({ page }) => {
	await mockBackend(page);
	await page.goto('/login');

	await expect(page.locator('h1')).toHaveCount(1);
	expect(await namelessButtons(page)).toEqual([]);
});

test('every guarded page carries a single top-level heading', async ({ page }) => {
	await mockBackend(page);
	await signIn(page);

	for (const route of GUARDED_ROUTES) {
		await page.goto(route);
		await expect(page.locator('h1')).toHaveCount(1);
	}
});

test('every visible button has an accessible name', async ({ page }) => {
	await mockBackend(page);
	await signIn(page);

	for (const route of GUARDED_ROUTES) {
		await page.goto(route);
		await expect(page.locator('h1')).toHaveCount(1);
		expect(await namelessButtons(page)).toEqual([]);
	}
});

test('the shell navigation marks the current page', async ({ page }, info) => {
	await mockBackend(page);
	await signIn(page);

	await page.goto('/devices');
	await expect(visibleNav(page).locator('[aria-current="page"]')).toHaveText(t('nav.devices'));

	await page.goto('/settings');
	await expect(visibleNav(page).locator('[aria-current="page"]')).toHaveText(t('nav.settings'));
	await capture(page, info, 'a11y-nav-current');
});

test('the compact header names the page on a narrow viewport only', async ({ page }, info) => {
	await mockBackend(page);
	await signIn(page);

	const header = page.locator('header.shell-top-bar');
	const mobile = info.project.name === 'mobile';

	if (mobile) {
		await expect(header).toBeVisible();
		await expect(header).toContainText(t('app.name'));
		await expect(header).toContainText(t('nav.map'));
	} else {
		await expect(header).toBeHidden();
	}

	await page.goto('/devices');
	if (mobile) {
		await expect(header).toContainText(t('nav.devices'));
	} else {
		await expect(header).toBeHidden();
	}

	await page.goto('/settings');
	if (mobile) {
		await expect(header).toContainText(t('nav.settings'));
		await capture(page, info, 'a11y-compact-header');
	} else {
		await expect(header).toBeHidden();
	}
});
