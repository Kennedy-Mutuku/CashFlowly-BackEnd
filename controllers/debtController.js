const Debt = require('../models/Debt');
const DebtPayment = require('../models/DebtPayment');

const addDebt = async (req, res) => {
    const { person, amount, type, dueDate, description } = req.body;
    try {
        const debt = await Debt.create({
            userId: req.user._id,
            person,
            originalAmount: amount,
            remainingAmount: amount,
            type,
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
    const { amountPaid, description } = req.body;
    try {
        const debt = await Debt.findById(id);
        if (debt && debt.userId.toString() === req.user._id.toString()) {
            // Create payment record
            await DebtPayment.create({
                debtId: id,
                userId: req.user._id,
                amountPaid,
                description,
            });

            // Update debt balance
            debt.remainingAmount -= amountPaid;
            if (debt.remainingAmount <= 0) {
                debt.remainingAmount = 0;
                debt.status = 'Settled';
            }
            await debt.save();
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
