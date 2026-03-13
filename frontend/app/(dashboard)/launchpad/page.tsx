"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  AlertCircle,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  Eye,
  Layers3,
  Loader2,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const LAUNCHPAD_PROGRAM_ID =
  process.env.NEXT_PUBLIC_LAUNCHPAD_PROGRAM_ID ?? "true_market_launchpad.aleo";
const LAUNCHPAD_ADAPTER_ADDRESS =
  process.env.NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS ?? "";
const API_URL = "https://api.explorer.provable.com/v1/testnet/program";
const TOKEN_DECIMALS = 6;

type ActionMode = "provide" | "withdraw";

type LaunchRoundPreset = {
  id: number;
  title: string;
  category: string;
  closeLabel: string;
  closeHeight: number;
  targetLiquidity: bigint;
  summary: string;
};

type OnchainRoundState = {
  exists: boolean;
  creator: string;
  closesAt: number;
  targetLiquidity: bigint;
  totalLiquidity: bigint;
  contributionCount: number;
  isLive: boolean;
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

type DecryptedLaunchPayload =
  | {
      owner?: string;
      round_id?: string;
      amount?: string;
      _nonce?: string;
      _version?: string;
    }
  | string;

type DecryptedLaunchRecordView = {
  key: string;
  roundId: string;
  amount: bigint;
  rawFields: Array<{ label: string; value: string }>;
};

const launchRounds: LaunchRoundPreset[] = [
  {
    id: 1,
    title: "Will stablecoin market cap pass $400B before June 2026?",
    category: "Crypto",
    closeLabel: "Apr 02, 2026",
    closeHeight: 15070000,
    targetLiquidity: 40000000000n,
    summary:
      "Seed the opening liquidity for a macro crypto market before public trading starts.",
  },
  {
    id: 2,
    title: "Will an Aleo-native app cross 100K users before Q3 2026?",
    category: "Aleo",
    closeLabel: "Apr 09, 2026",
    closeHeight: 15076000,
    targetLiquidity: 25000000000n,
    summary:
      "Back an ecosystem growth market with community-funded depth before the opening price forms.",
  },
  {
    id: 3,
    title: "Will ETH reach $6,500 before BTC reaches $140K?",
    category: "Macro",
    closeLabel: "Apr 15, 2026",
    closeHeight: 15082000,
    targetLiquidity: 60000000000n,
    summary:
      "Fund a high-conviction race market so the opening book is stronger from block one.",
  },
];

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
  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");

  return `${negative ? "-" : ""}${whole.toString()}${
    fractionStr ? `.${fractionStr}` : ""
  }`;
}

function formatDisplayUsd(value: bigint) {
  return formatUnits(value, TOKEN_DECIMALS, 2);
}

function formatCompactUsd(value: bigint) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(Number(value) / 10 ** TOKEN_DECIMALS);
}

function isWalletRecordArray(value: unknown): value is WalletRecord[] {
  return Array.isArray(value);
}

function isWalletPlaintextRecordArray(
  value: unknown
): value is WalletPlaintextRecord[] {
  return Array.isArray(value);
}

