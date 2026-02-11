const mongoose = require('mongoose');

const budgetSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        month: {
            type: String, // e.g., "2024-02"
        },
        endDate: {
            type: Date,
        },
        category: {
            type: String, // "Monthly" or "Specific Goal"
            default: "Monthly",
        },
        amount: {
            type: Number,
            required: [true, 'Please add a budget amount'],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Budget', budgetSchema);
