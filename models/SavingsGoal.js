const mongoose = require('mongoose');

const savingsGoalSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        name: {
            type: String,
            required: [true, 'Please add a goal name'],
        },
        targetAmount: {
            type: Number,
            required: [true, 'Please add a target amount'],
        },
        currentAmount: {
            type: Number,
            default: 0,
        },
        targetDate: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
