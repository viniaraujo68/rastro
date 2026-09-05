import type { Device, Location, Permission } from '../../src/lib/types.js';

export const TEST_USER = {
	id: '4f2a9c31-8b7e-4d55-9f10-6c3b2a7e1d84',
	email: 'pilot@rastro.test',
	password: 'rastro-e2e-password'
} as const;

export const OTHER_USER = {
	id: '9b1d7e54-2c60-4a38-8e7f-15d9c04b3a62',
	email: 'copilot@rastro.test'
} as const;

export const OWNED_DEVICE_ID = '1c9f4a72-5d3e-4b81-9a06-72e5f8c14d30';
export const SHARED_DEVICE_ID = '2d8e5b63-4c1f-4a92-b013-83f6a9d25e41';
export const CREATED_DEVICE_ID = '3e7c6d94-1a25-4f73-8b40-05a1e6c93f27';
export const OWNED_PERMISSION_ID = '5a0b8c17-6e49-4d32-a85f-71c9d3b04e68';

export const OWNED_DEVICE_NAME = 'Field Phone';
export const SHARED_DEVICE_NAME = 'Support Van';

export const CREATED_DEVICE_API_KEY = 'rk_live_7f3c1d9b4a586e20c94f8d1e7b60a35c';
export const ROTATED_DEVICE_API_KEY = 'rk_live_2b8e5c0a6d194f73a25c8e01b7d46f39';

export const RIO_LATITUDE = -22.9068;
export const RIO_LONGITUDE = -43.1729;

const TRAIL_POINTS = 40;
const TRAIL_SPAN_MS = 86_400_000;
const TRAIL_LONGITUDE_STEP = 0.0012;
const TRAIL_LATITUDE_STEP = 0.00072;
const LATEST_AGE_MINUTES = 5;

export const LATEST_BATTERY_LEVEL = 76;

export interface Fixtures {
	devices: Device[];
	permissions: Record<string, Permission[]>;
	latest: Record<string, Location>;
	locations: Record<string, Location[]>;
}

const isoAt = (milliseconds: number): string => new Date(milliseconds).toISOString();

const buildDevices = (now: number): Device[] => [
	{
		id: OWNED_DEVICE_ID,
		owner_id: TEST_USER.id,
		name: OWNED_DEVICE_NAME,
		is_active: true,
		created_at: isoAt(now - 30 * TRAIL_SPAN_MS),
		updated_at: isoAt(now - TRAIL_SPAN_MS),
		last_seen: isoAt(now - LATEST_AGE_MINUTES * 60_000)
	},
	{
		id: SHARED_DEVICE_ID,
		owner_id: OTHER_USER.id,
		name: SHARED_DEVICE_NAME,
		is_active: false,
		created_at: isoAt(now - 60 * TRAIL_SPAN_MS),
		updated_at: isoAt(now - 3 * TRAIL_SPAN_MS),
		last_seen: null
	}
];

const buildPermissions = (now: number): Permission[] => [
	{
		id: OWNED_PERMISSION_ID,
		device_id: OWNED_DEVICE_ID,
		user_id: OTHER_USER.id,
		user_email: OTHER_USER.email,
		permission: 'view',
		granted_by: TEST_USER.id,
		granted_at: isoAt(now - 7 * TRAIL_SPAN_MS)
	}
];

const buildLatestLocation = (now: number): Location => {
	const timestamp = isoAt(now - LATEST_AGE_MINUTES * 60_000);
	return {
		id: 9_001,
		device_id: OWNED_DEVICE_ID,
		latitude: RIO_LATITUDE,
		longitude: RIO_LONGITUDE,
		battery_level: LATEST_BATTERY_LEVEL,
		timestamp,
		created_at: timestamp
	};
};

export const buildTrail = (now: number): Location[] => {
	const start = now - TRAIL_SPAN_MS;
	const interval = TRAIL_SPAN_MS / (TRAIL_POINTS - 1);

	return Array.from({ length: TRAIL_POINTS }, (_unused, index) => {
		const timestamp = isoAt(start + interval * index);
		return {
			id: 1_000 + index,
			device_id: OWNED_DEVICE_ID,
			latitude: RIO_LATITUDE + TRAIL_LATITUDE_STEP * index,
			longitude: RIO_LONGITUDE + TRAIL_LONGITUDE_STEP * index,
			battery_level: 92 - index,
			timestamp,
			created_at: timestamp
		} satisfies Location;
	});
};

export const buildFixtures = (now: number = Date.now()): Fixtures => ({
	devices: buildDevices(now),
	permissions: { [OWNED_DEVICE_ID]: buildPermissions(now) },
	latest: { [OWNED_DEVICE_ID]: buildLatestLocation(now) },
	locations: { [OWNED_DEVICE_ID]: buildTrail(now) }
});
