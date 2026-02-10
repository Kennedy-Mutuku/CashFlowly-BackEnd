const express = require('express');
const { addExpense, getExpenses } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, addExpense).get(protect, getExpenses);

module.exports = router;
