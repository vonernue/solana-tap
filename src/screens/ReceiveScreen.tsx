import React, { useState, useContext } from 'react';
import { useAuthorization } from "../utils/useAuthorization";
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, TextInput, useTheme } from "react-native-paper";
import { AppModal } from "../components/ui/app-modal";
import { HCESession, HCESessionContext, NFCTagType4NDEFContentType, NFCTagType4 } from 'react-native-hce';

async function startHCE(message: string, modalOpen: () => void) {
    try {
        const tag = new NFCTagType4({
            type: NFCTagType4NDEFContentType.Text,
            content: message,
            writable: false,
        });

        let session = await HCESession.getInstance();

        await session.setApplication(tag);
        console.log('HCE tag set:', tag);
        await session.setEnabled(true);
        session.on(HCESession.Events.HCE_STATE_READ, () => {
            modalOpen();
        })
    } catch (error) {
        console.error('Error starting HCE:', error);
        throw error;
    }
}

export default function ReceiveScreen () {
    const { selectedAccount } = useAuthorization();
    const [requestModalVisible, setRequestModalVisible] = useState(false);
    const [waitTxModalVisible, setWaitTxModalVisible] = useState(false);
    const [amount, setAmount] = useState('');
    const handleRequest = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert('Invalid Input', 'Please enter a valid amount.');
            return;
        }

        const requestData = {
            token: 'SOL',
            amount: Number(amount),
            address: selectedAccount?.publicKey,
        };

        try {
            await startHCE(JSON.stringify(requestData), () => {
                setWaitTxModalVisible(true);
            }
            );
            setRequestModalVisible(true);
        } catch (error) {
            Alert.alert('Error', 'Failed to start NFC emulation.');
            console.error(error);
        }
    };

    return (
        <>
            <View style={styles.screenContainer}>
                <Text style={styles.label}>Enter Amount to Request (SOL):</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Enter amount"
                />
                <Button mode="contained" onPress={handleRequest} style={styles.button}>
                    Request
                </Button>
            </View>
            <AppModal
                title={`Request ${amount} SOL`}
                hide={() => setRequestModalVisible(false)}
                show={requestModalVisible}
            >
                <View style={{ padding: 20 }}>
                    <Text>
                        Tap your phone with another device to send {amount} SOL.
                    </Text>
                </View>
            </AppModal>
            <AppModal
                title={`Waiting Transaction...`}
                hide={() => setWaitTxModalVisible(false)}
                show={waitTxModalVisible}
            >
                <View style={{ padding: 20 }}>
                    <Text>
                        Waiting for transaction to be completed...
                    </Text>
                </View>
            </AppModal>
        </>
    );
};

const styles = StyleSheet.create({
    label: {
        fontSize: 16,
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 40,
    },
    button: {
        marginTop: 16,
    },
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