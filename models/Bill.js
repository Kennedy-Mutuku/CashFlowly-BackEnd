const mongoose = require('mongoose');

const billSchema = mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        name: {
            type: String,
            required: [true, 'Please add a bill name (e.g. WiFi, Rent)'],
        },
        amount: {
            type: Number,
            required: [true, 'Please add the bill amount'],
        },
        dueDate: {
            type: Date,
            required: true,
        },
        frequency: {
            type: String, // "Monthly", "Weekly", "Yearly"
            default: "Monthly",
        },
        status: {
            type: String, // "Unpaid" or "Paid"
            default: "Unpaid",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Bill', billSchema);
