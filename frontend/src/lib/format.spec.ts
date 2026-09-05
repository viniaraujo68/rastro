import { describe, expect, it } from 'vitest';
import { formatDuration, formatKm, formatTime } from './format.js';
import { t } from './messages.js';

describe('formatDuration', () => {
	it('collapses anything under a minute', () => {
		expect(formatDuration(0)).toBe(t('duration.lessThanMinute'));
		expect(formatDuration(29_000)).toBe(t('duration.lessThanMinute'));
	});

	it('treats a negative span as zero', () => {
		expect(formatDuration(-5_000)).toBe(t('duration.lessThanMinute'));
	});

	it('rounds to whole minutes below an hour', () => {
		expect(formatDuration(60_000)).toBe(t('duration.minutes', { minutes: 1 }));
		expect(formatDuration(59 * 60_000)).toBe(t('duration.minutes', { minutes: 59 }));
	});

	it('drops the minutes on a whole hour', () => {
		expect(formatDuration(3_600_000)).toBe(t('duration.hours', { hours: 1 }));
		expect(formatDuration(2 * 3_600_000)).toBe(t('duration.hours', { hours: 2 }));
	});

	it('pads the minutes past an hour', () => {
		expect(formatDuration(3_600_000 + 5 * 60_000)).toBe(
			t('duration.hoursMinutes', { hours: 1, minutes: '05' })
		);
		expect(formatDuration(3_600_000 + 45 * 60_000)).toBe(
			t('duration.hoursMinutes', { hours: 1, minutes: 45 })
		);
	});

	it('never leaves a one-digit minute unpadded', () => {
		expect(formatDuration(3_600_000 + 5 * 60_000)).toMatch(/05/);
	});
});

describe('formatKm', () => {
	it('renders one decimal with the locale separator', () => {
		expect(formatKm(12.34)).toBe('12,3 km');
	});

	it('keeps the decimal on a whole number', () => {
		expect(formatKm(3)).toBe('3,0 km');
	});
});

describe('formatTime', () => {
	it('renders a 24-hour clock', () => {
		expect(formatTime(new Date(2026, 0, 2, 7, 5))).toBe('07:05');
	});
});
