import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/messages.js';
import { POLLING_STORAGE_KEY } from '../src/lib/prefs.js';
import { capture, mockBackend, signIn, TEST_USER } from './support/index.js';

const SLOW_POLLING_MS = 60_000;
const SLOW_POLLING_LABEL = '60s';
const DARK_THEME = 'plinth-dark';
const THEME_COOKIE = 'theme';

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
	expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(DARK_THEME);
	await expect(themeToggle(page)).toHaveAttribute('data-preference', 'dark');
});
