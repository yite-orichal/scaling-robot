use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::{
    chain::Chain,
    commands::wallet::{CreateWalletGrpReq, ImportWalletGrpReq},
    error::AppError,
    utils,
};

pub type PrivateKey = Vec<u8>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletGrp {
    pub id: String,
    pub name: String,
    pub chain: Chain,
    pub pks: HashSet<PrivateKey>,
}

impl WalletGrp {
    pub fn create_from_req(req: CreateWalletGrpReq, chain: Chain) -> Self {
        let mut pks = HashSet::new();
        for _ in 0..req.cnt {
            pks.insert(utils::create_pk(chain));
        }

        Self {
            id: req.id,
            name: req.name,
            chain,
            pks,
        }
    }

    pub fn create_from_import_req(req: ImportWalletGrpReq, chain: Chain) -> Result<Self, AppError> {
        let mut pks = HashSet::new();
        for pk in req.pks {
            let keypair = utils::parse_sol_bs58_pk(&pk)?;
            pks.insert(keypair.to_bytes().to_vec());
        }

        Ok(Self {
            id: req.id,
            name: req.name,
            chain,
            pks,
        })
    }
}
