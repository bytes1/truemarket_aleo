// lib/data.ts

export interface Market {
  market_id: number;
  market_title: string;
  category: "Crypto" | "Politics" | "Sports" | "Entertainment";
  outcome_a: string;
  outcome_b: string;
  yesPercentage: number;
  noPercentage: number;
  volume: string;
  participants: number;
  deadline: string;
  marketType: string;
  currency: string;
  market_data: string;
  image: string;
  isFlashMarket?: boolean;
  isClosed?: boolean;
  cardStyle?: "image" | "text";
  creatorAddress?: string;
  closeHeight?: number;
  sourceLink?: string;
  isCustom?: boolean;
}

export const data: Market[] = [

  {
    market_id: 0,
    market_title: "Did True Markets win a prize in Aleo Buildathon Wave 5?",
    category: "Crypto",
    outcome_a: "YES",
    outcome_b: "NO",
    yesPercentage: 51,
    noPercentage: 49,
    volume: "100",
    participants: 3,
    deadline: "April 15, 2026",
    marketType: "Binary",
    currency: "USD",

    market_data: `Hackathon: Did True Markets officially win a prize or receive a winning position in Aleo Buildathon Wave 2 concluding in February 2026?

**Market Dates:**

- **Market Period:** From publication until February 28, 2026, at 11:59 PM UTC.
- **Market Close:** February 28, 2026, at 11:59 PM UTC, or when official results are announced.
- **Resolution Deadline:** Within 48 hours after official results are published.

**Resolution Details:**

- The market resolves to **YES** if True Markets is officially listed as a winner, finalist, grant recipient, or prize winner in Aleo Buildathon Wave 2 concluding in February 2026.
- The market resolves to **NO** if True Markets is not listed among winners or does not receive any official prize, grant, or recognition.

**Verification Sources:**

- Official Aleo website or Buildathon Wave 2 announcement page
- Official Aleo social media channels
- Official Buildathon result publication
- Verified GitHub, Devpost, or event recap posts

**Cancellation Conditions:**

This market will be canceled if:

- Aleo Buildathon Wave 2 is postponed beyond February 2026.
- Official results are not published.
- True Markets withdraws or is disqualified before results.

If canceled, participants may claim their position value at the time of cancellation.`,

    image:
      "https://ipfs.io/ipfs/bafkreibchzlqacwxyepuae4drzxtoktajlyfu3ddnbldj5ibnyy3wbkt2m",

    cardStyle: "image",
  },
  {
    market_id: 2,
    market_title: "Gold vs ETH - Which hits $5K first?",
    category: "Crypto",
    outcome_a: "Gold",
    outcome_b: "ETH",
    yesPercentage: 50,
    noPercentage: 50,
    volume: "0",
    participants: 2,
    deadline: "Dec 31, 2026",
    marketType: "Binary",
    currency: "MUSD",
    market_data: `Gold vs ETH - Which hits $5K first?;**Market Details:**\n\n- **Market Close:** This market will only be closed once a resolution is achieved.\n- **Resolution Deadline:** The resolution will be determined as soon as an outcome is reached.\n- **Market Target:** $5,000.00.\n\n**Resolution Criteria:**\n\nThe market resolves based on which asset first **reaches or exceeds the Market Target:**\n\n- **“ETH”** if Ethereum (ETH/USDT) price on Binance hits or exceeds the Market Target.\n- **“GOLD”** if Gold (XAU/USD) price on TradingView hits or exceeds the Market Target.\n\n**Resolution Details:**\n\n- ETH price will be tracked using **Binance’s ETH/USDT spot chart:**\n\n<https://www.binance.com/en/trade/ETH_USDT?type=spot>\n\n- GOLD price will be tracked using **TradingView’s XAU/USD chart (OANDA):**\n\n<https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD>\n\n- The **1-minute candle close price** (“C”) will be used to confirm when a target is hit.\n\n***Tie-breaker rules:***\n\n- If both assets reach or exceed $5,000 **within the same 1-minute candle**, the first to hit the mark will be determined using finer candle data (e.g., second or tick data) from their respective platforms.\n- Price spikes or brief wick touches that do not close above $5,000 will **not** count as a hit — only a candle **close** value is valid.\n\n**Cancellation and Invalidity Conditions:**\n\n- Either Binance or TradingView becomes unavailable, unreliable, or experiences major disruptions.\n- Price data for either ETH or GOLD cannot be verified during the market period.\n- Any significant technical issue prevents proper tracking or confirmation of the target hit.\n\n*In case of cancellation, participants may claim their stakes at the current market value of their open positions at the time of cancellation. This could result in a profit or a loss depending on the price of their outstanding shares.*␟"Gold","ETH"␟Crypto,Economy;;https://www.binance.com/en/trade/ETH_USDT?type=spot;Binance / TradingView␟`,
    image:
      "https://ipfs.io/ipfs/QmQfWHShio7K1Ev6BtTEA4CBC55VJRAPmXRkS6wwzhhiSb",
    cardStyle: "image", // <-- NEW: Standard image card
  }, // SBET PRICE: Pump to $22 or Dump to $12?
  // {
  //   market_id: 3,
  //   market_title: "Stablecoin market cap to pass $360B before February?",
  //   category: "Crypto",
  //   outcome_a: "YES",
  //   outcome_b: "NO",
  //   yesPercentage: 50,
  //   noPercentage: 50,
  //   volume: "0K",
  //   participants: 0,
  //   deadline: "HIT",
  //   marketType: "Binary",
  //   currency: "MUSD",
  //   market_data: `Stablecoin market cap to pass $360B before February?;**Market Dates:**\n\n- **Observation Period:** From publication date until January 31, 2026, at 11:59 PM UTC.\n- **Market Close:** January 29, 2026, at 11:59 PM UTC, two days before resolution.\n- **Resolution Time:** January 31, 2026, at 11:59 PM UTC.\n- **Market Target:** $360,000b\n\n**Yes/No Criteria:**\n\n- Resolves to “**Yes**” if the “Total Stablecoins Market Cap”, as shown by DeFiLlama, is strictly above the Market Target for any day of the Observation Period.\n- Resolves to “**No**” if not.\n\n**Resolution:**\n\n- The outcome will be determined using DeFiLlama’s “Total Stablecoins Market Cap” chart.\n\n**Cancelation Conditions:**\n\nThe market will be canceled if:\n\n- DeFiLlama or the “Total Stablecoins Market Cap” chart becomes unavailable for prolonged periods, becomes unreliable, or experiences significant disruptions during the Observation Period\n- Any technical issues prevent reliable market cap verification for resolution\n\nIn the event of cancelation, participants may claim their stakes at the market value of their open positions at the time of cancelation. This could result in a profit or a loss, depending on the price of their outstanding shares.␟"Yes","No"␟Crypto;;https://defillama.com/stablecoins;Defilama␟`,
  //   image:
  //     "https://ipfs.io/ipfs/QmZ5WGnYicrGABb5H3wKbuDA85rZx2KZ1sBNcjuVn9YkL1",
  //   isFlashMarket: true,
  //   cardStyle: "image", // <-- NEW: Standard image card
  // }, // Will Donald Trump visit China in 2026?



];
