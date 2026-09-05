import { expect, type Page } from '@playwright/test';
import { t } from '../../src/lib/messages.js';
import { TEST_USER } from './fixtures.js';

const ACCESS_TOKEN = 'e2e-access-token';
const REFRESH_TOKEN = 'e2e-refresh-token';
const SESSION_LIFETIME_SECONDS = 3_600;
const ACCOUNT_AGE_MS = 90 * 86_400_000;

const authenticatedUser = () => {
	const created = new Date(Date.now() - ACCOUNT_AGE_MS).toISOString();
	const now = new Date().toISOString();

	return {
		id: TEST_USER.id,
		aud: 'authenticated',
		role: 'authenticated',
		email: TEST_USER.email,
		email_confirmed_at: created,
		confirmed_at: created,
		phone: '',
		last_sign_in_at: now,
		app_metadata: { provider: 'email', providers: ['email'] },
		user_metadata: { email: TEST_USER.email, email_verified: true },
		identities: [],
		created_at: created,
		updated_at: now,
		is_anonymous: false
	};
};

const passwordSession = () => ({
	access_token: ACCESS_TOKEN,
	refresh_token: REFRESH_TOKEN,
	token_type: 'bearer',
	expires_in: SESSION_LIFETIME_SECONDS,
	expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
	user: authenticatedUser()
});

export const mockSupabase = async (page: Page): Promise<void> => {
	await page.route('**/auth/v1/token?grant_type=password', async (route) => {
		const credentials = route.request().postDataJSON() as { email?: string; password?: string };

		if (credentials?.email !== TEST_USER.email || credentials?.password !== TEST_USER.password) {
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({
					error: 'invalid_grant',
					error_description: 'Invalid login credentials'
				})
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(passwordSession())
		});
	});

	await page.route('**/auth/v1/user', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(authenticatedUser())
		})
	);

	await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));
};

export const signIn = async (page: Page): Promise<void> => {
	await page.goto('/login');
	await page.getByLabel(t('login.email')).fill(TEST_USER.email);
	await page.getByLabel(t('login.password')).fill(TEST_USER.password);
	await page.getByRole('button', { name: t('login.signIn'), exact: true }).click();
	await page.waitForURL('/');
	await expect(page.getByRole('navigation', { name: t('nav.main') }).first()).toBeAttached();
};
