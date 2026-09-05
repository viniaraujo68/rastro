import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_POLLING_MS,
	MIN_POLLING_MS,
	POLLING_OPTIONS,
	POLLING_STORAGE_KEY,
	parsePollingMs,
	readPollingMs,
	writePollingMs
} from './prefs.js';

const withStorage = (store: Map<string, string>) => {
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key)
	});
	return store;
};

afterEach(() => vi.unstubAllGlobals());

describe('parsePollingMs', () => {
	it('falls back to the default for a missing value', () => {
		expect(parsePollingMs(null)).toBe(DEFAULT_POLLING_MS);
	});

	it('falls back to the default for an empty value', () => {
		expect(parsePollingMs('')).toBe(DEFAULT_POLLING_MS);
	});

	it('falls back to the default for a non-numeric value', () => {
		expect(parsePollingMs('soon')).toBe(DEFAULT_POLLING_MS);
	});

	it('falls back to the default below the minimum', () => {
		expect(parsePollingMs(String(MIN_POLLING_MS - 1))).toBe(DEFAULT_POLLING_MS);
	});

	it('accepts exactly the minimum', () => {
		expect(parsePollingMs(String(MIN_POLLING_MS))).toBe(MIN_POLLING_MS);
	});

	it('accepts every offered option', () => {
		for (const option of POLLING_OPTIONS) expect(parsePollingMs(String(option))).toBe(option);
	});
});

describe('readPollingMs', () => {
	it('reads a stored value', () => {
		withStorage(new Map([[POLLING_STORAGE_KEY, '60000']]));
		expect(readPollingMs()).toBe(60_000);
	});

	it('defaults when storage throws', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('storage blocked');
			}
		});
		expect(readPollingMs()).toBe(DEFAULT_POLLING_MS);
	});
});

describe('writePollingMs', () => {
	it('persists an acceptable value under the shared key', () => {
		const store = withStorage(new Map());
		writePollingMs(15_000);
		expect(store.get(POLLING_STORAGE_KEY)).toBe('15000');
	});

	it('ignores a value below the minimum', () => {
		const store = withStorage(new Map());
		writePollingMs(1_000);
		expect(store.has(POLLING_STORAGE_KEY)).toBe(false);
	});

	it('swallows a storage failure', () => {
		vi.stubGlobal('localStorage', {
			setItem: () => {
				throw new Error('storage blocked');
			}
		});
		expect(() => writePollingMs(30_000)).not.toThrow();
	});
});
