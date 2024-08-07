use std::{
    str::FromStr,
    time::{Duration, Instant},
};

use alloy::{
    network::EthereumWallet,
    primitives::{
        utils::{format_ether, format_units},
        Address, U256,
    },
    providers::{Provider, ProviderBuilder},
    rpc::types::TransactionRequest,
    signers::local::PrivateKeySigner,
};
use log::{debug, warn};
use rand::{thread_rng, Rng};
use solana_sdk::{
    compute_budget::ComputeBudgetInstruction,
    message::{v0::Message, VersionedMessage},
    native_token::lamports_to_sol,
    program_pack::Pack,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::VersionedTransaction,
};
use tauri::{AppHandle, Manager};

use crate::{
    chain::{Chain, SolRpcClientExt},
    consts::{BASE_ONE_INCH_V6_ROUTER_ADDR, ONE_INCH_ETH_ADDR, WSOL_MINT},
    contracts::Erc20Contract,
    error::AppError,
    jup::{self, quote::QuoteRequest, swap::SwapRequest, transaction_config::TransactionConfig},
    one_inch::{self, SwapQueryParams},
    state::{AppHandleStateExt, TradeTaskState},
    token::TokenInfo,
    utils::AppHandleExt,
    wallet::PrivateKey,
};

use super::{
    Task, TaskState, TradeDirection, TradeMode, TradeTaskEventPayload, TradeTaskEventType,
};

#[derive(Debug)]
pub struct Worker {
    pub id: u32,
    pub task_id: String,
    pub app_handle: AppHandle,
    pub win_label: String,
    pub chain: Chain,
    pub agg_api_url: String,
    pub agg_api_key: Option<String>,
    pub token: TokenInfo,
    pub trade_mode: TradeMode,
    pub percetage: (u32, u32),
    pub slippage: u16,
    pub gas_price: u32,
}

impl Worker {
    fn send_task_msg_to_win(&self, kind: TradeTaskEventType, msg: impl Into<String>) {
        let evt = TradeTaskEventPayload::new_task_event(&self.task_id, kind, msg);
        self.app_handle.emit_trade_task_evt(&self.win_label, evt);
    }
    fn send_worker_msg_to_win(&self, kind: TradeTaskEventType, msg: impl Into<String>) {
        let evt = TradeTaskEventPayload::new_worker_event(self, kind, msg);
        self.app_handle.emit_trade_task_evt(&self.win_label, evt);
    }

    pub fn start(self) {
        tauri::async_runtime::spawn(async move {
            loop {
                let tasks_state = self.app_handle.state::<TradeTaskState>();
                let mut guard = tasks_state.write().await;
                let task = guard.get_mut(&self.task_id);
                if task.is_none() {
                    warn!("task {} not found", self.task_id);
                    break;
                }
                let task = task.unwrap();
                match task.task_state {
                    TaskState::Created | TaskState::Stopped => {
                        break;
                    }
                    TaskState::Running => {
                        let trade_interval_secs = task.interval_secs;
                        drop(guard);

                        let msg_kind = TradeTaskEventType::Executed;
                        if let Err(err) = self.execute().await {
                            self.send_worker_msg_to_win(msg_kind, err.err_msg);
                            self.send_worker_msg_to_win(TradeTaskEventType::Executed, "");
                        }

                        if trade_interval_secs >= 5 {
                            self.send_worker_msg_to_win(
                                msg_kind,
                                format!(
                                    "waiting {trade_interval_secs} seconds for next trade ......"
                                ),
                            );
                        }
                        tokio::time::sleep(Duration::from_secs(trade_interval_secs)).await;
                    }
                    TaskState::Stopping => {
                        self.stop(task);
                        break;
                    }
                }
            }
        });
    }

    async fn execute(&self) -> Result<(), AppError> {
        // take
        let selected_key = self.take_private_key().await?;
        if selected_key.is_none() {
            warn!("no private key for worker: {}", self.id);

            return Ok(());
        }

        let selected_key = selected_key.unwrap();

        // NOTE: take and return must success, so don't consume Result here
        let execute_result = match self.chain {
            Chain::Solana => self.sol_execute(&selected_key).await,
            Chain::Base => self.evm_execute(&selected_key).await,
        };

        if execute_result.is_ok() {
            self.send_worker_msg_to_win(TradeTaskEventType::Executed, "");
        }

        // return
        self.return_private_key(selected_key).await?;

        execute_result
    }

