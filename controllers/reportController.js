const Income = require('../models/Income');
const Expense = require('../models/Expense');

const getMonthlyReport = async (req, res) => {
    const { month } = req.query; // format: "YYYY-MM"
    const userId = req.user._id;

    try {
        const startDate = new Date(`${month}-01`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const incomes = await Income.find({
            userId,
            date: { $gte: startDate, $lt: endDate },
        });

        const expenses = await Expense.find({
            userId,
            date: { $gte: startDate, $lt: endDate },
        });

        const totalIncome = incomes.reduce((acc, curr) => acc + curr.amount, 0);
        const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        const expenseByCategory = expenses.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
        }, {});

        // Add total savings balance (cumulative)
        const SavingsRecord = require('../models/SavingsRecord');
        const savingsRecords = await SavingsRecord.find({ userId });
        const totalSavings = savingsRecords.reduce((acc, curr) => {
            return curr.type === 'deposit' ? acc + curr.amount : acc - curr.amount;
        }, 0);

        res.json({
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            expenseByCategory,
            totalSavings,
            incomeCount: incomes.length,
            expenseCount: expenses.length,
            monthlyIncome: incomes,
            monthlyExpenses: expenses,
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { getMonthlyReport };
