const express = require('express');
const { addIncome, getIncomes, deleteIncome } = require('../controllers/incomeController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, addIncome).get(protect, getIncomes);
router.route('/:id').delete(protect, deleteIncome);

module.exports = router;
