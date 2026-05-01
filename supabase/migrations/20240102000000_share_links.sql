CREATE TABLE share_links (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id  UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    created_by UUID        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX share_links_device_idx ON share_links(device_id);
