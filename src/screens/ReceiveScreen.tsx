import React, { useState, useContext } from 'react';
import { useAuthorization } from "../utils/useAuthorization";
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { HCESession, HCESessionContext, NFCTagType4NDEFContentType, NFCTagType4 } from 'react-native-hce';

async function startHCE(message: string){
    try {
        const tag = new NFCTagType4({
            type: NFCTagType4NDEFContentType.Text,
            content: message,
            writable: false,
        });

        let session = await HCESession.getInstance();
        console.log('HCESession instance created:', session);

        await session.setApplication(tag);
        console.log('Application set on tag:', tag);

        await session.setEnabled(true);
        console.log('HCE session enabled');
    } catch (error) {
        console.error('Error starting HCE:', error);
        throw error;
    }
}

export default function ReceiveScreen () {
    const { selectedAccount } = useAuthorization();
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
            await startHCE(JSON.stringify(requestData));
            Alert.alert('Request Started', JSON.stringify(requestData));
        } catch (error) {
            Alert.alert('Error', 'Failed to start NFC emulation.');
            console.error(error);
        }
    };

    return (
        
        <View style={styles.container}>
            <Text style={styles.label}>Enter Amount to Request (SOL):</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="Enter amount"
            />
            <Button title="Request SOL" onPress={handleRequest} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    label: {
        fontSize: 16,
        marginBottom: 8,
    },
    input: {
        width: '100%',
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 8,
        marginBottom: 16,
        backgroundColor: '#fff',
    },
});