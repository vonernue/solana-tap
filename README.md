# Solana Tap

A mobile application that enables seamless NFC-based Solana token transfers and distribution. Built with React Native, this app allows users to send and receive SOL and USDC tokens through simple NFC taps between devices.

## Features

- **NFC-Based Transfers**: Send and receive SOL and USDC tokens through NFC taps
- **Dual Transfer Modes**:
  - Direct wallet-to-wallet transfers
  - Distribution program transfers for splitting tokens among multiple recipients
- **Token Support**:
  - SOL (Solana)
  - USDC (USD Coin)
- **Real-time Transaction Monitoring**: Track transaction status and view on Solana Explorer
- **USD Value Estimation**: See estimated USD value of transfers in real-time
- **Distribution Program Integration**: Built-in support for the Solana Distribution Program


## Smart Contract

The project includes a Solana program for token distribution. The program allows:
- Initialization of distribution configurations
- Updating recipient lists and percentages
- Distributing SOL and SPL tokens according to configured percentages

### Program Features
- Maximum of 10 recipients per distribution
- Percentage-based distribution (total must not exceed 100%)
- Support for both SOL and SPL token distributions
- PDA-based configuration storage

## Usage

### Sending Tokens
1. Open the Send screen
2. Tap your device with another device running Solana Tap
3. Confirm the transfer details
4. Approve the transaction

### Receiving Tokens
1. Open the Receive screen
2. Enter the amount and select the token
3. Tap your device with the sender's device
4. Wait for the transaction confirmation

### Distribution Program
1. Configure distribution settings in the app
2. Select recipients and their percentages
3. Use the distribution program mode for sending tokens
4. Tokens will be automatically distributed according to the configuration

## Development

### Project Structure
```
solana-tap/
├── contracts/           # Solana program contracts
├── src/
│   ├── components/     # React components
│   ├── screens/        # App screens
│   └── utils/          # Utility functions
└── assets/            # Static assets
```

### Building the Smart Contract
```bash
cd contracts/distribution
anchor build
```

## Acknowledgments

- Solana Foundation
- Anchor Framework
- React Native NFC Manager
- React Native HCE
