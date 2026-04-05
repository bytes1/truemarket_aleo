"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  AlertCircle,
  Eye,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimelineCard } from "./TimelineCard";
import { type Market } from "@/lib/data";
import { cn } from "@/lib/utils";

const MARKET_PROGRAM_ID =
  process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID ?? "true_prediction_market_v3.aleo";
const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const MARKET_SPENDER_ADDRESS = "aleo107rx38hdjmjyanhhurftl9tapvketn4vv5v5l3rj7qjrplajhcqs6xct67";
const API_URL = "https://api.explorer.provable.com/v1/testnet/program";
const TOKEN_DECIMALS = 6;
const SLIPPAGE_BPS = 100n;

type Outcome = "yes" | "no";
type TradeMode = "buy" | "sell";

type PoolState = {
  sharesA: bigint;
  sharesB: bigint;
};

type WalletRecord = {
  spent?: boolean;
  recordName?: string;
  recordCiphertext?: string;
  programName?: string;
  sender?: string;
  commitment?: string;
  blockHeight?: number;
  blockTimestamp?: number;
  transactionIndex?: number;
  transitionIndex?: number;
  outputIndex?: number;
};

type WalletPlaintextRecord = {
  spent?: boolean;
  recordName?: string;
  programName?: string;
  sender?: string;
  commitment?: string;
  blockHeight?: number;
  blockTimestamp?: number;
  transactionIndex?: number;
  transitionIndex?: number;
  outputIndex?: number;
  plaintext?: unknown;
  recordPlaintext?: unknown;
  data?: unknown;
};

type DecryptedPositionRecord = {
  owner?: string;
  market_id?: string;
  outcome?: string;
  shares?: string;
  _nonce?: string;
  _version?: string;
};

type DecryptPayload = DecryptedPositionRecord | string;

type DecryptedRecordView = {
  key: string;
  marketId: string;
  outcomeValue: number;
  shares: bigint;
  matchesCurrentMarket: boolean;
  rawFields: Array<{ label: string; value: string }>;
};

type MarketHoldings = {
  yes: bigint;
  no: bigint;
};

function parseTypedInt(raw: string): bigint {
  const match = raw.match(/\d+/)?.[0];
  return match ? BigInt(match) : 0n;
}

function parseUnits(value: string, decimals = TOKEN_DECIMALS): bigint {
  if (!value) return 0n;

  const normalized = value.trim();
  if (!normalized) return 0n;

  const [wholeRaw, fracRaw = ""] = normalized.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const fraction = fracRaw.slice(0, decimals).padEnd(decimals, "0");

  if (!/^\d+$/.test(whole) || !/^\d+$/.test(fraction)) return 0n;

  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction);
}

function formatUnits(value: bigint, decimals = TOKEN_DECIMALS, precision = 4) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;

  if (precision === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");

  return `${negative ? "-" : ""}${whole.toString()}${fractionStr ? `.${fractionStr}` : ""
    }`;
}

function formatDisplayUsd(rawAtomic: bigint) {
  return formatUnits(rawAtomic, TOKEN_DECIMALS, 2);
}

function computeBuyQuoteAtomic(
  sharesA: bigint,
  sharesB: bigint,
  outcome: Outcome,
  amount: bigint
) {
  if (sharesA <= 0n || sharesB <= 0n || amount <= 0n) {
    return { sharesOut: 0n };
  }

  const k = sharesA * sharesB;

  if (outcome === "yes") {
    const nextSharesB = sharesB + amount;
    const nextSharesA = k / nextSharesB;
    const sharesOut = sharesA - nextSharesA;
    return { sharesOut: sharesOut > 0n ? sharesOut : 0n };
  }

  const nextSharesA = sharesA + amount;
  const nextSharesB = k / nextSharesA;
  const sharesOut = sharesB - nextSharesB;
  return { sharesOut: sharesOut > 0n ? sharesOut : 0n };
}

