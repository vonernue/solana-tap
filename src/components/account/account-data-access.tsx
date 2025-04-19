"use client";

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
  ParsedAccountData
} from "@solana/web3.js";
import { 
  TOKEN_2022_PROGRAM_ID, 
  TOKEN_PROGRAM_ID, 
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction, 
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "../../utils/ConnectionProvider";
import { useMobileWallet } from "../../utils/useMobileWallet";



async function getNumberDecimals(mintAddress: PublicKey, connection: Connection):Promise<number> {
  const info = await connection.getParsedAccountInfo(mintAddress);
  const result = (info.value?.data as ParsedAccountData).parsed.info.decimals as number;
  return result;
}


export function useGetBalance({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["get-balance", { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getBalance(address),
  });
}

export function useGetSignatures({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: ["get-signatures", { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getConfirmedSignaturesForAddress2(address),
  });
}

export function useGetTokenAccounts({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: [
      "get-token-accounts",
      { endpoint: connection.rpcEndpoint, address },
    ],
    queryFn: async () => {
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ]);
      return [...tokenAccounts.value, ...token2022Accounts.value];
    },
  });
}

export function useGetTokenAccountBalance({ address }: { address: PublicKey }) {
  const { connection } = useConnection();

  return useQuery({
    queryKey: [
      "get-token-account-balance",
      { endpoint: connection.rpcEndpoint, account: address.toString() },
    ],
    queryFn: () => connection.getTokenAccountBalance(address),
  });
}

export function useTransferSol({ address }: { address: PublicKey }) {
  const { connection } = useConnection();
  const client = useQueryClient();
  const wallet = useMobileWallet();

  return useMutation({
    mutationKey: [
      "transfer-sol",
      { endpoint: connection.rpcEndpoint, address },
    ],
    mutationFn: async (input: { destination: PublicKey; amount: number }) => {
      let signature: TransactionSignature = "";
      try {
        const { transaction, latestBlockhash, minContextSlot } = await createTransaction({
          publicKey: address,
          destination: input.destination,
          amount: input.amount,
          connection,
        });

        // Send transaction and await for signature
        signature = await wallet.signAndSendTransaction(transaction, minContextSlot);

        // Send transaction and await for signature
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          "confirmed"
        );

        console.log(signature);
        return signature;
      } catch (error: unknown) {
        console.log("error", `Transaction failed! ${error}`, signature);

        return;
      }
    },
    onSuccess: (signature) => {
      if (signature) {
        console.log(signature);
      }
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            "get-balance",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            "get-signatures",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
      ]).then(() => signature);
    },
    onError: (error) => {
      console.error(`Transaction failed! ${error}`);
    },
  });
}

export function useTransferToken({ srcAddress }: { srcAddress: PublicKey }) {
  const { connection } = useConnection();
  const client = useQueryClient();
  const wallet = useMobileWallet();

  return useMutation({
    mutationKey: [
      "transfer-token",
      { endpoint: connection.rpcEndpoint, srcAddress },
    ],
    mutationFn: async (input: {mintAddress: PublicKey; destAddress: PublicKey; amount: number}) => {
      let signature: TransactionSignature = "";
      try {
        const { transaction, latestBlockhash, minContextSlot } = await createTokenTransferTransaction({
          mintAddress: input.mintAddress,
          srcAddress,
          destAddress: input.destAddress,
          amount: input.amount * 10 ** await getNumberDecimals(input.mintAddress, connection),
          connection
        });
        // Send transaction and await for signature
        signature = await wallet.signAndSendTransaction(transaction, minContextSlot);

        // Send transaction and await for signature
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          "confirmed"
        );

        console.log(signature);
        return signature;
      } catch (error: unknown) {
        console.log("error", `Transaction failed! ${error}`, signature);

        return;
      }
    },
    onSuccess: (signature) => {
      if (signature) {
        console.log(signature);
      }
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            "get-balance",
            { endpoint: connection.rpcEndpoint, srcAddress },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            "get-signatures",
            { endpoint: connection.rpcEndpoint, srcAddress },
          ],
        })
      ]).then(() => signature);
    },
    onError: (error) => {
      console.error(`Transaction failed! ${error}`);
    },
  });
}

export function useRequestAirdrop({ address }: { address: PublicKey }) {
  const { connection } = useConnection();
  const client = useQueryClient();

  return useMutation({
    mutationKey: ["airdrop", { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async (amount: number = 1) => {
      const [latestBlockhash, signature] = await Promise.all([
        connection.getLatestBlockhash(),
        connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL),
      ]);

      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        "confirmed"
      );
      return signature;
    },
    onSuccess: (signature) => {
      console.log(signature);
      return Promise.all([
        client.invalidateQueries({
          queryKey: [
            "get-balance",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
        client.invalidateQueries({
          queryKey: [
            "get-signatures",
            { endpoint: connection.rpcEndpoint, address },
          ],
        }),
      ]);
    },
  });
}

async function createTokenTransferTransaction({
  mintAddress, 
  srcAddress, 
  destAddress, 
  amount,
  connection
}: {
  mintAddress: PublicKey, 
  srcAddress: PublicKey, 
  destAddress: PublicKey, 
  amount: number,
  connection: Connection
}) {
  const {
    context: {slot: minContextSlot},
    value: latestBlockhash
  } = await connection.getLatestBlockhashAndContext();

  const srcTokenAccount = getAssociatedTokenAddressSync(
    mintAddress,
    srcAddress,
  );

  const destTokenAccount = getAssociatedTokenAddressSync(
    mintAddress,
    destAddress,
  );

  const instructions = [
    createAssociatedTokenAccountIdempotentInstruction(
      srcAddress,
      destTokenAccount,
      destAddress,
      mintAddress,
    ),
    createTransferInstruction(
      srcTokenAccount,
      destTokenAccount,
      srcAddress,
      amount
    )
  ]

  // Create a new TransactionMessage with version and compile it to legacy
  const messageLegacy = new TransactionMessage({
    payerKey: srcAddress,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage();

  // Create a new VersionedTransaction which supports legacy and v0
  const transaction = new VersionedTransaction(messageLegacy);

  return {
    transaction,
    latestBlockhash,
    minContextSlot,
  };
}

async function createTransaction({
  publicKey,
  destination,
  amount,
  connection,
}: {
  publicKey: PublicKey;
  destination: PublicKey;
  amount: number;
  connection: Connection;
}): Promise<{
  transaction: VersionedTransaction;
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number };
  minContextSlot: number
}> {
  // Get the latest blockhash and slot to use in our transaction
  const {
    context: {slot: minContextSlot},
    value: latestBlockhash
  } = await connection.getLatestBlockhashAndContext();


  // Create instructions to send, in this case a simple transfer
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: destination,
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  ];

  // Create a new TransactionMessage with version and compile it to legacy
  const messageLegacy = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage();

  // Create a new VersionedTransaction which supports legacy and v0
  const transaction = new VersionedTransaction(messageLegacy);

  return {
    transaction,
    latestBlockhash,
    minContextSlot,
  };
}
