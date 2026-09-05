import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: 'e2e',
	outputDir: 'test-results',
	fullyParallel: true,
	reporter: 'list',
	expect: { timeout: 10_000 },
	use: {
		baseURL: BASE_URL,
		browserName: 'chromium',
		trace: 'retain-on-failure',
		locale: 'pt-BR',
		timezoneId: 'America/Sao_Paulo'
	},
	projects: [
		{ name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
		{ name: 'mobile', use: { viewport: { width: 390, height: 844 } } }
	],
	webServer: {
		command: `npm run build -- --mode test && npm run preview -- --port ${PORT} --strictPort`,
		url: BASE_URL,
		reuseExistingServer: false,
		timeout: 180_000
	}
});
