use std::{collections::HashMap, str::FromStr, sync::Arc, time::Duration};

use alloy::{
    providers::ProviderBuilder, rpc::client::ClientBuilder, signers::local::PrivateKeySigner,
    transports::http::Http,
};
use serde::{Deserialize, Serialize};
use solana_client::{nonblocking::rpc_client::RpcClient, rpc_client::RpcClientConfig};
use solana_rpc_client::http_sender::HttpSender;
use solana_sdk::commitment_config::CommitmentConfig;
use tauri::{command, AppHandle, Manager, State, Url};

use crate::{
    chain::Chain,
    error::AppError,
    project::Project,
    state::{
        EvmProviderState, EvmRpcClientState, ProjectState, ProjectStateValue,
        ProxiedHttpClientState, ProxiedHttpClientValue, SolRpcClientState, TradeTaskState,
    },
    utils,
};

use super::wallet::WalletGrpResp;

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProjectReq {
    pub id: String,
    pub name: String,
    pub chain: Chain,
    pub rpc: String,
    pub jito_url: Option<String>,
    pub agg_api_url: String,
    pub agg_api_key: Option<String>,
    pub proxy_urls: Vec<String>,
    pub save_path: String,
}

#[derive(Debug, Serialize)]
pub struct ProjectResp {
    pub id: String,
    pub name: String,
    pub chain: Chain,
    pub main_wallet: String,
    pub main_wallet_pk: String,
    pub rpc: String,
    pub jito_url: Option<String>,
    pub agg_api_url: String,
    pub agg_api_key: Option<String>,
    pub proxy_urls: Vec<String>,
    pub wallet_grps: Vec<WalletGrpResp>,
}

impl TryFrom<&Project> for ProjectResp {
    type Error = AppError;

