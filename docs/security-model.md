# Security Model

Jiraman fixes Jira scope to `AIPLATFORM`, restricts Confluence to configured spaces and roots, treats remote content as untrusted evidence, and uses the existing external `mcp-atlassian` server only. Tool selection requires one unambiguous schema-compatible exposed tool. Destructive operations remain denied.

Read-only and report-proposal skills cannot authorize writes. The approved-action skill accepts only exact named PMG/PMA approvals, performs all-or-nothing read-before-write preflight, calls only approved fields/content with Kilo permission `ask`, stops on failure, and verifies by re-reading. Expired, stale, modified, rejected, partially approved, or applied actions cannot execute.

Fixtures, action state, reports, packages, and run records must exclude credentials, cookies, authorization headers, private URLs, full remote bodies, and personal productivity metrics.

Approval integrity binds the pending-state map key to the PMG ID, requires every approved PMA ID to belong to that group, and requires the approval hash to equal a freshly recomputed group hash. The hash is SHA-256 over UTF-8 canonical JSON of actions sorted by PMA ID, excluding only top-level action `status`, recursively sorting object keys, and preserving nested array order.

Release archives are scanned in full before dependency installation. CI captures raw diagnostics privately, sanitizes sensitive lines before console or artifact output, and deletes the raw file. Installation snapshots `.kilo`, `docs`, and `.gitignore` into a private staging directory, verifies the staged tree, then replaces only those boundaries with no-follow atomic renames.
