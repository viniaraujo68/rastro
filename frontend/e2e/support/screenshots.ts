import type { Page, TestInfo } from '@playwright/test';

const SCREENSHOT_DIR = 'e2e/__screenshots__';

export const capture = async (page: Page, info: TestInfo, name: string): Promise<void> => {
	await page.screenshot({ path: `${SCREENSHOT_DIR}/${info.project.name}-${name}.png` });
};
