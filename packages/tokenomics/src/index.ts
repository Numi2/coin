export interface TokenomicsConfig {
  targetBlockTime: number;    // seconds
  initialReward: bigint;
  rewardHalvingInterval: number;  // blocks
  feeRate: number;           // fraction (e.g., 0.0001 for 0.01%)
}

export class Tokenomics {
  private config: TokenomicsConfig;

  constructor(config?: Partial<TokenomicsConfig>) {
    this.config = {
      targetBlockTime: 12,
      initialReward: BigInt(888888),
      rewardHalvingInterval: 200000,
      feeRate: 0.0001,
      ...config
    };
  }

  getBlockReward(height: number): bigint {
    const halvings = Math.floor(height / this.config.rewardHalvingInterval);
    return this.config.initialReward >> BigInt(halvings);
  }

  calculateFee(amount: bigint): bigint {
    // Compute fee = amount * feeRate
    return (amount * BigInt(Math.floor(this.config.feeRate * 1e8))) / BigInt(1e8);
  }
}
