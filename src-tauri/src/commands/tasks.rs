use log::debug;
use serde::Deserialize;
use tauri::{command, AppHandle, Manager};

use crate::error::AppError;
use crate::state::{ProjectState, TradeTaskState};
use crate::task::{Task, TaskState, TradeMode};
use crate::token::TokenInfo;

#[derive(Debug, Deserialize)]
pub struct CreateTaskReq {
    pub workers_cnt: u32,
    pub wallet_grp_id: String,
    pub token: TokenInfo,
    pub trade_mode: TradeMode,
    pub percetage: (u32, u32),
    pub slippage: u16,
    pub gas_price: u32,
    pub interval_secs: u64,
}

#[command(async)]
pub async fn create_trade_task(req: CreateTaskReq, app_handle: AppHandle) -> Result<(), AppError> {
    let project_state = app_handle.state::<ProjectState>();
    let guard = project_state.lock().await;
    let proj = guard
        .as_ref()
        .ok_or_else(|| AppError::new("No Project Open"))?;

    let task = Task::create_from_req(&req, &proj.project)?;
    drop(guard);

    let tasks_state = app_handle.state::<TradeTaskState>();
    let mut guard = tasks_state.write().await;
    if let Some(task) = guard.get(&task.id) {
        if task.task_state != TaskState::Created {
            return Err(AppError::new(format!(
                "task {} is already running",
                task.id
            )));
        }
        return Ok(());
    }

    debug!("creating task: {}", task.id);
    guard.insert(task.id.clone(), task);
    drop(guard);

    Ok(())
}

#[command(async)]
pub async fn start_trade_task(id: String, app_handle: AppHandle) -> Result<(), AppError> {
    let tasks_state = app_handle.state::<TradeTaskState>();
    let mut guard = tasks_state.write().await;
    if let Some(task) = guard.get_mut(&id) {
        if task.task_state == TaskState::Created || task.task_state == TaskState::Stopped {
            debug!("starting task: {id}");
            task.task_state = TaskState::Running;
            let workers = task.create_workers(app_handle.clone());
            for worker in workers {
                task.running_workers += 1;
                worker.start();
            }
            drop(guard);
        } else {
            debug!("task is running: {id}");
        }
    } else {
        return Err(AppError::new(format!("task {id} not found")));
    }
    Ok(())
}

#[command(async)]
pub async fn stop_trade_task(id: String, app_handle: AppHandle) -> Result<(), AppError> {
    debug!("stopping task: {id}");
    let tasks_state = app_handle.state::<TradeTaskState>();
    let mut guard = tasks_state.write().await;
    if let Some(task) = guard.get_mut(&id) {
        if task.task_state == TaskState::Running {
            task.task_state = TaskState::Stopping;
        }
    } else {
        return Err(AppError::new(format!("task {id} not found")));
    }
    drop(guard);
    Ok(())
}

#[command(async)]
pub async fn remove_trade_task(id: String, app_handle: AppHandle) -> Result<(), AppError> {
    debug!("remove task: {id}");
    let tasks_state = app_handle.state::<TradeTaskState>();
    let mut guard = tasks_state.write().await;
    if let Some(task) = guard.get_mut(&id) {
        if task.task_state == TaskState::Created || task.task_state == TaskState::Stopped {
            guard.remove(&id);
        }
    } else {
        return Err(AppError::new(format!("task {id} not found")));
    }
    drop(guard);
    Ok(())
}