    fn try_from(value: &Project) -> Result<Self, Self::Error> {
        let main_wallet = utils::pk_to_addr(value.chain, &value.main_wallet)?;
        let main_wallet_pk = utils::pk_to_string(value.chain, &value.main_wallet)?;
        let mut wallet_grps = vec![];
        for v in value.wallet_grps.iter() {
            let grp = WalletGrpResp::try_from(v)?;
            wallet_grps.push(grp);
        }

        Ok(Self {
            id: value.id.clone(),
            name: value.name.clone(),
            chain: value.chain,
            main_wallet,
            main_wallet_pk,
            rpc: value.rpc.clone(),
            jito_url: value.jito_url.clone(),
            agg_api_url: value.agg_api_url.clone(),
            agg_api_key: value.agg_api_key.clone(),
            proxy_urls: value.proxy_urls.clone(),
            wallet_grps,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectReq {
    pub main_wallet_pk: String,
    pub proxy_urls: Vec<String>,
    pub rpc_url: String,
    pub jito_url: Option<String>,
    pub agg_api_url: String,
}

#[command(async)]
pub async fn create_project(req: CreateProjectReq) -> Result<(), AppError> {
    let save_path = req.save_path.clone();
    if req.proxy_urls.is_empty() {
        return Err(AppError::new("proxy list must not empty"));
    }

    Url::parse(&req.rpc).map_err(|_| AppError::new("Rpc Url is not a valid url"))?;
    Url::parse(&req.agg_api_url)
        .map_err(|_| AppError::new("Aggregation Api Url is not a valid url"))?;

    let proj = Project::from(req);
    proj.save(save_path).await?;

    Ok(())
}

#[command(async)]
pub async fn open_project(path: String, app_handle: AppHandle) -> Result<ProjectResp, AppError> {
    let proj = Project::read_from(path.clone()).await?;
    let resp = ProjectResp::try_from(&proj)?;
    let rpc_proxy_url = proj.proxy_urls[0].clone();

    match &proj.chain {
        Chain::Solana => {
            let client_state = app_handle.state::<SolRpcClientState>();
            let http_client = reqwest_11::Client::builder()
                .proxy(reqwest_11::Proxy::all(rpc_proxy_url)?)
                .timeout(Duration::from_secs(10))
                .danger_accept_invalid_certs(true) 
                .build()?;
            let http_sender = HttpSender::new_with_client(proj.rpc.clone(), http_client);
            let client = RpcClient::new_sender(
                http_sender,
                RpcClientConfig::with_commitment(CommitmentConfig::confirmed()),
            );

            let mut guard = client_state.write().await;
            *guard = Some(Arc::new(client));
            drop(guard)
        }
        Chain::Base | Chain::Bsc => {
            let client_state = app_handle.state::<EvmRpcClientState>();
            let provider_state = app_handle.state::<EvmProviderState>();
            let chain_config = proj.chain.evm_chain_config().unwrap();

            let http_client = reqwest::ClientBuilder::new()
                .proxy(reqwest::Proxy::all(rpc_proxy_url)?)
                .timeout(Duration::from_secs(60))
                .danger_accept_invalid_certs(true) 
                .build()?;
            let rpc_url = proj.rpc.parse()?;
            let transport: Http<reqwest::Client> = Http::with_client(http_client, rpc_url);
            let client = ClientBuilder::default().transport(transport, false);

            let mut guard = client_state.write().await;
            *guard = Some(client.clone());
            drop(guard);

            let provider = ProviderBuilder::new()
                .with_chain(chain_config.named_chain)
                .on_client(client);

            let mut guard = provider_state.write().await;
            *guard = Some(provider);
            drop(guard)
        }
    };

    let mut proxied_http_clients: Vec<ProxiedHttpClientValue> = vec![];
    for proxy_url in &proj.proxy_urls {
        let proxy = reqwest::Proxy::all(proxy_url)?;
        let client = reqwest::ClientBuilder::default()
            .proxy(proxy)
            .connect_timeout(Duration::from_secs(2))
            .read_timeout(Duration::from_secs(10))
            .build()?;
        proxied_http_clients.push(ProxiedHttpClientValue {
            url: proxy_url.clone(),
            client,
        });
    }
    let proxied_http_client_state = app_handle.state::<ProxiedHttpClientState>();
    let mut guard = proxied_http_client_state.write().await;
    *guard = proxied_http_clients;
    drop(guard);

    let state_val = ProjectStateValue {
        path,
        project: proj,
    };

    let project_state = app_handle.state::<ProjectState>();
    let mut guard = project_state.lock().await;
    *guard = Some(state_val);
    drop(guard);

    Ok(resp)
}

#[command(async)]
pub async fn close_project(app_handle: AppHandle) -> Result<(), AppError> {
    let trade_tasks_state = app_handle.state::<TradeTaskState>();
    let mut guard = trade_tasks_state.write().await;
    *guard = HashMap::new();
    drop(guard);

    let proxied_http_client_state = app_handle.state::<ProxiedHttpClientState>();
    let mut guard = proxied_http_client_state.write().await;
    *guard = vec![];
    drop(guard);

    let sol_rpc_client_state = app_handle.state::<SolRpcClientState>();
    let mut guard = sol_rpc_client_state.write().await;
    *guard = None;
    drop(guard);

    let evm_rpc_client_state = app_handle.state::<EvmRpcClientState>();
    let mut guard = evm_rpc_client_state.write().await;
    *guard = None;
    drop(guard);

    let evm_provider_state = app_handle.state::<EvmProviderState>();
    let mut guard = evm_provider_state.write().await;
    *guard = None;
    drop(guard);

    let project_state = app_handle.state::<ProjectState>();
    let mut guard = project_state.lock().await;
    *guard = None;
    drop(guard);

    Ok(())
}

#[command(async)]
pub async fn update_project(
    req: UpdateProjectReq,
    app_handle: AppHandle,
) -> Result<ProjectResp, AppError> {
    let state: State<'_, ProjectState> = app_handle.state();

    Url::parse(&req.rpc_url).map_err(|_| AppError::new("Rpc Url is not a valid url"))?;
    Url::parse(&req.agg_api_url)
        .map_err(|_| AppError::new("Aggregation Api Url is not a valid url"))?;

    let mut guard = state.lock().await;
    if let Some(proj) = guard.as_mut() {
        let chain = proj.project.chain;
        let main_wallet = match chain {
            Chain::Solana => bs58::decode(&req.main_wallet_pk).into_vec()?,
            Chain::Base | Chain::Bsc => PrivateKeySigner::from_str(&req.main_wallet_pk)?
                .to_bytes()
                .to_vec(),
        };
        proj.project.main_wallet = main_wallet;

        proj.project.rpc = req.rpc_url;
        proj.project.jito_url = req.jito_url;
        proj.project.agg_api_url = req.agg_api_url;
        proj.project.proxy_urls = req.proxy_urls;

        proj.project.save(&proj.path).await?;

        let project_path = proj.path.clone();
        drop(guard);

        return open_project(project_path, app_handle.clone()).await;
    }

    Err(AppError::new("project not found"))
}
