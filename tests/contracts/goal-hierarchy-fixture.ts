import { canonicalPayloadHash } from "../../src/action-rules.js";
import type { JsonObject } from "../../src/contracts.js";

export function goalHierarchyGroup(): JsonObject {
  const literalPreservation = {policy_ref: ".kilo/config/jiraman.json#/language/preserved_literal_kinds", mode: "exact"};
  const goalActions = [
    {target_ref: "epic-1", dependencies: [], desired_state: {project: "AIPLATFORM", issue_type: "Epic", summary: "Nâng cấp an toàn", draft_ref: "epic-1", content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [{id: "AC-1", statement: "Các Story mục tiêu được nghiệm thu và thước đo thành công được xác minh", verification: "Đối chiếu bản đồ Story mục tiêu và bằng chứng thước đo thành công"}]}},
    {target_ref: "goal-1", dependencies: ["PMA-20260803-01"], desired_state: {project: "AIPLATFORM", issue_type: "Story", parent_ref: "epic-1", draft_ref: "goal-1", goal_name: "Khôi phục bản sao lưu", summary: "Khôi phục bản sao lưu", target_completion_date: "2026-08-07", target_completion_date_evidence: {source: "sprint-end", reference: "Kết thúc Sprint 7", verified: true}, due_date: "2026-08-07", definition_of_done: ["Bằng chứng khôi phục được chấp nhận"], canonical_spec: "Confluence page-200", requirements: ["REQ-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [{id: "AC-1", statement: "Bản sao lưu được khôi phục nguyên vẹn", verification: "Chạy diễn tập khôi phục", requirement_refs: ["REQ-1"]}], validation: ["Chạy diễn tập khôi phục"]}},
    {target_ref: "task-1", dependencies: ["PMA-20260803-02"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-1", draft_ref: "task-1", summary: "Chạy diễn tập khôi phục", outcome: "Kết quả khôi phục được xác minh", validation: "Kiểm thử khôi phục", definition_of_done: "Bằng chứng được đính kèm", original_estimate_hours: 3, requirements: ["REQ-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-1"], acceptance_criteria: [{id: "AC-1", statement: "Kết quả diễn tập khôi phục được ghi nhận", verification: "Kiểm thử khôi phục", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
    {target_ref: "task-2", dependencies: ["PMA-20260803-02"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-1", draft_ref: "task-2", summary: "Rà soát bằng chứng khôi phục", outcome: "Bằng chứng được chấp nhận", validation: "Danh sách kiểm tra rà soát", definition_of_done: "Kết quả rà soát được ghi nhận", original_estimate_hours: 2, requirements: ["REQ-1"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-1"], acceptance_criteria: [{id: "AC-1", statement: "Bằng chứng khôi phục được chấp nhận", verification: "Rà soát danh sách kiểm tra bằng chứng khôi phục", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
    {target_ref: "goal-2", dependencies: ["PMA-20260803-01"], desired_state: {project: "AIPLATFORM", issue_type: "Story", parent_ref: "epic-1", draft_ref: "goal-2", goal_name: "Xác minh hướng dẫn quay lui", summary: "Xác minh hướng dẫn quay lui", target_completion_date: "2026-08-07", target_completion_date_evidence: {source: "specification", reference: "Ngày mục tiêu của Confluence page-200", verified: true}, due_date: "2026-08-07", definition_of_done: ["Bằng chứng kiểm tra từng bước được chấp nhận"], canonical_spec: "Confluence page-200", requirements: ["REQ-2"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", acceptance_criteria: [{id: "AC-2", statement: "Hướng dẫn quay lui hoàn tất quy trình kiểm tra từng bước", verification: "Kiểm tra từng bước của hướng dẫn", requirement_refs: ["REQ-2"]}], validation: ["Kiểm tra từng bước của hướng dẫn"]}},
    {target_ref: "task-3", dependencies: ["PMA-20260803-05"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-2", draft_ref: "task-3", summary: "Kiểm tra từng bước của hướng dẫn", outcome: "Các khoảng trống của hướng dẫn được xác định", validation: "Kiểm tra từng bước của hướng dẫn", definition_of_done: "Các khoảng trống được ghi nhận", original_estimate_hours: 2, requirements: ["REQ-2"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-2"], acceptance_criteria: [{id: "AC-1", statement: "Các khoảng trống trong hướng dẫn được ghi nhận", verification: "Kiểm tra từng bước của hướng dẫn", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
    {target_ref: "task-4", dependencies: ["PMA-20260803-05"], desired_state: {project: "AIPLATFORM", issue_type: "Sub-task", parent_ref: "goal-2", draft_ref: "task-4", summary: "Khắc phục khoảng trống của hướng dẫn", outcome: "Hướng dẫn có thể sử dụng", validation: "Kiểm tra lần hai", definition_of_done: "Lần kiểm tra đạt yêu cầu", original_estimate_hours: 4, requirements: ["REQ-2"], content_language: "vi-VN", acceptance_criteria_storage: "managed-description-section", parent_acceptance_criteria_refs: ["AC-2"], acceptance_criteria: [{id: "AC-1", statement: "Hướng dẫn hoàn tất lần kiểm tra thứ hai", verification: "Thực hiện lần kiểm tra thứ hai", validation_ref: "VAL-1", definition_of_done_ref: "DOD-1"}]}},
  ];
  const actions = goalActions.map((action, index) => ({
    id: `PMA-20260803-${String(index + 1).padStart(2, "0")}`,
    system: "jira",
    operation: "issue.create",
    target_ref: action.target_ref,
    target_version: null,
    before_state: {},
    desired_state: {...action.desired_state, literal_preservation: literalPreservation},
    evidence: ["Bản nháp Mục tiêu đã được phê duyệt"],
    reason: "Tạo hệ phân cấp Mục tiêu đã được phê duyệt",
    preconditions: ["Quy tắc Mục tiêu vẫn được xác minh"],
    dependencies: action.dependencies,
    risk: "medium",
    approval_required: "group",
    expires_at: "2026-08-04T00:00:00Z",
    rollback_guidance: "Dừng và báo cáo các Jira key đã tạo",
    status: "proposed",
  }));
  return {schema_version: 5, id: "PMG-20260803-01", project: "AIPLATFORM", summary: "Tạo hệ phân cấp Mục tiêu", created_at: "2026-08-03T00:00:00Z", expires_at: "2026-08-04T00:00:00Z", status: "proposed", payload_hash: canonicalPayloadHash(actions), approval: {group_approved_by: null, approved_action_ids: [], approved_at: null, payload_hash: null}, actions};
}
