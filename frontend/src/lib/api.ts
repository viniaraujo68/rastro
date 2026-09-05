import { createHttpClient, errorStatus } from '@viniaraujo68/plinth/http';
import { signOut } from './auth.svelte.js';
import { t } from './messages.js';
import { supabase } from './supabase.js';
import type {
	Device,
	DeviceWithKey,
	LatestLocationResponse,
	LocationsResponse,
	Permission,
	PermissionLevel,
	RotatedKey
} from './types.js';

const client = createHttpClient({
	baseUrl: import.meta.env.VITE_API_URL,
	auth: async () => (await supabase.auth.getSession()).data.session?.access_token ?? '',
	parseError: (status, body) => {
		const error = (body as { error?: unknown } | null)?.error;
		return typeof error === 'string' ? error : t('error.http', { status });
	}
});

const UNAUTHORIZED = 401;

const authorized = async <T>(send: () => Promise<T>): Promise<T> => {
	try {
		return await send();
	} catch (error) {
		if (errorStatus(error) === UNAUTHORIZED) await signOut();
		throw error;
	}
};

const get = <T>(path: string): Promise<T> => authorized(() => client.get<T>(path));

const post = <T>(path: string, body?: unknown): Promise<T> =>
	authorized(() => client.post<T>(path, body));

const put = <T>(path: string, body?: unknown): Promise<T> =>
	authorized(() => client.put<T>(path, body));

const del = <T>(path: string): Promise<T> => authorized(() => client.del<T>(path));

export const getDevices = (): Promise<Device[]> =>
	get<{ devices: Device[] }>('/devices').then((response) => response.devices);

export const createDevice = (name: string): Promise<DeviceWithKey> =>
	post<DeviceWithKey>('/devices', { name });

export const updateDevice = (id: string, name: string, isActive: boolean): Promise<Device> =>
	put<Device>(`/devices/${id}`, { name, is_active: isActive });

export const deleteDevice = (id: string): Promise<void> => del<void>(`/devices/${id}`);

export const rotateKey = (id: string): Promise<RotatedKey> =>
	post<RotatedKey>(`/devices/${id}/rotate-key`);

export const getPermissions = (deviceId: string): Promise<Permission[]> =>
	get<{ permissions: Permission[] }>(`/devices/${deviceId}/permissions`).then(
		(response) => response.permissions
	);

export const grantPermission = (
	deviceId: string,
	email: string,
	permission: PermissionLevel
): Promise<Permission> =>
	post<Permission>(`/devices/${deviceId}/permissions`, { email, permission });

export const revokePermission = (deviceId: string, userId: string): Promise<void> =>
	del<void>(`/devices/${deviceId}/permissions/${userId}`);

export const getLocations = (
	deviceId: string,
	from?: string,
	to?: string,
	limit = 1000
): Promise<LocationsResponse> => {
	const params = new URLSearchParams({ device_id: deviceId, limit: String(limit) });
	if (from) params.set('from', from);
	if (to) params.set('to', to);
	return get<LocationsResponse>(`/locations?${params}`);
};

export const getLatestLocation = (deviceId: string): Promise<LatestLocationResponse> =>
	get<LatestLocationResponse>(`/locations/latest?device_id=${deviceId}`);
