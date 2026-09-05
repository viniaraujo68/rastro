export interface Device {
	id: string;
	owner_id: string;
	name: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	last_seen?: string | null;
}

export interface DeviceWithKey extends Device {
	api_key: string;
}

export interface Location {
	id: number;
	device_id: string;
	latitude: number;
	longitude: number;
	address?: string;
	altitude?: number;
	battery_level?: number;
	timestamp: string;
	created_at: string;
}

export type PermissionLevel = 'view' | 'admin';

export interface Permission {
	id: string;
	device_id: string;
	user_id: string;
	user_email: string;
	permission: PermissionLevel;
	granted_by: string;
	granted_at: string;
}

export type ViewMode = 'realtime' | 'trail' | 'heatmap';

export interface DeviceRef {
	id: string;
	name: string;
}

export interface LocationsResponse {
	device: DeviceRef;
	locations: Location[];
	meta: { count: number; from: string; to: string };
}

export interface LatestLocationResponse {
	device: DeviceRef;
	location: Location;
}

export interface RotatedKey {
	device_id: string;
	api_key: string;
}
