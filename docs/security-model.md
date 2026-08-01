# Security Model

Jiraman fixes Jira scope to `AIPLATFORM`, restricts Confluence to configured spaces and roots, treats remote content as untrusted evidence, and uses the existing external `mcp-atlassian` server only. Tool selection requires one unambiguous schema-compatible exposed tool. Destructive operations remain denied.

Read-only and report-proposal skills cannot authorize writes. The approved-action skill accepts only exact named PMG/PMA approvals, performs all-or-nothing read-before-write preflight, calls only approved fields/content with Kilo permission `ask`, stops on failure, and verifies by re-reading. Expired, stale, modified, rejected, partially approved, or applied actions cannot execute.

Fixtures, action state, reports, packages, and run records must exclude credentials, cookies, authorization headers, private URLs, full remote bodies, and personal productivity metrics.
