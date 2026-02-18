const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const SavingsGoal = require("../models/SavingsGoal");
const Debt = require("../models/Debt");
const Bill = require("../models/Bill");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const LOG_FILE = path.join(__dirname, "../ai_error_debug.log");

const logAIError = (context, error) => {
    const errorData = {
        timestamp: new Date().toISOString(),
        context,
        message: error.message,
        stack: error.stack,
        status: error.status,
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(errorData, null, 2) + "\n---\n");
};

// Simple In-Memory Cache
const globalAdviceCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour

/**
 * Aggregates all user financial data for context.
 */
const getFinancialStats = async (userId) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [incomes, expenses, goals, debts, bills] = await Promise.all([
        Income.find({ userId, date: { $gte: startOfMonth } }),
        Expense.find({ userId, date: { $gte: startOfMonth } }),
        SavingsGoal.find({ userId }),
        Debt.find({ userId, status: "Open" }),
        Bill.find({ userId, status: "Unpaid" }),
    ]);

    const income = incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const spent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    const byCategory = expenses.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
    }, {});

    return {
        income,
        spent,
        byCategory,
        goals: goals.map(g => ({ name: g.name, target: g.targetAmount, current: g.currentAmount })),
        debts: debts.map(d => ({ person: d.person, amount: d.remainingAmount })),
        bills: bills.map(b => ({ name: b.name, amount: b.amount })),
        balance: income - spent,
        currency: "Ksh"
    };
};

/**
 * GET /api/ai/advice
 */
const getFinancialAdvice = async (req, res) => {
    const userId = req.user._id.toString();
    const monthKey = new Date().toISOString().slice(0, 7);

    try {
        const cachedItem = globalAdviceCache.get(userId);
        if (cachedItem && cachedItem.month === monthKey && (Date.now() - cachedItem.timestamp < CACHE_DURATION)) {
            return res.json(cachedItem.tips);
        }

        const stats = await getFinancialStats(req.user._id);

        // Use gemini-pro-latest which is widely available and stable
        const model = genAI.getGenerativeModel({
            model: "gemini-pro",
            systemInstruction: "Provide 3 JSON financial tips for Kennedy."
        });

        const prompt = `Stats: Income ${stats.income}, Spent ${stats.spent}, Categories: ${JSON.stringify(stats.byCategory)}. Return ONLY a JSON string array.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const jsonMatch = text.match(/\[.*\]/s);
        const tips = jsonMatch ? JSON.parse(jsonMatch[0]) : ["Track more accurately.", "Set a savings target.", "Check your subscriptions."];

        globalAdviceCache.set(userId, { tips, month: monthKey, timestamp: Date.now() });
        res.json(tips);

    } catch (error) {
        logAIError("getFinancialAdvice", error);
        res.json([
            "Try to follow the 50/30/20 rule: 50% Needs, 30% Wants, 20% Savings.",
            "Review your 'Miscellaneous' spending to find potential savings.",
            "Stay consistent with your financial goals for long-term health."
        ]);
    }
};

/**
 * POST /api/ai/chat
 */
const chatWithAdvisor = async (req, res) => {
    try {
        const { message, history } = req.body;
        const stats = await getFinancialStats(req.user._id);

        const model = genAI.getGenerativeModel({
            model: "gemini-pro",
            systemInstruction: `You are CashFlowly AI. Kennedy's Balance: ${stats.balance} Ksh. Income: ${stats.income} Ksh. Spent: ${stats.spent} Ksh. Goals: ${JSON.stringify(stats.goals)}. Be concise.`
        });

        // Clean history: Ensure it starts with 'user' and alternates roles
        let chatHistory = (history || []).filter(h => h.role === 'user' || h.role === 'model');
        const userIdx = chatHistory.findIndex(m => m.role === 'user');
        chatHistory = userIdx !== -1 ? chatHistory.slice(userIdx) : [];

        const chat = model.startChat({
            history: chatHistory,
            generationConfig: { maxOutputTokens: 600 }
        });

        const result = await chat.sendMessage(message);
        res.json({ text: result.response.text() });

    } catch (error) {
        logAIError("chatWithAdvisor", error);

        if (error.message.includes("429") || error.message.includes("exhausted")) {
            return res.status(500).json({ message: "Google's AI is busy. Please wait 60 seconds." });
        }

        res.status(500).json({ message: "Small connection issue. Please try again shortly." });
    }
};

module.exports = { getFinancialAdvice, chatWithAdvisor };
