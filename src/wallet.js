const ethers = require('ethers');
const crypto = require('node:crypto');

class WalletManager {
    constructor() {
        this.userWallets = new Map();
        this.provider = new ethers.JsonRpcProvider(process.env.MANTLE_RPC_URL);
        // USDT contract interface
        this.usdtInterface = new ethers.Interface([
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function transfer(address to, uint256 amount) returns (bool)"
        ]);
        this.usdtContract = new ethers.Contract(
            process.env.USDT_ADDRESS,  // You'll need to add this to .env
            this.usdtInterface,
            this.provider
        );
    }

    async createWallet(userId) {
        const wallet = ethers.Wallet.createRandom();
        const encryptedPrivateKey = this.encryptPrivateKey(wallet.privateKey);
        
        this.userWallets.set(userId, {
            address: wallet.address,
            encryptedPrivateKey
        });

        return wallet.address;
    }

    encryptPrivateKey(privateKey) {
        const algorithm = 'aes-256-cbc';
        const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            iv: iv.toString('hex'),
            encryptedData: encrypted
        };
    }

    decryptPrivateKey(encrypted) {
        const algorithm = 'aes-256-cbc';
        const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        const iv = Buffer.from(encrypted.iv, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    async getBalance(userId) {
        const wallet = this.userWallets.get(userId);
        if (!wallet) throw new Error('NO_WALLET');
        
        // Get both MNT and USDT balances
        const [mntBalance, usdtBalance] = await Promise.all([
            this.provider.getBalance(wallet.address),
            this.usdtContract.balanceOf(wallet.address)
        ]);
        
        return {
            mnt: ethers.formatEther(mntBalance),
            usdt: ethers.formatUnits(usdtBalance, await this.usdtContract.decimals())
        };
    }

    async sendTransaction(userId, toAddress, amount) {
        const wallet = this.userWallets.get(userId);
        if (!wallet) throw new Error('NO_WALLET');

        try {
            // Log current balance
            const balance = await this.provider.getBalance(wallet.address);
            console.log('Current balance:', ethers.formatEther(balance), 'MNT');
            console.log('Attempting to send:', amount, 'MNT');

            const privateKey = this.decryptPrivateKey(wallet.encryptedPrivateKey);
            const signer = new ethers.Wallet(privateKey, this.provider);
            
            // Make sure amount is a string and properly formatted
            const cleanAmount = amount.toString().trim();
            console.log('Sending amount:', cleanAmount);
            const amountWei = ethers.parseEther(cleanAmount);
            console.log('Amount in Wei:', amountWei.toString());
            
            // Check if amount is greater than balance before even trying gas estimation
            if (amountWei > balance) {
                throw new Error(
                    `Insufficient funds for transfer amount. ` +
                    `Trying to send: ${amount} MNT, ` +
                    `Available balance: ${ethers.formatEther(balance)} MNT`
                );
            }

            // Get current gas price first
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice;
            console.log('Gas Price (wei):', gasPrice.toString());

            // Estimate gas
            const gasLimit = await this.provider.estimateGas({
                to: toAddress,
                value: amountWei,
                from: wallet.address  // Add the from address for better estimation
            });
            console.log('Estimated Gas Limit:', gasLimit.toString());
            
            // Calculate total cost (amount + gas)
            const gasCost = gasPrice * gasLimit;
            const totalCost = amountWei + gasCost;
            console.log({
                amountInWei: amountWei.toString(),
                gasCostInWei: gasCost.toString(),
                totalCostInWei: totalCost.toString(),
                balanceInWei: balance.toString()
            });

            // Check if we have enough balance for amount + gas
            if (balance < totalCost) {
                throw new Error(
                    `Insufficient funds for transaction + gas. ` +
                    `Need ${ethers.formatEther(totalCost)} MNT total ` +
                    `(${amount} MNT + ${ethers.formatEther(gasCost)} MNT gas). ` +
                    `Current balance: ${ethers.formatEther(balance)} MNT`
                );
            }
            
            // Send transaction
            const tx = await signer.sendTransaction({
                to: toAddress,
                value: amountWei,
                gasLimit,
                gasPrice
            });
            
            return tx.hash;
        } catch (error) {
            console.error('Transaction error details:', error);
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }

    async connectWallet(userId, privateKey) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            const encryptedPrivateKey = this.encryptPrivateKey(privateKey);
            
            this.userWallets.set(userId, {
                address: wallet.address,
                encryptedPrivateKey
            });
            
            return wallet.address;
        } catch (error) {
            throw new Error('Invalid private key');
        }
    }

    getUserWallet(userId) {
        return this.userWallets.get(userId);
    }

    async sendUSDTTransaction(userId, toAddress, amount) {
        const wallet = this.userWallets.get(userId);
        if (!wallet) throw new Error('NO_WALLET');

        try {
            const privateKey = this.decryptPrivateKey(wallet.encryptedPrivateKey);
            const signer = new ethers.Wallet(privateKey, this.provider);
            
            // Get USDT balance
            const usdtBalance = await this.usdtContract.balanceOf(wallet.address);
            console.log('Current USDT balance:', ethers.formatUnits(usdtBalance, await this.usdtContract.decimals()));
            
            // Convert amount to proper decimals
            const decimals = await this.usdtContract.decimals();
            const amountInSmallestUnit = ethers.parseUnits(amount.toString(), decimals);
            
            // Check if we have enough USDT
            if (usdtBalance < amountInSmallestUnit) {
                throw new Error(
                    `Insufficient USDT balance. ` +
                    `Trying to send: ${amount} USDT, ` +
                    `Available: ${ethers.formatUnits(usdtBalance, decimals)} USDT`
                );
            }
            
            // Create contract instance with signer
            const usdtWithSigner = this.usdtContract.connect(signer);
            
            // Send transaction
            const tx = await usdtWithSigner.transfer(toAddress, amountInSmallestUnit);
            
            return tx.hash;
        } catch (error) {
            console.error('USDT Transaction error details:', error);
            throw new Error(`USDT Transaction failed: ${error.message}`);
        }
    }
}

module.exports = WalletManager; 