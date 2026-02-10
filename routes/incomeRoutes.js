const express = require('express');
const { addIncome, getIncomes } = require('../controllers/incomeController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, addIncome).get(protect, getIncomes);

module.exports = router;
