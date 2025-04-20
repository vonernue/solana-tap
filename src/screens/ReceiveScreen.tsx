import React, { useState, useCallback } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, Image, Linking } from "react-native";
import { Text, Button, TextInput, Menu } from "react-native-paper";
import { useAuthorization } from "../utils/useAuthorization";
import { ActivityIndicator, MD2Colors } from 'react-native-paper';
import { useFocusEffect } from "@react-navigation/native";
import { AppModal } from "../components/ui/app-modal";
import { BottomAppModal } from "../components/ui/bottom-modal";
import {
  HCESession,
  HCESessionContext,
  NFCTagType4NDEFContentType,
  NFCTagType4,
} from "react-native-hce";
import { useConnection } from "../utils/ConnectionProvider";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function startHCE(
  message: string,
  readHandler: () => void
) {
  try {
    const tag = new NFCTagType4({
      type: NFCTagType4NDEFContentType.Text,
      content: message,
      writable: false,
    });

    let session = await HCESession.getInstance();
    await session.setApplication(tag);
    console.log("HCE tag set:", tag);
    await session.setEnabled(true);

    let isTagRead = false; // Local variable to track the read state

    session.on(HCESession.Events.HCE_STATE_READ,() => {
      if (isTagRead) {
        console.log("Tag already read, ignoring...");
        return;
      }
      isTagRead = true;
      readHandler();
    });
  } catch (error) {
    console.error("Error starting HCE:", error);
    throw error;
  }
}

