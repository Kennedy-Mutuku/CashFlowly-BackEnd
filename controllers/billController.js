const Bill = require('../models/Bill');
const Expense = require('../models/Expense');

const addBill = async (req, res) => {
    const { name, amount, dueDate, frequency } = req.body;

    if (!name || !amount || !dueDate) {
        return res.status(400).json({ message: 'Please provide name, amount, and due date' });
    }

    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be greater than zero' });
    }

    try {
        const bill = await Bill.create({
            userId: req.user._id,
            name,
            amount,
            dueDate,
            frequency: frequency || 'Monthly',
        });
        res.status(201).json(bill);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getBills = async (req, res) => {
    try {
        const bills = await Bill.find({ userId: req.user._id }).sort({ dueDate: 1 });
        res.json(bills);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const updateBillStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const bill = await Bill.findById(id);
        if (bill && bill.userId.toString() === req.user._id.toString()) {
            const oldStatus = bill.status;
            bill.status = status;
            await bill.save();

            // If marked as Paid, create an Expense automatically
            if (status === 'Paid' && oldStatus !== 'Paid') {
                await Expense.create({
                    userId: req.user._id,
                    amount: bill.amount,
                    title: `Bill Payment: ${bill.name}`,
                    category: 'Utilities', // Default category for bills
                    date: new Date(),
                    description: `Automated entry for paid bill: ${bill.name}`,
                    paymentMethod: 'Other',
                });
            }

            res.json(bill);
        } else {
            res.status(404).json({ message: 'Bill not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteBill = async (req, res) => {
    const { id } = req.params;
    try {
        const bill = await Bill.findById(id);
        if (bill && bill.userId.toString() === req.user._id.toString()) {
            await bill.deleteOne();
            res.json({ message: 'Bill removed' });
        } else {
            res.status(404).json({ message: 'Bill not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = { addBill, getBills, updateBillStatus, deleteBill };
