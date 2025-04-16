import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { Text, Button, TextInput, Menu } from "react-native-paper"; 

export default function ReceiveScreen() {
    const [amount, setAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState('SOL');
    const [menuVisible, setMenuVisible] = useState(false);

    const tokens = [
        { label: 'SOL', value: 'SOL', icon: require('../../assets/sol-icon.png') },
        { label: 'USDC', value: 'USDC', icon: require('../../assets/usdc-icon.png') },
    ];

    const handleRequest = () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert('Invalid Input', 'Please enter a valid amount.');
            return;
        }

        Alert.alert('Request Sent', `Requesting ${amount} ${selectedToken}`);
    };

    return (
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
                                source={tokens.find((token) => token.value === selectedToken)?.icon}
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
    );
}

const styles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    label: {
        fontSize: 16,
        marginBottom: 8,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        paddingHorizontal: 8,
    },
    flexInput: {
        flex: 2,
        marginRight: 8,
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderWidth: 1,
        borderColor: '#ccc',
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
        flexDirection: 'row',
        alignItems: 'center',
    },
    button: {
        marginTop: 16,
    }
});