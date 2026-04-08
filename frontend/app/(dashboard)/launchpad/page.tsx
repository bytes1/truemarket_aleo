"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
  Eye,
  Layers,
  Loader2,
  Lock,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TOKEN_PROGRAM_ID = "test_usdcx_stablecoin.aleo";
const LAUNCHPAD_PROGRAM_ID =
  process.env.NEXT_PUBLIC_LAUNCHPAD_PROGRAM_ID ?? "true_market_launchpad_v3.aleo";
const LAUNCHPAD_ADAPTER_ADDRESS =
  process.env.NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS ?? "aleo1k5kzdk75p7kr7cphf7jumm628xkzauvrt5fg2cw340ymks0ugqyqrnfp4t";
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

  return `${negative ? "-" : ""}${whole.toString()}${fractionStr ? `.${fractionStr}` : ""
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
          ? `Loaded ${filteredEncrypted.length} encrypted launch position${filteredEncrypted.length === 1 ? "" : "s"
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
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-white/5" />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-white/5" />
            ))}
          </div>
          <div className="h-[600px] rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    Crypto: {
      bg: "rgba(99,102,241,0.1)",
      text: "#818cf8",
      border: "rgba(99,102,241,0.25)",
    },
    Aleo: {
      bg: "rgba(6,182,212,0.1)",
      text: "#22d3ee",
      border: "rgba(6,182,212,0.25)",
    },
    Macro: {
      bg: "rgba(245,158,11,0.1)",
      text: "#fbbf24",
      border: "rgba(245,158,11,0.25)",
    },
  };

  return (
    <div className="space-y-7 animate-fade-up">
      {/* â”€â”€ Hero stats strip â”€â”€ */}
      <div className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(6,182,212,0.08) 50%, rgba(139,92,246,0.1) 100%)",
          border: "1px solid rgba(99,102,241,0.18)",
          boxShadow: "0 8px 32px -8px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Grid dot background */}
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        {/* Glow orb */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }} />

        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 20px rgba(99,102,241,0.5)" }}>
                <Rocket size={15} className="text-white" />
              </div>
              <span className="eyebrow">Launchpad</span>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Bootstrap Market{" "}
              <span className="text-gradient-brand">Liquidity</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-md leading-relaxed">
              Contribute private liquidity to upcoming prediction markets before they open. Your position is fully shielded on-chain using ZK proofs.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { label: "Active Rounds", value: launchRounds.length.toString(), icon: Layers, color: "#6366f1" },
              { label: "Total Committed", value: formatCompactUsd(totalCommitted), icon: TrendingUp, color: "#06b6d4" },
              { label: "Live Rounds", value: totalLiveRounds.toString(), icon: Zap, color: "#10b981" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card min-w-[120px]">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color }} />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                </div>
                <p className="font-display text-2xl font-bold" style={{ color }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy features bar */}
        <div className="relative mt-5 flex flex-wrap gap-3 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { icon: ShieldCheck, label: "ZK Private positions" },
            { icon: Lock, label: "Zero-knowledge proofs" },
            { icon: Users, label: "Community-funded depth" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="feature-tag">
              <Icon size={11} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Main content grid â”€â”€ */}
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Round cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Launch Rounds</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Select a round to contribute liquidity</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={refreshPublicData}
              disabled={isRefreshingRounds}
              className="h-9 rounded-xl gap-2 text-xs font-semibold"
              style={{ borderColor: "rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.06)" }}
            >
              {isRefreshingRounds ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>

          <div className="space-y-3">
            {launchRounds.map((round) => {
              const onchain = roundStates[round.id];
              const totalLiquidity = onchain?.totalLiquidity ?? 0n;
              const targetLiquidity =
                onchain?.targetLiquidity && onchain.targetLiquidity > 0n
                  ? onchain.targetLiquidity
                  : round.targetLiquidity;
              const progress =
                targetLiquidity > 0n
                  ? Math.min(100, (Number(totalLiquidity) / Number(targetLiquidity)) * 100)
                  : 0;
              const isActive = selectedRoundId === round.id;
              const statusLabel = !onchain?.exists
                ? "pending"
                : onchain.isLive
                  ? "live"
                  : "building";
              const cat = categoryColors[round.category] ?? categoryColors.Crypto;

              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => setSelectedRoundId(round.id)}
                  className="surface-card surface-card-hover w-full p-5 text-left transition-all duration-300 group"
                  style={isActive ? {
                    borderColor: "rgba(99,102,241,0.35)",
                    boxShadow: "0 0 0 1px rgba(99,102,241,0.25), 0 8px 32px -8px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                  } : {}}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text }}>
                          {round.category}
                        </span>

                        {statusLabel === "live" ? (
                          <span className="badge-live">
                            <span className="pulse-dot" />
                            Live
                          </span>
                        ) : statusLabel === "building" ? (
                          <span className="badge-building">
                            <span className="pulse-dot" />
                            Building
                          </span>
                        ) : (
                          <span className="badge-pending">
                            Pending Init
                          </span>
                        )}

                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8" }}>
                            Selected
                          </span>
                        )}
                      </div>

                      <h3 className="font-display font-semibold text-base leading-snug line-clamp-2 pr-4">
                        {round.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                        {round.summary}
                      </p>
                    </div>

                    {/* Close block badge */}
                    <div className="flex-shrink-0 text-right"
                      style={{ minWidth: "100px" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Closes</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{round.closeLabel}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        #{onchain?.closesAt || round.closeHeight}
                      </p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: "Committed", value: formatDisplayUsd(totalLiquidity) + " USD" },
                      { label: "Target", value: formatDisplayUsd(targetLiquidity) + " USD" },
                      { label: "Contributors", value: String(onchain?.contributionCount ?? 0) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl p-2.5 text-center"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground mb-1.5">
                      <span>Pool progress</span>
                      <span style={{ color: progress >= 100 ? "#10b981" : "#6366f1" }}>
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full progress-shine transition-all duration-700"
                        style={{
                          width: `${progress}%`,
                          background: progress >= 100
                            ? "linear-gradient(90deg, #10b981, #34d399)"
                            : "linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)",
                        }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Action panel */}
        <div className="space-y-4">
          {/* Action card */}
          <div className="surface-card overflow-visible">
            {/* Card header with gradient */}
            <div className="relative overflow-hidden rounded-t-2xl px-6 pt-6 pb-5"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
              <div className="absolute right-4 top-4 opacity-10">
                <Rocket size={64} />
              </div>
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Selected Round
                  </p>
                  <h2 className="font-display text-base font-bold leading-snug line-clamp-2">
                    {selectedPreset.title}
                  </h2>
                </div>
                {connected && (
                  <div className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2"
                    style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <Wallet size={13} style={{ color: "#818cf8" }} />
                    <span className="text-xs font-semibold" style={{ color: "#818cf8" }}>
                      {balanceValue} USDCx
                    </span>
                  </div>
                )}
              </div>

              {/* Round status + committed */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
                  <p className="mt-1.5 text-sm font-bold">
                    {!selectedRoundState.exists
                      ? "Not initialized"
                      : selectedRoundState.isLive
                        ? "ðŸŸ¢ Launch ready"
                        : "ðŸ”µ Collecting"}
                  </p>
                </div>
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Committed</p>
                  <p className="mt-1.5 text-sm font-bold">{formatDisplayUsd(selectedRoundState.totalLiquidity)} USD</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {!selectedRoundState.exists ? (
                /* â”€â”€ Initialize prompt â”€â”€ */
                <div className="rounded-2xl p-5 text-center"
                  style={{
                    background: "rgba(245,158,11,0.07)",
                    border: "1px solid rgba(245,158,11,0.2)",
                  }}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl mx-auto mb-3"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <PlusCircle size={22} style={{ color: "#fbbf24" }} />
                  </div>
                  <p className="font-semibold text-sm mb-1" style={{ color: "#fbbf24" }}>
                    Round not initialized onchain
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Create the round first, then contributors can provide USDCx liquidity into it.
                  </p>
                  <Button
                    className="h-11 w-full rounded-xl font-semibold text-sm btn-glow"
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      boxShadow: "0 4px 20px -4px rgba(245,158,11,0.5)",
                    }}
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
              ) : (
                <>
                  {/* â”€â”€ Action mode toggle â”€â”€ */}
                  <div className="grid grid-cols-2 rounded-xl p-1 gap-1"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {(["provide", "withdraw"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setActionMode(mode)}
                        className={cn(
                          "rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                          actionMode === mode
                            ? mode === "provide"
                              ? "text-white"
                              : "text-white"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        style={actionMode === mode ? {
                          background: mode === "provide"
                            ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                            : "linear-gradient(135deg, #059669, #10b981)",
                          boxShadow: mode === "provide"
                            ? "0 4px 16px -4px rgba(99,102,241,0.6)"
                            : "0 4px 16px -4px rgba(16,185,129,0.5)",
                        } : {}}
                      >
                        {mode === "provide" ? "Provide Liquidity" : "Withdraw"}
                      </button>
                    ))}
                  </div>

                  {/* â”€â”€ Amount input â”€â”€ */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
                      {actionMode === "provide" ? "Contribution amount" : "Withdrawal amount"}
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder="0.00"
                        disabled={isProcessing}
                        className="h-14 rounded-xl pr-20 text-xl font-bold"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(99,102,241,0.2)",
                          fontSize: "1.25rem",
                          boxShadow: "none",
                        }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
                        USDCx
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      {actionMode === "provide" ? (
                        <>
                          <span>Balance: <span className="text-foreground font-semibold">{balanceValue} USDCx</span></span>
                          <button
                            type="button"
                            onClick={() => setAmountStr(formatDisplayUsd(balanceAtomic))}
                            className="font-semibold hover:text-primary transition-colors"
                            style={{ color: "#818cf8" }}
                          >
                            Max
                          </button>
                        </>
                      ) : (
                        <span>Available: <span className="text-foreground font-semibold">{formatUnits(selectedWithdrawCapacity, TOKEN_DECIMALS, 4)} USDCx</span></span>
                      )}
                    </div>
                  </div>

                  {/* â”€â”€ Info row â”€â”€ */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Target pool", value: formatDisplayUsd(selectedRoundState.targetLiquidity) },
                      { label: "Your decrypted", value: formatDisplayUsd(currentRoundDecryptedTotal) },
                      { label: "Close block", value: String(selectedRoundState.closesAt || selectedPreset.closeHeight) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xs font-bold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* â”€â”€ Helper text â”€â”€ */}
                  {actionMode === "provide" ? (
                    <p className="text-xs text-muted-foreground leading-relaxed rounded-xl p-3"
                      style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.1)" }}>
                      {LAUNCHPAD_ADAPTER_ADDRESS
                        ? "Providing liquidity will approve USDCx and mint a private ZK launch position record."
                        : "Set NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS to enable contributions."}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed rounded-xl p-3"
                      style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)" }}>
                      {selectedWithdrawInput
                        ? selectedPlaintextPosition
                          ? "A matching launch position record is ready for withdrawal."
                          : "Decrypted position will be used for withdrawal."
                        : "Decrypt a launch position for this round before withdrawing."}
                    </p>
                  )}

                  {/* â”€â”€ CTA buttons â”€â”€ */}
                  <div className="flex flex-col gap-2.5">
                    <Button
                      className="h-13 w-full rounded-xl text-sm font-bold btn-glow"
                      style={{
                        height: "52px",
                        background: actionMode === "provide"
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                          : "linear-gradient(135deg, #059669, #10b981)",
                        boxShadow: actionMode === "provide"
                          ? "0 8px 24px -8px rgba(99,102,241,0.6)"
                          : "0 8px 24px -8px rgba(16,185,129,0.5)",
                        opacity: (!connected || !amountStr || parseFloat(amountStr) <= 0 || isProcessing || (actionMode === "provide" ? !canProvide : !canWithdraw)) ? 0.5 : 1,
                      }}
                      onClick={actionMode === "provide" ? handleProvideLiquidity : handleWithdrawLiquidity}
                      disabled={!connected || !amountStr || parseFloat(amountStr) <= 0 || isProcessing || (actionMode === "provide" ? !canProvide : !canWithdraw)}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : actionMode === "provide" ? (
                        <>
                          <BadgeDollarSign className="mr-2 h-4 w-4" />
                          Provide Liquidity
                          <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          <Wallet className="mr-2 h-4 w-4" />
                          Withdraw Liquidity
                        </>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      className="h-11 w-full rounded-xl text-sm font-semibold"
                      style={{
                        background: "rgba(99,102,241,0.08)",
                        border: "1px solid rgba(99,102,241,0.2)",
                        color: canActivate ? "#818cf8" : undefined,
                      }}
                      onClick={handleActivateRound}
                      disabled={!connected || isProcessing || !canActivate}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      )}
                      Activate Round
                    </Button>
                  </div>
                </>
              )}

              {/* â”€â”€ Status message â”€â”€ */}
              {txStatus && (
                <div className="rounded-xl px-4 py-3 text-center text-xs font-semibold"
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.18)",
                    color: "#818cf8",
                  }}>
                  <Loader2 className="inline mr-2 h-3.5 w-3.5 animate-spin" />
                  {txStatus}
                </div>
              )}

              {/* â”€â”€ Insufficient balance warning â”€â”€ */}
              {actionMode === "provide" && atomicAmount > balanceAtomic && amountStr.trim() !== "" && (
                <div className="rounded-xl px-4 py-3 text-xs font-semibold"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}>
                  <AlertCircle className="inline mr-1.5 h-3.5 w-3.5" />
                  Insufficient USDCx balance for this contribution.
                </div>
              )}

              {/* â”€â”€ Connect wallet prompt â”€â”€ */}
              {!connected && (
                <div className="rounded-xl p-4"
                  style={{
                    background: "rgba(99,102,241,0.06)",
                    border: "1px solid rgba(99,102,241,0.15)",
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}>
                      <AlertCircle size={16} style={{ color: "#818cf8" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#a5b4fc" }}>
                        Wallet required
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Connect a wallet to interact with the launchpad.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* â”€â”€ Private Records Panel â”€â”€ */}
          <div className="surface-card">
            <div className="px-6 pt-5 pb-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock size={15} style={{ color: "#818cf8" }} />
                  <h3 className="font-display text-base font-bold tracking-tight">
                    Private Records
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={loadSenderRecords}
                  disabled={isRefreshingRecords}
                  className="h-8 rounded-xl text-xs font-semibold gap-1.5"
                  style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}
                >
                  {isRefreshingRecords ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Load Records
                </Button>
              </div>

              {/* Record counters */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Encrypted", value: senderRecords.length },
                  { label: "Decrypted", value: Object.keys(decryptedRecords).length },
                  { label: "Round total", value: formatDisplayUsd(currentRoundDecryptedTotal) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-2.5 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              {/* Status message */}
              <p className="text-xs text-muted-foreground rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                {portfolioMessage}
              </p>

              {decryptMessage && (
                <p className="text-xs rounded-xl p-3"
                  style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.14)", color: "#a5b4fc" }}>
                  {decryptMessage}
                </p>
              )}

              {/* Record list */}
              {senderRecords.length > 0 && (
                <div className="space-y-2.5">
                  {senderRecords.map((record) => {
                    const key = getRecordKey(record);
                    const decrypted = decryptedRecords[key];
                    const matchingPreset = launchRounds.find(
                      (round) => String(round.id) === decrypted?.roundId
                    );

                    return (
                      <div key={key} className="rounded-xl overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {/* Record header */}
                        <div className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Launch position
                              </p>
                            </div>
                            <p className="truncate text-xs font-mono text-foreground/70">
                              {record.commitment
                                ? `${record.commitment.slice(0, 12)}...${record.commitment.slice(-6)}`
                                : "Encrypted position"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              Block #{record.blockHeight ?? 0}
                            </p>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => decryptRecord(record)}
                            disabled={decryptingKey === key || !decrypt}
                            className="h-8 rounded-lg text-xs font-semibold gap-1.5 flex-shrink-0"
                            style={{
                              background: "rgba(99,102,241,0.1)",
                              borderColor: "rgba(99,102,241,0.2)",
                              color: "#a5b4fc",
                            }}
                          >
                            {decryptingKey === key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                            {decrypted ? "Re-decrypt" : "Decrypt"}
                          </Button>
                        </div>

                        {/* Decrypted content */}
                        {decrypted && (
                          <div className="px-4 pb-4 pt-2 space-y-2.5"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-lg p-2.5"
                                style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}>
                                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Round ID</p>
                                <p className="mt-1 text-xs font-bold" style={{ color: "#a5b4fc" }}>{decrypted.roundId}</p>
                              </div>
                              <div className="rounded-lg p-2.5 col-span-2"
                                style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                                <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Amount</p>
                                <p className="mt-1 text-xs font-bold" style={{ color: "#34d399" }}>
                                  {formatUnits(decrypted.amount, TOKEN_DECIMALS, 4)} USDCx
                                </p>
                              </div>
                            </div>

                            {matchingPreset && (
                              <p className="text-[11px] text-muted-foreground rounded-lg p-2.5 leading-relaxed"
                                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                ðŸŽ¯ {matchingPreset.title}
                              </p>
                            )}

                            {/* Raw fields */}
                            <details className="group">
                              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors select-none">
                                Raw fields â–¸
                              </summary>
                              <div className="mt-2 space-y-1.5 rounded-lg p-3 font-mono text-[10px]"
                                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                {decrypted.rawFields.map((field) => (
                                  <div key={field.label} className="flex gap-2">
                                    <span className="text-muted-foreground shrink-0">{field.label}:</span>
                                    <span className="break-all text-foreground/70">{field.value}</span>
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
          </div>
        </div>
      </section>
    </div>
  );
}
