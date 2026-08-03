#!/usr/bin/env bash
set -euo pipefail

suite="${1:-}"
case "$suite" in
  goal-policy)
    shift
    set -- tests/contracts/goal-hierarchy-contracts.test.ts "$@"
    ;;
  goal-contract-schemas)
    shift
    set -- tests/contracts/goal-contract-boundaries.test.ts tests/contracts/goal-hierarchy-contracts.test.ts "$@"
    ;;
  refinement-goals)
    shift
    set -- tests/contracts/refinement-spec-reconciliation-epic-story-drafts-subtask-decomposition-refinement-action-proposals.test.ts tests/contracts/goal-hierarchy-contracts.test.ts "$@"
    ;;
  goal-action-preflight)
    shift
    set -- tests/contracts/goal-action-preflight.test.ts tests/contracts/goal-hierarchy-contracts.test.ts "$@"
    ;;
  goal-confluence-templates)
    shift
    set -- tests/contracts/confluence-metadata-confluence-templates-confluence-page-proposals-knowledge-audit-confluence-reporting.test.ts tests/contracts/goal-hierarchy-contracts.test.ts "$@"
    ;;
  goal-runway-planning)
    shift
    set -- tests/contracts/daily-control-sprint-health-ready-runway.test.ts tests/contracts/two-week-scenarios-two-week-recommendation-sprint-cadence.test.ts tests/contracts/goal-hierarchy-contracts.test.ts "$@"
    ;;
  goal-daily-sprint-cadence)
    shift
    set -- tests/contracts/daily-control-sprint-health-ready-runway.test.ts tests/contracts/two-week-scenarios-two-week-recommendation-sprint-cadence.test.ts tests/contracts/confluence-metadata-confluence-templates-confluence-page-proposals-knowledge-audit-confluence-reporting.test.ts "$@"
    ;;
esac

exec vitest run "$@"
