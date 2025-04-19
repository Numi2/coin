export interface Token {
  name: string;
  symbol: string;
  decimals: number;
}

export const CoinToken: Token = {
  name: "Coin",
  symbol: "COIN",
  decimals: 8
};
