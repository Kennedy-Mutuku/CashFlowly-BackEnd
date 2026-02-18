const mongoose = require('mongoose');

const savingsRecordSchema = mongoose.Schema(
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
        type: {
            type: String,
            required: [true, 'Please add a transaction type'],
            enum: ['deposit', 'withdrawal'],
        },
        partner: {
            type: String,
            default: 'Ziidi',
        },
        date: {
            type: Date,
            default: Date.now,
        },
        title: {
            type: String,
            required: [true, 'Please add a title'],
        },
        transactionId: {
            type: String,
            unique: true,
            sparse: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('SavingsRecord', savingsRecordSchema);