function isDecryptedLaunchPayload(value: unknown): value is DecryptedLaunchPayload {
  return value !== null && (typeof value === "object" || typeof value === "string");
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

function getObjectField(value: unknown, key: string): string | undefined {
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
  const fieldNames = new Set(["owner", "round_id", "amount", "_nonce", "_version"]);

  if (value && typeof value === "object") {
    Object.keys(value).forEach((field) => fieldNames.add(field));
    Object.getOwnPropertyNames(value).forEach((field) => fieldNames.add(field));
  }

  return [...fieldNames]
    .map((field) => {
      const fieldValue = getDecryptedField(value, field);
      return fieldValue === undefined ? null : { label: field, value: fieldValue };
    })
    .filter(
      (field): field is { label: string; value: string } => field !== null
    );
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

function buildLaunchPositionInput(view: DecryptedLaunchRecordView) {
  const getFieldValue = (label: string) =>
    view.rawFields.find((field) => field.label === label)?.value;
  const owner = getFieldValue("owner");
  const roundId = getFieldValue("round_id");
  const amount = getFieldValue("amount");
  const nonce = getFieldValue("_nonce");
  const version = getFieldValue("_version");

  if (!owner || !roundId || !amount || !nonce || !version) {
    return null;
  }

  return `{ owner: ${owner}, round_id: ${roundId}, amount: ${amount}, _nonce: ${nonce}, _version: ${version} }`;
}

function sortRecords<T extends WalletRecord | WalletPlaintextRecord>(records: T[]) {
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
  return !text || text === "null" ? null : text;
}

function parseRoundMapping(text: string | null): OnchainRoundState {
  if (!text) {
    return {
      exists: false,
      creator: "",
      closesAt: 0,
      targetLiquidity: 0n,
      totalLiquidity: 0n,
      contributionCount: 0,
      isLive: false,
    };
  }

  return {
    exists: true,
    creator: text.match(/creator:\s*([a-z0-9]+)/)?.[1] ?? "",
    closesAt: Number(text.match(/closes_at:\s*"?(\d+)/)?.[1] ?? "0"),
    targetLiquidity: BigInt(
      text.match(/target_liquidity:\s*"?(\d+)/)?.[1] ?? "0"
    ),
    totalLiquidity: BigInt(
      text.match(/total_liquidity:\s*"?(\d+)/)?.[1] ?? "0"
    ),
    contributionCount: Number(
      text.match(/contribution_count:\s*"?(\d+)/)?.[1] ?? "0"
    ),
    isLive: (text.match(/is_live:\s*(true|false)/)?.[1] ?? "false") === "true",
  };
}

export default function LaunchpadPage() {
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

  const [selectedRoundId, setSelectedRoundId] = useState(launchRounds[0].id);
  const [actionMode, setActionMode] = useState<ActionMode>("provide");
  const [amountStr, setAmountStr] = useState("500");
  const [balanceValue, setBalanceValue] = useState("0.00");
  const [balanceAtomic, setBalanceAtomic] = useState(0n);
  const [roundStates, setRoundStates] = useState<Record<number, OnchainRoundState>>(
    {}
  );
  const [isRefreshingRounds, setIsRefreshingRounds] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [portfolioMessage, setPortfolioMessage] = useState(
    "Connect a wallet to load your launch positions."
  );
  const [decryptMessage, setDecryptMessage] = useState("");
  const [isRefreshingRecords, setIsRefreshingRecords] = useState(false);
  const [decryptingKey, setDecryptingKey] = useState<string | null>(null);
  const [senderRecords, setSenderRecords] = useState<WalletRecord[]>([]);
  const [senderPlaintextRecords, setSenderPlaintextRecords] = useState<
    WalletPlaintextRecord[]
  >([]);
  const [decryptedRecords, setDecryptedRecords] = useState<
    Record<string, DecryptedLaunchRecordView>
  >({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedPreset =
    launchRounds.find((round) => round.id === selectedRoundId) ?? launchRounds[0];
  const selectedRoundState = roundStates[selectedRoundId] ?? {
    exists: false,
    creator: "",
    closesAt: 0,
    targetLiquidity: selectedPreset.targetLiquidity,
    totalLiquidity: 0n,
    contributionCount: 0,
    isLive: false,
  };

  const totalCommitted = useMemo(() => {
    return launchRounds.reduce((sum, round) => {
      return sum + (roundStates[round.id]?.totalLiquidity ?? 0n);
    }, 0n);
  }, [roundStates]);

  const totalLiveRounds = useMemo(() => {
    return launchRounds.filter((round) => roundStates[round.id]?.isLive).length;
  }, [roundStates]);

  const refreshPublicData = async () => {
    try {
      setIsRefreshingRounds(true);
      const nextRounds = await Promise.all(
        launchRounds.map(async (round) => {
          const roundText = await fetchMappingValue(
            LAUNCHPAD_PROGRAM_ID,
            "rounds",
            `${round.id}field`
          );

          return [round.id, parseRoundMapping(roundText)] as const;
        })
      );

      setRoundStates(Object.fromEntries(nextRounds));

      if (connected && address) {
        const balanceText =
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "account", address)) ??
          (await fetchMappingValue(TOKEN_PROGRAM_ID, "balances", address));

        if (balanceText) {
          const nextBalance = parseTypedInt(balanceText);
          setBalanceAtomic(nextBalance);
          setBalanceValue(formatDisplayUsd(nextBalance));
        } else {
          setBalanceAtomic(0n);
          setBalanceValue("0.00");
        }
      } else {
        setBalanceAtomic(0n);
        setBalanceValue("0.00");
      }
    } catch (error) {
      console.error("Launchpad public data fetch error:", error);
    } finally {
      setIsRefreshingRounds(false);
    }
  };

  const loadSenderRecords = async () => {
    if (!connected) {
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage("Connect a wallet to load your launch positions.");
      return;
    }

    if (!address) {
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage("0 launch positions found for this wallet.");
      return;
    }

    if (!requestRecords) {
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage(
        "This wallet does not expose private record access for launch positions."
      );
      return;
    }

    try {
      setIsRefreshingRecords(true);
      const encryptedResponse = await requestRecords(LAUNCHPAD_PROGRAM_ID, false);
      const encryptedRecords = isWalletRecordArray(encryptedResponse)
        ? encryptedResponse
        : [];
      const plaintextResponse = requestRecordPlaintexts
        ? await requestRecordPlaintexts(LAUNCHPAD_PROGRAM_ID, false)
        : [];
      const plaintextRecordsRaw = unwrapWalletRecordResponse(plaintextResponse);
      const plaintextRecords = isWalletPlaintextRecordArray(plaintextRecordsRaw)
        ? plaintextRecordsRaw
        : [];

      const filteredEncrypted = sortRecords(
        encryptedRecords.filter((record) => {
          return (
            !record.spent &&
            record.recordName === "LaunchPosition" &&
            Boolean(record.recordCiphertext) &&
            record.sender?.trim() === address.trim() &&
            (!record.programName || record.programName === LAUNCHPAD_PROGRAM_ID)
          );
        })
      );

      const filteredPlaintext = sortRecords(
        plaintextRecords.filter((record) => {
          return (
            !record.spent &&
            (!record.recordName || record.recordName === "LaunchPosition") &&
            (!record.programName || record.programName === LAUNCHPAD_PROGRAM_ID)
          );
        })
      );

      setSenderRecords(filteredEncrypted);
      setSenderPlaintextRecords(filteredPlaintext);
      setDecryptedRecords({});
      setDecryptMessage("");
      setPortfolioMessage(
        filteredEncrypted.length > 0
          ? `Loaded ${filteredEncrypted.length} encrypted launch position${
              filteredEncrypted.length === 1 ? "" : "s"
            }.`
          : "0 launch positions found for this wallet."
      );
    } catch (error) {
      console.error("Launchpad record fetch error:", error);
      setSenderRecords([]);
      setSenderPlaintextRecords([]);
      setDecryptedRecords({});
      setPortfolioMessage("Unable to load launch positions from the wallet.");
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

      if (!isDecryptedLaunchPayload(decrypted)) {
        setDecryptMessage("Decryption finished, but the wallet returned no readable content.");
        return;
      }

      const roundId = parseTypedInt(
        getDecryptedField(decrypted, "round_id") ?? ""
      ).toString();
      const amount = parseTypedInt(getDecryptedField(decrypted, "amount") ?? "");

      setDecryptedRecords((current) => ({
        ...current,
        [key]: {
          key,
          roundId,
          amount,
          rawFields: getDecryptedRawFields(decrypted),
        },
      }));

      if (launchRounds.some((round) => String(round.id) === roundId)) {
        setSelectedRoundId(Number(roundId));
      }

      setDecryptMessage("Launch position decrypted successfully.");
    } catch (error) {
      console.error("Failed to decrypt launch position:", error);
      setDecryptMessage("Unable to decrypt this launch position.");
    } finally {
      setDecryptingKey(null);
    }
  };

  useEffect(() => {
    if (!mounted) {
      return;
    }

    refreshPublicData();
    const intervalId = setInterval(refreshPublicData, 15000);
    return () => clearInterval(intervalId);
  }, [mounted, connected, address]);

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
        ? "Load your launch positions, then decrypt the records you want to manage."
        : "Connect a wallet to load your launch positions."
    );
  }, [mounted, connected, address]);

  const currentRoundDecryptedTotal = useMemo(() => {
    return Object.values(decryptedRecords).reduce((sum, record) => {
      return record.roundId === String(selectedRoundId) ? sum + record.amount : sum;
    }, 0n);
  }, [decryptedRecords, selectedRoundId]);

  const selectedDecryptedPosition = useMemo(() => {
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
            decrypted.roundId === String(selectedRoundId) &&
            decrypted.amount > 0n
        ) ?? null
    );
  }, [decryptedRecords, selectedRoundId, senderRecords]);

  const selectedPlaintextPosition = useMemo(() => {
    const matchingKey = selectedDecryptedPosition
      ? getRecordKey(selectedDecryptedPosition.record)
      : null;
    const decryptedAmount = selectedDecryptedPosition?.decrypted.amount ?? 0n;

    const keyMatch = matchingKey
      ? senderPlaintextRecords.find(
          (record) => getPlaintextRecordKey(record) === matchingKey
        ) ?? null
      : null;

    if (keyMatch) {
      return keyMatch;
    }

    return (
      senderPlaintextRecords.find((record) => {
        const payload = getPlaintextPayload(record);
        const roundId = parseTypedInt(
          getDecryptedField(payload, "round_id") ?? ""
        ).toString();
        const amount = parseTypedInt(getDecryptedField(payload, "amount") ?? "");

        return (
          roundId === String(selectedRoundId) &&
          (decryptedAmount === 0n || amount === decryptedAmount || amount > 0n)
        );
      }) ?? null
    );
  }, [selectedDecryptedPosition, selectedRoundId, senderPlaintextRecords]);

  const selectedWithdrawCapacity = selectedDecryptedPosition
    ? selectedDecryptedPosition.decrypted.amount
    : 0n;
  const selectedWithdrawInput =
    selectedPlaintextPosition
      ? getTransactionRecordInput(selectedPlaintextPosition)
      : selectedDecryptedPosition
        ? buildLaunchPositionInput(selectedDecryptedPosition.decrypted)
        : null;

  const atomicAmount = useMemo(() => parseUnits(amountStr), [amountStr]);
  const canProvide =
    selectedRoundState.exists &&
    !selectedRoundState.isLive &&
    LAUNCHPAD_ADAPTER_ADDRESS !== "" &&
    atomicAmount > 0n &&
    atomicAmount <= balanceAtomic;
  const canWithdraw =
    selectedRoundState.exists &&
    !selectedRoundState.isLive &&
    selectedWithdrawInput !== null &&
    atomicAmount > 0n &&
    atomicAmount <= selectedWithdrawCapacity;
  const canActivate =
    selectedRoundState.exists &&
    !selectedRoundState.isLive &&
    selectedRoundState.totalLiquidity > 0n &&
    selectedRoundState.totalLiquidity >= selectedRoundState.targetLiquidity;

  const resetPrivateState = (message: string) => {
    setSenderRecords([]);
    setSenderPlaintextRecords([]);
    setDecryptedRecords({});
    setPortfolioMessage(message);
  };

  const handleCreateRound = async () => {
    try {
      setIsProcessing(true);
      setTxStatus("Creating launch round...");
      await executeTransaction({
        program: LAUNCHPAD_PROGRAM_ID,
        function: "create_round",
        inputs: [
          `${selectedPreset.id}field`,
          `${selectedPreset.closeHeight}u32`,
          `${selectedPreset.targetLiquidity}u64`,
        ],
        fee: 120000,
        privateFee: false,
      });
      setTxStatus("Launch round created successfully.");
      setTimeout(() => {
        setTxStatus("");
        refreshPublicData();
      }, 5000);
    } catch (error) {
      console.error(error);
      setTxStatus("Failed to create the launch round.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProvideLiquidity = async () => {
    if (!connected || !address || !canProvide) return;

    try {
      setIsProcessing(true);
      setTxStatus("Approving USDCx allowance for the launchpad...");
      await executeTransaction({
        program: TOKEN_PROGRAM_ID,
        function: "approve_public",
        inputs: [LAUNCHPAD_ADAPTER_ADDRESS, `${atomicAmount}u128`],
        fee: 100000,
        privateFee: false,
      });

      setTxStatus("Submitting launch liquidity contribution...");
      await executeTransaction({
        program: LAUNCHPAD_PROGRAM_ID,
        function: "provide_liquidity_private",
        inputs: [`${selectedPreset.id}field`, `${atomicAmount}u64`, address],
        fee: 150000,
        privateFee: false,
      });

      setAmountStr("");
      resetPrivateState(
        "Contribution submitted. Reload launch positions and decrypt again to refresh your private records."
      );
      setTxStatus("Launch liquidity contribution submitted.");
      setTimeout(() => {
        setTxStatus("");
        refreshPublicData();
      }, 5000);
    } catch (error) {
      console.error(error);
      setTxStatus("Launch liquidity contribution failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdrawLiquidity = async () => {
    if (!connected || !canWithdraw || !selectedWithdrawInput) return;

    try {
      setIsProcessing(true);
      setTxStatus("Submitting launch liquidity withdrawal...");
      await executeTransaction({
        program: LAUNCHPAD_PROGRAM_ID,
        function: "withdraw_liquidity_private",
        inputs: [selectedWithdrawInput, `${atomicAmount}u64`],
        fee: 150000,
        privateFee: false,
      });

      setAmountStr("");
      resetPrivateState(
        "Withdrawal submitted. Reload launch positions and decrypt again to refresh your private records."
      );
      setTxStatus("Launch liquidity withdrawal submitted.");
      setTimeout(() => {
        setTxStatus("");
        refreshPublicData();
      }, 5000);
    } catch (error) {
      console.error(error);
      setTxStatus("Launch liquidity withdrawal failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActivateRound = async () => {
    if (!connected || !canActivate) return;

    try {
      setIsProcessing(true);
      setTxStatus("Activating launch round...");
      await executeTransaction({
        program: LAUNCHPAD_PROGRAM_ID,
        function: "activate_round",
        inputs: [`${selectedPreset.id}field`],
        fee: 100000,
        privateFee: false,
      });

      setTxStatus("Launch round activated.");
      setTimeout(() => {
        setTxStatus("");
        refreshPublicData();
      }, 5000);
    } catch (error) {
      console.error(error);
      setTxStatus("Round activation failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) {
    return <div className="surface-card h-[760px] animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-white/45 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.24),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_24%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(14,116,144,0.82),rgba(15,23,42,0.96))] p-6 text-white shadow-[0_30px_80px_-38px_rgba(2,6,23,0.95)] dark:border-white/10 md:p-8">
        <div className="absolute inset-0 opacity-40">
          <div className="section-grid h-full w-full" />
        </div>

        <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur-xl">
              <Sparkles className="h-4 w-4" />
              Standalone launchpad
            </div>

            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold tracking-tight md:text-6xl">
              Let the community seed market liquidity before public trading opens.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-white/76 md:text-lg">
              Upcoming markets do not need to rely only on platform-funded depth.
              Users can commit USDCx into pre-live launch rounds, receive private
              launch position records, and help shape stronger opening liquidity.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                  Planned rounds
                </p>
                <p className="mt-2 font-display text-3xl font-bold">
                  {launchRounds.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                  Capital committed
                </p>
                <p className="mt-2 font-display text-3xl font-bold">
                  {formatCompactUsd(totalCommitted)}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                  Live rounds
                </p>
                <p className="mt-2 font-display text-3xl font-bold">
                  {totalLiveRounds}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/14 bg-white/10 p-5 backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                  Launchpad flow
                </p>
                <p className="mt-2 text-lg font-semibold">
                  Real USDCx commitments with private launch positions
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <Layers3 className="h-5 w-5 text-white/80" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                "Create a launch round before the market goes live.",
                "Users approve USDCx and contribute private launch position records.",
                "Contributors can decrypt and withdraw before activation.",
                "Once the target is met, the round can be activated as launch-ready liquidity.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-black/10 px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <p className="text-sm leading-6 text-white/76">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/72">
              Program: <span className="font-mono">{LAUNCHPAD_PROGRAM_ID}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Upcoming liquidity windows</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Pre-live rounds users can back with USDCx
              </h2>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={refreshPublicData}
              disabled={isRefreshingRounds}
              className="h-11 rounded-2xl"
            >
              {isRefreshingRounds ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            {launchRounds.map((round) => {
              const onchain = roundStates[round.id];
              const totalLiquidity = onchain?.totalLiquidity ?? 0n;
              const targetLiquidity =
                onchain?.targetLiquidity && onchain.targetLiquidity > 0n
                  ? onchain.targetLiquidity
                  : round.targetLiquidity;
              const progress =
                targetLiquidity > 0n
                  ? Math.min(
                      100,
                      (Number(totalLiquidity) / Number(targetLiquidity)) * 100
                    )
                  : 0;
              const isActive = selectedRoundId === round.id;
              const statusLabel = !onchain?.exists
                ? "not initialized"
                : onchain.isLive
                  ? "live"
                  : "building";

              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => setSelectedRoundId(round.id)}
                  className={cn(
                    "surface-card w-full p-5 text-left transition-all duration-200",
                    isActive &&
                      "border-transparent shadow-[0_28px_60px_-34px_rgba(14,165,233,0.42)] ring-1 ring-sky-400/30"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                          {round.category}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                            statusLabel === "live"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                              : statusLabel === "building"
                                ? "border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200"
                                : "border-amber-400/20 bg-amber-400/12 text-amber-900 dark:text-amber-100"
                          )}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <h3 className="mt-3 max-w-2xl font-display text-2xl font-bold tracking-tight">
                        {round.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {round.summary}
                      </p>
                    </div>

                    <div className="rounded-[22px] border border-slate-200/70 bg-white/88 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Launch closes
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {round.closeLabel}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Block {onchain?.closesAt || round.closeHeight}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Committed
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatDisplayUsd(totalLiquidity)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Target
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {formatDisplayUsd(targetLiquidity)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Positions
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {onchain?.contributionCount ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Launch readiness</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-amber-300 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="surface-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Launch console
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
                  {selectedPreset.title}
                </h2>
              </div>
              {connected && (
                <div className="rounded-full border border-white/55 bg-white/72 px-3 py-2 text-sm font-medium dark:border-white/10 dark:bg-white/5">
                  <span className="inline-flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {balanceValue} USDCx
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Round status
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {!selectedRoundState.exists
                    ? "Not initialized"
                    : selectedRoundState.isLive
                      ? "Launch ready"
                      : "Collecting liquidity"}
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Current committed
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatDisplayUsd(selectedRoundState.totalLiquidity)}
                </p>
              </div>
            </div>

            {!selectedRoundState.exists ? (
              <div className="mt-5 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-300/18 p-3 text-amber-700 dark:text-amber-200">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      This launch round has not been initialized onchain yet.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-900/75 dark:text-amber-100/80">
                      Create the round first, then contributors can provide USDCx
                      liquidity into it.
                    </p>
                    <Button
                      className="mt-4 h-12 rounded-2xl"
                      onClick={handleCreateRound}
                      disabled={!connected || isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="mr-2 h-4 w-4" />
                      )}
                      Initialize Launch Round
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActionMode("provide")}
                    className={cn(
                      "rounded-[24px] border px-4 py-3 text-left transition-all duration-200",
                      actionMode === "provide"
                        ? "border-transparent bg-slate-950 text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.85)]"
                        : "border-slate-200/80 bg-white/88 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                      Action
                    </p>
                    <p className="mt-2 text-lg font-semibold">Provide</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionMode("withdraw")}
                    className={cn(
                      "rounded-[24px] border px-4 py-3 text-left transition-all duration-200",
                      actionMode === "withdraw"
                        ? "border-transparent bg-emerald-500 text-white shadow-[0_18px_35px_-24px_rgba(16,185,129,0.85)]"
                        : "border-slate-200/80 bg-white/88 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                      Action
                    </p>
                    <p className="mt-2 text-lg font-semibold">Withdraw</p>
                  </button>
                </div>

                <div className="mt-4 rounded-[24px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {actionMode === "provide"
                      ? "USDCx contribution"
                      : "USDCx withdrawal"}
                  </label>
                  <div className="relative mt-3">
                    <Input
                      type="number"
                      value={amountStr}
                      onChange={(event) => setAmountStr(event.target.value)}
                      placeholder="0.00"
                      className="h-14 rounded-2xl border-slate-200/80 bg-white pr-20 text-xl font-semibold shadow-none dark:border-white/10 dark:bg-slate-950/35"
                      disabled={isProcessing}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      USDCx
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {actionMode === "provide" ? (
                      <>
                        <p>
                          Wallet balance:{" "}
                          <span className="font-semibold text-foreground">
                            {balanceValue} USDCx
                          </span>
                        </p>
                        <p>
                          {LAUNCHPAD_ADAPTER_ADDRESS
                            ? "Providing liquidity will approve USDCx and mint a private launch position record."
                            : "Set NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS after deployment to enable USDCx approvals."}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          Withdrawable from decrypted position:{" "}
                          <span className="font-semibold text-foreground">
                            {formatUnits(selectedWithdrawCapacity, TOKEN_DECIMALS, 4)}
                          </span>
                        </p>
                        <p>
                          {selectedWithdrawInput
                            ? selectedPlaintextPosition
                              ? "A matching launch position record is ready for withdrawal."
                              : "The decrypted launch position will be used for withdrawal."
                            : "Decrypt a launch position for this round before withdrawing."}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Target pool
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatDisplayUsd(selectedRoundState.targetLiquidity)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Your decrypted total
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {formatDisplayUsd(currentRoundDecryptedTotal)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Close block
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {selectedRoundState.closesAt || selectedPreset.closeHeight}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button
                    className="h-14 rounded-2xl text-base font-semibold shadow-[0_20px_45px_-28px_rgba(14,165,233,0.9)]"
                    onClick={
                      actionMode === "provide"
                        ? handleProvideLiquidity
                        : handleWithdrawLiquidity
                    }
                    disabled={
                      !connected ||
                      !amountStr ||
                      parseFloat(amountStr) <= 0 ||
                      isProcessing ||
                      (actionMode === "provide" ? !canProvide : !canWithdraw)
                    }
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : actionMode === "provide" ? (
                      <>
                        <BadgeDollarSign className="mr-2 h-5 w-5" />
                        Provide Liquidity
                      </>
                    ) : (
                      <>
                        <Wallet className="mr-2 h-5 w-5" />
                        Withdraw Liquidity
                      </>
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    className="h-14 rounded-2xl text-base font-semibold"
                    onClick={handleActivateRound}
                    disabled={!connected || isProcessing || !canActivate}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <PlayCircle className="mr-2 h-5 w-5" />
                        Activate Round
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {txStatus && (
              <div className="mt-4 rounded-2xl border border-sky-500/15 bg-sky-500/8 px-4 py-3 text-center text-sm font-medium text-sky-700 dark:text-sky-300">
                {txStatus}
              </div>
            )}

            {actionMode === "provide" &&
              atomicAmount > balanceAtomic &&
              amountStr.trim() !== "" && (
                <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-center text-sm font-medium text-amber-900 dark:text-amber-100">
                  Insufficient USDCx balance for this launch contribution.
                </div>
              )}
          </div>

          <div className="surface-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Your launch positions
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">
                  Private liquidity records
                </h3>
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

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
              <div className="rounded-[22px] border border-sky-500/10 bg-white/72 p-3 dark:bg-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Current round total
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {formatDisplayUsd(currentRoundDecryptedTotal)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-sky-500/10 bg-white/72 px-4 py-3 text-sm text-muted-foreground dark:bg-white/5">
              {portfolioMessage}
            </div>

            {decryptMessage && (
              <div className="mt-4 rounded-[22px] border border-sky-500/10 bg-white/72 px-4 py-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">
                {decryptMessage}
              </div>
            )}

            {senderRecords.length > 0 && (
              <div className="mt-4 space-y-3">
                {senderRecords.map((record) => {
                  const key = getRecordKey(record);
                  const decrypted = decryptedRecords[key];
                  const matchingPreset = launchRounds.find(
                    (round) => String(round.id) === decrypted?.roundId
                  );

                  return (
                    <div
                      key={key}
                      className="rounded-[24px] border border-sky-500/10 bg-white/72 p-4 dark:bg-white/5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Launch position record
                          </p>
                          <p className="mt-2 truncate text-sm font-medium text-foreground">
                            {record.commitment ?? "Encrypted launch position"}
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
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Decrypting
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              {decrypted ? "Decrypt Again" : "Decrypt"}
                            </>
                          )}
                        </Button>
                      </div>

                      {decrypted && (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Round
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {matchingPreset?.title ?? `Round ${decrypted.roundId}`}
                              </p>
                            </div>
                            <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Round ID
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {decrypted.roundId}
                              </p>
                            </div>
                            <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Amount
                              </p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {formatUnits(decrypted.amount, TOKEN_DECIMALS, 4)}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/25">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Decrypted Content
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

            {!connected && (
              <div className="mt-4 rounded-[24px] border border-amber-300/25 bg-amber-300/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-300/18 p-3 text-amber-700 dark:text-amber-200">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                      Wallet connection required
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-900/75 dark:text-amber-100/80">
                      Connect an Aleo wallet from the header to create rounds,
                      provide USDCx liquidity, and manage private launch positions.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              How it works
            </p>
            <div className="mt-5 space-y-4">
              {[
                {
                  icon: Clock3,
                  title: "1. Initialize a round",
                  body: "Create a launch round with a target liquidity threshold and closing block.",
                },
                {
                  icon: BadgeDollarSign,
                  title: "2. Provide USDCx liquidity",
                  body: "Contributors approve USDCx and receive a private LaunchPosition record.",
                },
                {
                  icon: Users2,
                  title: "3. Manage your position",
                  body: "Before launch, users can decrypt and withdraw their launch liquidity position.",
                },
                {
                  icon: Target,
                  title: "4. Activate the round",
                  body: "Once the target is reached, the round becomes launch-ready liquidity.",
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-[22px] border border-slate-200/70 bg-white/88 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-700 dark:text-sky-300">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-emerald-500/15 bg-emerald-500/8 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Deployment note</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    After deploying the standalone launchpad, set{" "}
                    <code>NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS</code> so USDCx
                    approvals point at the deployed adapter program, then call{" "}
                    <code>launchpad_usdcx_adapter.aleo/set_launchpad</code> once
                    with the deployed launchpad program address.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
