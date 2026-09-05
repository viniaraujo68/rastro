import { describe, expect, it } from 'vitest';
import { formatDayTime, formatDuration, formatTime } from './format.js';
import {
	CLUSTER_THRESHOLD_M,
	clusterLocations,
	distanceMeters,
	gradientColor,
	GRADIENT_COOL,
	GRADIENT_MID,
	GRADIENT_WARM,
	summarizeCluster,
	totalDistanceKm,
	type LocationCluster
} from './geo.js';
import { t } from './messages.js';
import type { Location } from './types.js';

const RIO_LATITUDE = -22.9068;
const RIO_LONGITUDE = -43.1729;

let nextId = 1;

const makeLocation = (overrides: Partial<Location> = {}): Location => ({
	id: nextId++,
	device_id: 'device-1',
	latitude: RIO_LATITUDE,
	longitude: RIO_LONGITUDE,
	timestamp: new Date(2026, 0, 2, 8, 0).toISOString(),
	created_at: new Date(2026, 0, 2, 8, 0).toISOString(),
	...overrides
});

const metresNorth = (latitude: number, metres: number): number =>
	latitude + (metres / 6_371_000) * (180 / Math.PI);

const asCluster = (locations: Location[]): LocationCluster => ({
	latitude: locations[0].latitude,
	longitude: locations[0].longitude,
	locations
});

describe('distanceMeters', () => {
	it('is zero for the same coordinate', () => {
		expect(distanceMeters(RIO_LATITUDE, RIO_LONGITUDE, RIO_LATITUDE, RIO_LONGITUDE)).toBe(0);
	});

	it('is symmetric', () => {
		const forward = distanceMeters(RIO_LATITUDE, RIO_LONGITUDE, -22.95, -43.2);
		const backward = distanceMeters(-22.95, -43.2, RIO_LATITUDE, RIO_LONGITUDE);
		expect(forward).toBeCloseTo(backward, 9);
	});

	it('measures a known meridian span', () => {
		expect(distanceMeters(0, 0, 1, 0)).toBeCloseTo(111_194.9, 0);
	});

	it('measures a hundred metres to within a metre', () => {
		expect(
			distanceMeters(RIO_LATITUDE, RIO_LONGITUDE, metresNorth(RIO_LATITUDE, 100), RIO_LONGITUDE)
		).toBeCloseTo(100, 0);
	});

	it('shrinks a degree of longitude away from the equator', () => {
		expect(distanceMeters(60, 0, 60, 1)).toBeLessThan(distanceMeters(0, 0, 0, 1));
	});
});

