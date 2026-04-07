const mongoose = require('mongoose');

const pendingTransactionSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    rawSms: { type: String, required: true },
    transactionId: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true },
    type: {
        type: String,
        enum: ['income', 'expense', 'savings', 'savings-withdrawal', 'debt-taken', 'debt-payment'],
        required: true
    },
    title: { type: String, required: true },
    partner: { type: String, default: '' },
    date: { type: Date, required: true },
    paymentMethod: { type: String, default: 'M-PESA' },
    category: { type: String, default: '' },  // filled by user on review
    status: {
        type: String,
        enum: ['pending', 'approved', 'skipped'],
        default: 'pending'
    },
    source: {
        type: String,
        enum: ['sms_forwarder', 'manual_paste', 'native_sms'],
        default: 'sms_forwarder'
    }
}, { timestamps: true });

module.exports = mongoose.model('PendingTransaction', pendingTransactionSchema);
