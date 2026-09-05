import type { Page } from '@playwright/test';
import { mockApi, type ApiMock, type ApiOverrides } from './api.js';
import { mockBasemap, mockWebFonts } from './basemap.js';
import { mockSupabase } from './supabase.js';

export * from './api.js';
export * from './basemap.js';
export * from './fixtures.js';
export * from './screenshots.js';
export * from './supabase.js';

export const mockBackend = async (page: Page, overrides: ApiOverrides = {}): Promise<ApiMock> => {
	await mockWebFonts(page);
	await mockBasemap(page);
	await mockSupabase(page);
	return mockApi(page, overrides);
};
