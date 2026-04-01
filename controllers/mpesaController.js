const PendingTransaction = require('../models/PendingTransaction');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────
// M-PESA SMS PARSER (mirrors frontend mpesaParser.js)
// ─────────────────────────────────────────────────────────
const parseMpesaMessage = (message) => {
    if (!message) return null;

    const data = {
        amount: 0,
        partner: '',
        date: new Date(),
        type: 'expense',
        title: '',
        paymentMethod: 'M-PESA',
        transactionId: '',
    };

    // Transaction ID (e.g., RJL1234567)
    const txMatch = message.match(/^([A-Z\d]{10,})/);
    if (txMatch) data.transactionId = txMatch[1];

    // Amount
    const amountMatch = message.match(/Ksh\s?([\d,]+\.?\d*)/i);
    if (amountMatch) data.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    // Type & partner
    if (message.toLowerCase().includes('received')) {
        data.type = 'income';
        const partnerMatch = message.match(/from\s+(.+?)\s+on/i) || message.match(/from\s+(.+?)\./i);
        const partner = partnerMatch ? partnerMatch[1].trim() : 'Unknown Source';
        data.partner = partner;
        if (/ziidi|zidi/i.test(partner)) {
            data.type = 'savings-withdrawal';
            data.title = 'Withdrawn from Ziidi';
        } else {
            data.title = `Received from ${partner}`;
        }
    } else if (/paid to|sent to/i.test(message)) {
        const partnerMatch = message.match(/(?:paid|sent)\s+to\s+(.+?)\s+on/i) || message.match(/(?:paid|sent)\s+to\s+(.+?)\./i);
        const partner = partnerMatch ? partnerMatch[1].trim() : 'Unknown recipient';
        data.partner = partner;
        if (/ziidi|zidi/i.test(partner)) {
            data.type = 'savings';
            data.title = 'Saved to Ziidi';
        } else {
            data.type = 'expense';
            data.title = `Paid to ${partner}`;
        }
    } else if (/paid for/i.test(message)) {
        const partnerMatch = message.match(/paid\s+for\s+(.+?)\s+on/i) || message.match(/paid\s+for\s+(.+?)\./i);
        const partner = partnerMatch ? partnerMatch[1].trim() : 'Services';
        data.partner = partner;
        data.type = 'expense';
        data.title = `Payment for ${partner}`;
    } else if (/withdraw|withdrew/i.test(message)) {
        data.type = 'expense';
        const agentMatch = message.match(/at\s+(.+?)\s+on/i);
        data.partner = agentMatch ? agentMatch[1].trim() : 'ATM / Agent';
        data.title = `Withdrawal at ${data.partner}`;
    } else if (/pay your outstanding Fuliza/i.test(message)) {
        data.type = 'debt-payment';
        data.partner = 'Fuliza M-PESA';
        data.title = 'Fuliza Debt Repayment';
    }
    
    // Check if Fuliza was used (debt taken) alongside a regular transaction
    if (/Fuliza M-PESA amount is/i.test(message) || /Fuliza M-PESA Ksh\s+([\d,\.]+)/i.test(message)) {
        // If it was already marked as expense, we change its type to debt-taken
        // so the backend knows to record both the expense AND the Fuliza loan
        if (data.type === 'expense') {
             data.type = 'debt-taken'; 
        }
    }

    // Date
    const dateMatch = message.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dateMatch) {
        const parts = dateMatch[1].split('/');
        if (parts.length === 3) {
            let [day, month, year] = parts;
            if (year.length === 2) year = `20${year}`;
            data.date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        }
    }

    return data;
};

