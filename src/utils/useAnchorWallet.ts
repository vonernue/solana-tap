import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { useMemo } from "react";
import { useMobileWallet } from "./useMobileWallet";
import { useAuthorization } from "./useAuthorization";

export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]>;
}

export function useAnchorWallet(): AnchorWallet | undefined {
  const { selectedAccount } = useAuthorization();
  const mobileWallet = useMobileWallet();
  return useMemo(() => {
    if (!selectedAccount) {
      return;
    }

    return {
      signTransaction: async <T extends Transaction | VersionedTransaction>(
        transaction: T
      ) => {
        return await transact(async (wallet) => {
          const serialized = transaction.serialize();
          const signed = await wallet.signTransactions({
            payloads: [Buffer.from(serialized).toString('base64')]
          });
          const signedTx = Transaction.from(Buffer.from(signed.signed_payloads[0], 'base64'));
          return signedTx as T;
        });
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(
        transactions: T[]
      ) => {
        return await transact(async (wallet) => {
          const serialized = transactions.map(tx => Buffer.from(tx.serialize()).toString('base64'));
          const signed = await wallet.signTransactions({
            payloads: serialized
          });
          return signed.signed_payloads.map((payload, i) => {
            const signedTx = Transaction.from(Buffer.from(payload, 'base64'));
            return signedTx as T;
          });
        });
      },
      get publicKey() {
        return selectedAccount.publicKey;
      },
    };
  }, [mobileWallet, selectedAccount]);
}