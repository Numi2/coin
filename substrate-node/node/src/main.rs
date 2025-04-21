//! Substrate-based node integrating PQC crates and Blake3 hashing

mod pow;
mod kem_keystore;
mod service;
mod transport;
// JSON-RPC server for custom RPC methods
mod rpc;
use sc_service::{Configuration, AbstractService};
use sc_cli::RunCmd;

fn main() -> sc_cli::Result<()> {
    // Parse command-line arguments and run the node
    let runner = RunCmd::from_args();
    runner.run( |config: Configuration| async move {
        // Build and start the full service
        // Build and start the full service with PQC transport and manual PoW consensus
        let service = sc_service::new_full::<runtime::RuntimeApi, sc_service::DefaultTaskExecutor>(
            &config,
            |config| async move { Ok(service::new_partial(&config)?) },
        )?;
        // Start the network
        sc_service::start_network(service.network())?;
        // Launch our standalone JSON-RPC server for custom methods
        rpc::start_rpc_server(
            service.client().clone(),
            &config,
        )
        .map_err(|e| sc_cli::Error::Service(Box::from(e)))?;
        Ok(service)
    })
}