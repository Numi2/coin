export interface Token {
  name: string;
  symbol: string;
  decimals: number;
}

export const CoinToken: Token = {
  name: "Qoin",
  symbol: "QOIN",
  decimals: 8
};