    fn get_trade_direction(&self, native_bal: U256, token_bal: U256) -> TradeDirection {
        match self.trade_mode {
            TradeMode::Both => {
                if token_bal == U256::ZERO {
                    return TradeDirection::Buy;
                }

                if native_bal < U256::from(10000) {
                    return TradeDirection::Sell;
                }

                let sell: bool = thread_rng().gen();

                if sell {
                    TradeDirection::Sell
                } else {
                    TradeDirection::Buy
                }
            }
            TradeMode::BuyOnly => TradeDirection::Buy,
            TradeMode::SellOnly => TradeDirection::Sell,
        }
    }

    fn get_percentage(&self) -> u64 {
        let (min, max) = self.percetage;
        thread_rng().gen_range(min..=max) as u64
    }

    async fn sol_execute(&self, selected_key: &[u8]) -> Result<(), AppError> {
        let rpc_client = self.app_handle.read_sol_rpc_client().await?;
        let wallet_keypair = Keypair::from_bytes(selected_key)?;
        let wallet_pubkey = wallet_keypair.pubkey();
        debug!("wallet {wallet_pubkey} for worker: {}", self.id);

        let token_mint = Pubkey::from_str(&self.token.addr)?;
        let lamports = rpc_client.get_balance(&wallet_pubkey).await?;
        let wallet_token_account_pubkey =
            spl_associated_token_account::get_associated_token_address(&wallet_pubkey, &token_mint);
        let wallet_token_account = rpc_client
            .get_account_with_commitment(&wallet_token_account_pubkey, rpc_client.commitment())
            .await?
            .value;

        let wallet_token_bal = match wallet_token_account {
            Some(account) => spl_token::state::Account::unpack(&account.data)?.amount,
            None => 0,
        };
        let trade_direction =
            self.get_trade_direction(U256::from(lamports), U256::from(wallet_token_bal));
        let percentage = self.get_percentage();

        let (input_amount, input_mint, output_mint, msg) = match trade_direction {
            TradeDirection::Buy => {
                let amount = lamports * percentage / 100;
                let amount_ui = lamports_to_sol(amount);
                let msg = format!("use {} SOL to buy {}", amount_ui, self.token.symbol);
                (amount, WSOL_MINT, token_mint, msg)
            }
            TradeDirection::Sell => {
                let amount = wallet_token_bal * percentage / 100;
                let amount_ui = spl_token::amount_to_ui_amount(amount, self.token.decimals);
                let msg = format!("to sell {} {}", amount_ui, self.token.symbol);
                (amount, token_mint, WSOL_MINT, msg)
            }
        };

        let msg_kind = TradeTaskEventType::Executed;
        let evt_msg = format!("choose account {wallet_pubkey} {msg}",);
        self.send_worker_msg_to_win(msg_kind, evt_msg);

        if input_amount == 0 {
            return Err(AppError::new("input is 0, skip this trade ......"));
        }

        let proxied_http_client = self.app_handle.get_proxied_http_client().await?;
        let proxy_url = proxied_http_client.url;
        let proxied_http_client = proxied_http_client.client;
        self.send_worker_msg_to_win(msg_kind, format!("use proxy: {} to request jup", proxy_url));

        let quote_req = QuoteRequest {
            amount: input_amount,
            input_mint,
            output_mint,
            slippage_bps: self.slippage,
            only_direct_routes: Some(true),
            ..Default::default()
        };
        debug!("jup quote req: {}", serde_qs::to_string(&quote_req)?);
        let quote_response = jup::quote(&proxied_http_client, &self.agg_api_url, &quote_req)
            .await
            .map_err(|err| AppError::new(err.to_string()))?;

        let swap_req = SwapRequest {
            quote_response,
            user_public_key: wallet_pubkey,
            config: TransactionConfig {
                use_shared_accounts: false,
                ..Default::default()
            },
        };
        let swap_ixs_resp =
            jup::swap_instructions(&proxied_http_client, &self.agg_api_url, &swap_req)
                .await
                .map_err(|err| AppError::new(err.to_string()))?;

        let setup_ixs = swap_ixs_resp.setup_instructions;
        let swap_ix = swap_ixs_resp.swap_instruction;
        let cleanup_ix = swap_ixs_resp
            .cleanup_instruction
            .map(|ix| vec![ix])
            .unwrap_or_default();
        // let compute_units_ixs = swap_ixs_resp.compute_budget_instructions;
        let addr_loopup_tb = rpc_client
            .get_address_lookup_tables(&swap_ixs_resp.address_lookup_table_addresses)
            .await?;

        let compute_units_ixs = vec![
            ComputeBudgetInstruction::set_compute_unit_limit(600_000),
            ComputeBudgetInstruction::set_compute_unit_price(self.gas_price as u64),
        ];

        let tx_ixs = [compute_units_ixs, setup_ixs, vec![swap_ix], cleanup_ix].concat();

        let recent_blockhash = rpc_client.get_latest_blockhash().await?;
        let tx_msg =
            Message::try_compile(&wallet_pubkey, &tx_ixs, &addr_loopup_tb, recent_blockhash)?;
        let tx_msg = VersionedMessage::V0(tx_msg);
        let tx = VersionedTransaction::try_new(tx_msg, &[&wallet_keypair])?;

        let txid = rpc_client.send_transaction(&tx).await?;

        let evt_msg = format!("transaction {txid} has been send, confirming now ...");
        self.send_worker_msg_to_win(msg_kind, evt_msg);

        let start_time = Instant::now();
        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let results: Vec<_> = rpc_client
                .get_signature_statuses_with_history(&[txid])
                .await?
                .value;
            let result = results[0].clone();
            if result.is_none() {
                if start_time.elapsed().as_secs() > 120 {
                    let evt_msg =
                        format!("transaction {txid} was dropped, please increase priority fee");
                    self.send_worker_msg_to_win(msg_kind, evt_msg);
                    break;
                } else {
                    // still pendding status
                    debug!("transaction {txid} still pendding...");
                    continue;
                }
            } else {
                let status = result.unwrap();
                match status.err {
                    Some(err) => {
                        let evt_msg =
                            format!("transaction {txid} landed but failed, error is: {err}");
                        self.send_worker_msg_to_win(msg_kind, evt_msg);
                    }
                    None => {
                        let evt_msg = format!("transaction {txid} landed and successed !!!");
                        self.send_worker_msg_to_win(msg_kind, evt_msg);
                    }
                }
                break;
            }
        }

