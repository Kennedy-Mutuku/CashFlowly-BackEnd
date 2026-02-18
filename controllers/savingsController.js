const SavingsRecord = require('../models/SavingsRecord');

// @desc    Add a savings record (deposit or withdrawal)
// @route   POST /api/savings
// @access  Private
const addSavingsRecord = async (req, res) => {
    const { amount, type, date, title, transactionId, partner } = req.body;

    try {
        if (transactionId) {
            const existing = await SavingsRecord.findOne({ transactionId });
            if (existing) {
                return res.status(400).json({ message: 'This transaction has already been recorded.' });
            }
        }

        const record = await SavingsRecord.create({
            userId: req.user._id,
            amount,
            type,
            date,
            title,
            transactionId,
            partner: partner || 'Ziidi',
        });
        res.status(201).json(record);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all savings records for a user
// @route   GET /api/savings
// @access  Private
const getSavingsRecords = async (req, res) => {
    try {
        const records = await SavingsRecord.find({ userId: req.user._id }).sort({ date: -1 });
        res.json(records);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a savings record
// @route   DELETE /api/savings/:id
// @access  Private
const deleteSavingsRecord = async (req, res) => {
    try {
        const record = await SavingsRecord.findById(req.params.id);
        if (record && record.userId.toString() === req.user._id.toString()) {
            await record.deleteOne();
            res.json({ message: 'Record removed' });
        } else {
            res.status(404).json({ message: 'Record not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { addSavingsRecord, getSavingsRecords, deleteSavingsRecord };
