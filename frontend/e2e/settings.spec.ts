import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/messages.js';
import { POLLING_STORAGE_KEY } from '../src/lib/prefs.js';
import { capture, mockBackend, signIn, TEST_USER } from './support/index.js';

const SLOW_POLLING_MS = 60_000;
const SLOW_POLLING_LABEL = '60s';
const THEME_COOKIE = 'theme';
const LIGHT_BACKGROUND = 'rgb(255, 255, 255)';
const DARK_BACKGROUND = 'rgb(20, 22, 28)';

const openSettings = async (page: Page) => {
	await signIn(page);
	await page.goto('/settings');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('page.settings.title'));
};

const themeToggle = (page: Page) => page.getByRole('main').locator('button[data-preference]');

const readStoredPolling = (page: Page) =>
	page.evaluate((key) => localStorage.getItem(key), POLLING_STORAGE_KEY);

const readThemeCookie = async (page: Page) => {
	const cookies = await page.context().cookies();
	return cookies.find((cookie) => cookie.name === THEME_COOKIE)?.value;
};

const colorScheme = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

const bodyBackground = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const cycleTo = async (page: Page, preference: string) => {
	const toggle = themeToggle(page);
	for (let attempt = 0; attempt < 3; attempt += 1) {
		if ((await toggle.getAttribute('data-preference')) === preference) return;
		await toggle.click();
	}
	await expect(toggle).toHaveAttribute('data-preference', preference);
};

test('the account card shows the whole user id', async ({ page }, info) => {
	await mockBackend(page);
	await openSettings(page);

	const account = page.getByRole('main');
	await expect(account.getByText(TEST_USER.email)).toBeVisible();
	await expect(account.getByText(TEST_USER.id, { exact: true })).toBeVisible();
	await capture(page, info, 'settings-account');
});

test('the polling choice is stored and reloaded', async ({ page }, info) => {
	await mockBackend(page);
	await openSettings(page);

	const option = page.getByRole('button', { name: SLOW_POLLING_LABEL, exact: true });
	await option.click();
	await expect(option).toHaveAttribute('aria-pressed', 'true');
	expect(await readStoredPolling(page)).toBe(String(SLOW_POLLING_MS));
	await capture(page, info, 'settings-polling');

	await page.reload();
	await expect(
		page.getByRole('button', { name: SLOW_POLLING_LABEL, exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	expect(await readStoredPolling(page)).toBe(String(SLOW_POLLING_MS));
});

test('the theme choice is written to the cookie and applied before the next paint', async ({
	page
}, info) => {
	await mockBackend(page);
	await openSettings(page);

	const toggle = themeToggle(page);
	await expect(toggle).toHaveAttribute('data-preference', 'system');

	await toggle.click();
	await expect(toggle).toHaveAttribute('data-preference', 'light');
	await toggle.click();
	await expect(toggle).toHaveAttribute('data-preference', 'dark');
	expect(await readThemeCookie(page)).toBe('dark');
	await capture(page, info, 'settings-theme-dark');

	await page.goto('/settings');
	await expect(themeToggle(page)).toHaveAttribute('data-preference', 'dark');
	expect(await colorScheme(page)).toBe('dark');
	expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);
});

test('the theme keeps switching after a reload with a stored preference', async ({ page }) => {
	await mockBackend(page);
	await openSettings(page);

	await cycleTo(page, 'dark');
	await page.reload();
	await expect(themeToggle(page)).toHaveAttribute('data-preference', 'dark');
	expect(await colorScheme(page)).toBe('dark');
	expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);

	await cycleTo(page, 'light');
	expect(await colorScheme(page)).toBe('light');
	expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND);

	await cycleTo(page, 'system');
	expect(await colorScheme(page)).toBe('light dark');

	await page.emulateMedia({ colorScheme: 'dark' });
	expect(await bodyBackground(page)).toBe(DARK_BACKGROUND);

	await page.emulateMedia({ colorScheme: 'light' });
	expect(await bodyBackground(page)).toBe(LIGHT_BACKGROUND);
});
