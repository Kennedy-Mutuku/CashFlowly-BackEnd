const Expense = require('../models/Expense');

const addExpense = async (req, res) => {
    const { amount, category, date, description, title, paymentMethod } = req.body;

    try {
        const expense = await Expense.create({
            userId: req.user._id,
            amount,
            category,
            date,
            description,
            title,
            paymentMethod: paymentMethod || 'Cash',
        });
        res.status(201).json(expense);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getExpenses = async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.user._id }).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { addExpense, getExpenses };
