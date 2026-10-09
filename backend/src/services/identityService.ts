import { encodeFunctionData, type Address, type Hex } from "viem";
import { publicClient } from "../chain/client.js";
import { ERC8004IdentityRegistryAbi } from "../chain/abiIndex.js";
import { addresses } from "../chain/addresses.js";

/// ERC-8004 identity registration is deliberately decoupled from
/// ReinsAccountFactory (see factory/ReinsAccountFactory.sol comment) — each
/// agent key registers its own identity directly against the registry, as
/// a normal transaction from that agent's own key. The backend only builds
/// the calldata; it never holds an agent's key.
export function encodeRegisterAgentTx(agentURI: string): Hex {
  return encodeFunctionData({
    abi: ERC8004IdentityRegistryAbi,
    functionName: "register",
    args: [agentURI],
  });
}

export function encodeSetMetadataTx(agentId: bigint, metadataKey: string, metadataValue: Hex): Hex {
  return encodeFunctionData({
    abi: ERC8004IdentityRegistryAbi,
    functionName: "setMetadata",
    args: [agentId, metadataKey, metadataValue],
  });
}

export async function getAgentWallet(agentId: bigint): Promise<Address> {
  return publicClient.readContract({
    address: addresses.erc8004IdentityRegistry,
    abi: ERC8004IdentityRegistryAbi,
    functionName: "getAgentWallet",
    args: [agentId],
  }) as Promise<Address>;
}

export async function getAgentMetadata(agentId: bigint, metadataKey: string): Promise<Hex> {
  return publicClient.readContract({
    address: addresses.erc8004IdentityRegistry,
    abi: ERC8004IdentityRegistryAbi,
    functionName: "getMetadata",
    args: [agentId, metadataKey],
  }) as Promise<Hex>;
}
