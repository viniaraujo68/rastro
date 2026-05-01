CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage own devices"
    ON devices FOR ALL USING (owner_id = auth.uid());

CREATE TABLE device_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    granted_by UUID REFERENCES auth.users(id) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(device_id, user_id)
);
ALTER TABLE device_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own permissions"
    ON device_permissions FOR SELECT
    USING (user_id = auth.uid() OR granted_by = auth.uid());
CREATE POLICY "Device owner can manage permissions"
    ON device_permissions FOR ALL USING (granted_by = auth.uid());

CREATE TABLE locations (
    id BIGSERIAL PRIMARY KEY,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    accuracy DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    battery_level INTEGER,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view authorized locations"
    ON locations FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE owner_id = auth.uid()
            UNION
            SELECT device_id FROM device_permissions WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Service can insert locations"
    ON locations FOR INSERT WITH CHECK (true);

CREATE INDEX idx_locations_device_timestamp ON locations(device_id, timestamp DESC);
CREATE INDEX idx_locations_timestamp ON locations(timestamp DESC);
CREATE INDEX idx_devices_api_key ON devices(api_key);
CREATE INDEX idx_devices_owner ON devices(owner_id);
CREATE INDEX idx_permissions_user ON device_permissions(user_id);
CREATE INDEX idx_permissions_device ON device_permissions(device_id);
