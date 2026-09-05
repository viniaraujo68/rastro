import { expect, test, type Page } from '@playwright/test';
import { t } from '../src/lib/messages.js';
import {
	capture,
	CREATED_DEVICE_API_KEY,
	mockBackend,
	OTHER_USER,
	OWNED_DEVICE_ID,
	OWNED_DEVICE_NAME,
	SHARED_DEVICE_NAME,
	signIn
} from './support/index.js';

const NEW_DEVICE_NAME = 'Trail Beacon';

const cardToggle = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(name) });

const openDevices = async (page: Page) => {
	await signIn(page);
	await page.goto('/devices');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('page.devices.title'));
};

test('every device is listed with its state badge', async ({ page }, info) => {
	await mockBackend(page);
	await openDevices(page);

	await expect(page.getByText(t('devices.count', { count: 2 }))).toBeVisible();
	await expect(cardToggle(page, OWNED_DEVICE_NAME)).toBeVisible();
	await expect(cardToggle(page, SHARED_DEVICE_NAME)).toBeVisible();
	await expect(page.getByText(t('devices.active'), { exact: true })).toBeVisible();
	await expect(page.getByText(t('devices.inactive'), { exact: true })).toBeVisible();
	await capture(page, info, 'devices-list');
});

test('expanding an owned device loads its permissions and the grant form', async ({
	page
}, info) => {
	await mockBackend(page);
	await openDevices(page);

	await cardToggle(page, OWNED_DEVICE_NAME).click();

	const granted = page.getByRole('listitem').filter({ hasText: OTHER_USER.email });
	await expect(granted).toBeVisible();
	await expect(granted.getByText(t('permissions.view'), { exact: true })).toBeVisible();
	await expect(page.getByLabel(t('permissions.email'))).toBeVisible();
	await expect(page.getByRole('button', { name: t('permissions.invite') })).toBeVisible();
	await expect(page.getByRole('button', { name: t('devices.rotateKey') })).toBeVisible();
	await capture(page, info, 'devices-expanded');
});

test('a shared device offers no management', async ({ page }, info) => {
	await mockBackend(page);
	await openDevices(page);

	await cardToggle(page, SHARED_DEVICE_NAME).click();

	await expect(page.getByText(t('devices.sharedHint'))).toBeVisible();
	await expect(page.getByRole('button', { name: t('devices.rotateKey') })).toHaveCount(0);
	await expect(page.getByRole('button', { name: t('devices.delete') })).toHaveCount(0);
	await expect(page.getByLabel(t('permissions.email'))).toHaveCount(0);
	await capture(page, info, 'devices-shared');
});

test('creating a device shows its API key once', async ({ page }, info) => {
	await mockBackend(page);
	await openDevices(page);

	await page.getByRole('button', { name: t('devices.new') }).click();
	await page.getByLabel(t('devices.name')).fill(NEW_DEVICE_NAME);
	await page.getByRole('button', { name: t('devices.create') }).click();

	const banner = page
		.getByRole('status')
		.filter({ hasText: t('devices.keyBannerTitle', { name: NEW_DEVICE_NAME }) });
	await expect(banner).toBeVisible();
	await expect(banner.getByText(CREATED_DEVICE_API_KEY)).toHaveCount(0);

	await banner.getByRole('button', { name: t('devices.keyReveal') }).click();
	await expect(banner.getByText(CREATED_DEVICE_API_KEY)).toBeVisible();
	await expect(banner.getByRole('button', { name: 'Copy' })).toBeVisible();
	await capture(page, info, 'devices-api-key');

	await banner.getByRole('button', { name: t('devices.keyHide') }).click();
	await expect(banner.getByText(CREATED_DEVICE_API_KEY)).toHaveCount(0);
});

test('deleting a device asks for its name before enabling the confirm', async ({ page }, info) => {
	await mockBackend(page);
	await openDevices(page);
	await cardToggle(page, OWNED_DEVICE_NAME).click();

	await page.getByRole('button', { name: t('devices.delete') }).click();

	const challenge = page.getByTestId('confirm-challenge');
	const accept = page.getByTestId('confirm-accept');
	await expect(challenge).toBeVisible();
	await expect(accept).toBeDisabled();
	await capture(page, info, 'devices-delete-confirm');

	await challenge.fill(OWNED_DEVICE_NAME);
	await expect(accept).toBeEnabled();

	await page.getByTestId('confirm-cancel').click();
	await expect(challenge).toBeHidden();
	await expect(cardToggle(page, OWNED_DEVICE_NAME)).toBeVisible();
});

test('revoking an access confirms first and then calls the API', async ({ page }, info) => {
	const api = await mockBackend(page);
	await openDevices(page);
	await cardToggle(page, OWNED_DEVICE_NAME).click();

	await page
		.getByRole('button', { name: t('permissions.revokeLabel', { email: OTHER_USER.email }) })
		.click();

	const accept = page.getByTestId('confirm-accept');
	await expect(accept).toBeVisible();
	await expect(accept).toHaveAttribute('data-danger', 'true');
	await capture(page, info, 'devices-revoke-confirm');

	await accept.click();

	await expect(page.getByText(t('permissions.empty'))).toBeVisible();
	expect(
		api.matching('DELETE', `/api/v1/devices/${OWNED_DEVICE_ID}/permissions/${OTHER_USER.id}`)
	).toHaveLength(1);
});