function computeSellQuoteAtomic(
  sharesA: bigint,
  sharesB: bigint,
  outcome: Outcome,
  sharesToSell: bigint
) {
  if (sharesA <= 0n || sharesB <= 0n || sharesToSell <= 0n) {
    return { collateralOut: 0n };
  }

  const k = sharesA * sharesB;

  if (outcome === "yes") {
    const nextSharesA = sharesA + sharesToSell;
    const nextSharesB = k / nextSharesA;
    const collateralOut = sharesB - nextSharesB;
    return { collateralOut: collateralOut > 0n ? collateralOut : 0n };
  }

  const nextSharesB = sharesB + sharesToSell;
  const nextSharesA = k / nextSharesB;
  const collateralOut = sharesA - nextSharesA;
  return { collateralOut: collateralOut > 0n ? collateralOut : 0n };
}

function isWalletRecordArray(value: unknown): value is WalletRecord[] {
  return Array.isArray(value);
}

function isWalletPlaintextRecordArray(
  value: unknown
): value is WalletPlaintextRecord[] {
  return Array.isArray(value);
}

function unwrapWalletRecordResponse(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    const records = Reflect.get(value, "records");
    if (Array.isArray(records)) {
      return records;
    }
  }

  return [];
}

function isDecryptedPositionRecord(
  value: unknown
): value is DecryptPayload {
  return value !== null && (typeof value === "object" || typeof value === "string");
}

