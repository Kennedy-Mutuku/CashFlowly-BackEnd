const mongoose = require('mongoose');

const debtPaymentSchema = mongoose.Schema(
    {
        debtId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Debt',
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        amountPaid: {
            type: Number,
            required: [true, 'Please add the amount paid'],
        },
        paymentDate: {
            type: Date,
            default: Date.now,
        },
        description: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('DebtPayment', debtPaymentSchema);
