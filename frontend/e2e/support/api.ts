import type { Page, Route } from '@playwright/test';
import type {
	Device,
	DeviceWithKey,
	Location,
	Permission,
	PermissionLevel
} from '../../src/lib/types.js';
import {
	buildFixtures,
	CREATED_DEVICE_API_KEY,
	CREATED_DEVICE_ID,
	ROTATED_DEVICE_API_KEY,
	TEST_USER
} from './fixtures.js';

const API_PREFIX = '/api/v1';

export interface ApiRecord {
	method: string;
	pathname: string;
	search: string;
	body: unknown;
}

export interface ApiOverrides {
	devices?: Device[];
	permissions?: Record<string, Permission[]>;
	latest?: Record<string, Location>;
	locations?: Record<string, Location[]>;
}

export interface ApiMock {
	requests: ApiRecord[];
	matching: (method: string, pathname: string) => ApiRecord[];
}

const json = (route: Route, status: number, body: unknown): Promise<void> =>
	route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const readBody = (route: Route): unknown => {
	try {
		return route.request().postDataJSON();
	} catch {
		return null;
	}
};

const asPermissionLevel = (value: unknown): PermissionLevel =>
	value === 'admin' ? 'admin' : 'view';

export const mockApi = async (page: Page, overrides: ApiOverrides = {}): Promise<ApiMock> => {
	const fixtures = buildFixtures();
	const devices = [...(overrides.devices ?? fixtures.devices)];
	const permissions: Record<string, Permission[]> = {};
	const latest = overrides.latest ?? fixtures.latest;
	const locations = overrides.locations ?? fixtures.locations;
	const requests: ApiRecord[] = [];

	for (const [deviceId, granted] of Object.entries(overrides.permissions ?? fixtures.permissions)) {
		permissions[deviceId] = [...granted];
	}

	const deviceRef = (deviceId: string) => ({
		id: deviceId,
		name: devices.find((device) => device.id === deviceId)?.name ?? ''
	});

	await page.route(`**${API_PREFIX}/**`, async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname.slice(API_PREFIX.length);
		const method = request.method();

		requests.push({ method, pathname: url.pathname, search: url.search, body: readBody(route) });

		if (path === '/devices' && method === 'GET') {
			await json(route, 200, { devices });
			return;
		}

		if (path === '/devices' && method === 'POST') {
			const name = String((readBody(route) as { name?: unknown })?.name ?? '');
			const timestamp = new Date().toISOString();
			const created: DeviceWithKey = {
				id: CREATED_DEVICE_ID,
				owner_id: TEST_USER.id,
				name,
				is_active: true,
				created_at: timestamp,
				updated_at: timestamp,
				last_seen: null,
				api_key: CREATED_DEVICE_API_KEY
			};
			devices.push(created);
			permissions[created.id] = [];
			await json(route, 201, created);
			return;
		}

		const device = /^\/devices\/([^/]+)$/.exec(path);
		if (device) {
			const target = devices.find((candidate) => candidate.id === device[1]);
			if (!target) {
				await json(route, 404, { error: 'device not found' });
				return;
			}

			if (method === 'PUT') {
				const body = readBody(route) as { name?: unknown; is_active?: unknown };
				target.name = typeof body?.name === 'string' ? body.name : target.name;
				target.is_active = body?.is_active === true;
				target.updated_at = new Date().toISOString();
				await json(route, 200, target);
				return;
			}

			if (method === 'DELETE') {
				devices.splice(devices.indexOf(target), 1);
				delete permissions[target.id];
				await route.fulfill({ status: 204 });
				return;
			}
		}

		const rotate = /^\/devices\/([^/]+)\/rotate-key$/.exec(path);
		if (rotate && method === 'POST') {
			await json(route, 200, { device_id: rotate[1], api_key: ROTATED_DEVICE_API_KEY });
			return;
		}

		const grants = /^\/devices\/([^/]+)\/permissions$/.exec(path);
		if (grants) {
			const deviceId = grants[1];
			const granted = permissions[deviceId] ?? [];

			if (method === 'GET') {
				await json(route, 200, { permissions: granted });
				return;
			}

			if (method === 'POST') {
				const body = readBody(route) as { email?: unknown; permission?: unknown };
				const email = String(body?.email ?? '');
				const created: Permission = {
					id: `granted-${granted.length + 1}-${deviceId}`,
					device_id: deviceId,
					user_id: `user-${granted.length + 1}-${deviceId}`,
					user_email: email,
					permission: asPermissionLevel(body?.permission),
					granted_by: TEST_USER.id,
					granted_at: new Date().toISOString()
				};
				permissions[deviceId] = [...granted, created];
				await json(route, 201, created);
				return;
			}
		}

		const revoke = /^\/devices\/([^/]+)\/permissions\/([^/]+)$/.exec(path);
		if (revoke && method === 'DELETE') {
			const [, deviceId, userId] = revoke;
			permissions[deviceId] = (permissions[deviceId] ?? []).filter(
				(entry) => entry.user_id !== userId
			);
			await route.fulfill({ status: 204 });
			return;
		}

		if (path === '/locations/latest' && method === 'GET') {
			const deviceId = url.searchParams.get('device_id') ?? '';
			const location = latest[deviceId];
			if (!location) {
				await json(route, 404, { error: 'no location for device' });
				return;
			}
			await json(route, 200, { device: deviceRef(deviceId), location });
			return;
		}

		if (path === '/locations' && method === 'GET') {
			const deviceId = url.searchParams.get('device_id') ?? '';
			const points = locations[deviceId] ?? [];
			await json(route, 200, {
				device: deviceRef(deviceId),
				locations: points,
				meta: {
					count: points.length,
					from: url.searchParams.get('from') ?? '',
					to: url.searchParams.get('to') ?? ''
				}
			});
			return;
		}

		await json(route, 404, { error: 'unhandled endpoint' });
	});

	return {
		requests,
		matching: (method, pathname) =>
			requests.filter((entry) => entry.method === method && entry.pathname === pathname)
	};
};
