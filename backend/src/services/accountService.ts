import { encodeFunctionData, type Address, type Hex } from "viem";
import { publicClient } from "../chain/client.js";
import { ReinsAccountFactoryAbi } from "../chain/abiIndex.js";
import { addresses } from "../chain/addresses.js";

export function encodeCreateAccountTx(ownerPubKeyX: bigint, ownerPubKeyY: bigint): Hex {
  return encodeFunctionData({
    abi: ReinsAccountFactoryAbi,
    functionName: "createAccount",
    args: [ownerPubKeyX, ownerPubKeyY],
  });
}

export async function getAccountsForCreator(creator: Address): Promise<Address[]> {
  return publicClient.readContract({
    address: addresses.factory,
    abi: ReinsAccountFactoryAbi,
    functionName: "getAccounts",
    args: [creator],
  }) as Promise<Address[]>;
}
