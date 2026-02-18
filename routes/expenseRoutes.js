const express = require('express');
const { addExpense, getExpenses, deleteExpense } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, addExpense).get(protect, getExpenses);
router.route('/:id').delete(protect, deleteExpense);

module.exports = router;
