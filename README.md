# Wormhole Bridge Test

This project demonstrates how to bridge tokens from **Solana (Testnet)** to **Ethereum Sepolia** using the Wormhole SDK. It includes scripts for attesting a token (registering it on the destination chain) and transferring tokens.

## File Structure

```
bridge-test/
├── .env                # Environment variables (Private Keys)
├── .env.example        # Example environment file
├── package.json        # Dependencies and scripts
├── lib/
│   ├── attest.ts       # Script to attest/register the token on Sepolia
│   └── helper.ts       # Helper functions for signing and wallet management
└── src/
    └── transfer.ts     # Main script to transfer tokens from Solana to Sepolia
```

## Prerequisites

- Node.js (v16+ recommended)
- Solana Wallet with SOL (Testnet) and the SPL Token to bridge
- Ethereum Wallet with Sepolia ETH (for gas fees)

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd bridge-test
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your private keys:
   ```env
   SOLANA_PRIVATE_KEY="[...]"  # Array format or Base58 string
   EVM_PRIVATE_KEY="0x..."     # Your Ethereum Private Key
   ```

## Usage

### 1. Attest the Token
Before transferring a token for the first time, it must be attested (registered) on the destination chain (Sepolia).

```bash
npx tsx lib/attest.ts
```
*This script checks if the token is already wrapped on Sepolia. If not, it creates an attestation on Solana, fetches the VAA, and submits it to Sepolia.*

### 2. Transfer Tokens
Once the token is attested, you can transfer it from Solana to Sepolia.

```bash
npx tsx src/transfer.ts
```
*This script initiates the transfer on Solana, waits for the VAA, and completes the transfer on Sepolia.*

## Troubleshooting

- **VAA Reverted / Transfer Failed:** Ensure the token is correctly attested on the destination chain before transferring.
- **Insufficient Funds:** Ensure you have enough SOL on Solana and ETH on Sepolia to pay for gas fees.
- **Token Mismatch:** Verify that the `tokenMint` address in `lib/attest.ts` and `src/transfer.ts` matches the token you hold in your wallet.
