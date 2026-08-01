# Minimal Run Records

Private `.kilo/state/jiraman.json` run records contain only workflow ID, canonical command mode, start/end times, capability health, categorized tool results, PMG/PMA IDs, verification result, and artifact/page references. Categories distinguish tool failure, missing evidence, policy rejection, stale action, and verification failure.

Retain records for the configured 30 days, then remove them. Never store remote bodies, credentials, authorization data, private URLs, or personal productivity metrics. Redact tool summaries before persistence.
