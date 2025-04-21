#![cfg_attr(not(feature = "std"), no_std)]
#![feature(min_specialization)]

use sp_std::prelude::*;
use frame_support::{construct_runtime, parameter_types};
use frame_system::EnsureRoot;
use sp_runtime::{traits::{IdentityLookup, Hash as HashT}, generic::Header as GenericHeader};
use blake3::{hash, Hash as Blake3Hash};
use parity_scale_codec::{Encode, Decode};
use pqcrypto_dilithium::{PublicKey as DilithiumPublicKey, Signature as DilithiumSignature};
use sp_runtime::{traits::{Verify, IdentifyAccount}};
// remove Blake2-based address derivation; we’ll use Blake3 via the runtime hasher
// use sp_core::blake2_256;
// Include FRAME's balances pallet for account balances and transfers
use pallet_balances;

/// Post-quantum signature enum
#[derive(Encode, Decode, Clone, PartialEq, Eq, Debug)]
pub enum PQSignature {
    Dilithium(DilithiumPublicKey, DilithiumSignature),
}

impl Verify for PQSignature {
    type Signer = <PQSignature as IdentifyAccount>::AccountId;

    fn verify<L: sp_runtime::traits::VerifySigner<L>>(&self, msg: &[u8]) -> bool {
        match self {
            PQSignature::Dilithium(pk, sig) => pqcrypto_dilithium::verify(sig, msg, pk).is_ok(),
        }
    }
}

impl IdentifyAccount for PQSignature {
    type AccountId = [u8; 32];

    fn into_account(self) -> Self::AccountId {
        // Derive account ID by hashing the public key with Blake3
        match self {
            PQSignature::Dilithium(pk, _sig) => {
                let h = Blake3Hasher::hash(pk.as_bytes());
                // H256 -> [u8;32]
                *h.as_ref()
            }
        }
    }
}

/// Custom Blake3 hasher for the runtime
pub struct Blake3Hasher;
impl HashT<sp_core::H256> for Blake3Hasher {
    fn hash(input: &[u8]) -> sp_core::H256 {
        let h: Blake3Hash = hash(input);
        let mut out = [0u8; 32];
        out.copy_from_slice(h.as_bytes());
        sp_core::H256::from(out)
    }
}

parameter_types! {
    pub const BlockHashCount: u32 = 2400;
}
// --- Begin balances pallet configuration ---
/// Balance type used by pallet-balances
pub type Balance = u128;

parameter_types! {
    /// Minimum balance required to keep an account alive
    pub const ExistentialDeposit: Balance = 1;
    /// Maximum number of locks an account can have
    pub const MaxLocks: u32 = 50;
    /// Maximum number of named reserves an account can have
    pub const MaxReserves: u32 = 50;
}

/// Configure pallet-balances in the runtime
impl pallet_balances::Config for Runtime {
    type Balance = Balance;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type MaxLocks = MaxLocks;
    type MaxReserves = MaxReserves;
    type ReserveIdentifier = [u8; 8];
}
// --- End balances pallet configuration ---

/// Runtime configuration
impl frame_system::Config for Runtime {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Index = u32;
    type BlockNumber = u32;
    type Hash = sp_core::H256;
    type Hashing = Blake3Hasher;
    type AccountId = [u8; 32];
    type Lookup = IdentityLookup<Self::AccountId>;
    type Header = GenericHeader<Self::BlockNumber, Blake3Hasher>;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = (); 
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<Balance>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = (); 
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
}

// Transaction signature and payload configuration
use frame_system::{CheckSpecVersion, CheckTxVersion, CheckGenesis, CheckEra, CheckNonce, CheckWeight};
use sp_runtime::generic::SignedPayload;

/// Alias to our post-quantum signature type
pub type Signature = PQSignature;

/// Extra fields to be included in signed transactions (full FRAME Signed-Extensions)
pub type SignedExtra = (
    CheckSpecVersion<Runtime>,
    CheckTxVersion<Runtime>,
    CheckGenesis<Runtime>,
    CheckEra<Runtime>,
    CheckNonce<Runtime>,
    CheckWeight<Runtime>,
);

/// Unchecked extrinsic type using our PQSignature and full signed extensions
pub type UncheckedExtrinsic = sp_runtime::generic::UncheckedExtrinsic<
    AccountId,
    RuntimeCall,
    Signature,
    SignedExtra,
>;

/// The block type as expected by the runtime
pub type Block = sp_runtime::generic::Block<Header, UncheckedExtrinsic>;

/// Signed payload type for constructing transactions
pub type SignedPayload = SignedPayload<RuntimeCall, SignedExtra>;

/// Configuration for our basic pallet
impl pallet_basic_pallet::Config for Runtime {}

/// Construct the runtime with our custom extrinsic type and signed extensions
construct_runtime!(
    pub enum Runtime where
        Block = Block,
        NodeBlock = Block,
        UncheckedExtrinsic = UncheckedExtrinsic
    {
        System: frame_system::{Pallet, Call, Storage, Event<T>},
        Balances: pallet_balances::{Pallet, Call, Storage, Event<T>},
        BasicPallet: pallet_basic_pallet::{Pallet, Call, Storage, Event<T>},
    }
);