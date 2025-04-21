//! Custom JSON-RPC server for submitting transactions, querying chain state, and fetching block templates.
use std::sync::Arc;
use std::net::SocketAddr;
use jsonrpsee::core::{Error as RpcError, RpcResult};
use jsonrpsee::rpc_params;
use jsonrpsee::http_server::{HttpServerBuilder, HttpServerHandle};
use jsonrpsee::RpcModule;
use serde::{Deserialize, Serialize};
use sp_core::H256;
use sp_api::BlockId;
use sc_service::Configuration;
use blake3;
use sc_client_api::{BlockchainEvents, ProvideRuntimeApi, StorageProvider};
use runtime::RuntimeApi;

/// Block template returned via RPC
#[derive(Debug, Serialize, Deserialize)]
pub struct BlockTemplate {
    pub parent_hash: H256,
    pub difficulty: u64,
    pub target: u64,
}

/// Start a standalone JSON-RPC server exposing custom methods.
/// Binds to the first address in `config.rpc_http.listen_http` or defaults to 127.0.0.1:9933.
pub fn start_rpc_server<C>(
    client: Arc<C>,
    config: &Configuration,
) -> Result<HttpServerHandle, Box<dyn std::error::Error>>
where
    C: ProvideRuntimeApi<RuntimeApi> + StorageProvider<H256> + BlockchainEvents + Send + Sync + 'static,
    C::Api: runtime::PowApi,
{
    // Determine listen address
    let listen: SocketAddr = config
        .rpc_http
        .listen_http
        .get(0)
        .cloned()
        .unwrap_or_else(|| "127.0.0.1:9933".parse().unwrap());

    // Build the HTTP server
    let server = HttpServerBuilder::default().build(listen)?;
    let mut module = RpcModule::new(());
    let client = client.clone();

    // RPC: get_block_template(parent_hash)
    module.register_method("get_block_template", move |params, _| {
        let parent_hash: H256 = params.one()?;
        // Query runtime API for difficulty
        let difficulty = client
            .runtime_api()
            .current_difficulty(BlockId::Hash(parent_hash))
            .map_err(|e| RpcError::Custom(e.to_string()))?;
        let target = u64::MAX / difficulty;
        Ok(BlockTemplate { parent_hash, difficulty, target })
    })?;

    // RPC: submit_transaction(tx_bytes)
    module.register_method("submit_transaction", move |params, _| {
        let tx_bytes: Vec<u8> = params.one()?;
        // TODO: integrate transaction pool submission
        // For now, return Blake3-based hash of the bytes as a placeholder
        let h = blake3::hash(&tx_bytes);
        let mut out = [0u8; 32];
        out.copy_from_slice(h.as_bytes());
        let tx_hash = H256::from(out);
        Ok(tx_hash)
    })?;

    // RPC: get_chain_state(storage_key, at)
    module.register_method("get_chain_state", move |params, _| {
        let key: Vec<u8> = params.one()?;
        let at: Option<H256> = params.one()?;
        let at_block = at.map(BlockId::Hash);
        let data = client
            .storage(&key, at_block)
            .map_err(|e| RpcError::Custom(e.to_string()))?;
        Ok(data)
    })?;

    // Start the server
    let handle = server.start(module)?;
    tracing::info!(target: "rpc", "Custom RPC server listening on {}", listen);
    Ok(handle)
}