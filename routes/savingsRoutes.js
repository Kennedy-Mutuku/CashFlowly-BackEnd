const express = require('express');
const { addSavingsRecord, getSavingsRecords, deleteSavingsRecord } = require('../controllers/savingsController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, addSavingsRecord).get(protect, getSavingsRecords);
router.route('/:id').delete(protect, deleteSavingsRecord);

module.exports = router;
