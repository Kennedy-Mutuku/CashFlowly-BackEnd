const Budget = require('../models/Budget');

const setBudget = async (req, res) => {
    const { month, amount } = req.body;

    try {
        let budget = await Budget.findOne({ userId: req.user._id, month });

        if (budget) {
            budget.amount = amount;
            await budget.save();
        } else {
            budget = await Budget.create({
                userId: req.user._id,
                month,
                amount,
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
        const budget = await Budget.findOne({ userId: req.user._id, month });
        res.json(budget);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { setBudget, getBudget };
