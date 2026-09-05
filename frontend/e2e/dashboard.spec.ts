import { expect, test, type Page } from '@playwright/test';
import { format, formatKm } from '../src/lib/format.js';
import { totalDistanceKm } from '../src/lib/geo.js';
import { t } from '../src/lib/messages.js';
import {
	buildFixtures,
	capture,
	LATEST_BATTERY_LEVEL,
	mockBackend,
	OWNED_DEVICE_ID,
	signIn
} from './support/index.js';

const CUSTOM_RANGE_START = '2026-01-02T03:04';

const viewModeButton = (page: Page, label: string) => page.getByRole('button', { name: label });

const rangePresets = (page: Page) => page.getByRole('group', { name: t('dashboard.range') });

test('the device picker lists every device and switching one updates the pill', async ({
	page
}, info) => {
	const fixtures = buildFixtures();
	await mockBackend(page, fixtures);
	await signIn(page);

	const picker = page.getByRole('combobox', { name: t('dashboard.device') });
	await expect(picker).toHaveText(fixtures.devices[0].name);
	await expect(page.getByRole('img', { name: t('dashboard.deviceStatusActive') })).toBeVisible();

	await picker.click();
	const options = page.getByRole('option');
	await expect(options).toHaveText(fixtures.devices.map((device) => new RegExp(device.name)));

	await options.nth(1).click();
	await expect(picker).toHaveText(fixtures.devices[1].name);
	await expect(page.getByRole('img', { name: t('dashboard.deviceStatusInactive') })).toBeVisible();
	await capture(page, info, 'dashboard-device-picker');
});

test('realtime shows the relative time and the battery level', async ({ page }, info) => {
	const fixtures = buildFixtures();
	await mockBackend(page, fixtures);
	await signIn(page);

	const latest = fixtures.latest[OWNED_DEVICE_ID];
	await expect(page.getByText(format.relativeTime(latest.timestamp))).toBeVisible();
	await expect(page.getByText(`${LATEST_BATTERY_LEVEL}%`)).toBeVisible();
	await capture(page, info, 'dashboard-realtime');
});

test('the trail shows the distance pill and a hovered cluster opens its popup', async ({
	page
}, info) => {
	const fixtures = buildFixtures();
	await mockBackend(page, fixtures);
	await signIn(page);

	await viewModeButton(page, t('dashboard.viewTrail')).click();

	const trail = fixtures.locations[OWNED_DEVICE_ID];
	const distance = t('dashboard.trailDistance', { distance: formatKm(totalDistanceKm(trail)) });
	await expect(page.getByText(distance)).toBeVisible();

	const canvas = page.locator('.maplibregl-canvas');
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();

	const centreX = box!.x + box!.width / 2;
	const centreY = box!.y + box!.height / 2;
	await page.mouse.move(centreX - 4, centreY - 4);
	await page.mouse.move(centreX, centreY);

	await expect(page.locator('.rastro-popup')).toBeVisible();
	await capture(page, info, 'dashboard-trail');
});

test('a custom range survives a round trip through realtime', async ({ page }, info) => {
	await mockBackend(page, buildFixtures());
	await signIn(page);

	await viewModeButton(page, t('dashboard.viewTrail')).click();
	await expect(rangePresets(page).getByRole('button', { name: '24h' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await rangePresets(page).getByRole('button', { name: 'Custom' }).click();
	await page.getByLabel('From').fill(CUSTOM_RANGE_START);
	await expect(page.getByLabel('From')).toHaveValue(CUSTOM_RANGE_START);

	await viewModeButton(page, t('dashboard.viewRealtime')).click();
	await expect(page.getByLabel('From')).toBeHidden();

	await viewModeButton(page, t('dashboard.viewTrail')).click();
	await expect(page.getByLabel('From')).toHaveValue(CUSTOM_RANGE_START);
	await expect(rangePresets(page).getByRole('button', { name: 'Custom' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await capture(page, info, 'dashboard-custom-range');
});

test('the heatmap counts the points in the range', async ({ page }, info) => {
	const fixtures = buildFixtures();
	await mockBackend(page, fixtures);
	await signIn(page);

	await viewModeButton(page, t('dashboard.viewHeatmap')).click();

	const count = fixtures.locations[OWNED_DEVICE_ID].length;
	await expect(page.getByText(t('dashboard.heatmapPoints', { count }))).toBeVisible();
	await capture(page, info, 'dashboard-heatmap');
});

test('an empty device list explains how to add one', async ({ page }, info) => {
	await mockBackend(page, { devices: [] });
	await signIn(page);

	const card = page.getByRole('status').filter({ hasText: t('dashboard.noDevicesHintAfter') });
	await expect(card.getByText(t('dashboard.noDevicesTitle'))).toBeVisible();
	await expect(card.getByRole('link', { name: t('nav.devices') })).toBeVisible();
	await capture(page, info, 'dashboard-no-devices');
});

test('a device without any location waits for one', async ({ page }, info) => {
	await mockBackend(page, { ...buildFixtures(), latest: {} });
	await signIn(page);

	await expect(page.getByText(t('dashboard.waitingTitle'))).toBeVisible();
	await expect(page.getByText(t('dashboard.waitingHint'))).toBeVisible();
	await capture(page, info, 'dashboard-waiting');
});
