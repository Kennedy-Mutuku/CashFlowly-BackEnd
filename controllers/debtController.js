const Debt = require('../models/Debt');
const DebtPayment = require('../models/DebtPayment');
const Notification = require('../models/Notification');

const addDebt = async (req, res) => {
    const { person, amount, type, dateBorrowed, dueDate, description } = req.body;
    try {
        const debt = await Debt.create({
            userId: req.user._id,
            person,
            originalAmount: amount,
            remainingAmount: amount,
            type,
            dateBorrowed: dateBorrowed || Date.now(),
            dueDate,
            description,
        });
        res.status(201).json(debt);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getDebts = async (req, res) => {
    try {
        const debts = await Debt.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(debts);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateDebtStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const debt = await Debt.findById(id);
        if (debt && debt.userId.toString() === req.user._id.toString()) {
            debt.status = status;
            await debt.save();
            res.json(debt);
        } else {
            res.status(404).json({ message: 'Debt not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const addDebtPayment = async (req, res) => {
    const { id } = req.params;
    const { amountPaid, description, paymentDate } = req.body;
    try {
        const debt = await Debt.findById(id);
        if (debt && debt.userId.toString() === req.user._id.toString()) {
            // Update debt balance
            debt.remainingAmount -= amountPaid;
            if (debt.remainingAmount <= 0) {
                debt.remainingAmount = 0;
                debt.status = 'Settled';
            }

            // Create payment record with snapshotted balance
            await DebtPayment.create({
                debtId: id,
                userId: req.user._id,
                amountPaid,
                balanceAfter: debt.remainingAmount,
                description,
                paymentDate: paymentDate || Date.now(),
            });
            await debt.save();

            // Professional immediate feedback notification
            const progress = Math.round(((debt.originalAmount - debt.remainingAmount) / debt.originalAmount) * 100);
            await Notification.create({
                userId: req.user._id,
                title: `Payment Recorded: ${debt.person}`,
                message: debt.status === 'Settled'
                    ? `CONGRATULATIONS! You have fully settled your ${debt.type === 'I Owe' ? 'debt with' : 'receivable from'} ${debt.person}. Ksh ${amountPaid.toLocaleString()} was the final payment.`
                    : `Successful payment of Ksh ${amountPaid.toLocaleString()} recorded for ${debt.person}. You are now ${progress}% through your settlement journey.`,
                type: 'debt',
                link: `/debts?id=${debt._id}`
            });

            res.json(debt);
        } else {
            res.status(404).json({ message: 'Debt not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getDebtHistory = async (req, res) => {
    const { id } = req.params;
    try {
        const history = await DebtPayment.find({ debtId: id, userId: req.user._id }).sort({ paymentDate: -1 });
        res.json(history);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
const deleteDebt = async (req, res) => {
    const { id } = req.params;
    try {
        const debt = await Debt.findById(id);
        if (debt && debt.userId.toString() === req.user._id.toString()) {
            await debt.deleteOne();
            res.json({ message: 'Debt removed' });
        } else {
            res.status(404).json({ message: 'Debt not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { addDebt, getDebts, updateDebtStatus, deleteDebt, addDebtPayment, getDebtHistory };
