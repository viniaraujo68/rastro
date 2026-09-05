import { expect, test, type Page } from '@playwright/test';
import { format, formatKm } from '../src/lib/format.js';
import { totalDistanceKm } from '../src/lib/geo.js';
import { t } from '../src/lib/messages.js';
import { POLLING_STORAGE_KEY } from '../src/lib/prefs.js';
import {
	buildFixtures,
	capture,
	LATEST_BATTERY_LEVEL,
	mockBackend,
	OWNED_DEVICE_ID,
	signIn
} from './support/index.js';

const CUSTOM_RANGE_START = '2026-01-02T03:04';
const FAST_POLLING_MS = 5_000;
const DRAG_OFFSET = 120;
const MIN_PAN_PIXELS = 60;
const PAN_TOLERANCE = 4;
const SETTLE_STEP_MS = 100;
const SETTLE_ATTEMPTS = 30;

const usePolling = (page: Page, milliseconds: number) =>
	page.addInitScript(
		([key, value]) => localStorage.setItem(key, value),
		[POLLING_STORAGE_KEY, String(milliseconds)] as const
	);

const markerBox = async (page: Page) => {
	const box = await page.locator('.device-marker').boundingBox();
	expect(box).not.toBeNull();
	return box!;
};

const settledMarkerBox = async (page: Page) => {
	let previous = await markerBox(page);
	for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
		await page.waitForTimeout(SETTLE_STEP_MS);
		const current = await markerBox(page);
		if (Math.abs(current.x - previous.x) < 0.5 && Math.abs(current.y - previous.y) < 0.5) {
			return current;
		}
		previous = current;
	}
	return previous;
};

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

	await rangePresets(page).getByRole('button', { name: t('dashboard.rangeCustom') }).click();
	await page.getByLabel(t('dashboard.rangeFrom'), { exact: true }).fill(CUSTOM_RANGE_START);
	await expect(page.getByLabel(t('dashboard.rangeFrom'), { exact: true })).toHaveValue(CUSTOM_RANGE_START);

	await viewModeButton(page, t('dashboard.viewRealtime')).click();
	await expect(page.getByLabel(t('dashboard.rangeFrom'), { exact: true })).toBeHidden();

	await viewModeButton(page, t('dashboard.viewTrail')).click();
	await expect(page.getByLabel(t('dashboard.rangeFrom'), { exact: true })).toHaveValue(CUSTOM_RANGE_START);
	await expect(rangePresets(page).getByRole('button', { name: t('dashboard.rangeCustom') })).toHaveAttribute(
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

test('a poll leaves the panned camera where the user left it', async ({ page }) => {
	await usePolling(page, FAST_POLLING_MS);
	await mockBackend(page, buildFixtures());
	const latest = page.waitForResponse((response) =>
		response.url().includes('/api/v1/locations/latest')
	);
	await signIn(page);
	await latest;

	const before = await settledMarkerBox(page);

	const canvas = page.locator('.maplibregl-canvas');
	const bounds = await canvas.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
	await page.mouse.down();
	await page.mouse.move(
		bounds!.x + bounds!.width / 2 - DRAG_OFFSET,
		bounds!.y + bounds!.height / 2,
		{ steps: 12 }
	);
	await page.mouse.up();

	const panned = await settledMarkerBox(page);
	expect(before.x - panned.x).toBeGreaterThan(MIN_PAN_PIXELS);

	await page.waitForResponse((response) => response.url().includes('/api/v1/locations/latest'));
	await page.waitForResponse((response) => response.url().includes('/api/v1/locations/latest'));

	const after = await markerBox(page);
	expect(Math.abs(after.x - panned.x)).toBeLessThan(PAN_TOLERANCE);
	expect(Math.abs(after.y - panned.y)).toBeLessThan(PAN_TOLERANCE);
	expect(before.x - after.x).toBeGreaterThan(MIN_PAN_PIXELS);
});

test('a failed poll keeps the last position and reports the failure', async ({ page }) => {
	await usePolling(page, FAST_POLLING_MS);
	const fixtures = buildFixtures();
	await mockBackend(page, fixtures);

	let answered = 0;
	await page.route('**/api/v1/locations/latest*', async (route) => {
		answered += 1;
		if (answered > 1) {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'latest location unavailable' })
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				device: { id: OWNED_DEVICE_ID, name: fixtures.devices[0].name },
				location: fixtures.latest[OWNED_DEVICE_ID]
			})
		});
	});

	await signIn(page);
	await expect(page.locator('.device-marker')).toBeVisible();

	await expect(page.getByText(t('dashboard.updateFailed'))).toBeVisible();
	await expect(page.locator('.device-marker')).toBeVisible();
	await expect(page.getByText(t('dashboard.waitingTitle'))).toHaveCount(0);
});

test('clicking a trail point keeps its popup open', async ({ page }) => {
	await mockBackend(page, buildFixtures());
	await signIn(page);

	await viewModeButton(page, t('dashboard.viewTrail')).click();

	const canvas = page.locator('.maplibregl-canvas');
	await expect(canvas).toBeVisible();
	const bounds = await canvas.boundingBox();
	expect(bounds).not.toBeNull();

	const centreX = bounds!.x + bounds!.width / 2;
	const centreY = bounds!.y + bounds!.height / 2;
	await page.mouse.move(centreX - 4, centreY - 4);
	await page.mouse.move(centreX, centreY);
	await expect(page.locator('.rastro-popup')).toBeVisible();

	await page.mouse.click(centreX, centreY);
	await expect(page.locator('.rastro-popup')).toBeVisible();
	await page.waitForTimeout(SETTLE_STEP_MS);
	await expect(page.locator('.rastro-popup')).toBeVisible();
});

test('the marker popup survives a poll', async ({ page }) => {
	await usePolling(page, FAST_POLLING_MS);
	await mockBackend(page, buildFixtures());
	await signIn(page);

	await page.locator('.device-marker').click();
	await expect(page.locator('.rastro-popup')).toBeVisible();

	await page.waitForResponse((response) => response.url().includes('/api/v1/locations/latest'));
	await page.waitForResponse((response) => response.url().includes('/api/v1/locations/latest'));

	await expect(page.locator('.rastro-popup')).toBeVisible();
});
