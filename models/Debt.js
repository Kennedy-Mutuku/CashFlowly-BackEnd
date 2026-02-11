const mongoose = require('mongoose');

const debtSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        person: {
            type: String,
            required: [true, 'Please add a person or entity name'],
        },
        originalAmount: {
            type: Number,
            required: [true, 'Please add the original amount'],
        },
        remainingAmount: {
            type: Number,
            required: [true, 'Please add the remaining amount'],
        },
        type: {
            type: String, // "I Owe" or "Owed to Me"
            required: true,
        },
        dueDate: {
            type: Date,
        },
        description: {
            type: String,
        },
        status: {
            type: String, // "Open" or "Settled"
            default: "Open",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Debt', debtSchema);