function getObjectField(
  value: unknown,
  key: string
): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  try {
    const directValue = Reflect.get(value, key);
    if (directValue !== undefined && directValue !== null) {
      return String(directValue);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getStringField(value: string, key: string) {
  const match = value.match(new RegExp(`${key}\\s*:\\s*([^,}\\n]+)`));
  return match?.[1]?.trim();
}

function getDecryptedField(value: unknown, key: string) {
  const objectField = getObjectField(value, key);
  if (objectField) {
    return objectField;
  }

  if (typeof value === "string") {
    return getStringField(value, key);
  }

  return undefined;
}

function getDecryptedRawFields(
  value: unknown
): Array<{ label: string; value: string }> {
  const fieldNames = new Set([
    "owner",
    "market_id",
    "outcome",
    "shares",
    "_nonce",
    "_version",
  ]);

  if (value && typeof value === "object") {
    Object.keys(value).forEach((field) => fieldNames.add(field));
    Object.getOwnPropertyNames(value).forEach((field) => fieldNames.add(field));
  }

  const fields = [...fieldNames]
    .map((field) => {
      const fieldValue = getDecryptedField(value, field);

      if (fieldValue === undefined) {
        return null;
      }

      return {
        label: field,
        value: fieldValue,
      };
    })
    .filter(
      (field): field is { label: string; value: string } => field !== null
    );

  if (fields.length > 0) {
    return fields;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [{ label: "payload", value: String(value) }];
}

function getRecordKey(record: WalletRecord) {
  return (
    record.commitment ||
    `${record.blockHeight ?? 0}-${record.transactionIndex ?? 0}-${record.transitionIndex ?? 0}-${record.outputIndex ?? 0}`
  );
}

function getPlaintextRecordKey(record: WalletPlaintextRecord) {
  return (
    record.commitment ||
    `${record.blockHeight ?? 0}-${record.transactionIndex ?? 0}-${record.transitionIndex ?? 0}-${record.outputIndex ?? 0}`
  );
}

function getPlaintextPayload(record: WalletPlaintextRecord) {
  return record.plaintext ?? record.recordPlaintext ?? record.data ?? record;
}

function getTransactionRecordInput(record: WalletPlaintextRecord) {
  const payload = getPlaintextPayload(record);

  if (typeof payload !== "string") {
    return payload;
  }

  const trimmed = payload.trim();
  if (!trimmed.startsWith("{")) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function buildPositionRecordInput(view: DecryptedRecordView) {
  const getFieldValue = (label: string) =>
    view.rawFields.find((field) => field.label === label)?.value;

  const owner = getFieldValue("owner");
  const marketId = getFieldValue("market_id");
  const outcome = getFieldValue("outcome");
  const shares = getFieldValue("shares");
  const nonce = getFieldValue("_nonce");
  const version = getFieldValue("_version");

  if (!owner || !marketId || !outcome || !shares || !nonce || !version) {
    return null;
  }

  return `{ owner: ${owner}, market_id: ${marketId}, outcome: ${outcome}, shares: ${shares}, _nonce: ${nonce}, _version: ${version} }`;
}

function sortRecords(records: WalletRecord[]) {
  return [...records].sort((left, right) => {
    return (
      (right.blockHeight ?? 0) - (left.blockHeight ?? 0) ||
      (right.blockTimestamp ?? 0) - (left.blockTimestamp ?? 0) ||
      (right.transactionIndex ?? 0) - (left.transactionIndex ?? 0) ||
      (right.transitionIndex ?? 0) - (left.transitionIndex ?? 0) ||
      (right.outputIndex ?? 0) - (left.outputIndex ?? 0)
    );
  });
}

function sortPlaintextRecords(records: WalletPlaintextRecord[]) {
  return [...records].sort((left, right) => {
    return (
      (right.blockHeight ?? 0) - (left.blockHeight ?? 0) ||
      (right.blockTimestamp ?? 0) - (left.blockTimestamp ?? 0) ||
      (right.transactionIndex ?? 0) - (left.transactionIndex ?? 0) ||
      (right.transitionIndex ?? 0) - (left.transitionIndex ?? 0) ||
      (right.outputIndex ?? 0) - (left.outputIndex ?? 0)
    );
  });
}

async function fetchMappingValue(programId: string, mapping: string, key: string) {
  const response = await fetch(
    `${API_URL}/${programId}/mapping/${mapping}/${encodeURIComponent(key)}`
  );

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  if (!text || text === "null") {
    return null;
  }

  return text;
}

export const TradeCard = ({ market }: { market: Market }) => {
  const [mounted, setMounted] = useState(false);
  const wallet = useWallet() as ReturnType<typeof useWallet> & {
    requestRecords?: (
      programId: string,
      filterSpent?: boolean
    ) => Promise<unknown>;
    requestRecordPlaintexts?: (
      programId: string,
      filterSpent?: boolean
    ) => Promise<unknown>;
    decrypt?: (ciphertext: string) => Promise<unknown>;
  };
  const { connected, address, executeTransaction } = wallet;
  const requestRecords = wallet.requestRecords;
  const requestRecordPlaintexts = wallet.requestRecordPlaintexts;
  const decrypt = wallet.decrypt;

  const [tradeMode, setTradeMode] = useState<TradeMode>("buy");
  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [amountStr, setAmountStr] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [isRefreshingRecords, setIsRefreshingRecords] = useState(false);
  const [decryptingKey, setDecryptingKey] = useState<string | null>(null);

  const [balanceValue, setBalanceValue] = useState("0.00");
  const [balanceAtomic, setBalanceAtomic] = useState(0n);
  const [currentPrice, setCurrentPrice] = useState(0.5);
  const [pool, setPool] = useState<PoolState>({ sharesA: 0n, sharesB: 0n });
  const [senderRecords, setSenderRecords] = useState<WalletRecord[]>([]);
  const [senderPlaintextRecords, setSenderPlaintextRecords] = useState<
    WalletPlaintextRecord[]
  >([]);
  const [decryptedRecords, setDecryptedRecords] = useState<
    Record<string, DecryptedRecordView>
  >({});
  const [portfolioMessage, setPortfolioMessage] = useState(
    "Connect a wallet to load your private records."
  );
  const [decryptMessage, setDecryptMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchPublicData = async () => {
    try {
      const marketIdField = `${market.market_id}field`;

      if (connected && address) {
        const balanceText =
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "account", address)) ??
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "balances", address));

        if (balanceText) {
          const nextBalanceAtomic = parseTypedInt(balanceText);
          setBalanceAtomic(nextBalanceAtomic);
          setBalanceValue(formatDisplayUsd(nextBalanceAtomic));
        }
      } else {
        setBalanceValue("0.00");
        setBalanceAtomic(0n);
      }

      const poolText = await fetchMappingValue(
        MARKET_PROGRAM_ID,
        "pools",
        marketIdField
      );

      if (poolText) {
        const sharesA = BigInt(poolText.match(/shares_a:\s*"?(\d+)/)?.[1] || "0");
        const sharesB = BigInt(poolText.match(/shares_b:\s*"?(\d+)/)?.[1] || "0");

        setPool({ sharesA, sharesB });

        const total = sharesA + sharesB;
        if (total > 0n) {
          setCurrentPrice(Number(sharesB) / Number(total));
        }
      }
    } catch (error) {
      console.error("Public data fetch error:", error);
    }
  };

  const loadSenderRecords = async () => {
    if (!connected) {
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage("Connect a wallet to load your private records.");
      return;
    }

    if (!address) {
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage("0 private records found for this wallet.");
      return;
    }

    if (!requestRecords) {
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage(
        "This wallet does not expose private record access for lookup."
      );
      return;
    }

    try {
      setIsRefreshingRecords(true);
      const recordsResponse = await requestRecords(MARKET_PROGRAM_ID, false);
      const records = isWalletRecordArray(recordsResponse)
        ? recordsResponse
        : [];
      const plaintextResponse = requestRecordPlaintexts
        ? await requestRecordPlaintexts(MARKET_PROGRAM_ID, false)
        : [];
      const plaintextRecordsRaw = unwrapWalletRecordResponse(plaintextResponse);
      const plaintextRecords = isWalletPlaintextRecordArray(plaintextRecordsRaw)
        ? plaintextRecordsRaw
        : [];

      const filtered = sortRecords(
        records.filter((record) => {
          return (
            !record.spent &&
            record.recordName === "Position" &&
            Boolean(record.recordCiphertext) &&
            record.sender?.trim() === address.trim() &&
            (!record.programName || record.programName === MARKET_PROGRAM_ID)
          );
        })
      );
      const filteredPlaintext = sortPlaintextRecords(
        plaintextRecords.filter((record) => {
          return (
            !record.spent &&
            (!record.programName || record.programName === MARKET_PROGRAM_ID)
          );
        })
      );

      setSenderRecords(filtered);
      setSenderPlaintextRecords(filteredPlaintext);
      setDecryptedRecords({});
      setDecryptMessage("");

      if (filtered.length > 0) {
        setPortfolioMessage(
          `Loaded ${filtered.length} encrypted private record${filtered.length === 1 ? "" : "s"
          }${requestRecordPlaintexts ? ` and ${filteredPlaintext.length} sellable plaintext record${filteredPlaintext.length === 1 ? "" : "s"}` : ""}.`
        );
      } else {
        setPortfolioMessage("0 private records found for this wallet.");
      }
    } catch (error) {
      console.error("Private record fetch error:", error);
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage("Unable to load private records from the wallet.");
    } finally {
      setIsRefreshingRecords(false);
    }
  };

  const decryptRecord = async (record: WalletRecord) => {
    if (!decrypt || !record.recordCiphertext) {
      return;
    }

    const key = getRecordKey(record);

    try {
      setDecryptingKey(key);
      setDecryptMessage("");
      const decrypted = await decrypt(record.recordCiphertext);

      if (!isDecryptedPositionRecord(decrypted)) {
        setDecryptMessage("Decryption finished, but the wallet returned no readable content.");
        return;
      }

      const marketIdRaw = getDecryptedField(decrypted, "market_id") ?? "";
      const outcomeRaw = getDecryptedField(decrypted, "outcome") ?? "";
      const sharesRaw = getDecryptedField(decrypted, "shares") ?? "";
      const marketId = parseTypedInt(marketIdRaw).toString();
      const outcomeValue = Number(parseTypedInt(outcomeRaw));
      const shares = parseTypedInt(sharesRaw);
      const rawFields = getDecryptedRawFields(decrypted);
      const matchesCurrentMarket =
        marketId !== "" && marketId === String(market.market_id);

      if (!matchesCurrentMarket) {
        setDecryptedRecords((current) => {
          if (!current[key]) {
            return current;
          }

          const next = { ...current };
          delete next[key];
          return next;
        });

        setDecryptMessage(
          marketId
            ? `Record decrypted for market ${marketId}. Only records for market ${market.market_id} are shown here.`
            : `Record decrypted, but only records for market ${market.market_id} are shown here.`
        );
        return;
      }

      setDecryptedRecords((current) => ({
        ...current,
        [key]: {
          key,
          marketId,
          outcomeValue,
          shares,
          matchesCurrentMarket,
          rawFields,
        },
      }));

      if (tradeMode === "sell") {
        if (outcomeValue === 0) {
          setOutcome("yes");
        } else if (outcomeValue === 1) {
          setOutcome("no");
        }
      }

      setDecryptMessage(
        "Record decrypted and added to your holdings for this market."
      );
    } catch (error) {
      console.error("Failed to decrypt position record:", error);
      setDecryptMessage("Unable to decrypt this record from the connected wallet.");
    } finally {
      setDecryptingKey(null);
    }
  };

  useEffect(() => {
    if (!mounted) {
      return;
    }

    fetchPublicData();
    const intervalId = setInterval(fetchPublicData, 15000);
    return () => clearInterval(intervalId);
  }, [mounted, connected, address, market.market_id]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    setSenderRecords([]);
    setSenderPlaintextRecords([]);
    setDecryptedRecords({});
    setDecryptMessage("");
    setPortfolioMessage(
      connected
        ? "Load your private records, then decrypt the ones you want to inspect."
        : "Connect a wallet to load your private records."
    );
  }, [mounted, connected, address, market.market_id]);

  const selectedOutcomeLabel =
    outcome === "yes" ? market.outcome_a : market.outcome_b;

  const currentMarketHoldings = useMemo<MarketHoldings>(() => {
    return Object.values(decryptedRecords).reduce<MarketHoldings>(
      (totals, record) => {
        if (!record.matchesCurrentMarket) {
          return totals;
        }

        if (record.outcomeValue === 0) {
          totals.yes += record.shares;
        } else if (record.outcomeValue === 1) {
          totals.no += record.shares;
        }

        return totals;
      },
      { yes: 0n, no: 0n }
    );
  }, [decryptedRecords]);

  const selectedOutcomeValue = outcome === "yes" ? 0 : 1;
  const selectedDecryptedSellRecord = useMemo(() => {
    return (
      senderRecords
        .map((record, index) => ({
          index,
          record,
          decrypted: decryptedRecords[getRecordKey(record)],
        }))
        .find(
          ({ decrypted }) =>
            decrypted &&
            decrypted.matchesCurrentMarket &&
            decrypted.outcomeValue === selectedOutcomeValue &&
            decrypted.shares > 0n
        ) ?? null
    );
  }, [decryptedRecords, selectedOutcomeValue, senderRecords]);

  const selectedSellRecord = useMemo(() => {
    const matchingDecryptedKey = selectedDecryptedSellRecord
      ? getRecordKey(selectedDecryptedSellRecord.record)
      : null;
    const decryptedShares = selectedDecryptedSellRecord?.decrypted.shares ?? 0n;

    const keyMatch = matchingDecryptedKey
      ? senderPlaintextRecords.find(
        (record) => getPlaintextRecordKey(record) === matchingDecryptedKey
      ) ?? null
      : null;

    if (keyMatch) {
      return keyMatch;
    }

    const parsedMatch =
      senderPlaintextRecords.find((record) => {
        const payload = getPlaintextPayload(record);
        const marketId = parseTypedInt(
          getDecryptedField(payload, "market_id") ?? ""
        ).toString();
        const outcomeValue = Number(
          parseTypedInt(getDecryptedField(payload, "outcome") ?? "")
        );
        const shares = parseTypedInt(getDecryptedField(payload, "shares") ?? "");

        return (
          marketId === String(market.market_id) &&
          outcomeValue === selectedOutcomeValue &&
          (decryptedShares === 0n || shares === decryptedShares || shares > 0n)
        );
      }) ?? null;

    if (parsedMatch) {
      return parsedMatch;
    }

    if (
      selectedDecryptedSellRecord &&
      selectedDecryptedSellRecord.index < senderPlaintextRecords.length
    ) {
      return senderPlaintextRecords[selectedDecryptedSellRecord.index] ?? null;
    }

    return null;
  }, [
    market.market_id,
    selectedDecryptedSellRecord,
    selectedOutcomeValue,
    senderPlaintextRecords,
  ]);

  const selectedSellCapacity = selectedDecryptedSellRecord
    ? selectedDecryptedSellRecord.decrypted.shares
    : 0n;
  const selectedSellInput =
    selectedSellRecord
      ? getTransactionRecordInput(selectedSellRecord)
      : selectedDecryptedSellRecord
        ? buildPositionRecordInput(selectedDecryptedSellRecord.decrypted)
        : null;

  const tradeDetails = useMemo(() => {
    const atomicAmount = parseUnits(amountStr);

    if (tradeMode === "sell") {
      const quote = computeSellQuoteAtomic(
        pool.sharesA,
        pool.sharesB,
        outcome,
        atomicAmount
      );
      const minCollateralOut =
        (quote.collateralOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
      const avgFillPrice =
        atomicAmount > 0n ? Number(quote.collateralOut) / Number(atomicAmount) : 0;

      return {
        atomicAmount,
        sharesOut: 0n,
        minSharesOut: 0n,
        collateralOut: quote.collateralOut,
        minCollateralOut,
        estPrimaryDisplay: formatDisplayUsd(quote.collateralOut),
        minPrimaryDisplay: formatDisplayUsd(minCollateralOut),
        avgFillPriceDisplay: avgFillPrice.toFixed(4),
        yesPriceDisplay: currentPrice.toFixed(4),
        noPriceDisplay: (1 - currentPrice).toFixed(4),
        hasSufficientHoldings: atomicAmount > 0n && atomicAmount <= selectedSellCapacity,
      };
    }

    const quote = computeBuyQuoteAtomic(
      pool.sharesA,
      pool.sharesB,
      outcome,
      atomicAmount
    );
    const minSharesOut = (quote.sharesOut * (10_000n - SLIPPAGE_BPS)) / 10_000n;
    const avgFillPrice =
      quote.sharesOut > 0n ? Number(atomicAmount) / Number(quote.sharesOut) : 0;

    return {
      atomicAmount,
      sharesOut: quote.sharesOut,
      minSharesOut,
      collateralOut: 0n,
      minCollateralOut: 0n,
      estPrimaryDisplay: formatUnits(quote.sharesOut, TOKEN_DECIMALS, 4),
      minPrimaryDisplay: formatUnits(minSharesOut, TOKEN_DECIMALS, 4),
      avgFillPriceDisplay: avgFillPrice.toFixed(4),
      yesPriceDisplay: currentPrice.toFixed(4),
      noPriceDisplay: (1 - currentPrice).toFixed(4),
      hasSufficientHoldings: true,
    };
  }, [
    amountStr,
    currentPrice,
    outcome,
    pool,
    selectedSellCapacity,
    selectedSellInput,
    tradeMode,
  ]);

  const onAction = async () => {
    if (!connected || !address) return;
    if (pool.sharesA <= 0n || pool.sharesB <= 0n) return;
    if (tradeDetails.atomicAmount <= 0n) return;

    try {
      setIsProcessing(true);

      if (tradeMode === "sell") {
        if (!selectedSellInput) return;
        if (!tradeDetails.hasSufficientHoldings || tradeDetails.collateralOut <= 0n) {
          return;
        }

        setTxStatus("Submitting market sale...");
        await executeTransaction({
          program: MARKET_PROGRAM_ID,
          function: "sell_private",
          inputs: [
            selectedSellInput,
            `${pool.sharesA}u64`,
            `${pool.sharesB}u64`,
            `${tradeDetails.atomicAmount}u64`,
            `${tradeDetails.minCollateralOut}u64`,
          ],
          fee: 150000,
          privateFee: false,
        });

        setTxStatus("Sell transaction broadcast successfully.");
      } else {
        if (tradeDetails.sharesOut <= 0n) return;

        const marketIdField = `${market.market_id}field`;
        const outcomeU8 = outcome === "yes" ? "0u8" : "1u8";

        setTxStatus("Approving USDCx spending...");
        await executeTransaction({
          program: TOKEN_PROGRAM_ID,
          function: "approve_public",
          inputs: [MARKET_SPENDER_ADDRESS, `${tradeDetails.atomicAmount}u128`],
          fee: 100000,
          privateFee: false,
        });

        setTxStatus("Submitting market purchase...");
        await executeTransaction({
          program: MARKET_PROGRAM_ID,
          function: "buy_private",
          inputs: [
            marketIdField,
            outcomeU8,
            `${tradeDetails.atomicAmount}u64`,
            address,
            `${pool.sharesA}u64`,
            `${pool.sharesB}u64`,
            `${tradeDetails.minSharesOut}u64`,
          ],
          fee: 150000,
          privateFee: false,
        });

        setTxStatus("Buy transaction broadcast successfully.");
      }

      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setDecryptMessage(
        "Transaction submitted. Reload records and decrypt again to refresh your private position."
      );
      setPortfolioMessage(
        "Transaction submitted. Reload records to fetch your latest private position."
      );
      setTimeout(() => {
        setTxStatus("");
        setAmountStr("");
        fetchPublicData();
      }, 5000);
    } catch (error) {
      console.error(error);
      setTxStatus("Transaction failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) {
    return <div className="surface-card h-[640px] animate-pulse" />;
  }

  return (
    <section className="surface-card sticky top-6 overflow-hidden p-0">
      <div className="border-b border-slate-200/70 bg-white p-5 dark:border-white/10 dark:bg-slate-950/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">
              Trade
            </h2>
          </div>

          {connected && (
            <div className="rounded-full border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-foreground dark:border-white/10 dark:bg-white/5">
              <span className="inline-flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                {balanceValue} USDCx
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-950 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Privacy boundary</p>
              <p className="mt-1 leading-6 text-amber-900/80 dark:text-amber-100/80">
                Your position record is private, but the approval and token transfer used to
                fund or redeem it are still public on-chain.
              </p>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setTradeMode("buy")}
            className={cn(
              "flex-1 rounded-md px-4 py-1.5 text-sm font-semibold transition-all duration-200 text-center",
              tradeMode === "buy"
                ? "bg-white text-slate-900 shadow-sm dark:bg-[#1C1C1E] dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            Buy
          </button>

          <button
            type="button"
            onClick={() => setTradeMode("sell")}
            className={cn(
              "flex-1 rounded-md px-4 py-1.5 text-sm font-semibold transition-all duration-200 text-center",
              tradeMode === "sell"
                ? "bg-white text-slate-900 shadow-sm dark:bg-[#1C1C1E] dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            Sell
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={() => setOutcome("yes")}
            className={cn(
              "rounded border p-3 flex flex-col justify-between transition-all duration-200",
              outcome === "yes"
                ? "border-blue-500 bg-blue-50/50 dark:border-[#0041FF] dark:bg-[#0041FF]/10"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            )}
          >
            <span className={cn(
              "text-sm font-semibold",
              outcome === "yes" ? "text-blue-600 dark:text-[#0041FF]" : "text-slate-600 dark:text-slate-400"
            )}>
              {market.outcome_a}
            </span>
            <span className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100">
              ${tradeDetails.yesPriceDisplay}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOutcome("no")}
            className={cn(
              "rounded border p-3 flex flex-col justify-between transition-all duration-200",
              outcome === "no"
                ? "border-red-500 bg-red-50/50 dark:border-[#FF0054] dark:bg-[#FF0054]/10"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            )}
          >
            <span className={cn(
              "text-sm font-semibold",
              outcome === "no" ? "text-red-500 dark:text-[#FF0054]" : "text-slate-600 dark:text-slate-400"
            )}>
              {market.outcome_b}
            </span>
            <span className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100">
              ${tradeDetails.noPriceDisplay}
            </span>
          </button>
        </div>

        <div className="mt-2 rounded border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#1C1C1E]">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {tradeMode === "buy" ? "Amount" : "Shares"}
            </label>
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              {tradeMode === "buy" ? "USDCx" : "Shares"}
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              value={amountStr}
              onChange={(event) => setAmountStr(event.target.value)}
              placeholder="0.00"
              className="h-10 border-0 bg-transparent text-xl font-mono shadow-none focus-visible:ring-0 p-0 text-slate-900 dark:text-white"
              disabled={isProcessing}
            />
          </div>
          {tradeMode === "sell" && (
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              <span>
                Available:{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatUnits(selectedSellCapacity, TOKEN_DECIMALS, 4)}
                </span>
              </span>
            </div>
          )}
        </div>

        {connected ? (
          <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Records</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {portfolioMessage}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={loadSenderRecords}
                disabled={isRefreshingRecords}
                className="h-11 rounded-2xl"
              >
                {isRefreshingRecords ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Load Records
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-sky-500/10 bg-white/72 p-3 dark:bg-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Records
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {senderRecords.length}
                </p>
              </div>
              <div className="rounded-[22px] border border-sky-500/10 bg-white/72 p-3 dark:bg-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Decrypted
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {Object.keys(decryptedRecords).length}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-sky-500/10 bg-white/72 p-3 dark:bg-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {market.outcome_a} Holdings
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {formatUnits(currentMarketHoldings.yes, TOKEN_DECIMALS, 4)}
                </p>
              </div>
              <div className="rounded-[22px] border border-sky-500/10 bg-white/72 p-3 dark:bg-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {market.outcome_b} Holdings
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {formatUnits(currentMarketHoldings.no, TOKEN_DECIMALS, 4)}
                </p>
              </div>
            </div>

            {decryptMessage && (
              <div className="mt-4 rounded-[20px] border border-sky-500/15 bg-white/72 px-4 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
                {decryptMessage}
              </div>
            )}

            {senderRecords.length > 0 && (
              <div className="mt-4 space-y-3">
                {senderRecords.map((record) => {
                  const key = getRecordKey(record);
                  const decrypted = decryptedRecords[key];

                  return (
                    <div
                      key={key}
                      className="rounded-[24px] border border-sky-500/10 bg-white/72 p-4 dark:bg-white/5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Record
                          </p>
                          <p className="mt-2 truncate text-sm font-medium text-foreground">
                            {record.commitment ?? "Encrypted position"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Block {record.blockHeight ?? 0}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => decryptRecord(record)}
                          disabled={decryptingKey === key || !decrypt}
                          className="h-10 rounded-2xl"
                        >
                          {decryptingKey === key ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                              Generating ZK Proof...
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4 text-primary" />
                              Local ZK Decrypt
                            </>
                          )}
                        </Button>
                      </div>

                      {decrypted && (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Market ID
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {decrypted.marketId}
                              </p>
                            </div>
                            <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Outcome
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {decrypted.outcomeValue === 0
                                  ? market.outcome_a
                                  : decrypted.outcomeValue === 1
                                    ? market.outcome_b
                                    : "Unknown"}
                              </p>
                            </div>
                            <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Shares
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {formatUnits(decrypted.shares, TOKEN_DECIMALS, 4)}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Details
                            </p>
                            <div className="mt-3 space-y-2">
                              {decrypted.rawFields.map((field) => (
                                <div
                                  key={field.label}
                                  className="grid gap-1 border-b border-slate-200/70 pb-2 last:border-b-0 last:pb-0 dark:border-white/10"
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    {field.label}
                                  </p>
                                  <p className="break-all font-mono text-xs text-foreground">
                                    {field.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[28px] border border-amber-300/25 bg-amber-300/10 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-amber-300/18 p-3 text-amber-700 dark:text-amber-200">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Wallet connection required
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-900/75 dark:text-amber-100/80">
                  Connect an Aleo wallet from the header to load and decrypt
                  your private records.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200/70 bg-white/86 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {tradeMode === "buy" ? "You receive" : "You receive"}
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {tradeDetails.estPrimaryDisplay}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200/70 bg-white/86 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Average price
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              ${tradeDetails.avgFillPriceDisplay}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200/70 bg-white/86 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {tradeMode === "buy" ? "Minimum" : "Minimum"}
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {tradeDetails.minPrimaryDisplay}
            </p>
          </div>
        </div>

        <Button
          className="h-14 w-full rounded-2xl text-base font-semibold shadow-[0_0_20px_rgba(var(--primary),0.25)] bg-primary text-primary-foreground hover:bg-primary/90 transition-all border border-primary/50"
          onClick={onAction}
          disabled={
            !connected ||
            !amountStr ||
            parseFloat(amountStr) <= 0 ||
            isProcessing ||
            tradeDetails.atomicAmount <= 0n ||
            (tradeMode === "buy"
              ? tradeDetails.sharesOut <= 0n ||
              tradeDetails.atomicAmount > balanceAtomic
              : !selectedSellInput ||
              !tradeDetails.hasSufficientHoldings ||
              tradeDetails.collateralOut <= 0n)
          }
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            `${tradeMode === "buy" ? "Buy" : "Sell"} ${selectedOutcomeLabel} (Private)`
          )}
        </Button>

        {txStatus && (
          <div className="rounded-2xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 text-center text-sm font-medium text-sky-700 dark:text-sky-300">
            {txStatus}
          </div>
        )}

        {tradeMode === "buy" && tradeDetails.atomicAmount > balanceAtomic && (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-center text-sm font-medium text-amber-900 dark:text-amber-100">
            Insufficient USDCx balance for this buy amount.
          </div>
        )}
      </div>

      <div className="border-t border-white/45 p-5 dark:border-white/10">
        <TimelineCard market={market} />
      </div>
    </section>
  );
};
