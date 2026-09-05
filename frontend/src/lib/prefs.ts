export const POLLING_STORAGE_KEY = 'rastro_polling_ms';
export const DEFAULT_POLLING_MS = 30_000;
export const MIN_POLLING_MS = 5_000;

export const POLLING_OPTIONS = [15_000, DEFAULT_POLLING_MS, 60_000] as const;

const isUsable = (value: number): boolean => Number.isFinite(value) && value >= MIN_POLLING_MS;

export const parsePollingMs = (stored: string | null): number => {
	if (stored === null || stored.trim() === '') return DEFAULT_POLLING_MS;
	const value = Number(stored);
	return isUsable(value) ? value : DEFAULT_POLLING_MS;
};

export const readPollingMs = (): number => {
	try {
		return parsePollingMs(localStorage.getItem(POLLING_STORAGE_KEY));
	} catch {
		return DEFAULT_POLLING_MS;
	}
};

export const writePollingMs = (milliseconds: number): void => {
	if (!isUsable(milliseconds)) return;
	try {
		localStorage.setItem(POLLING_STORAGE_KEY, String(milliseconds));
	} catch {
		return;
	}
};