async function txPolling(
  connection: Connection, 
  targetAddress: PublicKey, 
  setWaitTxModalVisible: (visible: boolean) => void,
  setReceivedModal: (visible: boolean) => void,
  setReceivedAmount: (amount: string) => void,
  setReceivedToken: (token: string) => void,
  setSender: (sender: string) => void,
  setTxHash: (hash: string) => void
) {
  let lastSignature = await connection.getSignaturesForAddress(targetAddress, {
    limit: 1,
  }, "confirmed").then((signatures) => {
    if (signatures.length > 0) {
      return signatures[0].signature;
    }
    return null;
  });

  console.log(`Last signature: ${lastSignature}`);

  let shouldStop = false; // Flag to control polling

  const fetchTx = async (lastSignature: string | null) => {
    if (shouldStop) return; // Stop polling if the flag is set

    const signatures = await connection.getSignaturesForAddress(targetAddress, {
      until: lastSignature ?? undefined,
      limit: 10,
    }, "confirmed");

    console.log(`signatures: ${JSON.stringify(signatures)}`);
    for (const sigInfo of signatures.reverse()) {
      const tx = await connection.getTransaction(sigInfo.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      console.log(`Transaction: ${sigInfo.signature}`);

      if (tx && tx.meta && tx.meta.postBalances && tx.meta.preBalances) {
        const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys.map(k => k.toBase58());
        const targetIndex = accountKeys.indexOf(targetAddress.toBase58());

        if (targetIndex !== -1) {
          const balanceDiff = (tx.meta.postBalances[targetIndex] - tx.meta.preBalances[targetIndex]) / LAMPORTS_PER_SOL;

          if (balanceDiff > 0) {
            // Try to find the sender (the one who lost SOL)
            let sender = null;
            for (let i = 0; i < tx.meta.preBalances.length; i++) {
              if (
                tx.meta.preBalances[i] > tx.meta.postBalances[i] &&
                accountKeys[i] !== targetAddress.toBase58()
              ) {
                sender = accountKeys[i];
                break;
              }
            }
            if (!sender) {
              console.log("Sender not found");
              continue;
            }
            setReceivedAmount(balanceDiff.toString());
            setReceivedToken("SOL");
            setSender(sender);
            setTxHash(sigInfo.signature);
            console.log(`💸 ${sender} sent ${balanceDiff} SOL to ${targetAddress.toBase58()}`);
            console.log(`🔗 https://solscan.io/tx/${sigInfo.signature}`);
            setWaitTxModalVisible(false); // Close the waiting modal
            setReceivedModal(true); // Show the received modal
            shouldStop = true; // Stop polling after finding a transaction
            break;
          }
        }
      }

      lastSignature = sigInfo.signature;
    }

  };

  setInterval(() => fetchTx(lastSignature), 2000);

  // fetchTx(lastSignature);
}

export default function ReceiveScreen() {
  const { selectedAccount } = useAuthorization();
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [waitTxModalVisible, setWaitTxModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("SOL");
  const [menuVisible, setMenuVisible] = useState(false);
  const [receivedModal, setReceivedModal] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedToken, setReceivedToken] = useState("SOL");
  const [sender, setSender] = useState("");
  const [txHash, setTxHash] = useState("");

  const { connection } = useConnection();
  
  

  if (!selectedAccount) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.label}>Please Conneect Your Wallet</Text>
      </View>
    );
  }

  const tokens = [
    { label: "SOL", value: "SOL", icon: require("../../assets/sol-icon.png") },
    {
      label: "USDC",
      value: "USDC",
      icon: require("../../assets/usdc-icon.png"),
    },
  ];

  useFocusEffect(
    useCallback(() => {
      return () => {
        // Turn off HCE and clean up NFC resources when the screen is not active
        const disableHCE = async () => {
          try {
            const session = await HCESession.getInstance();
            await session.setEnabled(false);
            console.log("HCE disabled");
          } catch (error) {
            console.error("Failed to disable HCE:", error);
          }
        };
  
        disableHCE();
      };
    }, [])
  );

  const handleRequest = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid amount.");
      return;
    }

    const requestData = {
      token: selectedToken,
      amount: Number(amount),
      address: selectedAccount?.publicKey,
    };

    try {
      await startHCE(
        JSON.stringify(requestData), 
        () => {
          setRequestModalVisible(false);
          setWaitTxModalVisible(true);
          txPolling(
            connection, 
            selectedAccount?.publicKey, 
            setWaitTxModalVisible,
            setReceivedModal,
            setReceivedAmount,
            setReceivedToken,
            setSender,
            setTxHash
          );
        }
      );
      // await txPolling(connection, selectedAccount?.publicKey);
      setRequestModalVisible(true);
    } catch (error) {
      Alert.alert("Error", "Failed to start NFC emulation.");
      console.error(error);
    }
  };

  return (
    <>
      <View style={styles.screenContainer}>
        <Text style={styles.label}>Enter Amount and Select Token:</Text>
        <View style={styles.rowContainer}>
          <TextInput
            style={[styles.input, styles.flexInput]}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter amount"
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <TouchableOpacity
                style={[styles.pickerButton, styles.flexPicker]}
                onPress={() => setMenuVisible(true)}
              >
                <Image
                  source={
                    tokens.find((token) => token.value === selectedToken)?.icon
                  }
                  style={styles.tokenIcon}
                />
                <Text>{selectedToken}</Text>
              </TouchableOpacity>
            }
          >
            {tokens.map((token) => (
              <Menu.Item
                key={token.value}
                onPress={() => {
                  setSelectedToken(token.value);
                  setMenuVisible(false);
                }}
                title={
                  <View style={styles.menuItem}>
                    <Image source={token.icon} style={styles.tokenIcon} />
                    <Text>{token.label}</Text>
                  </View>
                }
              />
            ))}
          </Menu>
        </View>
        <Button mode="contained" onPress={handleRequest} style={styles.button}>
          Request
        </Button>
      </View>
      <BottomAppModal
        title={`Request ${selectedToken}`}
        hide={() => setRequestModalVisible(false)}
        show={requestModalVisible}
      >
        <View style={{ padding: 20 }}>
          <Text style={styles.bottomModalText}>Tap your phone with another device to send {amount} {selectedToken}.</Text>
        </View>
      </BottomAppModal>
      <BottomAppModal
        title={`Waiting Transaction`}
        hide={() => setWaitTxModalVisible(false)}
        show={waitTxModalVisible}
      >
        <View style={{ padding: 10 }}>
          <ActivityIndicator size="large" animating={true} />
        </View>
      </BottomAppModal>
      <BottomAppModal
        title={`Transaction Success`}
        hide={() => setReceivedModal(false)}
        show={receivedModal}
        submit={async () => {
          if (txHash) {
            const solscanUrl = `https://solscan.io/tx/${txHash}?cluster=devnet`;
            Linking.openURL(solscanUrl); // Open the transaction URL in the browser
          }
        }}
        submitLabel="View on explorer"
      >
        <View style={{ padding: 20 }}>
          <Text style={styles.bottomModalText}>
            You received {" "}
            <Text style={{ fontWeight: "bold" }}>{receivedAmount} {receivedToken}</Text>
            {" "} from {" "}
            <Text style={{ fontWeight: "bold" }}>{sender}</Text>
          </Text>
        </View>
      </BottomAppModal>
    </>
  );
}

const styles = StyleSheet.create({
  bottomModalText: {
    fontSize: 14,
    textAlign: "center",
  },
  screenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  flexInput: {
    flex: 2,
    marginRight: 8,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
  },
  flexPicker: {
    flex: 1,
  },
  tokenIcon: {
    width: 20,
    height: 20,
    marginRight: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    marginTop: 16,
  },
});