        Ok(())
    }

    async fn evm_execute(&self, selected_key: &[u8]) -> Result<(), AppError> {
        let rpc_client = self.app_handle.read_evm_rpc_client().await?;
        let wallet_signer = PrivateKeySigner::from_slice(selected_key)?;
        let wallet_address = wallet_signer.address();

        let rpc_provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(EthereumWallet::from(wallet_signer))
            .on_client(rpc_client);

        let token_address = Address::from_str(&self.token.addr)?;
        let balance_wei = rpc_provider.get_balance(wallet_address).await?;
        let token_contract = Erc20Contract::new(token_address, rpc_provider.clone());
        let wallet_token_bal = token_contract
            .balanceOf(wallet_address)
            .call()
            .await?
            .balance;
        let trade_direction = self.get_trade_direction(balance_wei, wallet_token_bal);
        let percentage = self.get_percentage();

        let (input_amount, input_token_addr, output_token_addr, msg) = match trade_direction {
            TradeDirection::Buy => {
                let amount = balance_wei * U256::from(percentage) / U256::from(100);
                let amount_ui = format_ether(amount);
                let msg = format!("use {} ETH to buy {}", amount_ui, self.token.symbol);
                (amount, ONE_INCH_ETH_ADDR, token_address, msg)
            }
            TradeDirection::Sell => {
                let amount = wallet_token_bal * U256::from(percentage) / U256::from(100);
                let amount_ui = format_units(amount, self.token.decimals)?;
                let msg = format!("to sell {} {}", amount_ui, self.token.symbol);
                (amount, token_address, ONE_INCH_ETH_ADDR, msg)
            }
        };

        let msg_kind = TradeTaskEventType::Executed;
        let evt_msg = format!("choose account {wallet_address} {msg}",);
        self.send_worker_msg_to_win(msg_kind, evt_msg);

        if input_amount.is_zero() {
            return Err(AppError::new("input amount too small, skip it..."));
        }

        if input_token_addr == token_address {
            let allowance = token_contract
                .allowance(wallet_address, BASE_ONE_INCH_V6_ROUTER_ADDR)
                .call()
                .await?
                ._0;

            if allowance < input_amount {
                let evt_msg = "allowance not enough, adjust it ....";
                self.send_worker_msg_to_win(msg_kind, evt_msg);

                let receipt = token_contract
                    .approve(BASE_ONE_INCH_V6_ROUTER_ADDR, U256::MAX)
                    .send()
                    .await?
                    .get_receipt()
                    .await?;
                if !receipt.status() {
                    return Err(AppError::new("adjust allowance failed ...."));
                }
                let approve_txid = receipt.transaction_hash;
                let evt_msg = format!("adjust allowance successed, tx: {approve_txid}");
                self.send_worker_msg_to_win(msg_kind, evt_msg);
            }
        }

        let proxied_http_client = self.app_handle.get_proxied_http_client().await?;

        let proxy_url = proxied_http_client.url;
        self.send_worker_msg_to_win(
            msg_kind,
            format!("use proxy: {} to request 1inch", proxy_url),
        );

        let proxied_http_client = proxied_http_client.client;
        let swap_query_params = SwapQueryParams {
            src: input_token_addr,
            dst: output_token_addr,
            amount: input_amount,
            from: wallet_address,
            origin: wallet_address,
            slippage: self.slippage,
        };

        let api_key = self.agg_api_key.clone().unwrap_or_default();
        let resp = one_inch::get_swap_data(
            &proxied_http_client,
            &self.agg_api_url,
            &api_key,
            alloy_chains::NamedChain::Base.into(),
            swap_query_params,
        )
        .await?;

        let total_fee = resp.tx.gas_price * U256::from(resp.tx.gas);
        let total_need = total_fee + resp.tx.value;
        let balance_eth = format_ether(balance_wei);
        let total_need_eth = format_ether(total_need);
        if balance_wei < total_need {
            return Err(AppError::new(format!(
                "wallet {wallet_address} balance too low {balance_eth} ETH, need: {total_need_eth} ETH"
            )));
        }

        let tx_req: TransactionRequest = resp.tx.try_into()?;
        let receipt = rpc_provider
            .send_transaction(tx_req)
            .await?
            .get_receipt()
            .await?;

        let tx_hash = receipt.transaction_hash;

        if !receipt.status() {
            return Err(AppError::new(format!(
                "swap transaction failed .... tx_id: {tx_hash}"
            )));
        }

        self.send_worker_msg_to_win(msg_kind, format!("swap successed ... txhash: {tx_hash}"));

        Ok(())
    }

    fn stop(&self, task: &mut Task) {
        // stop worker
        task.running_workers -= 1;
        let evt_msg = format!("Worker {} stop successed", self.id);
        self.send_worker_msg_to_win(TradeTaskEventType::Stopped, evt_msg);

        // if all worker stopped, mark task stopped
        if task.running_workers == 0 {
            task.task_state = TaskState::Stopped;
            let evt_msg = format!("task {} stop successed", self.task_id);
            self.send_task_msg_to_win(TradeTaskEventType::Stopped, evt_msg);
            debug!("stopped task: {}", self.task_id);
        }
    }

    async fn take_private_key(&self) -> Result<Option<PrivateKey>, AppError> {
        let task_state = self.app_handle.state::<TradeTaskState>();
        let mut guard = task_state.write().await;
        let task = guard.get_mut(&self.task_id);
        if task.is_none() {
            return Err(AppError::new(format!("no task {} found", self.task_id)));
        }
        let task = task.unwrap();
        let selected_key = task.take_private_key();
        drop(guard);

        Ok(selected_key)
    }

    async fn return_private_key(&self, private_key: PrivateKey) -> Result<(), AppError> {
        let task_state = self.app_handle.state::<TradeTaskState>();
        let mut guard = task_state.write().await;
        let task = guard.get_mut(&self.task_id);
        if task.is_none() {
            return Err(AppError::new(format!("no task {} found", self.task_id)));
        }
        let task = task.unwrap();
        task.return_private_key(private_key);
        drop(guard);

        Ok(())
    }
}
