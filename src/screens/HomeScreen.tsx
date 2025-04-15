import React, { useEffect, useState } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { Text, Button, TextInput, useTheme } from "react-native-paper";
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

import { useAuthorization } from "../utils/useAuthorization";
import { AccountDetailFeature } from "../components/account/account-detail-feature";
import { SignInFeature } from "../components/sign-in/sign-in-feature";
import { AppModal } from "../components/ui/app-modal";

import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import {
  useGetBalance,
  useGetTokenAccountBalance,
  useGetTokenAccounts,
  useRequestAirdrop,
  useTransferSol,
} from "../components/account/account-data-access";

export function HomeScreen() {
  
  const { selectedAccount } = useAuthorization();
  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [showTransferSolModal, setShowTransferSolModal] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("");
  const theme = useTheme();

  // Initialize NFC Manager
  useEffect(() => {
    const initNfc = async () => {
      try {
        await NfcManager.start();
        const isEnabled = await NfcManager.isEnabled();
        setNfcEnabled(isEnabled);
      } catch (error) {
        console.error("Failed to initialize NFC:", error);
      }
    };

    initNfc();

    return () => {
      NfcManager.close();
    };
  }, []);

  // Start NFC Scanning
  const startScanning = async () => {
    try {
      await NfcManager.start();
      await NfcManager.requestTechnology(NfcTech.IsoDep);
      const tag = await NfcManager.getTag();
      console.log('Got tag:', tag);
  
      // Select APP
      let response = await NfcManager.transceive([0x00, 0xA4, 0x04, 0x00, 0x07, 0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01, 0x00]);
      // if (JSON.stringify(response) !== JSON.stringify([0x90, 0x00])) {
      //   Alert.alert("Error", "Failed to communicate with NFC tag (APP)");
      //   return;
      // }
      // Select File
      response = await NfcManager.transceive([0x00, 0xA4, 0x00, 0x0C, 0x02, 0xE1, 0x04]);
      if (JSON.stringify(response) !== JSON.stringify([0x90, 0x00])) {
        Alert.alert("Error", "Failed to communicate with NFC tag (File)");
        return;
      }
      // Read File
      response = await NfcManager.transceive([0x00, 0xB0, 0x00, 0x00, 0xFF]);
      // Parse response string from { (7B)
      const startIndex = response.indexOf(0x7B);
      const endIndex = response.indexOf(0x7D);
      const jsonString = response.slice(startIndex, endIndex + 1);
      const jsonStringParsed = String.fromCharCode.apply(null, jsonString);
      // Alert.alert("Success", `NFC Tag Data: ${jsonStringParsed}`);
      const jsonData = JSON.parse(jsonStringParsed);
      const { token, amount, address } = jsonData;
      if (token !== "SOL") {
        Alert.alert("Error", "Invalid token type. Only SOL is supported.");
        return;
      }
      if (!address || !amount) {
        Alert.alert("Error", "Invalid address or amount.");
        return;
      }
      setDestinationAddress(address);
      setAmount(amount);
      setShowTransferSolModal(true);
    } catch (ex) {
      console.warn('NFC read error', ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }
  };

  return (
    <>
      <View style={styles.screenContainer}>
        <Text
          style={{ fontWeight: "bold", marginBottom: 12 }}
          variant="displaySmall"
        >
          Solana Tap
        </Text>
        {selectedAccount ? (
          <AccountDetailFeature />
        ) : (
          <>
            <SignInFeature />
          </>
        )}
        {nfcEnabled ? (
          <Button mode="contained" onPress={startScanning}>
            Start NFC Scan
          </Button>
        ) : (
          <Text style={{ marginTop: 16, color: "red" }}>
            NFC is not enabled on this device.
          </Text>
        )}
      </View>
      {
        selectedAccount ? (
          <SolConfirmationModal
            hide={() => setShowTransferSolModal(false)}
            show={showTransferSolModal}
            srcAddr={selectedAccount.publicKey}
            destAddr = {destinationAddress}
            amount={amount}
          />
        ) : null
      }
  </>
  );
}

export function SolConfirmationModal ({
  hide,
  show,
  srcAddr,
  destAddr,
  amount
}: {
  hide: () => void;
  show: boolean;
  srcAddr: PublicKey;
  destAddr: string;
  amount: string;
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
          Are you sure you want to send {amount} SOL to {destAddr}?
        </Text>
      </View>
    </AppModal>
  )

}

const styles = StyleSheet.create({
  screenContainer: {
    padding: 16,
    flex: 1,
  },
  buttonGroup: {
    flexDirection: "column",
    paddingVertical: 4,
  },
});