import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Alert, Linking } from "react-native";
import { Text, useTheme } from "react-native-paper";
import NfcManager, { NfcTech } from "react-native-nfc-manager";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthorization } from "../utils/useAuthorization";
import { useConnection } from "../utils/ConnectionProvider";
import { useMobileWallet } from "../utils/useMobileWallet";
import { useAnchorWallet } from "../utils/useAnchorWallet";
import { AppModal } from "../components/ui/app-modal";
import { BottomAppModal } from "../components/ui/bottom-modal";
import { PublicKey, Connection, LAMPORTS_PER_SOL, SystemProgram, Transaction, TransactionSignature } from "@solana/web3.js";
import { useTransferSol, useTransferToken } from "../components/account/account-data-access";
import { Program, AnchorProvider, Wallet, web3, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "../../contracts/distribution/target/idl/distribution_program.json";
import { type DistributionProgram } from "../../contracts/distribution/target/types/distribution_program";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const tokenMintAddresses = {
  "USDC": new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr")
}

export function SendScreen() {
  const { selectedAccount } = useAuthorization();
  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [showTransferSolModal, setShowTransferSolModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("SOL");
  const [transferMode, setTransferMode] = useState<'wallet' | 'program'>('wallet');
  const theme = useTheme();

  const startContinuousScanning = async () => {
    try {
      await NfcManager.start();
      await NfcManager.requestTechnology(NfcTech.IsoDep);

      while (true) {
        const tag = await NfcManager.getTag();

        // Select APP
        let response = await NfcManager.transceive([
          0x00, 0xa4, 0x04, 0x00, 0x07, 0xd2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01, 0x00,
        ]);

        // Select File
        response = await NfcManager.transceive([0x00, 0xa4, 0x00, 0x0c, 0x02, 0xe1, 0x04]);
        if (JSON.stringify(response) !== JSON.stringify([0x90, 0x00])) {
          Alert.alert("Error", "Failed to communicate with NFC tag (File)");
          continue;
        }

        // Read File
        response = await NfcManager.transceive([0x00, 0xb0, 0x00, 0x00, 0xff]);
        const startIndex = response.indexOf(0x7b);
        const endIndex = response.indexOf(0x7d);
        const jsonString = response.slice(startIndex, endIndex + 1);
        const jsonStringParsed = String.fromCharCode.apply(null, jsonString);
        const jsonData = JSON.parse(jsonStringParsed);
        const { token, amount, address, mode } = jsonData;
        console.log("Parsed NFC data:", jsonData);
        if (token !== "SOL" && token !== "USDC") {
          Alert.alert("Error", "Invalid token type.");
          continue;
        }
        if (!address || !amount) {
          Alert.alert("Error", "Invalid address or amount.");
          continue;
        }

        setDestinationAddress(address);
        setAmount(amount);
        setToken(token);
        setTransferMode(mode || 'wallet');
        setShowTransferSolModal(true);
        continue;
      }
    } catch (ex) {
      console.log("NFC read error", ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }
  };

  useFocusEffect(
    useCallback(() => {
      const initNfc = async () => {
        try {
          await NfcManager.start();
          const isEnabled = await NfcManager.isEnabled();
          setNfcEnabled(isEnabled);
          if (isEnabled) {
            startContinuousScanning();
          }
        } catch (error) {
          console.error("Failed to initialize NFC:", error);
        }
      };

      initNfc();

      return () => {
        NfcManager.cancelTechnologyRequest();
        NfcManager.close();
      };
    }, [])
  );

  return (
    <>
      <View style={styles.screenContainer}>
        <View style={styles.centeredContainer}>
          <MaterialIcons name="nfc" size={64} color={theme.colors.primary} />
          <Text style={styles.tapToSendText}>Tap to send</Text>
        </View>
        {nfcEnabled ? null : (
          <Text style={{ marginTop: 16, color: "red", textAlign: "center" }}>
            NFC is not enabled on this device.
          </Text>
        )}
      </View>
      {selectedAccount ? (
        <SolConfirmationModal
          hide={() => setShowTransferSolModal(false)}
          show={showTransferSolModal}
          srcAddr={selectedAccount.publicKey}
          destAddr={destinationAddress}
          amount={amount}
          token={token}
          mode={transferMode}
          setTxHash={setTxHash}
          successShow={() => setShowSuccessModal(true)}
          failureShow={() => {
            Alert.alert("Error", "Transaction failed!");
            setShowTransferSolModal(false);
          }}
        />
        ) : null}
      <BottomAppModal
        title="Transaction Success"
        hide={() => setShowSuccessModal(false)}
        show={showSuccessModal}
        submit={async () => {
          setDestinationAddress("");
          setAmount("");
          setToken("");
          if (txHash) {
            const solscanUrl = `https://solscan.io/tx/${txHash}?cluster=devnet`;
            Linking.openURL(solscanUrl); // Open the transaction URL in the browser
          }
        }}
        submitLabel="View on explorer"
      >
        <View style={{ padding: 20 }}>
          <Text>
            Transaction successful! You have sent{" "}
            <Text style={{ fontWeight: "bold" }}>{amount}</Text>{" "}
            <Text style={{ fontWeight: "bold" }}>{token}</Text> to{" "}
            <Text style={{ fontWeight: "bold" }}>{destinationAddress}</Text>?
          </Text>
        </View>
      </BottomAppModal>
    </>
  );
}

export function SolConfirmationModal({
  hide,
  show,
  srcAddr,
  destAddr,
  amount,
  token,
  mode,
  setTxHash,
  successShow,
  failureShow,
}: {
  hide: () => void;
  show: boolean;
  srcAddr: PublicKey;
  destAddr: string;
  amount: string;
  token: string;
  mode: 'wallet' | 'program';
  setTxHash: (hash: string) => void;
  successShow: () => void;
  failureShow: () => void;
}) {
  const transferSol = useTransferSol({ address: srcAddr });
  const transferToken = useTransferToken({ srcAddress: srcAddr });
  const { connection } = useConnection();
  const wallet = useMobileWallet();
  const anchorWallet = useAnchorWallet();

  const executeDistribution = async () => {
    if (!anchorWallet) {
      throw new Error("Wallet not connected");
    }

    const provider = new AnchorProvider(
      connection as any,
      anchorWallet as Wallet,
      { commitment: "confirmed" }
    );

    const program = new Program<DistributionProgram>(
      idl as DistributionProgram,
      provider
    );

    const configPda = new PublicKey(destAddr);
    const amountInLamports = parseFloat(amount) * LAMPORTS_PER_SOL;
    const incinerator = new PublicKey("1nc1nerator11111111111111111111111111111111");

    // Fetch the config account to get recipients
    const configAccount = await program.account.config.fetch(configPda);
    const recipients = configAccount.recipients;

    let instruction;
    if (token === "SOL") {
      // Create array of 10 recipient accounts, using incinerator for unused slots
      const recipientAccounts = Array(10).fill(incinerator);
      recipients.forEach((recipient, index) => {
        recipientAccounts[index] = recipient;
      });

      instruction = await program.methods
        .distributeSol(new BN(amountInLamports))
        .accounts({
          config: configPda,
          payer: srcAddr,
          systemProgram: SystemProgram.programId,
          recipient0: recipientAccounts[0],
          recipient1: recipientAccounts[1],
          recipient2: recipientAccounts[2],
          recipient3: recipientAccounts[3],
          recipient4: recipientAccounts[4],
          recipient5: recipientAccounts[5],
          recipient6: recipientAccounts[6],
          recipient7: recipientAccounts[7],
          recipient8: recipientAccounts[8],
          recipient9: recipientAccounts[9],
        })
        .instruction();
    } else if (token === "USDC") {
      // Create array of 10 recipient ATAs, using incinerator for unused slots
      const recipientATAs = Array(10).fill(incinerator);
      
      // Get ATAs for each recipient
      for (let i = 0; i < recipients.length; i++) {
        const recipientATA = await getAssociatedTokenAddress(
          tokenMintAddresses["USDC"],
          recipients[i] 
        );
        recipientATAs[i] = recipientATA;
      }

      const senderAta = await getAssociatedTokenAddress(
        tokenMintAddresses["USDC"],
        srcAddr
      );

      instruction = await program.methods
        .distributeSplAmount(new BN(parseFloat(amount)* 10 ** 6))
        .accounts({
          config: configPda,
          payer: srcAddr,
          fromAta: senderAta,
          mint: tokenMintAddresses["USDC"],
          tokenProgram: TOKEN_PROGRAM_ID,
          recipient0Ata: recipientATAs[0],
          recipient1Ata: recipientATAs[1],
          recipient2Ata: recipientATAs[2],
          recipient3Ata: recipientATAs[3],
          recipient4Ata: recipientATAs[4],
          recipient5Ata: recipientATAs[5],
          recipient6Ata: recipientATAs[6],
          recipient7Ata: recipientATAs[7],
          recipient8Ata: recipientATAs[8],
          recipient9Ata: recipientATAs[9],
        })
        .instruction();
    } else {
      throw new Error("Invalid token type");
    }

    const {
      context: { slot: minContextSlot },
      value: latestBlockhash
    } = await connection.getLatestBlockhashAndContext();

    const tx = new Transaction({
      ...latestBlockhash,
      feePayer: srcAddr,
    }).add(instruction);

    const txHash = await wallet.signAndSendTransaction(tx, minContextSlot);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      { signature: txHash, ...latestBlockhash },
      "confirmed"
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    return txHash;
  };

  return (
    <BottomAppModal
      title="Send SOL"
      hide={hide}
      show={show}
      submit={async () => {
        try {
          let hash = "";

          if (mode === "wallet") {
            // Direct wallet transfer
            if (transferSol && token === "SOL") {
              const result = await transferSol.mutateAsync({
                destination: new PublicKey(destAddr),
                amount: parseFloat(amount),
              });
              hash = result || "";
            } else if (transferToken && token === "USDC") {
              const result = await transferToken.mutateAsync({
                mintAddress: tokenMintAddresses["USDC"],
                destAddress: new PublicKey(destAddr),
                amount: parseFloat(amount),
              });
              hash = result || "";
            } else {
              throw new Error("Transfer functionality is not available.");
            }
          } else if (mode === "program") {
            // Distribution program transfer
            const result = await executeDistribution();
            hash = result || "";
          } else {
            throw new Error("Invalid transfer mode");
          }

          hide();
          if (hash) {
            setTxHash(hash);
            successShow();
          } else {
            failureShow();
          }
        } catch (error: any) {
          console.error("Transfer error:", error);
          Alert.alert("Error", error.message || "Transaction failed!");
          failureShow();
        }
      }}
      submitLabel="Send"
      submitDisabled={!srcAddr || !amount}
    >
      <View style={{ padding: 20 }}>
        <Text>
          Are you sure you want to send{" "}
          <Text style={{ fontWeight: "bold" }}>{amount}</Text>{" "}
          <Text style={{ fontWeight: "bold" }}>{token}</Text> to{" "}
          <Text style={{ fontWeight: "bold" }}>{destAddr}</Text>?
          {mode === "program" && (
            <Text> This will be distributed according to the configuration.</Text>
          )}
        </Text>
      </View>
    </BottomAppModal>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centeredContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  tapToSendText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "bold",
  },
});