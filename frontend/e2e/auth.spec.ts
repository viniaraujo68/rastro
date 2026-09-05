import { expect, test } from '@playwright/test';
import { t } from '../src/lib/messages.js';
import { capture, mockBackend, signIn } from './support/index.js';

test('the login form signs in and lands on the map', async ({ page }, info) => {
	await mockBackend(page);
	await signIn(page);

	await expect(page).toHaveURL('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('page.map.title'));
	await capture(page, info, 'auth-signed-in');
});

test('a guarded route sends an anonymous visitor to the login page', async ({ page }, info) => {
	await mockBackend(page);

	await page.goto('/devices');

	await page.waitForURL('/login');
	await expect(page.getByRole('button', { name: t('login.signIn'), exact: true })).toBeVisible();
	await capture(page, info, 'auth-guard-redirect');
});

test('the login page sends a signed-in visitor back to the map', async ({ page }) => {
	await mockBackend(page);
	await signIn(page);

	await page.goto('/login');

	await page.waitForURL('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('page.map.title'));
});

test('signing out from settings returns to the login page', async ({ page }, info) => {
	await mockBackend(page);
	await signIn(page);
	await page.goto('/settings');

	await page.getByRole('main').getByRole('button', { name: t('auth.signOut') }).click();

	await page.waitForURL('/login');
	await expect(page.getByRole('button', { name: t('login.signIn'), exact: true })).toBeVisible();
	await capture(page, info, 'auth-signed-out');
});

test('a rejected session sends the visitor back to the login page', async ({ page }) => {
	await mockBackend(page);
	await signIn(page);

	await page.route('**/api/v1/devices', (route) =>
		route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ error: 'invalid or expired token' })
		})
	);

	await page.goto('/devices');

	await page.waitForURL('/login');
	await expect(page.getByRole('button', { name: t('login.signIn'), exact: true })).toBeVisible();
});
