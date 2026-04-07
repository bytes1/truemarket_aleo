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
  process.env.NEXT_PUBLIC_MARKET_PROGRAM_ID ?? "true_prediction_market_v4.aleo";
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
    <section className="surface-card sticky top-6 overflow-hidden" style={{ padding: 0 }}>
      {/* Card header */}
      <div
        className="relative overflow-hidden px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="absolute right-4 top-4 opacity-[0.07]">
          <Wallet size={72} />
        </div>
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Trade</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Private ZK prediction market</p>
          </div>
          {connected && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              <Wallet size={13} style={{ color: "#818cf8" }} />
              <span className="text-xs font-semibold" style={{ color: "#818cf8" }}>
                {balanceValue} USDCx
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Privacy notice */}
        <div
          className="flex items-start gap-3 rounded-xl p-3.5"
          style={{
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.18)",
          }}
        >
          <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#fbbf24" }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: "#fbbf24" }}>
              Privacy boundary
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your position record is private, but the approval and token transfer used to fund or redeem it are still public on-chain.
            </p>
          </div>
        </div>

        {/* Buy / Sell toggle */}
        <div
          className="grid grid-cols-2 rounded-xl p-1 gap-1"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(["buy", "sell"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTradeMode(mode)}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 capitalize"
              style={
                tradeMode === mode
                  ? {
                    background:
                      mode === "buy"
                        ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                        : "linear-gradient(135deg, #059669, #10b981)",
                    color: "#fff",
                    boxShadow:
                      mode === "buy"
                        ? "0 4px 16px -4px rgba(99,102,241,0.6)"
                        : "0 4px 16px -4px rgba(16,185,129,0.5)",
                  }
                  : { color: "#94a3b8" }
              }
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Outcome selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOutcome("yes")}
            className="relative flex flex-col gap-1 overflow-hidden rounded-xl p-4 text-left transition-all duration-200"
            style={
              outcome === "yes"
                ? {
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.35)",
                  boxShadow: "0 0 20px -6px rgba(99,102,241,0.4)",
                }
                : {
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }
            }
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: outcome === "yes" ? "#818cf8" : "#64748b" }}
            >
              {market.outcome_a}
            </span>
            <span className="font-mono text-xl font-bold" style={{ color: outcome === "yes" ? "#a5b4fc" : "#94a3b8" }}>
              ${tradeDetails.yesPriceDisplay}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOutcome("no")}
            className="relative flex flex-col gap-1 overflow-hidden rounded-xl p-4 text-left transition-all duration-200"
            style={
              outcome === "no"
                ? {
                  background: "rgba(6,182,212,0.1)",
                  border: "1px solid rgba(6,182,212,0.35)",
                  boxShadow: "0 0 20px -6px rgba(6,182,212,0.35)",
                }
                : {
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }
            }
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: outcome === "no" ? "#22d3ee" : "#64748b" }}
            >
              {market.outcome_b}
            </span>
            <span className="font-mono text-xl font-bold" style={{ color: outcome === "no" ? "#67e8f9" : "#94a3b8" }}>
              ${tradeDetails.noPriceDisplay}
            </span>
          </button>
        </div>

        {/* Amount input */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {tradeMode === "buy" ? "Amount" : "Shares to sell"}
          </label>
          <div className="relative">
            <Input
              type="number"
              value={amountStr}
              onChange={(event) => setAmountStr(event.target.value)}
              placeholder="0.00"
              className="h-14 rounded-xl pr-16 text-xl font-bold"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(99,102,241,0.2)",
                fontSize: "1.2rem",
                boxShadow: "none",
              }}
              disabled={isProcessing}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
              {tradeMode === "buy" ? "USD" : "Shares"}
            </span>
          </div>
          {tradeMode === "sell" && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Available:{" "}
              <span className="font-semibold text-foreground">
                {formatUnits(selectedSellCapacity, TOKEN_DECIMALS, 4)}
              </span>
            </p>
          )}
        </div>

        {/* Quote grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: tradeMode === "buy" ? "You receive" : "You receive", value: tradeDetails.estPrimaryDisplay },
            { label: "Avg price", value: `$${tradeDetails.avgFillPriceDisplay}` },
            { label: "Minimum", value: tradeDetails.minPrimaryDisplay },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <p className="mt-1.5 text-sm font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Wallet not connected */}
        {!connected && (
          <div
            className="flex items-center gap-3 rounded-xl p-4"
            style={{
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.15)",
            }}
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}
            >
              <AlertCircle size={16} style={{ color: "#818cf8" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#a5b4fc" }}>
                Wallet required
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect an Aleo wallet to load and decrypt your private records.
              </p>
            </div>
          </div>
        )}

        {/* Records panel (when connected) */}
        {connected && (
          <div
            className="space-y-3 rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Private Records
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {portfolioMessage}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={loadSenderRecords}
                disabled={isRefreshingRecords}
                className="h-8 rounded-xl text-xs font-semibold gap-1.5"
                style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}
              >
                {isRefreshingRecords ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Load
              </Button>
            </div>

            {/* Record counters row */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: "Records", value: senderRecords.length },
                { label: "Decrypted", value: Object.keys(decryptedRecords).length },
                { label: market.outcome_a, value: formatUnits(currentMarketHoldings.yes, TOKEN_DECIMALS, 2) },
                { label: market.outcome_b, value: formatUnits(currentMarketHoldings.no, TOKEN_DECIMALS, 2) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-2 text-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
                    {label}
                  </p>
                  <p className="mt-1 text-xs font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {decryptMessage && (
              <p
                className="rounded-xl px-3 py-2.5 text-xs"
                style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.14)", color: "#a5b4fc" }}
              >
                {decryptMessage}
              </p>
            )}

            {/* Encrypted record list */}
            {senderRecords.length > 0 && (
              <div className="space-y-2">
                {senderRecords.map((record) => {
                  const key = getRecordKey(record);
                  const decrypted = decryptedRecords[key];
                  return (
                    <div
                      key={key}
                      className="overflow-hidden rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="flex items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full" style={{ background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                              Position Record
                            </p>
                          </div>
                          <p className="mt-1 truncate text-xs font-mono text-foreground/60">
                            {record.commitment
                              ? `${record.commitment.slice(0, 10)}â€¦${record.commitment.slice(-6)}`
                              : "Encrypted"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => decryptRecord(record)}
                          disabled={decryptingKey === key || !decrypt}
                          className="h-7 rounded-lg text-[10px] font-semibold gap-1 flex-shrink-0"
                          style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}
                        >
                          {decryptingKey === key ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            <Eye className="h-2.5 w-2.5" />
                          )}
                          {decrypted ? "Re-decrypt" : "Decrypt"}
                        </Button>
                      </div>

                      {decrypted && (
                        <div
                          className="px-3.5 pb-3.5 pt-2 space-y-2"
                          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { label: "Market ID", value: decrypted.marketId },
                              {
                                label: "Outcome",
                                value:
                                  decrypted.outcomeValue === 0
                                    ? market.outcome_a
                                    : decrypted.outcomeValue === 1
                                      ? market.outcome_b
                                      : "Unknown",
                              },
                              { label: "Shares", value: formatUnits(decrypted.shares, TOKEN_DECIMALS, 4) },
                            ].map(({ label, value }) => (
                              <div
                                key={label}
                                className="rounded-lg p-2"
                                style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}
                              >
                                <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                                  {label}
                                </p>
                                <p className="mt-0.5 text-[11px] font-bold truncate" style={{ color: "#a5b4fc" }}>
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>

                          <details>
                            <summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors select-none">
                              Raw fields â–¸
                            </summary>
                            <div
                              className="mt-1.5 rounded-lg p-2.5 font-mono text-[9px] space-y-1"
                              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}
                            >
                              {decrypted.rawFields.map((field) => (
                                <div key={field.label} className="flex gap-1.5">
                                  <span className="text-muted-foreground shrink-0">{field.label}:</span>
                                  <span className="break-all text-foreground/60">{field.value}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CTA button */}
        <Button
          className="h-14 w-full rounded-xl text-base font-bold btn-glow"
          style={{
            background:
              tradeMode === "buy"
                ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                : "linear-gradient(135deg, #059669, #10b981)",
            boxShadow:
              tradeMode === "buy"
                ? "0 8px 24px -8px rgba(99,102,241,0.6)"
                : "0 8px 24px -8px rgba(16,185,129,0.5)",
          }}
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
          <div
            className="rounded-xl px-4 py-3 text-center text-xs font-semibold"
            style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.18)",
              color: "#818cf8",
            }}
          >
            <Loader2 className="inline mr-2 h-3.5 w-3.5 animate-spin" />
            {txStatus}
          </div>
        )}

        {tradeMode === "buy" && tradeDetails.atomicAmount > balanceAtomic && amountStr && (
          <div
            className="rounded-xl px-4 py-3 text-center text-xs font-semibold"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#f87171",
            }}
          >
            Insufficient USDCx balance for this buy amount.
          </div>
        )}
      </div>

      {/* Timeline footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} className="px-5 py-4">
        <TimelineCard market={market} />
      </div>
    </section>
  );
};
