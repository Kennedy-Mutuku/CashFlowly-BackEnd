const express = require('express');
const router = express.Router();
const { addDebt, getDebts, updateDebtStatus, deleteDebt, addDebtPayment, getDebtHistory } = require('../controllers/debtController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, addDebt).get(protect, getDebts);
router.route('/:id').put(protect, updateDebtStatus).delete(protect, deleteDebt);
router.post('/:id/payment', protect, addDebtPayment);
router.get('/:id/history', protect, getDebtHistory);

module.exports = router;
