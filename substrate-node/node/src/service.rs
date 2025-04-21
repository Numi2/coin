use std::sync::Arc;
use sc_service::{Configuration, PartialComponents, error::Error};
use sc_client_api::{BlockchainEvents, ExecutorProvider};
use sc_consensus_manual::{ManualEngine, ManualEngineParams, ManualSealBlockImport};
use libp2p::identity::Keypair as P2PKeypair;
use pqcrypto_kyber::kyber768;
use tokio::runtime::Builder as TokioRuntimeBuilder;

use crate::pow::blake3_pow;
use crate::kem_keystore::Keystore;
use runtime::{RuntimeApi, ExecutorDispatch};
use crate::transport::build_pq_transport;

/// Create partial components with custom PQC transport and manual PoW consensus
pub fn new_partial(
    config: &Configuration,
) -> Result<PartialComponents<_, _, _, _, _, _>, Error> {
    // Load or initialize PQC keystore
    let mut pqc_keystore = Keystore::load_or_init(config)
        .map_err(|e| Error::Other(e.to_string()))?;
    let (kem_pk, kem_sk) = pqc_keystore.current_keypair();
    // Generate libp2p identity keypair
    let p2p_keypair = P2PKeypair::generate_ed25519();
    // Build custom PQC transport over TCP/QUIC
    let transport = build_pq_transport(p2p_keypair.clone(), kem_pk.clone(), kem_sk.clone())?;

    // Clone and override network and RPC transports in configuration
    let mut config = config.clone();
    config.network.transport = transport.clone();
    // Use PQC transport for JSON-RPC (HTTP & WS)
    config.rpc_http.transport = Some(transport.clone());
    config.rpc_ws.transport = Some(transport.clone());

    // Build partial components (client, backend, import queue, keystore, task manager, on_exit)
    let PartialComponents {
        client,
        backend,
        import_queue,
        keystore,
        task_manager,
        on_exit,
    } = sc_service::new_partial::<RuntimeApi, _>(&config)?;

    // Build tokio multi-threaded runtime for async tasks
    let tokio_rt = TokioRuntimeBuilder::new_multi_thread()
        .worker_threads(4)
        .enable_all()
        .build()
        .map_err(|e| Error::Other(e.to_string()))?;

    // Integrate manual PoW consensus engine
    let block_import = ManualSealBlockImport::new(client.clone(), backend.clone(), import_queue.clone());
    // Hooks for block authoring
    let can_author = Arc::new(move |_header: &()| true);
    let apply_author = Arc::new(move |_pre_digest: &()| {
        // Example: run Blake3 PoW with dummy header and difficulty
        let header_bytes = [];
        let _nonce = blake3_pow(&header_bytes, 1).expect("PoW failed");
    });
    let params = ManualEngineParams {
        block_import,
        link: client.clone(),
        env: Default::default(),
        can_author_with: can_author,
        apply_author,
    };
    let consensus = ManualEngine::new(params);

    // Spawn consensus task
    tokio_rt.spawn(consensus.start());

    // Spawn block-import task on the tokio runtime
    tokio_rt.spawn(async move {
        sc_service::block_import_task(import_queue).await;
    });

    Ok(PartialComponents { client, backend, import_queue, keystore, task_manager, on_exit })
}
