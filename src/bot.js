const { Telegraf } = require('telegraf');
const { Web3 } = require('web3');
const dotenv = require('dotenv');
const WalletManager = require('./wallet');
const NLPHandler = require('./nlp');

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const web3 = new Web3(process.env.MANTLE_RPC_URL);
const walletManager = new WalletManager();
const nlpHandler = new NLPHandler();

// Simple in-memory store for pending transactions
const pendingTransactions = new Map();

// Track users waiting to input private key
const awaitingPrivateKey = new Set();

// Custom keyboard markup
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['💰 Check Balance', '📤 Transfer MNT'],
            ['🔑 My Address', 'ℹ️ About Mantle'],
            ['💼 Create Wallet', '🔗 Connect Wallet']
        ],
        resize_keyboard: true
    }
};

// Start command
bot.command('start', async (ctx) => {
    try {
        await ctx.reply(
            'Welcome to MantleGPT - an AI powered Wallet Bot for the Mantle Network! 🤖\n\n' +
            'I can help you manage your Mantle wallet using natural language.\n\n' +
            'Use the options below or type naturally!',
            mainKeyboard
        );
    } catch (error) {
        console.error('Start command error:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// Create wallet command
bot.command('create', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const address = await walletManager.createWallet(userId);
        await ctx.reply(
            `✅ Wallet created successfully!\n\n` +
            `Your wallet address: \`${address}\`\n\n` +
            `Keep your wallet details safe!`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Create wallet error:', error);
        ctx.reply('Sorry, there was an error creating your wallet.');
    }
});

// Connect wallet command
bot.command('connect', async (ctx) => {
    try {
        const userId = ctx.from.id;
        awaitingPrivateKey.add(userId);
        await ctx.reply(
            'Please send me your private key to connect your existing wallet.\n' +
            '⚠️ Warning: Never share your private key with anyone else!'
        );
    } catch (error) {
        console.error('Connect command error:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// Helper function to handle no wallet scenario
const handleNoWallet = async (ctx) => {
    await ctx.reply(
        "❌ No wallet found!\n\n" +
        "Would you like to:\n" +
        "1️⃣ Create a new wallet with /create\n" +
        "2️⃣ Connect existing wallet with /connect\n\n" +
        "Or use the buttons below 👇",
        mainKeyboard
    );
};

// Balance command
bot.command('balance', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const balance = await walletManager.getBalance(userId);
        await ctx.reply(
            `💰 Your wallet balance: ${balance} MNT`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Balance check error:', error);
        if (error.message === 'NO_WALLET') {
            await handleNoWallet(ctx);
        } else {
            ctx.reply('Sorry, there was an error checking your balance.');
        }
    }
});

// Transfer command
bot.command('transfer', async (ctx) => {
    await ctx.reply(
        '💸 How to Transfer MNT:\n\n' +
        'You can simply type:\n' +
        '• "Send 5 MNT to 0x123..."\n' +
        '• "Transfer 1.5 MNT to 0x456..."\n' +
        '• "Pay 0.1 MNT to 0x789..."\n\n' +
        '⚠️ Important:\n' +
        '• Always verify the recipient address\n' +
        '• Keep some MNT for gas fees\n' +
        '• You can cancel before confirming\n',
        mainKeyboard
    );
});

// Help command
bot.command('help', async (ctx) => {
    await ctx.reply(
        '🔹 Available Commands:\n\n' +
        '/create - Create a new wallet\n' +
        '/connect - Connect existing wallet\n' +
        '/balance - Check wallet balance\n' +
        '/transfer - Send MNT to another address\n' +
        '/help - Show this help message\n\n' +
        '🔸 Natural Language Commands:\n\n' +
        '• "Check my balance"\n' +
        '• "Send 0.1 MNT to 0x123..."\n' +
        '• "Transfer 1 MNT to 0x456..."\n' +
        '• "Pay 5 MNT to 0x789..."\n' +
        '• "What is my wallet address?"\n' +
        '• "Show me my address"\n\n' +
        '💡 Transfer Tips:\n' +
        '• Always double-check the recipient address\n' +
        '• Remember to account for gas fees\n' +
        '• You can cancel any transfer before confirming'
    );
});

// Handle natural language messages
bot.on('text', async (ctx) => {
    try {
        // Skip if message is a command
        if (ctx.message.text.startsWith('/')) return;

        const userId = ctx.from.id;

        // Handle confirmation/cancel commands before NLP
        if (['confirm', 'cancel'].includes(ctx.message.text.toLowerCase())) {
            const pendingTx = pendingTransactions.get(userId);
            if (pendingTx) {
                if (ctx.message.text.toLowerCase() === 'cancel') {
                    pendingTransactions.delete(userId);
                    await ctx.reply('Transaction cancelled.');
                    return;
                }

                // Proceed with the transaction
                await ctx.reply('Processing transaction...');
                
                try {
                    let txHash;
                    if (pendingTx.token === 'USDT') {
                        txHash = await walletManager.sendUSDTTransaction(
                            userId,
                            pendingTx.to,
                            pendingTx.amount
                        );
                    } else {
                        txHash = await walletManager.sendTransaction(
                            userId,
                            pendingTx.to,
                            pendingTx.amount
                        );
                    }

                    // Clear pending transaction
                    pendingTransactions.delete(userId);

                    // Send success message with transaction hash
                    await ctx.reply(
                        `✅ Transaction successful!\n\n` +
                        `Amount: ${pendingTx.amount} ${pendingTx.token}\n` +
                        `To: ${pendingTx.to}\n` +
                        `Transaction Hash: \`${txHash}\`\n\n` +
                        `View on Explorer: https://explorer.sepolia.mantle.xyz/tx/${txHash}`,
                        { parse_mode: 'Markdown' }
                    );
                    return;
                } catch (error) {
                    console.error('Transaction confirmation error:', error);
                    if (error.message === 'NO_WALLET') {
                        await handleNoWallet(ctx);
                    } else {
                        await ctx.reply(
                            '❌ Transaction failed:\n' +
                            error.message
                        );
                    }
                    pendingTransactions.delete(userId);
                    return;
                }
            }
            await ctx.reply('No pending transaction to confirm.');
            return;
        }

        // Check if user is waiting to input private key
        if (awaitingPrivateKey.has(userId)) {
            try {
                const address = await walletManager.connectWallet(userId, ctx.message.text);
                awaitingPrivateKey.delete(userId);
                await ctx.reply(
                    `✅ Wallet connected successfully!\n\n` +
                    `Your wallet address: \`${address}\``,
                    { parse_mode: 'Markdown' }
                );
                // Delete message containing private key for security
                await ctx.deleteMessage(ctx.message.message_id);
                return;
            } catch (error) {
                awaitingPrivateKey.delete(userId);
                await ctx.reply('❌ Invalid private key. Please try again with /connect');
                return;
            }
        }

        const result = await nlpHandler.parseMessage(ctx.message.text);

        if (result.intent === 'TRANSFER') {
            if (!result.amount || !result.to) {
                await ctx.reply(
                    'I couldn\'t understand the transfer details.\n' +
                    'Please specify the amount and recipient address clearly.\n' +
                    'Example: "Send 0.1 MNT to 0x123..."'
                );
                return;
            }

            // Store pending transaction
            pendingTransactions.set(ctx.from.id, {
                amount: parseFloat(result.amount),
                to: result.to,
                token: result.token,
                timestamp: Date.now()
            });

            // Confirm transaction with user
            const amount = parseFloat(result.amount);
            if (isNaN(amount)) {
                await ctx.reply(
                    'Invalid amount format. Please specify a valid number.\n' +
                    'Example: "Send 0.1 MNT to 0x..." or "Send 5 USDT to 0x..."'
                );
                return;
            }

            await ctx.reply(
                `🔄 Confirm Transaction:\n\n` +
                `Amount: ${amount.toFixed(4)} ${result.token}\n` +
                `To: ${result.to}\n\n` +
                `Reply with 'confirm' to proceed or 'cancel' to cancel.`
            );
            // Handle confirmation in another message handler

        } else if (result.intent === "CHECK_BALANCE") {
            try {
                const balance = await walletManager.getBalance(userId);
                await ctx.reply(
                    `💰 Your wallet balances:\n\n` +
                    `• ${Number(balance.mnt).toFixed(4)} MNT\n` +
                    `• ${Number(balance.usdt).toFixed(4)} USDT`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                if (error.message === 'NO_WALLET') {
                    await ctx.reply(
                        "❌ No wallet found. Use /create to create a new wallet or /connect to connect an existing one."
                    );
                } else {
                    console.error('Balance error:', error);
                    await ctx.reply('Sorry, there was an error checking your balance.');
                }
            }
            return;

        } else if (result.intent === "GET_ADDRESS") {
            const wallet = walletManager.getUserWallet(userId);
            if (wallet) {
                await ctx.reply(
                    `🔑 Your wallet address is:\n` +
                    `\`${wallet.address}\``,
                    { parse_mode: 'Markdown' }
                );
            } else {
                await ctx.reply(
                    "❌ No wallet found. Use /create to create a new wallet or /connect to connect an existing one."
                );
            }
            return;

        } else if (result.intent === "INFO") {
            await ctx.reply(
                result.info,
                { parse_mode: 'Markdown' }
            );
            return;

        } else if (result.intent === "CONNECT") {
            const userId = ctx.from.id;
            awaitingPrivateKey.add(userId);
            await ctx.reply(
                'Please send me your private key to connect your existing wallet.\n' +
                '⚠️ Warning: Never share your private key with anyone else!'
            );
            return;

        } else if (result.intent === "CREATE") {
            try {
                const userId = ctx.from.id;
                const address = await walletManager.createWallet(userId);
                await ctx.reply(
                    `✅ Wallet created successfully!\n\n` +
                    `Your wallet address: \`${address}\`\n\n` +
                    `Keep your wallet details safe!`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                console.error('Create wallet error:', error);
                ctx.reply('Sorry, there was an error creating your wallet.');
            }
            return;

        } else {
            await ctx.reply(
                "I'm not sure what you want to do.\n" +
                "Try using specific commands or check /help for examples."
            );
        }
    } catch (error) {
        console.error('Message handling error:', error);
        ctx.reply('Sorry, I could not process your request.');
    }
});

// Clean up expired pending transactions periodically
setInterval(() => {
    const now = Date.now();
    for (const [userId, tx] of pendingTransactions.entries()) {
        if (now - tx.timestamp > 5 * 60 * 1000) {
            pendingTransactions.delete(userId);
        }
    }
}, 60 * 1000); // Run every minute

// Error handling
bot.catch((err, ctx) => {
    console.error(`Bot error: ${err}`);
    ctx.reply('An error occurred while processing your request.');
});

// Start bot
bot.launch().then(() => {
    console.log('Bot is running...');
}).catch((error) => {
    console.error('Failed to start bot:', error);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Handle keyboard button presses
bot.hears('💰 Check Balance', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const balance = await walletManager.getBalance(userId);
        await ctx.reply(
            `💰 Your wallet balances:\n\n` +
            `• ${Number(balance.mnt).toFixed(4)} MNT\n` +
            `• ${Number(balance.usdt).toFixed(4)} USDT`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        if (error.message === 'NO_WALLET') {
            await handleNoWallet(ctx);
        } else {
            console.error('Balance error:', error);
            await ctx.reply('Sorry, there was an error checking your balance.');
        }
    }
});

bot.hears('📤 Transfer MNT', async (ctx) => {
    // First check if user has a wallet
    const userId = ctx.from.id;
    const wallet = walletManager.getUserWallet(userId);
    
    if (!wallet) {
        await handleNoWallet(ctx);
        return;
    }

    await ctx.reply(
        '💸 How to Transfer MNT:\n\n' +
        'Type your transfer like this:\n' +
        '• "Send 5 MNT to 0x123..."\n' +
        '• "Transfer 1.5 MNT to 0x456..."\n' +
        '• "Pay 0.1 MNT to 0x789..."\n\n' +
        '⚠️ Important:\n' +
        '• Always verify the recipient address\n' +
        '• Keep some MNT for gas fees\n' +
        '• You can cancel before confirming'
    );
});

bot.hears('🔑 My Address', async (ctx) => {
    const userId = ctx.from.id;
    const wallet = walletManager.getUserWallet(userId);
    if (wallet) {
        await ctx.reply(
            `🔑 Your wallet address is:\n` +
            `\`${wallet.address}\``,
            { parse_mode: 'Markdown' }
        );
    } else {
        await ctx.reply(
            "❌ No wallet found. Use /create to create a new wallet or /connect to connect an existing one."
        );
    }
});

bot.hears('💼 Create Wallet', async (ctx) => {
    ctx.message.text = "create a new wallet";
    await handleMessage(ctx);
});

bot.hears('🔗 Connect Wallet', async (ctx) => {
    try {
        const userId = ctx.from.id;
        awaitingPrivateKey.add(userId);
        await ctx.reply(
            'Please send me your private key to connect your existing wallet.\n' +
            '⚠️ Warning: Never share your private key with anyone else!'
        );
    } catch (error) {
        console.error('Connect command error:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

bot.hears('ℹ️ About Mantle', async (ctx) => {
    ctx.message.text = "Tell me about Mantle Network";
    await handleMessage(ctx);
}); 