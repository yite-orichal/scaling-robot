use std::collections::HashMap;

use chrono::Utc;
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::chain::Chain;
use crate::commands::tasks::CreateTaskReq;
use crate::error::AppError;
use crate::project::Project;
use crate::token::TokenInfo;
use crate::wallet::PrivateKey;

mod worker;

pub use worker::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskState {
    Created,
    Running,
    Stopping,
    Stopped,
}

#[derive(Debug, strum::Display, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TradeMode {
    Both,
    BuyOnly,
    SellOnly,
}

#[derive(Debug, strum::Display, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TradeDirection {
    Buy,
    Sell,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub workers_cnt: u32,
    pub running_workers: u32,
    pub task_state: TaskState,
    pub chain: Chain,
    pub agg_api_url: String,
    pub agg_api_key: Option<String>,
    pub token: TokenInfo,
    pub trade_mode: TradeMode,
    pub percetage: (u32, u32),
    pub slippage: u16,
    pub use_jito: bool,
    pub jito_url: Option<String>,
    pub gas_price: u32,
    pub interval_secs: u64,
    pub wallet_states: HashMap<PrivateKey, bool>,
}

impl Task {
    pub fn create_from_req(req: &CreateTaskReq, project: &Project) -> Result<Self, AppError> {
        let wallet_grp = project
            .wallet_grps
            .iter()
            .find(|wg| wg.id == req.wallet_grp_id)
            .ok_or_else(|| AppError::new("No wallet group find"))?;

        let wallet_states: HashMap<PrivateKey, bool> = wallet_grp
            .pks
            .iter()
            .map(|pk| (pk.to_owned(), false))
            .collect();

        Ok(Self {
            id: wallet_grp.id.clone(),
            workers_cnt: req.workers_cnt,
            running_workers: 0,
            task_state: TaskState::Created,
            chain: wallet_grp.chain,
            agg_api_url: project.agg_api_url.clone(),
            agg_api_key: project.agg_api_key.clone(),
            wallet_states,
            token: req.token.clone(),
            trade_mode: req.trade_mode,
            percetage: req.percetage,
            slippage: req.slippage,
            use_jito: req.use_jito,
            jito_url: project.jito_url.clone(),
            gas_price: req.gas_price,
            interval_secs: req.interval_secs,
        })
    }

    pub fn create_workers(&self, app_handle: AppHandle) -> Vec<Worker> {
        let task_id = self.id.clone();
        let workers_cnt = self.workers_cnt;
        (0..workers_cnt)
            .map(|idx| {
                let task_id = task_id.clone();
                Worker {
                    win_label: format!("task_{task_id}"),
                    task_id,
                    id: idx,
                    app_handle: app_handle.clone(),
                    chain: self.chain,
                    agg_api_url: self.agg_api_url.clone(),
                    agg_api_key: self.agg_api_key.clone(),
                    token: self.token.clone(),
                    trade_mode: self.trade_mode,
                    percetage: self.percetage,
                    slippage: self.slippage,
                    gas_price: self.gas_price,
                    use_jito: self.use_jito,
                    jito_url: self.jito_url.clone(),
                }
            })
            .collect()
    }

    pub fn take_private_key(&mut self) -> Option<PrivateKey> {
        let not_inuse_keys: Vec<_> = self
            .wallet_states
            .iter()
            .filter_map(|(k, in_use)| if *in_use { None } else { Some(k) })
            .collect();
        if not_inuse_keys.is_empty() {
            return None;
        }
        let key_idx = thread_rng().gen_range(0..not_inuse_keys.len());
        let selected_key = not_inuse_keys[key_idx].clone();
        self.wallet_states
            .entry(selected_key.clone())
            .and_modify(|v| *v = true);

        Some(selected_key)
    }

    pub fn return_private_key(&mut self, private_key: PrivateKey) {
        self.wallet_states
            .entry(private_key)
            .and_modify(|v| *v = false);
    }
}

#[derive(Debug, Copy, Clone, Serialize)]
pub enum TradeTaskEventType {
    Executed,
    Stopped,
}

#[derive(Debug, Clone, Serialize)]
pub struct TradeTaskEventPayload {
    task_id: String,
    worker_id: Option<u32>,
    kind: TradeTaskEventType,
    msg: String,
    ts: i64,
}

impl TradeTaskEventPayload {
    pub fn new_task_event(
        task_id: impl Into<String>,
        kind: TradeTaskEventType,
        msg: impl Into<String>,
    ) -> Self {
        Self {
            task_id: task_id.into(),
            worker_id: None,
            kind,
            msg: msg.into(),
            ts: Utc::now().timestamp_millis(),
        }
    }

    pub fn new_worker_event(
        worker: &Worker,
        kind: TradeTaskEventType,
        msg: impl Into<String>,
    ) -> Self {
        Self {
            task_id: worker.task_id.clone(),
            worker_id: Some(worker.id),
            kind,
            msg: msg.into(),
            ts: Utc::now().timestamp_millis(),
        }
    }
}
