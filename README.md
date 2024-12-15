# MantleGPT 🤖

Your AI-Powered Mantle Wallet, Right in Telegram

## Overview

MantleGPT is an intelligent Telegram bot that combines the power of AI with blockchain technology to provide a seamless wallet experience on the Mantle Network. Using natural language processing, users can perform crypto transactions, check balances, and manage their wallet through simple conversations.

### Key Features

- 🧠 Natural Language Understanding
  - Send transactions using everyday language
  - Check balances conversationally in many different languages
  - Get information about Mantle Network

- 💰 Token Support
  - Native MNT token
  - USDT on Mantle
  - Real-time balance checking

- 🔐 Secure Wallet Management
  - Create new wallets
  - Connect existing wallets
  - Encrypted private key storage
  - Auto-delete sensitive messages

- 💬 User Experience
  - Custom keyboard interface
  - Transaction confirmations
  - Clear error messages
  - Network status updates

## Installation

### Prerequisites

- Node.js v16 or higher
- npm (Node Package Manager)
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- OpenAI API Key
- Access to Mantle Network

### Setup Steps

1. Clone the Repository

    ```bash
    git clone <your-repo-url>
    cd mantlegpt
    ```

2. Install Dependencies

    ```bash
    npm install
    ```

3. Environment Configuration

    ```env
    BOT_TOKEN=your_telegram_bot_token
    MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
    ENCRYPTION_KEY=your_32_byte_hex_encryption_key
    OPENAI_API_KEY=your_openai_api_key
    USDT_ADDRESS=your_deployed_usdt_contract_address
    ```

4. Start the Bot

    ```bash
    # Development mode with auto-reload
    npm run dev

    # Production mode
    npm start
    ```

## Usage Guide

### Basic Commands

- `/start` - Initialize the bot
- `/create` - Create a new wallet
- `/connect` - Connect existing wallet
- `/balance` - Check wallet balance
- `/help` - Show all commands

### Natural Language Examples

- "Check my balance"
- "Send 5 MNT to 0x..."
- "Transfer 10 USDT to 0x..."
- "What's my wallet address?"
- "Tell me about Mantle Network"

## Project Structure

    ```plaintext
    mantlegpt/
    ├── src/
    │   ├── bot.js          # Main bot logic & command handlers
    │   ├── wallet.js       # Wallet management & transactions
    │   └── nlp.js          # Natural language processing
    ├── package.json
    └── .env
    ```

## Security Features

- Private keys are encrypted using AES-256-CBC
- No plain text storage of sensitive data
- Automatic deletion of messages containing private keys
- Transaction confirmation system
- Session timeouts for pending transactions

## Acknowledgments

- Built on [Mantle Network](https://mantle.xyz)
- Powered by OpenAI's GPT 4o
- Uses [Telegraf](https://github.com/telegraf/telegraf) for Telegram Bot API
- Uses [ethers.js](https://docs.ethers.org/v6/) for blockchain interactions

## Support

For support, please open an issue in the repository or contact me. 