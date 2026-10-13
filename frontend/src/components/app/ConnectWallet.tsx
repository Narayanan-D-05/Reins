"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "@/lib/chain";

export function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  if (!isConnected) {
    const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => injected && connect({ connector: injected })}
          disabled={isPending || !injected}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {isPending ? "Connecting…" : injected ? "Connect wallet" : "No wallet found"}
        </button>
        {error && (
          <span className="max-w-xs text-right text-xs text-danger">
            {error.message.toLowerCase().includes("provider")
              ? "No browser wallet detected. Install MetaMask or another EVM wallet extension."
              : error.message}
          </span>
        )}
      </div>
    );
  }

  if (chainId !== monadTestnet.id) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => switchChain({ chainId: monadTestnet.id })}
          disabled={isSwitching}
          className="rounded-full border border-danger px-5 py-2.5 text-sm text-danger transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
        >
          {isSwitching ? "Switching…" : "Switch to Monad Testnet"}
        </button>
        {switchError && (
          <span className="max-w-xs text-right text-xs text-danger">
            Your wallet couldn&apos;t add the network automatically. Add it manually instead:
            RPC https://testnet-rpc.monad.xyz, chain ID 10143, currency MON.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-text-muted">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="rounded-full border border-border-strong px-4 py-2 text-xs text-text transition-all duration-150 ease-out hover:border-accent hover:text-accent active:scale-[0.97]"
      >
        Disconnect
      </button>
    </div>
  );
}
