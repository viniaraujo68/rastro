import { formatDayTime, formatDuration, formatTime } from './format.js';
import { t } from './messages.js';
import type { Location } from './types.js';

export const CLUSTER_THRESHOLD_M = 25;

const EARTH_RADIUS_M = 6_371_000;
const METRES_PER_KM = 1_000;

const COOL: readonly [number, number, number] = [59, 130, 246];
const MID: readonly [number, number, number] = [168, 85, 247];
const WARM: readonly [number, number, number] = [248, 113, 113];

export const GRADIENT_COOL = '#3b82f6';
export const GRADIENT_MID = '#a855f7';
export const GRADIENT_WARM = '#f87171';

export interface LocationCluster {
	latitude: number;
	longitude: number;
	locations: Location[];
}

export interface ClusterSummary {
	title: string;
	detail: string | null;
	battery: string | null;
	address: string | null;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const distanceMeters = (
	fromLatitude: number,
	fromLongitude: number,
	toLatitude: number,
	toLongitude: number
): number => {
	const deltaLatitude = toRadians(toLatitude - fromLatitude);
	const deltaLongitude = toRadians(toLongitude - fromLongitude);
	const firstLatitude = toRadians(fromLatitude);
	const secondLatitude = toRadians(toLatitude);
	const chord =
		Math.sin(deltaLatitude / 2) ** 2 +
		Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(deltaLongitude / 2) ** 2;
	return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
};

export const clusterLocations = (
	locations: readonly Location[],
	thresholdMeters: number = CLUSTER_THRESHOLD_M
): LocationCluster[] => {
	if (locations.length === 0) return [];

	const clusters: LocationCluster[] = [];
	let current: Location[] = [locations[0]];
	let latitudeSum = locations[0].latitude;
	let longitudeSum = locations[0].longitude;

	for (let index = 1; index < locations.length; index += 1) {
		const location = locations[index];
		const centroidLatitude = latitudeSum / current.length;
		const centroidLongitude = longitudeSum / current.length;
		const distance = distanceMeters(
			centroidLatitude,
			centroidLongitude,
			location.latitude,
			location.longitude
		);

		if (distance < thresholdMeters) {
			current.push(location);
			latitudeSum += location.latitude;
			longitudeSum += location.longitude;
			continue;
		}

		clusters.push({
			latitude: centroidLatitude,
			longitude: centroidLongitude,
			locations: current
		});
		current = [location];
		latitudeSum = location.latitude;
		longitudeSum = location.longitude;
	}

	clusters.push({
		latitude: latitudeSum / current.length,
		longitude: longitudeSum / current.length,
		locations: current
	});

	return clusters;
};

const lerp = (from: number, to: number, ratio: number): number => from + (to - from) * ratio;

const toHex = (channel: number): string => Math.round(channel).toString(16).padStart(2, '0');

export const gradientColor = (ratio: number): string => {
	const clamped = Math.max(0, Math.min(1, ratio));
	const [from, to, local] =
		clamped < 0.5
			? ([COOL, MID, clamped * 2] as const)
			: ([MID, WARM, (clamped - 0.5) * 2] as const);
	const red = lerp(from[0], to[0], local);
	const green = lerp(from[1], to[1], local);
	const blue = lerp(from[2], to[2], local);
	return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const isSameDay = (first: Date, second: Date): boolean =>
	first.getFullYear() === second.getFullYear() &&
	first.getMonth() === second.getMonth() &&
	first.getDate() === second.getDate();

const batteryRange = (first: Location, last: Location): string | null => {
	const start = first.battery_level;
	const end = last.battery_level;
	if (start == null && end == null) return null;
	if (start != null && end != null && start !== end) return `${start}% → ${end}%`;
	return `${start ?? end}%`;
};

export const summarizeCluster = (cluster: LocationCluster): ClusterSummary => {
	const first = cluster.locations[0];
	const last = cluster.locations[cluster.locations.length - 1];
	const address = first.address ?? last.address ?? null;

	if (cluster.locations.length === 1) {
		return {
			title: formatDayTime(first.timestamp),
			detail: null,
			battery: batteryRange(first, first),
			address
		};
	}

	const start = new Date(first.timestamp);
	const end = new Date(last.timestamp);
	const formatEdge = isSameDay(start, end) ? formatTime : formatDayTime;

	return {
		title: `${formatEdge(start)} → ${formatEdge(end)}`,
		detail: t('trail.clusterDetail', {
			duration: formatDuration(end.getTime() - start.getTime()),
			points: cluster.locations.length
		}),
		battery: batteryRange(first, last),
		address
	};
};

export const totalDistanceKm = (locations: readonly Location[]): number => {
	let total = 0;
	for (let index = 1; index < locations.length; index += 1) {
		const previous = locations[index - 1];
		const current = locations[index];
		total += distanceMeters(
			previous.latitude,
			previous.longitude,
			current.latitude,
			current.longitude
		);
	}
	return total / METRES_PER_KM;
};
