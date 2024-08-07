use std::collections::HashSet;

use crate::{chain::Chain, error::AppError, state::ProjectState, utils, wallet::WalletGrp};
use serde::{Deserialize, Serialize};
use tauri::{command, State};

#[derive(Debug, Serialize)]
pub struct WalletGrpResp {
    pub id: String,
    pub name: String,
    pub chain: Chain,
    pub addresses: HashSet<(String, String)>,
}

impl TryFrom<&WalletGrp> for WalletGrpResp {
    type Error = AppError;

    fn try_from(value: &WalletGrp) -> Result<Self, Self::Error> {
        let mut addresses = HashSet::new();

        for pk in &value.pks {
            let addr = utils::pk_to_addr(value.chain, pk)?;
            let pk_str = utils::pk_to_string(value.chain, pk)?;
            addresses.insert((addr, pk_str));
        }

        Ok(Self {
            id: value.id.clone(),
            name: value.name.clone(),
            chain: value.chain,
            addresses,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateWalletGrpReq {
    pub id: String,
    pub name: String,
    pub cnt: u32,
}

#[derive(Debug, Deserialize)]
pub struct ImportWalletGrpReq {
    pub id: String,
    pub name: String,
    pub pks: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExportWalletGrpReq {
    /// vec item format (addr, pk)
    pub pks: Vec<(String, String)>,
    pub path: String,
}

#[command(async)]
pub async fn create_wallet_grp(
    req: CreateWalletGrpReq,
    state: State<'_, ProjectState>,
) -> Result<WalletGrpResp, AppError> {
    let guard = state.lock().await;
    let chain = guard
        .as_ref()
        .map(|s| s.project.chain)
        .ok_or_else(|| AppError::new("No Project Open"))?;
    drop(guard);

    let grp = WalletGrp::create_from_req(req, chain);
    let resp = WalletGrpResp::try_from(&grp)?;

    let mut guard = state.lock().await;
    if let Some(s) = guard.as_mut() {
        s.project.wallet_grps.push(grp);
        s.project.save(s.path.clone()).await?;
    }
    drop(guard);

    Ok(resp)
}

#[command(async)]
pub async fn import_wallet_grp(
    req: ImportWalletGrpReq,
    state: State<'_, ProjectState>,
) -> Result<WalletGrpResp, AppError> {
    let guard = state.lock().await;
    let chain = guard
        .as_ref()
        .map(|s| s.project.chain)
        .ok_or_else(|| AppError::new("No Project Open"))?;
    drop(guard);

    let grp = WalletGrp::create_from_import_req(req, chain)?;
    let resp = WalletGrpResp::try_from(&grp)?;

    let mut guard = state.lock().await;
    if let Some(s) = guard.as_mut() {
        s.project.wallet_grps.push(grp);
        s.project.save(s.path.clone()).await?;
    }
    drop(guard);

    Ok(resp)
}

#[command(async)]
pub async fn export_wallet_grp(req: ExportWalletGrpReq) -> Result<(), AppError> {
    let file_content = req
        .pks
        .into_iter()
        .map(|(addr, pk)| format!("{addr}, {pk}"))
        .collect::<Vec<_>>()
        .join("\n");
    tokio::fs::write(req.path, file_content).await?;

    Ok(())
}
