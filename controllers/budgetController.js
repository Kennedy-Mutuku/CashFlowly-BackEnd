const Budget = require('../models/Budget');

const setBudget = async (req, res) => {
    const { month, amount, endDate, category } = req.body;

    try {
        let query = { userId: req.user._id };
        if (month) query.month = month;
        if (category && category !== 'Monthly') query.category = category;

        let budget = await Budget.findOne(query);

        if (budget) {
            budget.amount = amount;
            if (endDate) budget.endDate = endDate;
            if (category) budget.category = category;
            await budget.save();
        } else {
            budget = await Budget.create({
                userId: req.user._id,
                month,
                amount,
                endDate,
                category: category || 'Monthly',
            });
        }
        res.status(201).json(budget);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getBudget = async (req, res) => {
    const { month } = req.query;
    try {
        if (month) {
            const budget = await Budget.findOne({ userId: req.user._id, month });
            res.json(budget);
        } else {
            const budgets = await Budget.find({ userId: req.user._id });
            res.json(budgets);
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { setBudget, getBudget };
