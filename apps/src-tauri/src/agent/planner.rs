use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};

use super::tool_executor;

// ─── Data Structures ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    pub action: String,
    pub description: String,
    pub params: Value,
    pub status: String,       // "pending", "running", "completed", "failed", "skipped"
    pub result: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationPlan {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub steps: Vec<PlanStep>,
    pub status: String,        // "pending_approval", "approved", "executing", "completed", "failed", "cancelled"
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub completed_steps: usize,
    pub total_steps: usize,
}

static PLANS: LazyLock<Arc<Mutex<HashMap<String, OperationPlan>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

use crate::utils::now_secs;

// ─── Tool Executors (called from tool_executor.rs) ──────────────────────────

/// Create a new operation plan. Returns the plan in JSON for Claude to present to the user.
pub fn execute_create_plan(input: &Value) -> Result<String, String> {
    let title = input["title"]
        .as_str()
        .ok_or("Missing 'title' parameter")?
        .to_string();
    let description = input["description"].as_str().map(|s| s.to_string());
    let steps_val = input["steps"]
        .as_array()
        .ok_or("Missing 'steps' parameter — must be an array")?;

    if steps_val.is_empty() {
        return Err("Plan must have at least one step".to_string());
    }
    if steps_val.len() > 50 {
        return Err("Plan cannot have more than 50 steps".to_string());
    }

    let mut steps = Vec::new();
    for (i, step_val) in steps_val.iter().enumerate() {
        let action = step_val["action"]
            .as_str()
            .ok_or(format!("Step {} missing 'action'", i))?
            .to_string();
        let desc = step_val["description"]
            .as_str()
            .ok_or(format!("Step {} missing 'description'", i))?
            .to_string();
        let params = step_val["params"].clone();

        steps.push(PlanStep {
            action,
            description: desc,
            params,
            status: "pending".to_string(),
            result: None,
            error: None,
        });
    }

    let plan_id = format!("plan_{}", now_secs());
    let total = steps.len();
    let plan = OperationPlan {
        id: plan_id.clone(),
        title: title.clone(),
        description: description.clone(),
        steps,
        status: "pending_approval".to_string(),
        created_at: now_secs(),
        completed_at: None,
        completed_steps: 0,
        total_steps: total,
    };

    // Store plan
    PLANS.lock().unwrap_or_else(|e| e.into_inner()).insert(plan_id.clone(), plan.clone());

    // Return plan summary for Claude to show the user
    let summary = json!({
        "plan_id": plan_id,
        "title": title,
        "description": description,
        "total_steps": total,
        "status": "pending_approval",
        "steps": plan.steps.iter().enumerate().map(|(i, s)| {
            json!({
                "step": i + 1,
                "action": s.action,
                "description": s.description,
            })
        }).collect::<Vec<_>>(),
        "note": "This plan requires user approval before execution. Call execute_plan with the plan_id after the user approves."
    });

    serde_json::to_string_pretty(&summary).map_err(|e| e.to_string())
}

