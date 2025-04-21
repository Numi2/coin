#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        dispatch::DispatchResultWithPostInfo,
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement, Randomness},
        transactional,
    };
    use frame_system::pallet_prelude::*;
    // use the runtime's configured hasher (Blake3) instead of Blake2
    use sp_runtime::traits::Hash as HasherTrait;
    use sp_runtime::{
        traits::{CheckedAdd, CheckedSub, Hash, SaturatedConversion, StaticLookup},
        ArithmeticError,
    };
    use sp_std::prelude::*;

    // Define the pallet's configuration trait
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching event type
        type Event: From<Event<Self>> + IsType<<Self as frame_system::Config>::Event>;

        /// The currency mechanism
        type Currency: Currency<Self::AccountId>;

        /// The source of randomness
        type Randomness: Randomness<Self::Hash, Self::BlockNumber>;

        /// The maximum number of blocks that can be claimed in a single transaction
        #[pallet::constant]
        type MaxBlockClaims: Get<u32>;

        /// The difficulty adjustment period in blocks
        #[pallet::constant]
        type DifficultyAdjustmentPeriod: Get<Self::BlockNumber>;

        /// The target block time in milliseconds
        #[pallet::constant]
        type TargetBlockTime: Get<u64>;
    }

    // Define the pallet's storage items
    #[pallet::storage]
    #[pallet::getter(fn current_difficulty)]
    pub type CurrentDifficulty<T> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn block_timestamps)]
    pub type BlockTimestamps<T: Config> =
        StorageMap<_, Twox64Concat, T::BlockNumber, u64, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn last_difficulty_adjustment)]
    pub type LastDifficultyAdjustment<T: Config> = StorageValue<_, T::BlockNumber, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn mining_rewards)]
    pub type MiningRewards<T: Config> =
        StorageMap<_, Twox64Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

    // Define the pallet's events
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A new block was successfully mined
        BlockMined(T::AccountId, T::Hash, u64),

        /// The mining difficulty was adjusted
        DifficultyAdjusted(u64, u64),

        /// Mining rewards were claimed
        RewardsClaimed(T::AccountId, BalanceOf<T>),
    }

    // Define the pallet's errors
    #[pallet::error]
    pub enum Error<T> {
        /// The provided proof of work is invalid
        InvalidProofOfWork,

        /// The difficulty target was not met
        DifficultyTargetNotMet,

        /// No mining rewards available to claim
        NoRewardsToClaim,

        /// Too many block claims in a single transaction
        TooManyBlockClaims,

        /// Arithmetic overflow
        ArithmeticOverflow,
    }

    // Define the pallet's hooks
    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(n: T::BlockNumber) -> Weight {
            // Record the timestamp of this block
            let now = T::TimeProvider::now().as_millis() as u64;
            <BlockTimestamps<T>>::insert(n, now);

            // Check if it's time to adjust difficulty
            let adjustment_period = T::DifficultyAdjustmentPeriod::get();
            let last_adjustment = Self::last_difficulty_adjustment();
            
            if n > last_adjustment && (n - last_adjustment) >= adjustment_period {
                Self::adjust_difficulty(n);
            }

            Weight::zero()
        }
    }

    // Define the pallet's dispatchable functions
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit a mined block
        #[pallet::weight(10_000)]
        #[transactional]
        pub fn submit_block(
            origin: OriginFor<T>,
            nonce: Vec<u8>,
            block_hash: T::Hash,
        ) -> DispatchResultWithPostInfo {
            let who = ensure_signed(origin)?;

            // Verify the proof of work
            Self::verify_proof_of_work(&who, &nonce, block_hash)?;

            // Record the mining reward
            let reward = Self::calculate_block_reward();
            <MiningRewards<T>>::mutate(&who, |rewards| {
                *rewards = rewards.checked_add(&reward).ok_or(Error::<T>::ArithmeticOverflow)?;
                Ok(())
            })?;

            // Emit event
            Self::deposit_event(Event::BlockMined(who, block_hash, Self::current_difficulty()));

            Ok(().into())
        }

        /// Claim mining rewards
        #[pallet::weight(10_000)]
        #[transactional]
        pub fn claim_rewards(origin: OriginFor<T>) -> DispatchResultWithPostInfo {
            let who = ensure_signed(origin)?;

            // Get the rewards
            let rewards = <MiningRewards<T>>::get(&who);
            ensure!(!rewards.is_zero(), Error::<T>::NoRewardsToClaim);

            // Clear the rewards
            <MiningRewards<T>>::remove(&who);

            // Transfer the rewards
            T::Currency::deposit_creating(&who, rewards);

            // Emit event
            Self::deposit_event(Event::RewardsClaimed(who, rewards));

            Ok(().into())
        }

        /// Submit multiple mined blocks in a single transaction
        #[pallet::weight(10_000)]
        #[transactional]
        pub fn submit_blocks(
            origin: OriginFor<T>,
            blocks: Vec<(Vec<u8>, T::Hash)>,
        ) -> DispatchResultWithPostInfo {
            let who = ensure_signed(origin)?;

            // Check that we're not submitting too many blocks
            ensure!(
                blocks.len() <= T::MaxBlockClaims::get() as usize,
                Error::<T>::TooManyBlockClaims
            );

            let mut total_reward = BalanceOf::<T>::zero();

            // Verify each block
            for (nonce, block_hash) in blocks {
                // Verify the proof of work
                Self::verify_proof_of_work(&who, &nonce, block_hash)?;

                // Calculate the reward
                let reward = Self::calculate_block_reward();
                total_reward = total_reward
                    .checked_add(&reward)
                    .ok_or(Error::<T>::ArithmeticOverflow)?;

                // Emit event
                Self::deposit_event(Event::BlockMined(who.clone(), block_hash, Self::current_difficulty()));
            }

            // Record the total mining reward
            <MiningRewards<T>>::mutate(&who, |rewards| {
                *rewards = rewards
                    .checked_add(&total_reward)
                    .ok_or(Error::<T>::ArithmeticOverflow)?;
                Ok(())
            })?;

            Ok(().into())
        }
    }

    // Define the pallet's helper functions
    impl<T: Config> Pallet<T> {
        /// Verify the proof of work
        fn verify_proof_of_work(
            who: &T::AccountId,
            nonce: &[u8],
            block_hash: T::Hash,
        ) -> Result<(), Error<T>> {
            // Combine the account ID, nonce, and block hash
            let mut data = who.encode();
            data.extend_from_slice(nonce);
            data.extend_from_slice(&block_hash.encode());

        // Hash the data using the runtime's configured HASHING (Blake3)
        let header_hash = <T as frame_system::Config>::Hashing::hash(&data);
        let hash_bytes = header_hash.as_ref();
        // Convert the first 8 bytes to a u64 for difficulty comparison
        let hash_value = u64::from_be_bytes(hash_bytes[0..8].try_into().unwrap());

            // Check if the hash meets the difficulty target
            let difficulty = Self::current_difficulty();
            let target = u64::MAX / difficulty;

            if hash_value <= target {
                Ok(())
            } else {
                Err(Error::<T>::DifficultyTargetNotMet)
            }
        }

        /// Calculate the block reward
        fn calculate_block_reward() -> BalanceOf<T> {
            // In a real implementation, this would include a halving schedule
            // and potentially other factors
            BalanceOf::<T>::from(500_000_000_000u64)
        }

        /// Adjust the mining difficulty
        fn adjust_difficulty(current_block: T::BlockNumber) {
            let adjustment_period = T::DifficultyAdjustmentPeriod::get();
            let last_adjustment = Self::last_difficulty_adjustment();
            
            if current_block <= last_adjustment || (current_block - last_adjustment) < adjustment_period {
                return;
            }

            // Get the timestamps of the first and last blocks in the period
            let first_block_time = <BlockTimestamps<T>>::get(last_adjustment);
            let last_block_time = <BlockTimestamps<T>>::get(current_block);

            // Calculate the actual time it took to mine these blocks
            let actual_time_taken = last_block_time.saturating_sub(first_block_time);
            
            // Calculate the target time
            let target_time = T::TargetBlockTime::get()
                .saturating_mul(adjustment_period.saturated_into::<u64>());

            // Adjust difficulty based on the ratio of actual to target time
            let current_difficulty = Self::current_difficulty();
            let new_difficulty = if actual_time_taken < target_time {
                // Blocks are being mined too quickly, increase difficulty
                let adjustment_factor = target_time as f64 / actual_time_taken as f64;
                let new_diff = (current_difficulty as f64 * adjustment_factor) as u64;
                new_diff.max(1) // Ensure difficulty is at least 1
            } else {
                // Blocks are being mined too slowly, decrease difficulty
                let adjustment_factor = actual_time_taken as f64 / target_time as f64;
                let new_diff = (current_difficulty as f64 / adjustment_factor) as u64;
                new_diff.max(1) // Ensure difficulty is at least 1
            };

            // Update the difficulty and last adjustment block
            <CurrentDifficulty<T>>::put(new_difficulty);
            <LastDifficultyAdjustment<T>>::put(current_block);

            // Emit event
            Self::deposit_event(Event::DifficultyAdjusted(current_difficulty, new_difficulty));
        }
    }

    // Define the pallet's genesis configuration
    #[pallet::genesis_config]
    pub struct GenesisConfig<T: Config> {
        pub initial_difficulty: u64,
    }

    #[cfg(feature = "std")]
    impl<T: Config> Default for GenesisConfig<T> {
        fn default() -> Self {
            Self {
                initial_difficulty: 1_000_000, // Default initial difficulty
            }
        }
    }

    #[pallet::genesis_build]
    impl<T: Config> GenesisBuild<T> for GenesisConfig<T> {
        fn build(&self) {
            <CurrentDifficulty<T>>::put(self.initial_difficulty);
            <LastDifficultyAdjustment<T>>::put(T::BlockNumber::zero());
        }
    }

    // Define the pallet's types
    type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
}
