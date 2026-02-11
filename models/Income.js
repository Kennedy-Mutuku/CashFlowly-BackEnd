const mongoose = require('mongoose');

const incomeSchema = mongoose.Schema(
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
            required: [true, 'Please add a title (e.g., Laptop, Salary)'],
        },
        source: {
            type: String,
            required: [true, 'Please add a source'],
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

module.exports = mongoose.model('Income', incomeSchema);