describe('clusterLocations', () => {
	it('returns nothing for an empty list', () => {
		expect(clusterLocations([])).toEqual([]);
	});

	it('wraps a single location in a single cluster at its own coordinate', () => {
		const location = makeLocation();
		const [cluster, ...rest] = clusterLocations([location]);
		expect(rest).toHaveLength(0);
		expect(cluster.locations).toEqual([location]);
		expect(cluster.latitude).toBe(location.latitude);
		expect(cluster.longitude).toBe(location.longitude);
	});

	it('merges consecutive points inside the threshold', () => {
		const locations = [
			makeLocation(),
			makeLocation({ latitude: metresNorth(RIO_LATITUDE, 5) }),
			makeLocation({ latitude: metresNorth(RIO_LATITUDE, 10) })
		];
		const clusters = clusterLocations(locations);
		expect(clusters).toHaveLength(1);
		expect(clusters[0].locations).toHaveLength(3);
	});

	it('splits when a point falls outside the threshold', () => {
		const locations = [
			makeLocation(),
			makeLocation({ latitude: metresNorth(RIO_LATITUDE, 500) }),
			makeLocation({ latitude: metresNorth(RIO_LATITUDE, 1_000) })
		];
		expect(clusterLocations(locations)).toHaveLength(3);
	});

	it('places a cluster on the mean of its members', () => {
		const locations = [
			makeLocation({ latitude: 0, longitude: 0 }),
			makeLocation({ latitude: 0, longitude: 0.0002 })
		];
		const [cluster] = clusterLocations(locations);
		expect(cluster.latitude).toBeCloseTo(0, 12);
		expect(cluster.longitude).toBeCloseTo(0.0001, 12);
	});

	it('keeps every location exactly once and in order', () => {
		const locations = [
			makeLocation(),
			makeLocation({ latitude: metresNorth(RIO_LATITUDE, 5) }),
			makeLocation({ latitude: metresNorth(RIO_LATITUDE, 400) }),
			makeLocation({ latitude: metresNorth(RIO_LATITUDE, 405) })
		];
		const clusters = clusterLocations(locations);
		expect(clusters.flatMap((cluster) => cluster.locations)).toEqual(locations);
	});

	it('compares against the running centroid, not the previous point', () => {
		const step = CLUSTER_THRESHOLD_M - 5;
		const locations = [
			makeLocation({ latitude: 0, longitude: 0 }),
			makeLocation({ latitude: metresNorth(0, step), longitude: 0 }),
			makeLocation({ latitude: metresNorth(0, 2 * step), longitude: 0 }),
			makeLocation({ latitude: metresNorth(0, 3 * step), longitude: 0 })
		];
		expect(clusterLocations(locations).length).toBeGreaterThan(1);
	});

	it('honours a custom threshold', () => {
		const locations = [makeLocation(), makeLocation({ latitude: metresNorth(RIO_LATITUDE, 100) })];
		expect(clusterLocations(locations, 25)).toHaveLength(2);
		expect(clusterLocations(locations, 500)).toHaveLength(1);
	});

	it('defaults to the 25 m threshold', () => {
		expect(CLUSTER_THRESHOLD_M).toBe(25);
		const justInside = [makeLocation(), makeLocation({ latitude: metresNorth(RIO_LATITUDE, 24) })];
		const justOutside = [makeLocation(), makeLocation({ latitude: metresNorth(RIO_LATITUDE, 26) })];
		expect(clusterLocations(justInside)).toHaveLength(1);
		expect(clusterLocations(justOutside)).toHaveLength(2);
	});
});

