use std::iter;
use std::pin::Pin;
use std::future::Future;
use std::io::{Error as IoError, ErrorKind};
use futures::prelude::*;
use tokio::io::{AsyncRead, AsyncWrite, AsyncReadExt, AsyncWriteExt};

use libp2p::core::upgrade::{UpgradeInfo, InboundUpgrade, OutboundUpgrade};
use libp2p::{Transport, PeerId};
use libp2p::core::{upgrade, ProtocolName};
use libp2p::transport::{Boxed, OrTransport};
use libp2p::tcp::tokio::TcpConfig;
use libp2p::quic::tokio::QuicConfig;
use libp2p::yamux::YamuxConfig;
use libp2p::identity::Keypair as P2PKeypair;
use libp2p::core::muxing::StreamMuxerBox;
use pqcrypto_kyber::kyber768;
use pqcrypto_kyber::kyber768::{PublicKey, SecretKey};
use sc_service::error::Error;

/// Builds a combined TCP/QUIC transport with a Kyber KEM handshake before multistream-select.
/// Implements a two-step KEM handshake:
/// 1) Dialer generates an ephemeral Kyber keypair, sends its public key.
/// 2) Listener encapsulates to that public key, sends ciphertext.
/// 3) Dialer decapsulates to derive the shared secret.
/// After handshake, the connection is returned (currently unencrypted; encryption layer may be added).
pub fn build_pq_transport(
    p2p_keypair: P2PKeypair,
    _kem_pk: PublicKey,
    _kem_sk: SecretKey,
) -> Result<Boxed<(PeerId, StreamMuxerBox)>, Error> {
    // Base transports
    let tcp = TcpConfig::new().nodelay(true);
    let quic = QuicConfig::new(&p2p_keypair);
    let base = OrTransport::new(tcp, quic);

    // KEM handshake upgrade
    let kem_upgrade = KEMConfig;
    let transport = base
        .upgrade(upgrade::Version::V1)
        .authenticate(kem_upgrade)
        .multiplex(YamuxConfig::default())
        .boxed();
    Ok(transport)
}

/// Kyber KEM handshake configuration for libp2p authenticate().
#[derive(Clone, Debug)]
struct KEMConfig;

impl UpgradeInfo for KEMConfig {
    // Info type passed to upgrade_{in|out}bound is the remote PeerId
    type Info = PeerId;
    type InfoIter = std::iter::Once<PeerId>;
    fn protocol_info(&self) -> Self::InfoIter {
        // Pass through the remote PeerId (unused in handshake)
        // The authenticate() layer will supply the actual PeerId when invoking the upgrade
        // We yield a dummy here; the transport layer ignores protocol_info for authenticate()
        std::iter::once(PeerId::random())
    }
}

impl<C> InboundUpgrade<C> for KEMConfig
where
    C: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    type Output = C;
    type Error = IoError;
    type Future = Pin<Box<dyn Future<Output = Result<C, IoError>> + Send>>;

    fn upgrade_inbound(self, _info: PeerId, mut socket: C, _protocol: PeerId) -> Self::Future {
        Box::pin(async move {
            // Listener (server) side: perform KEM encapsulation
            // 1. Read client public key
            let mut pk_bytes = vec![0u8; kyber768::public_key_bytes()];
            socket.read_exact(&mut pk_bytes).await?;
            let client_pk = PublicKey::from_bytes(&pk_bytes)
                .map_err(|_| IoError::new(ErrorKind::InvalidData, "invalid client public key"))?;
            // 2. Encapsulate to client's public key
            let (ct, _shared_secret) = kyber768::encapsulate(&client_pk);
            // 3. Send ciphertext
            socket.write_all(&ct.as_bytes()).await?;
            socket.flush().await?;
            // Handshake complete
            Ok(socket)
        })
    }
}

impl<C> OutboundUpgrade<C> for KEMConfig
where
    C: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    type Output = C;
    type Error = IoError;
    type Future = Pin<Box<dyn Future<Output = Result<C, IoError>> + Send>>;

    fn upgrade_outbound(self, _info: PeerId, mut socket: C, _protocol: PeerId) -> Self::Future {
        Box::pin(async move {
            // Dialer (client) side: perform KEM decapsulation
            // 1. Generate ephemeral keypair
            let (client_pk, client_sk) = kyber768::keypair();
            // 2. Send client public key
            socket.write_all(&client_pk.as_bytes()).await?;
            socket.flush().await?;
            // 3. Read ciphertext
            let mut ct_bytes = vec![0u8; kyber768::ciphertext_bytes()];
            socket.read_exact(&mut ct_bytes).await?;
            // 4. Decapsulate to derive shared secret
            let _shared_secret = kyber768::decapsulate(&ct_bytes, &client_sk);
            // Handshake complete
            Ok(socket)
        })
    }
}