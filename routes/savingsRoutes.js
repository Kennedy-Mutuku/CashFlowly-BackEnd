const express = require('express');
const { addSavingsGoal, getSavingsGoals, updateSavingsProgress } = require('../controllers/savingsController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, addSavingsGoal).get(protect, getSavingsGoals);
router.route('/:id').put(protect, updateSavingsProgress);

module.exports = router;