describe('gradientColor', () => {
	it('runs from cool through mid to warm', () => {
		expect(gradientColor(0)).toBe(GRADIENT_COOL);
		expect(gradientColor(0.5)).toBe(GRADIENT_MID);
		expect(gradientColor(1)).toBe(GRADIENT_WARM);
	});

	it('clamps out-of-range ratios to the ends', () => {
		expect(gradientColor(-3)).toBe(GRADIENT_COOL);
		expect(gradientColor(42)).toBe(GRADIENT_WARM);
	});

	it('interpolates between the stops', () => {
		expect(gradientColor(0.25)).toBe('#726cf7');
		expect(gradientColor(0.75)).toBe('#d063b4');
	});

	it('always yields a six-digit hex colour', () => {
		for (const ratio of [0, 0.1, 0.37, 0.5, 0.62, 0.99, 1]) {
			expect(gradientColor(ratio)).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});

describe('summarizeCluster', () => {
	it('titles a single point with its day and time', () => {
		const timestamp = new Date(2026, 0, 2, 8, 30);
		const summary = summarizeCluster(
			asCluster([makeLocation({ timestamp: timestamp.toISOString() })])
		);
		expect(summary.title).toBe(formatDayTime(timestamp));
		expect(summary.detail).toBeNull();
	});

	it('titles a same-day stay with a clock range', () => {
		const start = new Date(2026, 0, 2, 8, 0);
		const end = new Date(2026, 0, 2, 9, 30);
		const summary = summarizeCluster(
			asCluster([
				makeLocation({ timestamp: start.toISOString() }),
				makeLocation({ timestamp: end.toISOString() })
			])
		);
		expect(summary.title).toBe(`${formatTime(start)} → ${formatTime(end)}`);
	});

	it('titles a stay crossing midnight with the day too', () => {
		const start = new Date(2026, 0, 2, 23, 0);
		const end = new Date(2026, 0, 3, 1, 0);
		const summary = summarizeCluster(
			asCluster([
				makeLocation({ timestamp: start.toISOString() }),
				makeLocation({ timestamp: end.toISOString() })
			])
		);
		expect(summary.title).toBe(`${formatDayTime(start)} → ${formatDayTime(end)}`);
	});

	it('reports the dwell time and the point count', () => {
		const start = new Date(2026, 0, 2, 8, 0);
		const end = new Date(2026, 0, 2, 9, 30);
		const summary = summarizeCluster(
			asCluster([
				makeLocation({ timestamp: start.toISOString() }),
				makeLocation({ timestamp: new Date(2026, 0, 2, 8, 45).toISOString() }),
				makeLocation({ timestamp: end.toISOString() })
			])
		);
		expect(summary.detail).toBe(
			t('trail.clusterDetail', { duration: formatDuration(90 * 60_000), points: 3 })
		);
	});

	it('shows a battery span when the level moved', () => {
		const summary = summarizeCluster(
			asCluster([
				makeLocation({ battery_level: 80, timestamp: new Date(2026, 0, 2, 8, 0).toISOString() }),
				makeLocation({ battery_level: 62, timestamp: new Date(2026, 0, 2, 9, 0).toISOString() })
			])
		);
		expect(summary.battery).toBe('80% → 62%');
	});

	it('shows one reading when the level did not move', () => {
		const summary = summarizeCluster(
			asCluster([
				makeLocation({ battery_level: 80, timestamp: new Date(2026, 0, 2, 8, 0).toISOString() }),
				makeLocation({ battery_level: 80, timestamp: new Date(2026, 0, 2, 9, 0).toISOString() })
			])
		);
		expect(summary.battery).toBe('80%');
	});

	it('falls back to whichever end reported a battery level', () => {
		const summary = summarizeCluster(
			asCluster([
				makeLocation({ timestamp: new Date(2026, 0, 2, 8, 0).toISOString() }),
				makeLocation({ battery_level: 41, timestamp: new Date(2026, 0, 2, 9, 0).toISOString() })
			])
		);
		expect(summary.battery).toBe('41%');
	});

	it('has no battery line when neither end reported one', () => {
		expect(summarizeCluster(asCluster([makeLocation()])).battery).toBeNull();
	});

	it('prefers the first address and falls back to the last', () => {
		const first = makeLocation({ address: 'Av. Atlantica, 1702' });
		const last = makeLocation({
			address: 'Rua Barata Ribeiro, 100',
			timestamp: new Date(2026, 0, 2, 9, 0).toISOString()
		});
		expect(summarizeCluster(asCluster([first, last])).address).toBe('Av. Atlantica, 1702');
		expect(summarizeCluster(asCluster([makeLocation(), last])).address).toBe(
			'Rua Barata Ribeiro, 100'
		);
		expect(summarizeCluster(asCluster([makeLocation()])).address).toBeNull();
	});
});

describe('totalDistanceKm', () => {
	it('is zero for an empty list', () => {
		expect(totalDistanceKm([])).toBe(0);
	});

	it('is zero for a single point', () => {
		expect(totalDistanceKm([makeLocation()])).toBe(0);
	});

	it('adds every leg', () => {
		const locations = [
			makeLocation({ latitude: 0, longitude: 0 }),
			makeLocation({ latitude: 0, longitude: 1 }),
			makeLocation({ latitude: 0, longitude: 2 })
		];
		expect(totalDistanceKm(locations)).toBeCloseTo(2 * 111.19, 1);
	});

	it('counts a there-and-back trip as twice the leg', () => {
		const locations = [
			makeLocation({ latitude: 0, longitude: 0 }),
			makeLocation({ latitude: 0, longitude: 0.5 }),
			makeLocation({ latitude: 0, longitude: 0 })
		];
		expect(totalDistanceKm(locations)).toBeCloseTo(111.19, 1);
	});
});
