use std::{collections::HashMap, sync::Arc};

use alloy::{
    providers::RootProvider, rpc::client::RpcClient as EvmRpcClient, transports::http::Http,
};
use async_trait::async_trait;
use solana_client::nonblocking::rpc_client::RpcClient as SolRpcClient;
use tauri::{AppHandle, Manager};
use tokio::sync::{Mutex, RwLock};

use crate::{error::AppError, project::Project, task::Task};

#[derive(Debug)]
pub struct ProjectStateValue {
    pub path: String,
    pub project: Project,
}

#[derive(Debug, Clone)]
pub struct HttpClientState(pub reqwest::Client);

#[derive(Debug, Clone)]
pub struct ProxiedHttpClientValue {
    pub url: String,
    pub client: reqwest::Client,
}

pub type EvmRpcProvider = RootProvider<Http<reqwest::Client>>;

pub type ProjectState = Mutex<Option<ProjectStateValue>>;
pub type EvmRpcClientState = RwLock<Option<EvmRpcClient<Http<reqwest::Client>>>>;
pub type EvmProviderState = RwLock<Option<EvmRpcProvider>>;
pub type SolRpcClientState = RwLock<Option<Arc<SolRpcClient>>>;
pub type TradeTaskState = RwLock<HashMap<String, Task>>;
pub type ProxiedHttpClientState = RwLock<Vec<ProxiedHttpClientValue>>;

#[async_trait]
pub trait AppHandleStateExt {
    async fn get_proxied_http_client(&self) -> Result<ProxiedHttpClientValue, AppError>;
    async fn read_sol_rpc_client(&self) -> Result<Arc<SolRpcClient>, AppError>;
    async fn read_evm_provider(&self) -> Result<EvmRpcProvider, AppError>;
    async fn read_evm_rpc_client(&self) -> Result<EvmRpcClient<Http<reqwest::Client>>, AppError>;
}

#[async_trait]
impl AppHandleStateExt for AppHandle {
    async fn get_proxied_http_client(&self) -> Result<ProxiedHttpClientValue, AppError> {
        let proxied_http_client_state = self.state::<ProxiedHttpClientState>();
        let mut guard = proxied_http_client_state.write().await;
        if guard.len() == 0 {
            let client = self.state::<HttpClientState>().0.clone();
            drop(guard);
            return Ok(ProxiedHttpClientValue {
                url: "no proxy".to_owned(),
                client,
            });
        }

        let removed = guard.remove(0);
        let selected_client = removed.clone();
        guard.push(removed);
        drop(guard);

        Ok(selected_client)
    }

    async fn read_sol_rpc_client(&self) -> Result<Arc<SolRpcClient>, AppError> {
        let rpc_state = self.state::<SolRpcClientState>();
        let guard = rpc_state.read().await;
        if guard.is_none() {
            return Err(AppError::new("no sol rpc client found"));
        }
        let rpc_client = guard.clone().unwrap();
        drop(guard);

        Ok(rpc_client)
    }

    async fn read_evm_provider(&self) -> Result<EvmRpcProvider, AppError> {
        let rpc_state = self.state::<EvmProviderState>();
        let guard = rpc_state.read().await;
        if guard.is_none() {
            println!("no evm rpc client found");
            return Err(AppError::new("no evm rpc client found"));
        }
        let rpc_client = guard.clone().unwrap();
        drop(guard);

        Ok(rpc_client)
    }

    async fn read_evm_rpc_client(&self) -> Result<EvmRpcClient<Http<reqwest::Client>>, AppError> {
        let rpc_state = self.state::<EvmRpcClientState>();
        let guard = rpc_state.read().await;
        if guard.is_none() {
            return Err(AppError::new("no evm rpc client found"));
        }
        let rpc_client = guard.clone().unwrap();
        drop(guard);

        Ok(rpc_client)
    }
}
