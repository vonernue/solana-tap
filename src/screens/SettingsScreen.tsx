import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, Linking } from "react-native";
import { Text, Button, TextInput, List, useTheme, Card, Switch, Divider } from "react-native-paper";
import { useAuthorization } from "../utils/useAuthorization";
import { useConnection } from "../utils/ConnectionProvider";
import { useAnchorWallet } from "../utils/useAnchorWallet";
import { Program, AnchorProvider, web3, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Transaction, TransactionSignature } from "@solana/web3.js";
import { AppModal } from "../components/ui/app-modal";
import { BottomAppModal } from "../components/ui/bottom-modal";
import { useMobileWallet } from "../utils/useMobileWallet";
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [configAccounts, setConfigAccounts] = useState<{
    address: string;
    recipients: { address: string; percentage: number }[];
  }[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [useDistributionConfig, setUseDistributionConfig] = useState(false);

  // Load saved receiving mode
  useEffect(() => {
    const loadReceivingMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('receivingMode');
        if (savedMode) {
          setUseDistributionConfig(savedMode === 'program');
        }
      } catch (error) {
        console.error('Error loading receiving mode:', error);
      }
    };
    loadReceivingMode();
  }, []);

  // Save receiving mode when it changes
  useEffect(() => {
    const saveReceivingMode = async () => {
      try {
        await AsyncStorage.setItem('receivingMode', useDistributionConfig ? 'program' : 'wallet');
      } catch (error) {
        console.error('Error saving receiving mode:', error);
      }
    };
    saveReceivingMode();
  }, [useDistributionConfig]);

  // Fetch existing config accounts
  useEffect(() => {
    const fetchConfigAccounts = async () => {
      if (!selectedAccount) return;

      try {
        const provider = new AnchorProvider(
          connection as any,
          anchorWallet as Wallet,
          { commitment: "confirmed" }
        );

        const program = new Program<DistributionProgram>(
          idl as DistributionProgram,
          provider
        );

        const configs = await program.account.config.all([
          {
            memcmp: {
              offset: 8,
              bytes: selectedAccount.publicKey.toBase58(),
            },
          },
        ]);

        const formattedConfigs = configs.map((config) => {
          const recipients = config.account.recipients || [];
          const percentages = config.account.percentages || [];
          
          return {
            address: config.publicKey.toBase58(),
            recipients: recipients.map((recipient, index) => ({
              address: recipient.toBase58(),
              percentage: (percentages[index] || 0) / 100, // Convert from basis points to percentage
            })),
          };
        });

        setConfigAccounts(formattedConfigs);
      } catch (error) {
        console.error("Error fetching config accounts:", error);
        setConfigAccounts([]); // Reset to empty array on error
      }
    };

    fetchConfigAccounts();
  }, [selectedAccount, connection, anchorWallet]);

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

  const handleConfigSelect = async (address: string) => {
    setSelectedConfig(address);
    try {
      await AsyncStorage.setItem('selectedConfig', address);
    } catch (error) {
      console.error('Error saving selected config:', error);
    }
  };

  return (
    <ScrollView style={styles.screenContainer}>
      <View style={styles.section}>
        <Text variant="headlineMedium" style={styles.sectionTitle}>
          Receiving Mode
        </Text>
        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <Text variant="bodyLarge">Direct to Wallet</Text>
            <Switch
              value={useDistributionConfig}
              onValueChange={setUseDistributionConfig}
            />
            <Text variant="bodyLarge">Distribution Config</Text>
          </View>
          <Text variant="bodySmall" style={styles.toggleDescription}>
            {useDistributionConfig 
              ? "Funds will be distributed according to your selected configuration"
              : "Funds will be sent directly to your wallet"}
          </Text>
        </View>
      </View>

      <Divider style={styles.divider} />

      {useDistributionConfig && (
        <View style={styles.section}>
          <Text variant="headlineMedium" style={styles.sectionTitle}>
            Distribution Config
          </Text>
          
          {configAccounts.length > 0 && (
            <View style={styles.configList}>
              <Text variant="titleMedium" style={styles.subtitle}>
                Your Configurations
              </Text>
              {configAccounts.map((config) => (
                <Card
                  key={config.address}
                  style={[
                    styles.configCard,
                    selectedConfig === config.address && styles.selectedCard,
                  ]}
                  onPress={() => handleConfigSelect(config.address)}
                >
                  <Card.Content>
                    <Text variant="bodyMedium" style={styles.configAddress}>
                      {config.address}
                    </Text>
                    {config.recipients && config.recipients.length > 0 ? (
                      <>
                        <View style={styles.recipientsList}>
                          {config.recipients.map((recipient, index) => (
                            <View key={index} style={styles.recipientRow}>
                              <Text variant="bodySmall" style={styles.recipientAddress}>
                                {recipient.address.slice(0, 4)}...{recipient.address.slice(-4)}
                              </Text>
                              <Text variant="bodySmall" style={styles.percentage}>
                                {recipient.percentage.toFixed(2)}%
                              </Text>
                            </View>
                          ))}
                        </View>
                        <Text variant="bodySmall" style={styles.totalRecipients}>
                          Total: {config.recipients.length} recipient{config.recipients.length !== 1 ? "s" : ""}
                        </Text>
                      </>
                    ) : (
                      <Text variant="bodySmall" style={styles.noRecipients}>
                        No recipients configured
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}

          <Button
            mode="contained"
            onPress={() => setShowCreateConfigModal(true)}
            style={styles.button}
          >
            Create New Config
          </Button>
        </View>
      )}

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
  configList: {
    marginBottom: 16,
  },
  subtitle: {
    marginBottom: 8,
  },
  configCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectedCard: {
    borderColor: "#6200ee",
  },
  configAddress: {
    fontFamily: "monospace",
  },
  toggleContainer: {
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleDescription: {
    color: '#666',
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  recipientsList: {
    marginTop: 8,
    marginBottom: 4,
  },
  recipientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recipientAddress: {
    fontFamily: 'monospace',
    flex: 1,
  },
  percentage: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  totalRecipients: {
    marginTop: 4,
    color: '#666',
  },
  noRecipients: {
    marginTop: 8,
    color: '#666',
    fontStyle: 'italic',
  },
});
