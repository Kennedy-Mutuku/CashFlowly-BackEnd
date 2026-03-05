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

        // --- AUTO-NOTIFICATION LOGIC START ---
        const Notification = require('../models/Notification');
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));

        // 1. Check for Upcoming Debt Deadlines & Progress
        const Debt = require('../models/Debt');
        const debts = await Debt.find({ userId, status: { $ne: 'Deleted' } });
        for (const debt of debts) {
            if (debt.status === 'Settled') continue;

            const daysUntilDue = debt.dueDate ? Math.ceil((new Date(debt.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const progress = ((debt.originalAmount - debt.remainingAmount) / debt.originalAmount);

            // Progress Alerts (50%, 75%, 95%)
            const thresholds = [0.95, 0.75, 0.5];
            let metThreshold = 0;
            for (const t of thresholds) {
                if (progress >= t) {
                    metThreshold = t;
                    break;
                }
            }

            if (metThreshold > 0) {
                const thresholdLabel = Math.round(metThreshold * 100);
                const title = `Debt Milestone: ${debt.person} (${thresholdLabel}%)`;
                const message = `Excellent! You've settled ${Math.round(progress * 100)}% of your ${debt.type === 'I Owe' ? 'debt with' : 'receivable from'} ${debt.person}. (Remaining: Ksh ${debt.remainingAmount.toLocaleString()})`;

                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);

                const existingNote = await Notification.findOne({
                    userId,
                    title,
                    isRead: false,
                    createdAt: { $gte: startOfToday }
                });

                if (!existingNote) {
                    await Notification.create({
                        userId,
                        title,
                        message,
                        type: 'debt',
                        link: `/debts?id=${debt._id}`
                    });
                }
            }

            // Deadline Alerts
            if (daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue >= 0) {
                const title = `Deadline Alert: ${debt.person}`;
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const existingNote = await Notification.findOne({
                    userId,
                    title,
                    isRead: false,
                    createdAt: { $gte: startOfToday }
                });

                if (!existingNote) {
                    await Notification.create({
                        userId,
                        title,
                        message: `URGENT: Your Ksh ${debt.remainingAmount.toLocaleString()} ${debt.type === 'I Owe' ? 'repayment to' : 'receivable from'} ${debt.person} is due in ${daysUntilDue} days!`,
                        type: 'debt',
                        link: `/debts?id=${debt._id}`
                    });
                }
            }
        }

        // 2. Check for Budget Overspending
        for (const budget of activeBudgets) {
            const spent = budget.category === 'Monthly'
                ? totalExpenses
                : (expenseByCategory[budget.category] || 0);

            const thresholds = [1, 0.95, 0.75, 0.5];
            let metThreshold = 0;

            for (const t of thresholds) {
                if (spent >= budget.amount * t) {
                    metThreshold = t;
                    break;
                }
            }

            if (metThreshold > 0) {
                const percentage = Math.round((spent / budget.amount) * 100);
                const thresholdLabel = Math.round(metThreshold * 100);
                const title = `Budget Alert: ${budget.category} (${thresholdLabel}%)`;
                const message = spent >= budget.amount
                    ? `CRITICAL: You have exceeded your ${budget.category} budget! (Spent: Ksh ${spent.toLocaleString()} / Limit: Ksh ${budget.amount.toLocaleString()})`
                    : `Alert: You have reached ${percentage}% of your ${budget.category} budget. (Spent: Ksh ${spent.toLocaleString()} / Limit: Ksh ${budget.amount.toLocaleString()})`;

                // Only notify if unread notification doesn't exist for this specific threshold today
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);

                const existingNote = await Notification.findOne({
                    userId,
                    title, // Title now contains (50%), (75%), etc.
                    isRead: false,
                    createdAt: { $gte: startOfToday }
                });

                if (!existingNote) {
                    await Notification.create({
                        userId,
                        title,
                        message,
                        type: 'budget',
                        link: `/budgets?id=${budget._id}`
                    });
                }
            }
        }
        // --- AUTO-NOTIFICATION LOGIC END ---

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
