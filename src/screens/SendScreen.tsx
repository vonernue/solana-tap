import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { Text, useTheme } from "react-native-paper";
import NfcManager, { NfcTech } from "react-native-nfc-manager";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native"; // Import useFocusEffect

import { useAuthorization } from "../utils/useAuthorization";
import { AppModal } from "../components/ui/app-modal";
import { PublicKey } from "@solana/web3.js";

import { useTransferSol } from "../components/account/account-data-access";

export function SendScreen() {
  const { selectedAccount } = useAuthorization();
  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [showTransferSolModal, setShowTransferSolModal] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("SOL");
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
        const { token, amount, address } = jsonData;
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
        setShowTransferSolModal(true);
        break; // Exit the loop after successfully reading a tag
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
        />
      ) : null}
    </>
  );
}

export function SolConfirmationModal ({
  hide,
  show,
  srcAddr,
  destAddr,
  amount,
  token
}: {
  hide: () => void;
  show: boolean;
  srcAddr: PublicKey;
  destAddr: string;
  amount: string;
  token: string;
})  {
  const transferSol = useTransferSol({ address: srcAddr });

  return (
    <AppModal
      title="Send SOL"
      hide={hide}
      show={show}
      submit={() => {
        if (transferSol) {
          transferSol
            .mutateAsync({
              destination: new PublicKey(destAddr),
              amount: parseFloat(amount),
            })
            .then(() => hide);
        } else {
          Alert.alert("Error", "Transfer functionality is not available.");
        }
      }}
      submitLabel="Send"
      submitDisabled={!srcAddr || !amount}
    >
      <View style={{ padding: 20 }}>
        <Text>
          Are you sure you want to send {amount} {token} to {destAddr}?
        </Text>
      </View>
    </AppModal>
  )

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