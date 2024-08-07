use tauri::{generate_handler, ipc::Invoke};

pub mod chain;
pub mod project;
pub mod tasks;
pub mod wallet;

pub fn invoke_hanlders() -> impl Fn(Invoke) -> bool + Send + Sync + 'static {
    generate_handler![
        project::create_project,
        project::update_project,
        project::open_project,
        project::close_project,
        wallet::create_wallet_grp,
        wallet::import_wallet_grp,
        wallet::export_wallet_grp,
        chain::airdrop,
        chain::transfer_native,
        chain::get_addr_balance,
        chain::get_token_info,
        tasks::create_trade_task,
        tasks::start_trade_task,
        tasks::stop_trade_task,
        tasks::remove_trade_task,
    ]
}
