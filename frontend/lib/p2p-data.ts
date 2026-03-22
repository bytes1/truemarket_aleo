export interface P2PMarket {
  market_id: number;
  market_title: string;
  category: string;
  outcome_a: string;
  outcome_b: string;
  deadline: string;
  closeHeight: number;
  market_data: string;
}

export const p2pMarkets: P2PMarket[] = [
  {
    market_id: 0,
    market_title: "Will BTC trade above $150K before September 2026?",
    category: "Crypto",
    outcome_a: "YES",
    outcome_b: "NO",
    deadline: "Sep 1, 2026",
    closeHeight: 15320000,
    market_data:
      "Private head-to-head bet on whether BTC reaches a spot price above $150K before September 2026.",
  },
  {
    market_id: 1,
    market_title: "Will an Aleo app reach 250K users before Q4 2026?",
    category: "Aleo",
    outcome_a: "YES",
    outcome_b: "NO",
    deadline: "Oct 1, 2026",
    closeHeight: 15380000,
    market_data:
      "Private peer-to-peer bet on whether an Aleo-native application crosses 250K users before Q4 2026.",
  },
  {
    market_id: 2,
    market_title: "Will ETH outperform SOL over the next 90 days?",
    category: "Macro",
    outcome_a: "ETH",
    outcome_b: "SOL",
    deadline: "90 days",
    closeHeight: 15290000,
    market_data:
      "Binary private matchup where both sides stake the same USDCx amount and settle against the resolved winner.",
  },
];
