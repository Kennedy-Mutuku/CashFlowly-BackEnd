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

        // Fetch active category budgets for this month
        const Budget = require('../models/Budget');
        const activeBudgets = await Budget.find({
            userId,
            $or: [
                { month: month },
                {
                    startDate: { $lte: endDate },
                    endDate: { $gte: startDate }
                }
            ]
        });

        const allIncomes = await Income.find({ userId });
        const allExpenses = await Expense.find({ userId });

        const allTimeTotalIncome = allIncomes.reduce((acc, curr) => acc + curr.amount, 0);
        const allTimeTotalExpenses = allExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        const allTimeExpenseByCategory = allExpenses.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
        }, {});

        // We remove the synchronous notification creation from the report fetch to improve performance.
        // Notifications should ideally be triggered by data modification events (POST/PUT/DELETE)
        // or a separate background job, not every time a user views their dashboard.
        const Debt = require('../models/Debt');
        const debts = await Debt.find({ userId, status: { $ne: 'Deleted' } });


        // 3. All-Time Debts Statistics
        const allTimeDebts = debts.reduce((acc, curr) => {
            if (curr.type === 'I Owe') acc.toPay += curr.remainingAmount;
            else acc.toReceive += curr.remainingAmount;
            return acc;
        }, { toPay: 0, toReceive: 0 });

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
            activeBudgets, // Expose active budgets to the dashboard
            allTimeTotalIncome,
            allTimeTotalExpenses,
            allTimeExpenseByCategory,
            allTimeDebts
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { getMonthlyReport };
