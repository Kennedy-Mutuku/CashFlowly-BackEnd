const mongoose = require('mongoose');

const budgetSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        category: {
            type: String,
            required: [true, 'Please add a category'],
            enum: [
                'Housing & Utilities',
                'Food & Household',
                'Transportation',
                'Health & Personal Care',
                'Financial Obligations',
                'Lifestyle & Entertainment',
                'Assets',
                'Miscellaneous',
            ],
        },
        amount: {
            type: Number,
            required: [true, 'Please add a budget amount'],
        },
        startDate: {
            type: Date,
            required: [true, 'Please add a start date'],
        },
        endDate: {
            type: Date,
            required: [true, 'Please add an end date'],
        },
        // Kept for backward compatibility with old Monthly budgets if needed, but not strictly required moving forward
        month: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Budget', budgetSchema);
