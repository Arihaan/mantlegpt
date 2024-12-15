const natural = require('natural');
const OpenAI = require('openai');
const tokenizer = new natural.WordTokenizer();

class NLPHandler {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async parseMessage(text) {
        try {
            console.log(text);
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are a Mantle crypto wallet assistant that helps parse user intents and answer questions about Mantle. 
                            For transactions, extract:
                            - Intent (must be exactly one of: "TRANSFER", "CHECK_BALANCE", "GET_ADDRESS", "INFO", "CONNECT", "CREATE", or "UNKNOWN")
                            - amount (must be a number only, e.g., "1" not "1 USDT")
                            - token (must be exactly "MNT" or "USDT")
                            - to (address)
                            Return JSON only with these exact keys: { "Intent", "amount", "token", "to", "info" }`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(completion.choices[0].message.content);
            console.log('NLP Result:', result);
            console.log('Parsed Intent:', result.Intent);
            
            // Clean up amount if it includes token name
            let cleanAmount = result.amount;
            if (typeof cleanAmount === 'string') {
                cleanAmount = cleanAmount.replace(/\s*(?:MNT|USDT)\s*/gi, '');
                cleanAmount = parseFloat(cleanAmount);
            }

            return {
                intent: result.Intent || 'UNKNOWN',
                amount: cleanAmount,
                token: result.token || 'MNT',
                to: result.to,
                info: result.info
            };
        } catch (error) {
            console.error('OpenAI API error:', error);
            // Fallback to basic intent recognition
            return this.basicIntentRecognition(text);
        }
    }

    basicIntentRecognition(text) {
        const tokens = tokenizer.tokenize(text.toLowerCase());
        
        if (tokens.includes('send') || tokens.includes('transfer')) {
            return this.parseTransferIntent(tokens);
        }
        
        if (tokens.includes('connect') || tokens.includes('import') || tokens.includes('link')) {
            return {
                intent: 'CONNECT'
            };
        }
        
        if (tokens.includes('create') || tokens.includes('new') || tokens.includes('generate')) {
            return {
                intent: 'CREATE'
            };
        }
        
        if (tokens.includes('balance') || tokens.includes('check')) {
            return {
                intent: 'CHECK_BALANCE'
            };
        }
        
        if (tokens.includes('address') || tokens.includes('wallet')) {
            return {
                intent: 'GET_ADDRESS'
            };
        }
        
        if (tokens.includes('mantle') || tokens.includes('network') || tokens.includes('chain')) {
            return {
                intent: 'INFO',
                info: 'Mantle is a high-performance Ethereum Layer 2 blockchain. For more specific questions, please ask!'
            };
        }
        
        return { intent: 'UNKNOWN' };
    }

    parseTransferIntent(tokens) {
        // Basic regex for amount and address
        const text = tokens.join(' ').toLowerCase();
        const amountMatch = text.match(/(\d+(?:\.\d+)?)/i);
        const addressMatch = tokens.join(' ').match(/(0x[a-fA-F0-9]{40})/);

        // Debug log
        console.log('NLP amount match:', amountMatch);
        console.log('Full text:', text);
        
        let amount = null;
        let token = 'MNT';  // Default to MNT
        if (amountMatch) {
            amount = parseFloat(amountMatch[1]);
            if (text.includes('usdt')) {
                token = 'USDT';
            } else if (text.includes('mnt')) {
                token = 'MNT';
            }
            if (isNaN(amount)) {
                console.log('Warning: Amount parsed to NaN');
                amount = null;
            }
        }

        // If OpenAI returns amount with token, parse it
        if (typeof result?.amount === 'string' && result.amount.includes('USDT')) {
            token = 'USDT';
            amount = parseFloat(result.amount);
        }

        console.log('Parsed values:', { amount, token });

        return {
            intent: 'TRANSFER',
            amount: amount,
            token: token,
            to: addressMatch ? addressMatch[1] : null
        };
    }
}

module.exports = NLPHandler; 