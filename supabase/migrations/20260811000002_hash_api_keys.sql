-- Store device API keys as SHA-256 hex digests instead of raw tokens, so a
-- database dump/backup no longer exposes usable ingest credentials.
-- Keys are 256-bit random values, so an unsalted digest is sufficient.
-- Pairs with the backend change that hashes presented keys before lookup.
UPDATE devices SET api_key = encode(sha256(api_key::bytea), 'hex');
