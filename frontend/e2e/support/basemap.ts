import type { Page } from '@playwright/test';

const BASEMAP_STYLE = {
	version: 8,
	name: 'rastro-e2e-basemap',
	sources: {},
	layers: [
		{
			id: 'background',
			type: 'background',
			paint: { 'background-color': '#e9e7e2' }
		}
	]
};

export const mockBasemap = async (page: Page): Promise<void> => {
	await page.route('**/basemaps.cartocdn.com/**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify(BASEMAP_STYLE)
		})
	);
};

export const mockWebFonts = async (page: Page): Promise<void> => {
	await page.route('**/fonts.googleapis.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'text/css', body: '' })
	);
	await page.route('**/fonts.gstatic.com/**', (route) => route.fulfill({ status: 204 }));
};
