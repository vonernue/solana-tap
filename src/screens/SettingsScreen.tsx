import React, { useState } from "react";
import { StyleSheet, View, ScrollView, Linking } from "react-native";
import { Text, Button, TextInput, List, useTheme } from "react-native-paper";
import { useAuthorization } from "../utils/useAuthorization";
import { useConnection } from "../utils/ConnectionProvider";
import { useAnchorWallet } from "../utils/useAnchorWallet";
import { Program, AnchorProvider, web3, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Transaction, TransactionSignature } from "@solana/web3.js";
import { AppModal } from "../components/ui/app-modal";
import { BottomAppModal } from "../components/ui/bottom-modal";
import { useMobileWallet } from "../utils/useMobileWallet";

// Import the IDL
import idl from "../../contracts/distribution/target/idl/distribution_program.json";
import { type DistributionProgram } from "../../contracts/distribution/target/types/distribution_program";

export function SettingsScreen() {
  const { selectedAccount } = useAuthorization();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const theme = useTheme();
  const wallet = useMobileWallet();
  const [showCreateConfigModal, setShowCreateConfigModal] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([""]);
  const [percentages, setPercentages] = useState<string[]>(["0"]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [configAddress, setConfigAddress] = useState<string>("");

  const handleAddRecipient = () => {
    setRecipients([...recipients, ""]);
    setPercentages([...percentages, "0"]);
  };

  const handleRemoveRecipient = (index: number) => {
    const newRecipients = [...recipients];
    const newPercentages = [...percentages];
    newRecipients.splice(index, 1);
    newPercentages.splice(index, 1);
    setRecipients(newRecipients);
    setPercentages(newPercentages);
  };

  const handleRecipientChange = (text: string, index: number) => {
    const newRecipients = [...recipients];
    newRecipients[index] = text;
    setRecipients(newRecipients);
  };

  const handlePercentageChange = (text: string, index: number) => {
    const newPercentages = [...percentages];
    newPercentages[index] = text;
    setPercentages(newPercentages);
  };

  const handleCreateConfig = async () => {
    if (!selectedAccount || !anchorWallet) return;
    try {
      // Create provider
      const provider = new AnchorProvider(
        connection as any,
        anchorWallet as Wallet,
        { commitment: "confirmed" }
      );

      // Create program instance
      const program = new Program<DistributionProgram>(
        idl as DistributionProgram,
        provider
      );

      // Convert recipients to PublicKeys and percentages to numbers
      const recipientPubkeys = recipients
        .filter(r => r.trim() !== "")
        .map(r => new PublicKey(r));
      const percentageValues = percentages
        .filter(p => p.trim() !== "")
        .map(p => parseFloat(p) * 100);

      // Find PDA for config account
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), selectedAccount.publicKey.toBuffer()],
        program.programId
      );

      // Create the config
      const instruction = await program.methods
        .initialize(recipientPubkeys, percentageValues)
        .accounts({
          authority: selectedAccount.publicKey
        })
        .instruction();

      const {
        context: {slot: minContextSlot},
        value: latestBlockhash
      } = await connection.getLatestBlockhashAndContext();

      const tx = new Transaction({
        ...latestBlockhash,
        feePayer: selectedAccount.publicKey,
      }).add(instruction);

      let txHash: TransactionSignature = "";
      txHash = await wallet.signAndSendTransaction(tx, minContextSlot);

      await connection.confirmTransaction(
        { signature: txHash, ...latestBlockhash },
        "confirmed"
      );

      console.log("txHash", txHash);

      setConfigAddress(configPda.toBase58());
      setShowCreateConfigModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error creating config:", error);
      // Handle error appropriately
    }
  };

  return (
    <ScrollView style={styles.screenContainer}>
      <View style={styles.section}>
        <Text variant="headlineMedium" style={styles.sectionTitle}>
          Distribution Config
        </Text>
        <Button
          mode="contained"
          onPress={() => setShowCreateConfigModal(true)}
          style={styles.button}
        >
          Create New Config
        </Button>
      </View>

      <AppModal
        title="Create Distribution Config"
        show={showCreateConfigModal}
        hide={() => setShowCreateConfigModal(false)}
        submit={handleCreateConfig}
        submitLabel="Create"
      >
        <ScrollView style={styles.modalContent}>
          {recipients.map((recipient, index) => (
            <View key={index} style={styles.recipientRow}>
              <TextInput
                label="Recipient Address"
                value={recipient}
                onChangeText={(text) => handleRecipientChange(text, index)}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Percentage"
                value={percentages[index]}
                onChangeText={(text) => handlePercentageChange(text, index)}
                mode="outlined"
                keyboardType="numeric"
                style={styles.percentageInput}
              />
              {recipients.length > 1 && (
                <Button
                  mode="outlined"
                  onPress={() => handleRemoveRecipient(index)}
                  style={styles.removeButton}
                >
                  Remove
                </Button>
              )}
            </View>
          ))}
          <Button
            mode="outlined"
            onPress={handleAddRecipient}
            style={styles.addButton}
          >
            Add Recipient
          </Button>
        </ScrollView>
      </AppModal>

      <BottomAppModal
        title="Config Created"
        show={showSuccessModal}
        hide={() => setShowSuccessModal(false)}
        submit={() => {
          // Open in explorer
          const url = `https://explorer.solana.com/address/${configAddress}?cluster=devnet`;
          Linking.openURL(url);
        }}
        submitLabel="View on Explorer"
      >
        <View style={styles.successContent}>
          <Text>Distribution config created successfully!</Text>
          <Text style={styles.addressText}>{configAddress}</Text>
        </View>
      </BottomAppModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  modalContent: {
    maxHeight: 400,
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  input: {
    flex: 2,
    marginRight: 8,
  },
  percentageInput: {
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    marginLeft: 8,
  },
  addButton: {
    marginTop: 8,
  },
  successContent: {
    padding: 16,
  },
  addressText: {
    marginTop: 8,
    fontFamily: "monospace",
  },
});
