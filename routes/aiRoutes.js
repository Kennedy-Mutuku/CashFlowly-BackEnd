const express = require('express');
const { getFinancialAdvice, chatWithAdvisor } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/advice', protect, getFinancialAdvice);
router.post('/chat', protect, chatWithAdvisor);

module.exports = router;
