const Income = require('../models/Income');

const addIncome = async (req, res) => {
    const { amount, source, date, description, title, paymentMethod, transactionId } = req.body;

    try {
        const income = await Income.create({
            userId: req.user._id,
            amount,
            source,
            date,
            description,
            title,
            paymentMethod: paymentMethod || 'Cash',
            transactionId,
        });
        res.status(201).json(income);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getIncomes = async (req, res) => {
    try {
        const incomes = await Income.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(incomes);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteIncome = async (req, res) => {
    try {
        const income = await Income.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!income) return res.status(404).json({ message: 'Income record not found' });
        res.json({ message: 'Income deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { addIncome, getIncomes, deleteIncome };
