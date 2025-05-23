import React, { useEffect, useState } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { Text, Button, TextInput, useTheme } from "react-native-paper";
import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

import { useAuthorization } from "../utils/useAuthorization";
import { AccountDetailFeature } from "../components/account/account-detail-feature";
import { SignInFeature } from "../components/sign-in/sign-in-feature";

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
      </View>
  </>
  );
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