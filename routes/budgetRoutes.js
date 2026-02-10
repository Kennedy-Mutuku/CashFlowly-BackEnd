const express = require('express');
const { setBudget, getBudget } = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.route('/').post(protect, setBudget).get(protect, getBudget);

module.exports = router;
