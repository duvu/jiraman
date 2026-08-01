# Confluence Information Model

The governed tree is Project Home with Goals/Roadmap, Next Two Weeks, Epics, Specifications, Decisions, Risks/Dependencies, Sprints, Status Reports, Meetings, and Archive children. The template inventory records each page type's purpose, parent, ownership class, and lifecycle.

Stable lookup order is configured page ID, metadata key, label, then title. Duplicate matches block. Metadata includes owner, status, created, last reviewed, review due, Jira project, related Epics/Stories, DLV ID, confidentiality, managed-by, and ownership.

A `jiraman-managed` page may be fully replaced after version-bound preflight. A mixed page permits only marked `JIRAMAN:BEGIN/END` section changes. A human-owned page permits a comment or delimited proposed patch only. Archived and superseded pages are excluded from active freshness rules.
