const express = require('express');
const router = express.Router();
const { addBill, getBills, updateBillStatus, deleteBill } = require('../controllers/billController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, addBill).get(protect, getBills);
router.route('/:id').put(protect, updateBillStatus).delete(protect, deleteBill);

module.exports = router;
