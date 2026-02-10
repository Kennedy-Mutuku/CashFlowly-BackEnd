const express = require('express');
const { getMonthlyReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/monthly', protect, getMonthlyReport);

module.exports = router;
