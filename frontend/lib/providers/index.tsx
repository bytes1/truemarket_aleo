// bytes1/truemarket_tempo/truemarket_tempo-main/frontend/lib/providers/index.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletModalProvider } from '@provablehq/aleo-wallet-adaptor-react-ui'; // Import this
import { LeoWalletAdapter } from '@provablehq/aleo-wallet-adaptor-leo';
import { PuzzleWalletAdapter } from '@provablehq/aleo-wallet-adaptor-puzzle';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { FoxWalletAdapter } from '@provablehq/aleo-wallet-adaptor-fox';
import { SoterWalletAdapter } from '@provablehq/aleo-wallet-adaptor-soter';
import { Network } from '@provablehq/aleo-types';
import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core';

// Import Aleo wallet adapter CSS
import '@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css';

const queryClient = new QueryClient();

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const wallets = useMemo(
    () => [
      new ShieldWalletAdapter(),
      new PuzzleWalletAdapter(),
      new LeoWalletAdapter(),
      new FoxWalletAdapter(),
      new SoterWalletAdapter(),
    ],
    []
  );

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={Network.TESTNET}
      decryptPermission={DecryptPermission.UponRequest}
      autoConnect={true}
    >
      <WalletModalProvider> {/* Add this wrapper here */}
        <QueryClientProvider client={queryClient}>
          {mounted ? children : null}
        </QueryClientProvider>
      </WalletModalProvider>
    </AleoWalletProvider>
  );
};