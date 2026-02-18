const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        amount: {
            type: Number,
            required: [true, 'Please add an amount'],
        },
        title: {
            type: String,
            required: [true, 'Please add a title (e.g., Pizza, Bus Fare)'],
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
        date: {
            type: Date,
            required: [true, 'Please add a date'],
            default: Date.now,
        },
        paymentMethod: {
            type: String,
            default: 'Cash',
        },
        description: {
            type: String,
        },
        transactionId: {
            type: String,
            unique: true,
            sparse: true, // Allow multiple nulls/undefined for manual entries
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Expense', expenseSchema);
