import type { JsonObject } from "../../src/contracts.js";

export function goalHierarchyGroup(): JsonObject {
  const goalActions = [
    {target_ref: "epic-1", dependencies: [], desired_state: {project: "AIPLATFORM", issue_type: "Epic", summary: "Safe upgrades", draft_ref: "epic-1", content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [{id: "AC-1", statement: "Các Goal Stories được nghiệm thu và thước đo thành công được xác minh", verification: "Đối chiếu Story map và bằng chứng thước đo thành công"}]}},
    {target_ref: "goal-1", dependencies: ["PMA-20260803-01"], desired_state: {project: "AIPLATFORM", issue_type: "Story", parent_ref: "epic-1", draft_ref: "goal-1", goal_name: "Restore backups", summary: "Restore backups", target_completion_date: "2026-08-07", target_completion_date_evidence: {source: "sprint-end", reference: "Sprint 7 end", verified: true}, due_date: "2026-08-07", definition_of_done: ["Restore evidence accepted"], canonical_spec: "Confluence page-200", requirements: ["REQ-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [{id: "AC-1", statement: "Bản sao lưu được khôi phục nguyên vẹn", verification: "restore drill", requirement_refs: ["REQ-1"]}], validation: ["restore drill"]}},
    {target_ref: "task-1", dependencies: ["PMA-20260803-02"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-1", draft_ref: "task-1", summary: "Run restore drill", outcome: "Restore is verified", validation: "restore test", definition_of_done: "Evidence is attached", original_estimate_hours: 3, requirements: ["REQ-1"], parent_requirement_ids: ["REQ-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-1"], parent_acceptance_criteria_ids: ["AC-1"], acceptance_criteria: [{id: "AC-1", statement: "Kết quả restore drill được ghi nhận", verification: "restore test", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
    {target_ref: "task-2", dependencies: ["PMA-20260803-02"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-1", draft_ref: "task-2", summary: "Review restore evidence", outcome: "Evidence is accepted", validation: "review checklist", definition_of_done: "Review is recorded", original_estimate_hours: 2, requirements: ["REQ-1"], parent_requirement_ids: ["REQ-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-1"], parent_acceptance_criteria_ids: ["AC-1"], acceptance_criteria: [{id: "AC-1", statement: "Bằng chứng khôi phục được chấp nhận", verification: "review checklist", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
    {target_ref: "goal-2", dependencies: ["PMA-20260803-01"], desired_state: {project: "AIPLATFORM", issue_type: "Story", parent_ref: "epic-1", draft_ref: "goal-2", goal_name: "Verify rollback guide", summary: "Verify rollback guide", target_completion_date: "2026-08-07", target_completion_date_evidence: {source: "specification", reference: "Confluence page-200 target", verified: true}, due_date: "2026-08-07", definition_of_done: ["Walkthrough evidence accepted"], canonical_spec: "Confluence page-200", requirements: ["REQ-2"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [{id: "AC-2", statement: "Hướng dẫn rollback hoàn tất walkthrough", verification: "guide walkthrough", requirement_refs: ["REQ-2"]}], validation: ["guide walkthrough"]}},
    {target_ref: "task-3", dependencies: ["PMA-20260803-05"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-2", draft_ref: "task-3", summary: "Run guide walkthrough", outcome: "Guide gaps are known", validation: "walkthrough", definition_of_done: "Gaps are recorded", original_estimate_hours: 2, requirements: ["REQ-2"], parent_requirement_ids: ["REQ-2"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-2"], parent_acceptance_criteria_ids: ["AC-2"], acceptance_criteria: [{id: "AC-1", statement: "Các khoảng trống trong hướng dẫn được ghi nhận", verification: "walkthrough", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
    {target_ref: "task-4", dependencies: ["PMA-20260803-05"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-2", draft_ref: "task-4", summary: "Resolve guide gaps", outcome: "Guide is usable", validation: "second walkthrough", definition_of_done: "Walkthrough passes", original_estimate_hours: 4, requirements: ["REQ-2"], parent_requirement_ids: ["REQ-2"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-2"], parent_acceptance_criteria_ids: ["AC-2"], acceptance_criteria: [{id: "AC-1", statement: "Hướng dẫn hoàn tất walkthrough lần hai", verification: "second walkthrough", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
  ];
  const actions = goalActions.map((action, index) => ({
    id: `PMA-20260803-${String(index + 1).padStart(2, "0")}`,
    system: "jira",
    operation: "issue.create",
    target_ref: action.target_ref,
    target_version: null,
    before_state: {},
    desired_state: action.desired_state,
    evidence: ["approved Goal draft"],
    reason: "Create approved Goal hierarchy",
    preconditions: ["Goal contract remains verified"],
    dependencies: action.dependencies,
    risk: "medium",
    approval_required: "group",
    expires_at: "2026-08-04T00:00:00Z",
    rollback_guidance: "Stop and report the created issue IDs",
    status: "proposed",
  }));
  return {schema_version: 5, id: "PMG-20260803-01", project: "AIPLATFORM", summary: "Create Goal hierarchy", created_at: "2026-08-03T00:00:00Z", expires_at: "2026-08-04T00:00:00Z", status: "proposed", payload_hash: "0".repeat(64), approval: {group_approved_by: null, approved_action_ids: [], approved_at: null, payload_hash: null}, actions};
}