// ─────────────────────────────────────────────────────────
// POST /api/mpesa/sms  (called by SMS Forwarder app)
// Body: { message: "...", token: "..." }  OR header: Authorization
// ─────────────────────────────────────────────────────────
const receiveSmsWebhook = async (req, res) => {
    try {
        // Support token via header OR body (SMS forwarder apps send different formats)
        const authHeader = req.headers['authorization'] || '';
        const bodyToken = req.body?.token || req.body?.secret || '';
        const rawToken = authHeader.replace('Bearer ', '').trim() || bodyToken;

        if (!rawToken) {
            return res.status(401).json({ message: 'No auth token provided.' });
        }

        let userId;
        try {
            const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch {
            return res.status(401).json({ message: 'Invalid or expired token.' });
        }

        // Accept various body formats from different SMS forwarder apps
        const smsText = req.body?.message || req.body?.sms || req.body?.text || req.body?.msg || '';
        const sender = req.body?.from || req.body?.sender || req.body?.address || 'MPESA';

        if (!smsText) {
            return res.status(400).json({ message: 'No SMS message provided.' });
        }

        // Only process M-Pesa messages
        if (!sender.toUpperCase().includes('MPESA') && !smsText.toLowerCase().includes('m-pesa') && !smsText.match(/Ksh/i)) {
            return res.status(200).json({ message: 'Not an M-Pesa message, ignored.' });
        }

        const parsed = parseMpesaMessage(smsText);
        if (!parsed || !parsed.amount) {
            return res.status(200).json({ message: 'Could not parse M-Pesa message.' });
        }

        // Check for duplicate by transactionId
        if (parsed.transactionId) {
            const existing = await PendingTransaction.findOne({ transactionId: parsed.transactionId });
            if (existing) {
                return res.status(200).json({ message: 'Duplicate transaction, already recorded.' });
            }
        }

        const pending = await PendingTransaction.create({
            userId,
            rawSms: smsText,
            transactionId: parsed.transactionId || undefined,
            amount: parsed.amount,
            type: parsed.type,
            title: parsed.title,
            partner: parsed.partner,
            date: parsed.date,
            paymentMethod: 'M-PESA',
            source: 'sms_forwarder',
        });

        return res.status(201).json({ message: 'Transaction queued for review.', id: pending._id });

    } catch (err) {
        console.error('[SMS Webhook Error]:', err.message);
        return res.status(500).json({ message: 'Server error processing SMS.' });
    }
};

// ─────────────────────────────────────────────────────────
// GET /api/mpesa/pending  — fetch pending for current user
// ─────────────────────────────────────────────────────────
const getPendingTransactions = async (req, res) => {
    try {
        const pending = await PendingTransaction.find({
            userId: req.user._id,
            status: 'pending'
        }).sort({ createdAt: -1 });

        res.json(pending);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ─────────────────────────────────────────────────────────
// POST /api/mpesa/approve/:id  — user confirms + categorises
// Body: { category: "Food", type: "expense" }
// ─────────────────────────────────────────────────────────
const approveTransaction = async (req, res) => {
    try {
        const { category, type } = req.body;
        const pending = await PendingTransaction.findOne({
            _id: req.params.id,
            userId: req.user._id,
            status: 'pending'
        });

        if (!pending) return res.status(404).json({ message: 'Pending transaction not found.' });

        const finalType = type || pending.type;
        const finalCategory = category || 'Uncategorised';

        if (finalType === 'income' || finalType === 'savings-withdrawal') {
            await Income.create({
                userId: req.user._id,
                amount: pending.amount,
                title: pending.title,
                source: pending.partner || 'M-PESA',
                date: pending.date,
                paymentMethod: 'M-PESA',
                transactionId: pending.transactionId || undefined,
                description: `Auto-imported via SMS. Category: ${finalCategory}`,
            });
        } else if (finalType === 'debt-payment') {
            // Expense out from our side
            await Expense.create({
                userId: req.user._id,
                amount: pending.amount,
                title: pending.title,
                category: 'Financial Obligations',
                date: pending.date,
                paymentMethod: 'M-PESA',
                transactionId: pending.transactionId || undefined,
                description: `Debt Repayment (Fuliza)`
            });
            
            const Debt = require('../models/Debt'); // imported lazily to avoid requiring at top if it wasn't there
            let fulizaDebt = await Debt.findOne({ userId: req.user._id, person: /Fuliza/i, type: 'I Owe', status: 'Open' });
            if (fulizaDebt) {
                fulizaDebt.remainingAmount = Math.max(0, fulizaDebt.remainingAmount - pending.amount);
                if (fulizaDebt.remainingAmount === 0) fulizaDebt.status = 'Settled';
                await fulizaDebt.save();
            }
        } else if (finalType === 'debt-taken') {
            // Expense for the purchase
            await Expense.create({
                userId: req.user._id,
                amount: pending.amount,
                title: pending.title,
                category: finalCategory,
                date: pending.date,
                paymentMethod: 'M-PESA',
                transactionId: pending.transactionId || undefined,
                description: `Auto-imported via SMS (Fuliza Usage)`,
            });
            
            const Debt = require('../models/Debt');
            let fulizaDebt = await Debt.findOne({ userId: req.user._id, person: /Fuliza/i, type: 'I Owe', status: 'Open' });
            if (fulizaDebt) {
                fulizaDebt.remainingAmount += pending.amount;
                fulizaDebt.originalAmount += pending.amount;
                await fulizaDebt.save();
            } else {
                await Debt.create({
                    userId: req.user._id,
                    person: 'Fuliza M-PESA',
                    originalAmount: pending.amount,
                    remainingAmount: pending.amount,
                    type: 'I Owe',
                    description: 'Auto-created from M-PESA SMS'
                });
            }
        } else {
            await Expense.create({
                userId: req.user._id,
                amount: pending.amount,
                title: pending.title,
                category: finalCategory,
                date: pending.date,
                paymentMethod: 'M-PESA',
                transactionId: pending.transactionId || undefined,
                description: `Auto-imported via SMS`,
            });
        }

        pending.status = 'approved';
        pending.category = finalCategory;
        await pending.save();

        res.json({ message: 'Transaction saved successfully.' });

    } catch (err) {
        console.error('[Approve Error]:', err.message);
        res.status(500).json({ message: err.message });
    }
};

// ─────────────────────────────────────────────────────────
// DELETE /api/mpesa/skip/:id  — user dismisses a transaction
// ─────────────────────────────────────────────────────────
const skipTransaction = async (req, res) => {
    try {
        const pending = await PendingTransaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { status: 'skipped' },
            { new: true }
        );
        if (!pending) return res.status(404).json({ message: 'Not found.' });
        res.json({ message: 'Transaction skipped.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ─────────────────────────────────────────────────────────
// GET /api/mpesa/count  — badge count for navbar
// ─────────────────────────────────────────────────────────
const getPendingCount = async (req, res) => {
    try {
        const count = await PendingTransaction.countDocuments({
            userId: req.user._id,
            status: 'pending'
        });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    receiveSmsWebhook,
    getPendingTransactions,
    approveTransaction,
    skipTransaction,
    getPendingCount,
};
