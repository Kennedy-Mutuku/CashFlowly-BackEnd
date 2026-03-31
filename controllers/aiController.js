const { GoogleGenerativeAI } = require("@google/generative-ai");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const SavingsGoal = require("../models/SavingsGoal");
const Debt = require("../models/Debt");
const Bill = require("../models/Bill");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fallback chain — try each model in order until one works
const MODEL_CHAIN = [
    "gemini-2.0-flash-lite",   // Lightest, highest free quota
    "gemini-2.0-flash",        // Standard
    "gemini-flash-lite-latest", // Alias
];

// Simple In-Memory Cache (1 hour per user)
const globalAdviceCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000;

// ─────────────────────────────────────────────
// DATA LAYER
// ─────────────────────────────────────────────
const getFinancialStats = async (userId) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [incomes, expenses, goals, debts, bills] = await Promise.all([
        Income.find({ userId, date: { $gte: startOfMonth } }).lean(),
        Expense.find({ userId, date: { $gte: startOfMonth } }).lean(),
        SavingsGoal.find({ userId }).lean(),
        Debt.find({ userId, status: "Open" }).lean(),
        Bill.find({ userId, status: "Unpaid" }).lean(),
    ]);

    const income = incomes.reduce((s, r) => s + (r.amount || 0), 0);
    const spent = expenses.reduce((s, r) => s + (r.amount || 0), 0);
    const balance = income - spent;

    const byCategory = expenses.reduce((acc, r) => {
        const cat = r.category || "Other";
        acc[cat] = (acc[cat] || 0) + (r.amount || 0);
        return acc;
    }, {});

    const totalDebtOwed = debts.reduce((s, d) => s + (d.remainingAmount || 0), 0);
    const totalBillsDue = bills.reduce((s, b) => s + (b.amount || 0), 0);

    return {
        income, spent, balance, byCategory,
        goals: goals.map(g => ({
            name: g.name,
            target: g.targetAmount || 0,
            current: g.currentAmount || 0,
            pct: g.targetAmount ? Math.round(((g.currentAmount || 0) / g.targetAmount) * 100) : 0
        })),
        debts: debts.map(d => ({
            person: d.person,
            amount: d.remainingAmount || 0,
            type: d.type // "I Owe" or "Owed to Me"
        })),
        bills: bills.map(b => ({ name: b.name, amount: b.amount || 0 })),
        totalDebtOwed, totalBillsDue,
        currency: "Ksh"
    };
};

