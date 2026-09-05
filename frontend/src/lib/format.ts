import { createFormatters } from '@viniaraujo68/plinth/formatters';
import { t } from './messages.js';

export const LOCALE = 'pt-BR';

export const format = createFormatters(LOCALE, {
	datetime: { dateStyle: 'short', timeStyle: 'short' }
});

const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });

const dayTimeFormat = new Intl.DateTimeFormat(LOCALE, {
	day: '2-digit',
	month: '2-digit',
	hour: '2-digit',
	minute: '2-digit'
});

const kilometreFormat = new Intl.NumberFormat(LOCALE, {
	style: 'unit',
	unit: 'kilometer',
	minimumFractionDigits: 1,
	maximumFractionDigits: 1
});

export const formatTime = (value: string | number | Date): string =>
	timeFormat.format(new Date(value));

export const formatDayTime = (value: string | number | Date): string =>
	dayTimeFormat.format(new Date(value));

export const formatKm = (kilometres: number): string => kilometreFormat.format(kilometres);

export const formatDuration = (milliseconds: number): string => {
	const minutes = Math.round(Math.max(0, milliseconds) / 60_000);
	if (minutes < 1) return t('duration.lessThanMinute');
	if (minutes < 60) return t('duration.minutes', { minutes });
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	if (remainder === 0) return t('duration.hours', { hours });
	return t('duration.hoursMinutes', { hours, minutes: String(remainder).padStart(2, '0') });
};
