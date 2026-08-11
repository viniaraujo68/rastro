-- Tighten RLS on device_permissions and locations.

-- "Device owner can manage permissions" was FOR ALL with only USING
-- (granted_by = auth.uid()); Postgres reuses USING as WITH CHECK when the
-- latter is omitted, so any authenticated user could INSERT a permission row
-- for any device by setting granted_by = auth.uid(). Split into per-command
-- policies where writes require owning the target device.
DROP POLICY "Device owner can manage permissions" ON device_permissions;

CREATE POLICY "Device owner can grant permissions"
    ON device_permissions FOR INSERT
    WITH CHECK (
        granted_by = auth.uid()
        AND device_id IN (SELECT id FROM devices WHERE owner_id = auth.uid())
    );

CREATE POLICY "Device owner can update permissions"
    ON device_permissions FOR UPDATE
    USING (granted_by = auth.uid())
    WITH CHECK (
        granted_by = auth.uid()
        AND device_id IN (SELECT id FROM devices WHERE owner_id = auth.uid())
    );

CREATE POLICY "Device owner can revoke permissions"
    ON device_permissions FOR DELETE
    USING (granted_by = auth.uid());

-- SELECT stays covered by the existing "Users can see their own permissions"
-- policy (user_id = auth.uid() OR granted_by = auth.uid()).

-- The backend connects as the postgres role and bypasses RLS, so this
-- public WITH CHECK (true) INSERT policy only served PostgREST clients
-- holding the anon key (i.e. anyone). Drop it.
DROP POLICY "Service can insert locations" ON locations;

-- Enforce valid permission values at the database level (previously Go-only).
ALTER TABLE device_permissions
    ADD CONSTRAINT device_permissions_permission_check
    CHECK (permission IN ('view', 'admin'));
