# Upgrade to Jiraman v4

Version 4 adds evidence-based recommendations and brainstorming for the deliverables of the next two future one-week sprints while preserving the mandatory `Epic -> Story -> Sub-task` hierarchy.

## Upgrade

Update the local checkout, then reinstall the managed files:

```bash
cd /path/to/jiraman
git pull --ff-only
./install.sh /absolute/path/to/project --force
```

The installer creates a timestamped backup before replacing managed files. Review and preserve pending action IDs from `.kilo/state/jiraman.json` before upgrading. The deliverable capability is installed as a backward-compatible policy extension and does not require a state-schema reset.

After installation, start a new Kilo chat and run:

```text
/jiraman hierarchy
/jiraman runway
/jiraman deliverables
/jiraman brainstorm platform reliability
```

A deliverable is not a Jira issue type and does not add a fourth hierarchy level. It is an observable outcome mapped to one primary Epic and one or more Stories. Brainstormed hypotheses do not count toward the two-sprint Ready runway until their Stories and Sub-tasks satisfy the existing spec-driven Definition of Ready. Candidates receive stable `DLV-*` IDs and can be converted into a complete spec-driven proposal through `/jiraman refine <DLV-ID>`.
