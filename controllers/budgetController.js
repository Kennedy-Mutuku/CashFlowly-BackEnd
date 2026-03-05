const Budget = require('../models/Budget');

const setBudget = async (req, res) => {
    const { category, amount, startDate, endDate, month } = req.body;

    // Validate required fields
    if (!category || !amount || !startDate || !endDate) {
        return res.status(400).json({ message: 'Category, amount, start date, and end date are required.' });
    }

    try {
        // Find existing budget for this category and month if one exists
        let query = {
            userId: req.user._id,
            category: category
        };
        // Using month as a lookup fallback since frontend currently sends it and it's helpful for tracking
        if (month) query.month = month;

        let budget = await Budget.findOne(query);

        if (budget) {
            // Update existing
            budget.amount = amount;
            budget.startDate = startDate;
            budget.endDate = endDate;
            if (month) budget.month = month;
            await budget.save();
        } else {
            // Create new
            budget = await Budget.create({
                userId: req.user._id,
                category,
                amount,
                startDate,
                endDate,
                month
            });
        }
        res.status(201).json(budget);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getBudget = async (req, res) => {
    const { month } = req.query; // Usually "YYYY-MM"
    try {
        let query = { userId: req.user._id };

        if (month) {
            // Find all budgets where either the 'month' string matches,
            // OR the start/end date overlaps with the requested month
            const year = parseInt(month.split('-')[0]);
            const mon = parseInt(month.split('-')[1]) - 1; // 0-indexed

            const monthStart = new Date(year, mon, 1);
            const monthEnd = new Date(year, mon + 1, 0, 23, 59, 59);

            query['$or'] = [
                { month: month },
                {
                    startDate: { $lte: monthEnd },
                    endDate: { $gte: monthStart }
                }
            ];
        }

        const budgets = await Budget.find(query);
        res.json(budgets);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { setBudget, getBudget };
