// bytes1/truemarket_tempo/truemarket_tempo-main/frontend/components/common/WalletButton.tsx
"use client";

import { WalletMultiButton } from "@provablehq/aleo-wallet-adaptor-react-ui";

export function WalletButton() {
  return (
    <div className="flex items-center gap-2">
      <WalletMultiButton />
    </div>
  );
}