const SavingsGoal = require('../models/SavingsGoal');

const addSavingsGoal = async (req, res) => {
    const { name, targetAmount, currentAmount, targetDate } = req.body;

    try {
        const goal = await SavingsGoal.create({
            userId: req.user._id,
            name,
            targetAmount,
            currentAmount,
            targetDate,
        });
        res.status(201).json(goal);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getSavingsGoals = async (req, res) => {
    try {
        const goals = await SavingsGoal.find({ userId: req.user._id });
        res.json(goals);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateSavingsProgress = async (req, res) => {
    const { id } = req.params;
    const { currentAmount } = req.body;

    try {
        const goal = await SavingsGoal.findById(id);
        if (goal && goal.userId.toString() === req.user._id.toString()) {
            if (req.body.transactionId) {
                const existing = await SavingsGoal.findOne({ transactionId: req.body.transactionId });
                if (existing) {
                    return res.status(400).json({ message: 'This savings transaction has already been recorded.' });
                }
                goal.transactionId = req.body.transactionId; // Note: This might only store the LAST tx ID if we don't have a separate collection.
            }
            goal.currentAmount = currentAmount;
            await goal.save();
            res.json(goal);
        } else {
            res.status(404).json({ message: 'Goal not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { addSavingsGoal, getSavingsGoals, updateSavingsProgress };