/// Execute an approved plan step by step.
pub fn execute_execute_plan(input: &Value) -> Result<String, String> {
    let plan_id = input["plan_id"]
        .as_str()
        .ok_or("Missing 'plan_id' parameter")?;

    // Get plan (clone to release lock)
    let plan = {
        let plans = PLANS.lock().unwrap_or_else(|e| e.into_inner());
        plans.get(plan_id).cloned()
            .ok_or(format!("Plan '{}' not found", plan_id))?
    };

    // Auto-approve plans (user already approved via the tool approval mechanism)
    if plan.status != "pending_approval" && plan.status != "approved" {
        return Err(format!("Plan '{}' is in state '{}', cannot execute", plan_id, plan.status));
    }

    // Mark as executing
    {
        let mut plans = PLANS.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(p) = plans.get_mut(plan_id) {
            p.status = "executing".to_string();
        }
    }

    let mut completed = 0;
    let mut results = Vec::new();

    for (i, step) in plan.steps.iter().enumerate() {
        // Update step to running
        {
            let mut plans = PLANS.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(p) = plans.get_mut(plan_id) {
                p.steps[i].status = "running".to_string();
            }
        }

        // Map plan actions to tool calls
        let result = match step.action.as_str() {
            "create_directory" => tool_executor::execute_create_directory(&step.params),
            "write_file" => tool_executor::execute_write_file(&step.params),
            "rename" => tool_executor::execute_rename(&step.params),
            "delete" => tool_executor::execute_delete(&step.params),
            "move_file" => tool_executor::execute_move_file(&step.params),
            "copy_file" => tool_executor::execute_copy_file(&step.params),
            "execute_command" => tool_executor::execute_command(&step.params),
            other => Err(format!("Unknown plan action: '{}'. Supported: create_directory, write_file, rename, delete, move_file, copy_file, execute_command", other)),
        };

        match result {
            Ok(res) => {
                {
                    let mut plans = PLANS.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(p) = plans.get_mut(plan_id) {
                        p.steps[i].status = "completed".to_string();
                        p.steps[i].result = Some(res.clone());
                        p.completed_steps = completed + 1;
                    }
                }
                completed += 1;
                results.push(json!({
                    "step": i + 1,
                    "description": step.description,
                    "status": "completed",
                    "result": res,
                }));
            }
            Err(err) => {
                {
                    let mut plans = PLANS.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(p) = plans.get_mut(plan_id) {
                        p.steps[i].status = "failed".to_string();
                        p.steps[i].error = Some(err.clone());
                        p.status = "failed".to_string();
                        // Mark remaining steps as skipped
                        for j in (i + 1)..p.steps.len() {
                            p.steps[j].status = "skipped".to_string();
                        }
                    }
                }
                results.push(json!({
                    "step": i + 1,
                    "description": step.description,
                    "status": "failed",
                    "error": err,
                }));

                // Return partial results on failure
                let output = json!({
                    "plan_id": plan_id,
                    "status": "failed",
                    "completed_steps": completed,
                    "total_steps": plan.steps.len(),
                    "failed_at_step": i + 1,
                    "results": results,
                });
                return serde_json::to_string_pretty(&output).map_err(|e| e.to_string());
            }
        }
    }

    // Mark plan as completed
    {
        let mut plans = PLANS.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(p) = plans.get_mut(plan_id) {
            p.status = "completed".to_string();
            p.completed_at = Some(now_secs());
        }
    }

    let output = json!({
        "plan_id": plan_id,
        "status": "completed",
        "completed_steps": completed,
        "total_steps": plan.steps.len(),
        "results": results,
    });
    serde_json::to_string_pretty(&output).map_err(|e| e.to_string())
}

/// Get a plan by ID (for UI display).
pub fn get_plan(plan_id: &str) -> Option<OperationPlan> {
    PLANS.lock().unwrap_or_else(|e| e.into_inner()).get(plan_id).cloned()
}

/// Approve a pending plan.
pub fn approve_plan(plan_id: &str) -> Result<(), String> {
    let mut plans = PLANS.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(plan) = plans.get_mut(plan_id) {
        if plan.status == "pending_approval" {
            plan.status = "approved".to_string();
            Ok(())
        } else {
            Err(format!("Plan '{}' is not pending approval (status: {})", plan_id, plan.status))
        }
    } else {
        Err(format!("Plan '{}' not found", plan_id))
    }
}