// ─────────────────────────────────────────────
// CONTEXT BUILDER (for AI prompt injection)
// ─────────────────────────────────────────────
const buildContext = (stats) => {
    const cats = Object.entries(stats.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: Ksh ${v.toLocaleString()}`)
        .join(", ") || "None recorded this month";

    const goals = stats.goals.length
        ? stats.goals.map(g => `${g.name} (${g.pct}% done, Ksh ${g.current.toLocaleString()} / Ksh ${g.target.toLocaleString()})`).join("; ")
        : "No savings goals";

    const debts = stats.debts.length
        ? stats.debts.map(d => `${d.type === "Owed to Me" ? `${d.person} owes you` : `You owe ${d.person}`} Ksh ${d.amount.toLocaleString()}`).join("; ")
        : "No open debts";

    const bills = stats.bills.length
        ? stats.bills.map(b => `${b.name}: Ksh ${b.amount.toLocaleString()}`).join("; ")
        : "No unpaid bills";

    return `=== USER FINANCIAL SNAPSHOT (CURRENT MONTH) ===
Income   : Ksh ${stats.income.toLocaleString()}
Spent    : Ksh ${stats.spent.toLocaleString()}
Balance  : Ksh ${stats.balance.toLocaleString()}
Spending : ${cats}
Goals    : ${goals}
Debts    : ${debts} | Total owed out: Ksh ${stats.totalDebtOwed.toLocaleString()}
Bills    : ${bills} | Total due: Ksh ${stats.totalBillsDue.toLocaleString()}
=================================================`;
};

// ─────────────────────────────────────────────
// SMART LOCAL FALLBACK ADVISOR
// Used when ALL Gemini models are quota-limited
// Answers questions using real financial data
// ─────────────────────────────────────────────
const localAdvisor = (message, stats) => {
    const msg = message.toLowerCase();
    const { income, spent, balance, byCategory, goals, debts, bills, totalDebtOwed, totalBillsDue } = stats;
    const savingsRate = income > 0 ? Math.round(((income - spent) / income) * 100) : 0;
    const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    // ── AFFORDABILITY ──
    const affordMatch = msg.match(/afford\s+(a\s+)?(\d[\d,]*k?)\s*(ksh)?/i) ||
        msg.match(/(ksh\s*)?(\d[\d,]*k?)\s*(shilling|ksh)?/i);
    if (affordMatch || msg.includes("afford") || msg.includes("buy") || msg.includes("purchase")) {
        let amount = 0;
        const numMatch = message.match(/(\d[\d,]*)(k)?/i);
        if (numMatch) {
            amount = parseInt(numMatch[1].replace(/,/g, "")) * (numMatch[2] ? 1000 : 1);
        }
        if (amount > 0) {
            const canAfford = balance >= amount;
            const afterPurchase = balance - amount;
            const needed = amount - balance;
            return canAfford
                ? `**Yes, you can afford this!** 🟢\n\nYour current balance is **Ksh ${balance.toLocaleString()}**, and this costs **Ksh ${amount.toLocaleString()}**. After buying, you'd have **Ksh ${afterPurchase.toLocaleString()}** remaining.\n\n${afterPurchase < totalBillsDue ? `⚠️ However, you still have **Ksh ${totalBillsDue.toLocaleString()}** in unpaid bills — make sure those are covered first.` : `Your bills (Ksh ${totalBillsDue.toLocaleString()}) are manageable. Go for it!`}`
                : `**Not comfortably right now.** 🔴\n\nYou need **Ksh ${amount.toLocaleString()}** but your balance is only **Ksh ${balance.toLocaleString()}**. You're short by **Ksh ${needed.toLocaleString()}**.\n\n💡 **To afford this:**\n- Reduce ${topCat ? `your ${topCat[0]} spending (Ksh ${topCat[1].toLocaleString()} this month)` : "discretionary spending"}\n- Wait until next income cycle\n- Check if any debts owed to you (Ksh ${stats.debts.filter(d => d.type === "Owed to Me").reduce((s, d) => s + d.amount, 0).toLocaleString()}) can be collected`;
        }
        return `Your current balance is **Ksh ${balance.toLocaleString()}**. Tell me how much the item costs and I'll give you a specific affordability breakdown!`;
    }

    // ── DEBT ──
    if (msg.includes("debt") || msg.includes("owe") || msg.includes("loan") || msg.includes("borrow")) {
        if (debts.length === 0) return "You have **no open debts** recorded in CashFlowly! 🎉 Great financial position.";
        const iOwe = debts.filter(d => d.type === "I Owe");
        const owedToMe = debts.filter(d => d.type === "Owed to Me");
        let response = "**Your Debt Summary:**\n\n";
        if (iOwe.length > 0) response += `🔴 **You owe:**\n${iOwe.map(d => `- ${d.person}: Ksh ${d.amount.toLocaleString()}`).join("\n")}\n— Total: Ksh ${iOwe.reduce((s, d) => s + d.amount, 0).toLocaleString()}\n\n`;
        if (owedToMe.length > 0) response += `🟢 **Owed to you:**\n${owedToMe.map(d => `- ${d.person}: Ksh ${d.amount.toLocaleString()}`).join("\n")}\n— Total: Ksh ${owedToMe.reduce((s, d) => s + d.amount, 0).toLocaleString()}`;
        return response;
    }

    // ── SAVINGS GOALS ──
    if (msg.includes("goal") || msg.includes("saving") || msg.includes("target") || msg.includes("track")) {
        if (goals.length === 0) return "You have **no savings goals** set yet. Go to the Goals page to create one — even a small weekly target builds massive wealth over time!";
        let response = "**Your Savings Goals:**\n\n";
        goals.forEach(g => {
            const remaining = g.target - g.current;
            const bar = "█".repeat(Math.floor(g.pct / 10)) + "░".repeat(10 - Math.floor(g.pct / 10));
            response += `**${g.name}**\n${bar} ${g.pct}%\nSaved: Ksh ${g.current.toLocaleString()} / Ksh ${g.target.toLocaleString()} (Ksh ${remaining.toLocaleString()} to go)\n\n`;
        });
        return response.trim();
    }

    // ── BILLS ──
    if (msg.includes("bill") || msg.includes("pay") || msg.includes("due") || msg.includes("pending")) {
        if (bills.length === 0) return "You have **no unpaid bills** recorded! 🎉 All clear.";
        let response = `**Pending Bills — Ksh ${totalBillsDue.toLocaleString()} total:**\n\n`;
        bills.forEach(b => { response += `- ${b.name}: Ksh ${b.amount.toLocaleString()}\n`; });
        response += `\n💡 These bills require **Ksh ${totalBillsDue.toLocaleString()}** — you currently have **Ksh ${balance.toLocaleString()}** available.`;
        if (balance >= totalBillsDue) response += " ✅ You can cover all bills!";
        else response += ` ⚠️ You're short by Ksh ${(totalBillsDue - balance).toLocaleString()}.`;
        return response;
    }

    // ── SPENDING ANALYSIS ──
    if (msg.includes("spend") || msg.includes("spending") || msg.includes("budget") || msg.includes("analyz") || msg.includes("breakdown") || msg.includes("hierarchy")) {
        if (Object.keys(byCategory).length === 0) return "No spending recorded this month yet. Start logging your expenses on the Expenses page!";
        const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
        let response = `**Spending Breakdown — Ksh ${spent.toLocaleString()} total:**\n\n`;
        sortedCats.forEach(([cat, amount]) => {
            const pct = Math.round((amount / spent) * 100);
            response += `- **${cat}**: Ksh ${amount.toLocaleString()} (${pct}%)\n`;
        });
        response += `\n**Savings Rate: ${savingsRate}%** ${savingsRate >= 20 ? "🟢 Excellent!" : savingsRate >= 10 ? "🟡 Getting there." : "🔴 Try to save at least 20%."}`;
        if (topCat) response += `\n\n💡 Your biggest expense is **${topCat[0]}** (Ksh ${topCat[1].toLocaleString()}). Review if this is necessary.`;
        return response;
    }

    // ── INCOME ──
    if (msg.includes("income") || msg.includes("earn") || msg.includes("salary") || msg.includes("revenue")) {
        return `**Monthly Income: Ksh ${income.toLocaleString()}**\n\nYou've spent **Ksh ${spent.toLocaleString()}** (${income > 0 ? Math.round((spent / income) * 100) : 0}% of income), leaving **Ksh ${balance.toLocaleString()}** (${savingsRate}% savings rate).\n\n${savingsRate >= 20 ? "🟢 Great discipline! You're saving above the recommended 20%." : "💡 Aim to save at least 20% of your income — that's Ksh " + Math.round(income * 0.2).toLocaleString() + " per month."}`;
    }

    // ── BALANCE ──
    if (msg.includes("balance") || msg.includes("how much") || msg.includes("left") || msg.includes("remain")) {
        return `Your current balance is **Ksh ${balance.toLocaleString()}**.\n\n- Income: Ksh ${income.toLocaleString()}\n- Spent: Ksh ${spent.toLocaleString()}\n- Pending bills: Ksh ${totalBillsDue.toLocaleString()}\n- Net after bills: Ksh ${(balance - totalBillsDue).toLocaleString()}`;
    }

    // ── IDENTITY ──
    if (msg.includes("who are you") || msg.includes("what are you") || msg.includes("help") || msg.includes("hello") || msg.includes("hi")) {
        return `**I'm CashFlowly AI** — your personal finance advisor powered by your real financial data.\n\nI can help you with:\n- 💰 **Affordability checks** — "Can I afford a Ksh 50,000 laptop?"\n- 📊 **Spending analysis** — "Analyze my spending this month"\n- 🎯 **Savings goals** — "Am I on track for my goals?"\n- 📋 **Bills & debts** — "Tell me my debts" or "What bills are due?"\n- 💡 **Budget advice** — "How can I save more this month?"\n\nYour current balance is **Ksh ${balance.toLocaleString()}**. What would you like to know?`;
    }

    // ── SAVE MORE / TIPS ──
    if (msg.includes("save more") || msg.includes("tip") || msg.includes("advice") || msg.includes("plan") || msg.includes("improve")) {
        const tips = [];
        if (savingsRate < 20) tips.push(`📈 Increase your savings rate from ${savingsRate}% to 20%+ — save at least Ksh ${Math.round(income * 0.2).toLocaleString()} monthly`);
        if (topCat && topCat[1] > spent * 0.3) tips.push(`✂️ Your **${topCat[0]}** spending (Ksh ${topCat[1].toLocaleString()}) is ${Math.round((topCat[1] / spent) * 100)}% of total spend — look for cuts here`);
        if (totalBillsDue > 0) tips.push(`⚡ Clear your Ksh ${totalBillsDue.toLocaleString()} in pending bills to avoid late fees`);
        if (totalDebtOwed > 0) tips.push(`🔴 You owe Ksh ${totalDebtOwed.toLocaleString()} in debts — prioritize clearing high-pressure ones`);
        if (goals.length === 0) tips.push(`🎯 Set a savings goal on the Goals page to give your money a purpose`);
        else {
            const incomplete = goals.filter(g => g.pct < 100);
            if (incomplete.length > 0) tips.push(`🎯 Focus on your **${incomplete[0].name}** goal — you're ${incomplete[0].pct}% there!`);
        }
        if (tips.length === 0) tips.push("🟢 You're doing well! Keep maintaining your current discipline.");
        return `**Personalised Financial Tips:**\n\n${tips.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
    }

    // ── DEFAULT SUMMARY ──
    return `I'm your CashFlowly AI Advisor. Here's your quick snapshot:\n\n💰 **Balance**: Ksh ${balance.toLocaleString()}\n📥 **Income**: Ksh ${income.toLocaleString()}\n📤 **Spent**: Ksh ${spent.toLocaleString()}\n🎯 **Goals**: ${goals.length}\n📋 **Bills due**: Ksh ${totalBillsDue.toLocaleString()}\n💳 **Debts owed out**: Ksh ${totalDebtOwed.toLocaleString()}\n\nAsk me about affordability, spending, goals, bills, or debts for specific advice!`;
};

// ─────────────────────────────────────────────
// GEMINI WITH MODEL FALLBACK CHAIN
// ─────────────────────────────────────────────
const tryGemini = async (prompt) => {
    for (const modelName of MODEL_CHAIN) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text().trim();
            if (text) return text;
        } catch (err) {
            // Always continue to next model regardless of error type
            // (429=quota, 404=not found, 403=key issue, 500=server error)
            const code = err.message?.match(/\[(\d{3})/)?.[1] || "err";
            console.error(`[AI] Model ${modelName} failed (${code}) — trying fallback`);
            continue;
        }
    }
    return null; // all models exhausted → local advisor takes over
};

// ─────────────────────────────────────────────
// GET /api/ai/advice — 3 quick tips (cached)
// ─────────────────────────────────────────────
const getFinancialAdvice = async (req, res) => {
    const userId = req.user._id.toString();
    const monthKey = new Date().toISOString().slice(0, 7);

    try {
        const cached = globalAdviceCache.get(userId);
        if (cached && cached.month === monthKey && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            return res.json(cached.tips);
        }

        const stats = await getFinancialStats(req.user._id);

        // Try Gemini first
        const prompt = `You are a financial advisor. Based on:
${buildContext(stats)}
Give exactly 3 short, data-specific financial tips. Return ONLY a raw JSON array of 3 strings, no markdown.`;

        let tips = null;
        const aiText = await tryGemini(prompt);
        if (aiText) {
            try {
                const match = aiText.match(/\[[\s\S]*?\]/);
                if (match) tips = JSON.parse(match[0]);
            } catch (_) {}
        }

        // Smart local fallback tips
        if (!Array.isArray(tips) || tips.length < 1) {
            const { income, spent, balance, totalBillsDue, savingsRate, goals, byCategory } = {
                ...stats, savingsRate: stats.income > 0 ? Math.round(((stats.income - stats.spent) / stats.income) * 100) : 0
            };
            const topCat = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0];
            tips = [
                `Your balance is Ksh ${balance.toLocaleString()} with Ksh ${totalBillsDue.toLocaleString()} in pending bills. ${balance >= totalBillsDue ? "You can cover all bills ✅" : `Ksh ${(totalBillsDue - balance).toLocaleString()} shortfall — prioritise income or reduce spending.`}`,
                topCat
                    ? `Your top expense is ${topCat[0]} at Ksh ${topCat[1].toLocaleString()} (${Math.round((topCat[1] / (stats.spent || 1)) * 100)}% of spending). Review if this can be trimmed.`
                    : "Start tracking your expenses by category to identify your biggest spending drain.",
                goals.length > 0
                    ? `Your ${goals[0].name} goal is ${goals[0].pct}% complete. Stay consistent — you need Ksh ${(goals[0].target - goals[0].current).toLocaleString()} more.`
                    : "Set a savings goal on the Goals page. A clear target is the #1 driver of financial progress."
            ];
        }

        globalAdviceCache.set(userId, { tips, month: monthKey, timestamp: Date.now() });
        return res.json(tips);

    } catch (err) {
        console.error("[AI Advice Error]:", err.message);
        res.json([
            "Follow the 50/30/20 rule: 50% Needs, 30% Wants, 20% Savings.",
            "Review recurring subscriptions — they quietly drain your wallet.",
            "Set a specific savings goal to build wealth intentionally."
        ]);
    }
};

// ─────────────────────────────────────────────
// POST /api/ai/chat — Conversational advisor
// ─────────────────────────────────────────────
const chatWithAdvisor = async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ message: "Please provide a valid message." });
        }

        const stats = await getFinancialStats(req.user._id);
        const context = buildContext(stats);

        // Build conversation string
        let conversationStr = "";
        if (Array.isArray(history) && history.length > 0) {
            const validTurns = history.filter(h =>
                h && (h.role === "user" || h.role === "model") &&
                typeof h.parts?.[0]?.text === "string" &&
                h.parts[0].text.trim().length > 0
            ).slice(-10); // keep last 10 turns to reduce prompt size

            if (validTurns.length > 0) {
                conversationStr = "\n\n=== CONVERSATION HISTORY ===\n";
                conversationStr += validTurns.map(h =>
                    `${h.role === "user" ? "User" : "Advisor"}: ${h.parts[0].text.trim()}`
                ).join("\n");
                conversationStr += "\n=== END ===";
            }
        }

        const fullPrompt = `You are CashFlowly AI, a brilliant personal finance advisor for Kenyan users.
You have REAL financial data below. Reference the actual numbers. Be specific, concise, and helpful.
Use Kenyan Shillings (Ksh). Do NOT invent numbers.

${context}
${conversationStr}

User: ${message.trim()}
Advisor:`;

        // Try Gemini models first
        const aiText = await tryGemini(fullPrompt);

        if (aiText) {
            return res.json({ text: aiText, source: "ai" });
        }

        // All AI models quota-exhausted — use smart local advisor
        console.log("[AI] All models quota-exhausted. Using local financial advisor.");
        const localResponse = localAdvisor(message, stats);
        return res.json({ text: localResponse, source: "local" });

    } catch (err) {
        console.error("[AI Chat Error]:", err.message);
        try {
            // Last resort: try local advisor even if stats failed
            return res.status(500).json({ message: "I encountered an unexpected error. Please try again in a moment." });
        } catch (e) {
            return res.status(500).json({ message: "Service temporarily unavailable. Please try again shortly." });
        }
    }
};

module.exports = { getFinancialAdvice, chatWithAdvisor };
