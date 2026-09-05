import { createHttpClient } from '@viniaraujo68/plinth/http';
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
		return typeof error === 'string' ? error : `HTTP ${status}`;
	}
});

export const getDevices = (): Promise<Device[]> =>
	client.get<{ devices: Device[] }>('/devices').then((response) => response.devices);

export const createDevice = (name: string): Promise<DeviceWithKey> =>
	client.post<DeviceWithKey>('/devices', { name });

export const updateDevice = (id: string, name: string, isActive: boolean): Promise<Device> =>
	client.put<Device>(`/devices/${id}`, { name, is_active: isActive });

export const deleteDevice = (id: string): Promise<void> => client.del<void>(`/devices/${id}`);

export const rotateKey = (id: string): Promise<RotatedKey> =>
	client.post<RotatedKey>(`/devices/${id}/rotate-key`);

export const getPermissions = (deviceId: string): Promise<Permission[]> =>
	client
		.get<{ permissions: Permission[] }>(`/devices/${deviceId}/permissions`)
		.then((response) => response.permissions);

export const grantPermission = (
	deviceId: string,
	email: string,
	permission: PermissionLevel
): Promise<Permission> =>
	client.post<Permission>(`/devices/${deviceId}/permissions`, { email, permission });

export const revokePermission = (deviceId: string, userId: string): Promise<void> =>
	client.del<void>(`/devices/${deviceId}/permissions/${userId}`);

export const getLocations = (
	deviceId: string,
	from?: string,
	to?: string,
	limit = 1000
): Promise<LocationsResponse> => {
	const params = new URLSearchParams({ device_id: deviceId, limit: String(limit) });
	if (from) params.set('from', from);
	if (to) params.set('to', to);
	return client.get<LocationsResponse>(`/locations?${params}`);
};

export const getLatestLocation = (deviceId: string): Promise<LatestLocationResponse> =>
	client.get<LatestLocationResponse>(`/locations/latest?device_id=${deviceId}`);