/// Get all plans (for UI listing).
pub fn get_all_plans() -> Vec<OperationPlan> {
    PLANS.lock().unwrap_or_else(|e| e.into_inner())
        .values()
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Helper to build a valid create_plan input with a unique title.
    fn make_plan_input(title: &str, step_count: usize) -> Value {
        let steps: Vec<Value> = (0..step_count)
            .map(|i| {
                json!({
                    "action": "create_directory",
                    "description": format!("Step {}", i + 1),
                    "params": {"path": format!("/tmp/test_plan_{}/dir_{}", title, i)}
                })
            })
            .collect();
        json!({
            "title": title,
            "description": "Test plan",
            "steps": steps
        })
    }

    // ─── execute_create_plan ────────────────────────────────────────────

    #[test]
    fn create_plan_success() {
        let input = make_plan_input("test_create_plan_success", 3);
        let result = execute_create_plan(&input);
        assert!(result.is_ok(), "create_plan should succeed: {:?}", result.err());

        let output: Value = serde_json::from_str(&result.unwrap()).unwrap();
        assert_eq!(output["status"], "pending_approval");
        assert_eq!(output["total_steps"], 3);
        assert!(output["plan_id"].as_str().unwrap().starts_with("plan_"));
        assert_eq!(output["title"], "test_create_plan_success");

        // Verify steps are listed
        let steps = output["steps"].as_array().unwrap();
        assert_eq!(steps.len(), 3);
        assert_eq!(steps[0]["step"], 1);
        assert_eq!(steps[0]["action"], "create_directory");
    }

    #[test]
    fn create_plan_missing_title() {
        let input = json!({
            "steps": [{"action": "create_directory", "description": "d", "params": {}}]
        });
        let result = execute_create_plan(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'title' parameter");
    }

    #[test]
    fn create_plan_missing_steps() {
        let input = json!({"title": "test"});
        let result = execute_create_plan(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Missing 'steps' parameter"));
    }

    #[test]
    fn create_plan_empty_steps() {
        let input = json!({
            "title": "test",
            "steps": []
        });
        let result = execute_create_plan(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Plan must have at least one step");
    }

    #[test]
    fn create_plan_too_many_steps() {
        let input = make_plan_input("test_too_many", 51);
        let result = execute_create_plan(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Plan cannot have more than 50 steps");
    }

    #[test]
    fn create_plan_exactly_50_steps() {
        let input = make_plan_input("test_exactly_50", 50);
        let result = execute_create_plan(&input);
        assert!(result.is_ok(), "50 steps should be allowed");
    }

    #[test]
    fn create_plan_step_missing_action() {
        let input = json!({
            "title": "test",
            "steps": [{"description": "d", "params": {}}]
        });
        let result = execute_create_plan(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Step 0 missing 'action'"));
    }

    #[test]
    fn create_plan_step_missing_description() {
        let input = json!({
            "title": "test",
            "steps": [{"action": "create_directory", "params": {}}]
        });
        let result = execute_create_plan(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Step 0 missing 'description'"));
    }

    #[test]
    fn create_plan_stores_plan_in_global_map() {
        // Use the insert_test_plan helper with a unique ID to avoid
        // collisions from now_secs()-based IDs in concurrent tests.
        let plan_id = insert_test_plan("stores_plan_check", vec![
            PlanStep {
                action: "create_directory".to_string(),
                description: "Step 1".to_string(),
                params: json!({"path": "/tmp/test_sp1"}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
            PlanStep {
                action: "create_directory".to_string(),
                description: "Step 2".to_string(),
                params: json!({"path": "/tmp/test_sp2"}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
        ]);

        let plan = get_plan(&plan_id);
        assert!(plan.is_some(), "Plan should be retrievable after insertion");
        let plan = plan.unwrap();
        assert_eq!(plan.title, "Test stores_plan_check");
        assert_eq!(plan.total_steps, 2);
        assert_eq!(plan.status, "pending_approval");
        assert_eq!(plan.completed_steps, 0);
    }

    #[test]
    fn create_plan_no_description() {
        let input = json!({
            "title": "no desc",
            "steps": [{"action": "create_directory", "description": "step", "params": {}}]
        });
        let result = execute_create_plan(&input);
        assert!(result.is_ok());
        let output: Value = serde_json::from_str(&result.unwrap()).unwrap();
        assert!(output["description"].is_null());
    }

    // ─── get_plan / approve_plan ────────────────────────────────────────

    #[test]
    fn get_plan_nonexistent() {
        let plan = get_plan("plan_nonexistent_xyz");
        assert!(plan.is_none());
    }

    #[test]
    fn approve_plan_nonexistent() {
        let result = approve_plan("plan_nonexistent_abc");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn approve_plan_success() {
        let plan_id = insert_test_plan("approve_success", vec![
            PlanStep {
                action: "create_directory".to_string(),
                description: "Step".to_string(),
                params: json!({}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
        ]);

        // Should start as pending_approval
        let plan = get_plan(&plan_id).unwrap();
        assert_eq!(plan.status, "pending_approval");

        // Approve it
        let approve_result = approve_plan(&plan_id);
        assert!(approve_result.is_ok());

        // Check status changed
        let plan = get_plan(&plan_id).unwrap();
        assert_eq!(plan.status, "approved");
    }

    #[test]
    fn approve_plan_already_approved() {
        // Use a unique plan ID to avoid collisions with concurrent tests.
        let plan_id = insert_test_plan("double_approve", vec![
            PlanStep {
                action: "create_directory".to_string(),
                description: "Step".to_string(),
                params: json!({}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
        ]);

        approve_plan(&plan_id).unwrap();

        // Approving again should fail
        let result = approve_plan(&plan_id);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not pending approval"));
    }

    // ─── execute_execute_plan ───────────────────────────────────────────

    #[test]
    fn execute_plan_missing_plan_id() {
        let input = json!({});
        let result = execute_execute_plan(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'plan_id' parameter");
    }

    #[test]
    fn execute_plan_nonexistent() {
        let input = json!({"plan_id": "plan_does_not_exist"});
        let result = execute_execute_plan(&input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    /// Insert a plan directly into the global map with a unique ID.
    /// This avoids `now_secs()`-based ID collisions when tests run in parallel.
    fn insert_test_plan(unique_suffix: &str, steps: Vec<PlanStep>) -> String {
        let plan_id = format!("test_plan_{}", unique_suffix);
        let total = steps.len();
        let plan = OperationPlan {
            id: plan_id.clone(),
            title: format!("Test {}", unique_suffix),
            description: None,
            steps,
            status: "pending_approval".to_string(),
            created_at: now_secs(),
            completed_at: None,
            completed_steps: 0,
            total_steps: total,
        };
        PLANS.lock().unwrap_or_else(|e| e.into_inner()).insert(plan_id.clone(), plan);
        plan_id
    }

    #[test]
    fn execute_plan_with_create_directory_steps() {
        let dir = tempfile::tempdir().unwrap();
        let dir1 = dir.path().join("plan_dir_a");
        let dir2 = dir.path().join("plan_dir_b");

        let plan_id = insert_test_plan("exec_dirs", vec![
            PlanStep {
                action: "create_directory".to_string(),
                description: "Create dir A".to_string(),
                params: json!({"path": dir1.to_str().unwrap()}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
            PlanStep {
                action: "create_directory".to_string(),
                description: "Create dir B".to_string(),
                params: json!({"path": dir2.to_str().unwrap()}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
        ]);

        let exec_input = json!({"plan_id": plan_id});
        let exec_result = execute_execute_plan(&exec_input).unwrap();
        let exec_output: Value = serde_json::from_str(&exec_result).unwrap();

        assert_eq!(exec_output["status"], "completed");
        assert_eq!(exec_output["completed_steps"], 2);
        assert_eq!(exec_output["total_steps"], 2);

        // Verify directories were created
        assert!(dir1.is_dir());
        assert!(dir2.is_dir());
    }

    #[test]
    fn execute_plan_stops_on_failure() {
        let dir = tempfile::tempdir().unwrap();
        let good_dir = dir.path().join("good");
        let skipped_dir = dir.path().join("skipped");

        let plan_id = insert_test_plan("exec_failure", vec![
            PlanStep {
                action: "create_directory".to_string(),
                description: "Create good dir".to_string(),
                params: json!({"path": good_dir.to_str().unwrap()}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
            PlanStep {
                action: "unknown_action_xyz".to_string(),
                description: "This will fail".to_string(),
                params: json!({}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
            PlanStep {
                action: "create_directory".to_string(),
                description: "This should be skipped".to_string(),
                params: json!({"path": skipped_dir.to_str().unwrap()}),
                status: "pending".to_string(),
                result: None,
                error: None,
            },
        ]);

        let exec_input = json!({"plan_id": plan_id});
        let exec_result = execute_execute_plan(&exec_input).unwrap();
        let exec_output: Value = serde_json::from_str(&exec_result).unwrap();

        assert_eq!(exec_output["status"], "failed");
        assert_eq!(exec_output["completed_steps"], 1);
        assert_eq!(exec_output["failed_at_step"], 2);

        // The first directory should be created
        assert!(good_dir.is_dir());
        // The third directory should NOT be created (skipped)
        assert!(!skipped_dir.exists());

        // Check that the plan in the store is marked as failed with skipped steps
        let plan = get_plan(&plan_id).unwrap();
        assert_eq!(plan.status, "failed");
        assert_eq!(plan.steps[0].status, "completed");
        assert_eq!(plan.steps[1].status, "failed");
        assert_eq!(plan.steps[2].status, "skipped");
    }

    // ─── PlanStep / OperationPlan structure ─────────────────────────────

    #[test]
    fn plan_step_default_fields() {
        let step = PlanStep {
            action: "create_directory".to_string(),
            description: "test".to_string(),
            params: json!({}),
            status: "pending".to_string(),
            result: None,
            error: None,
        };
        assert_eq!(step.status, "pending");
        assert!(step.result.is_none());
        assert!(step.error.is_none());
    }

    #[test]
    fn plan_step_serialization_roundtrip() {
        let step = PlanStep {
            action: "write_file".to_string(),
            description: "write a file".to_string(),
            params: json!({"path": "/tmp/x", "content": "y"}),
            status: "completed".to_string(),
            result: Some("ok".to_string()),
            error: None,
        };
        let json = serde_json::to_string(&step).unwrap();
        let deserialized: PlanStep = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.action, "write_file");
        assert_eq!(deserialized.result, Some("ok".to_string()));
    }

    #[test]
    fn operation_plan_serialization_roundtrip() {
        let plan = OperationPlan {
            id: "plan_123".to_string(),
            title: "Test".to_string(),
            description: Some("desc".to_string()),
            steps: vec![],
            status: "pending_approval".to_string(),
            created_at: 1000,
            completed_at: None,
            completed_steps: 0,
            total_steps: 0,
        };
        let json = serde_json::to_string(&plan).unwrap();
        let deserialized: OperationPlan = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "plan_123");
        assert_eq!(deserialized.description, Some("desc".to_string()));
        assert!(deserialized.completed_at.is_none());
    }
}
