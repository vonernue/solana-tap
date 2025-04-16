import React, { useState } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, Image } from "react-native";
import { Text, Button, TextInput, Menu } from "react-native-paper";
import { useAuthorization } from "../utils/useAuthorization";
import { AppModal } from "../components/ui/app-modal";
import {
  HCESession,
  HCESessionContext,
  NFCTagType4NDEFContentType,
  NFCTagType4,
} from "react-native-hce";

async function startHCE(message: string, modalOpen: () => void) {
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
    session.on(HCESession.Events.HCE_STATE_READ, () => {
      modalOpen();
    });
  } catch (error) {
    console.error("Error starting HCE:", error);
    throw error;
  }
}

export default function ReceiveScreen() {
  const { selectedAccount } = useAuthorization();
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [waitTxModalVisible, setWaitTxModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("SOL");
  const [menuVisible, setMenuVisible] = useState(false);

  const tokens = [
    { label: "SOL", value: "SOL", icon: require("../../assets/sol-icon.png") },
    {
      label: "USDC",
      value: "USDC",
      icon: require("../../assets/usdc-icon.png"),
    },
  ];

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
    console.log("Request data:", JSON.stringify(requestData));
    try {
      await startHCE(JSON.stringify(requestData), () => {
        setWaitTxModalVisible(true);
      });
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
      <AppModal
        title={`Request ${amount} ${selectedToken}`}
        hide={() => setRequestModalVisible(false)}
        show={requestModalVisible}
      >
        <View style={{ padding: 20 }}>
          <Text>Tap your phone with another device to send {amount} {selectedToken}.</Text>
        </View>
      </AppModal>
      <AppModal
        title={`Waiting Transaction...`}
        hide={() => setWaitTxModalVisible(false)}
        show={waitTxModalVisible}
      >
        <View style={{ padding: 20 }}>
          <Text>Waiting for transaction to be completed...</Text>
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
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
