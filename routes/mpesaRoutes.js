const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    receiveSmsWebhook,
    receiveNativeSms,
    getPendingTransactions,
    approveTransaction,
    skipTransaction,
    getPendingCount,
} = require('../controllers/mpesaController');

// Public webhook — SMS forwarder apps POST here (auth via token in body)
router.post('/sms', receiveSmsWebhook);

// Protected — called by the Capacitor native SMS listener inside the app
router.post('/native-sms', protect, receiveNativeSms);

// Protected routes — used by the CashFlowly frontend
router.get('/pending', protect, getPendingTransactions);
router.get('/count', protect, getPendingCount);
router.post('/approve/:id', protect, approveTransaction);
router.put('/skip/:id', protect, skipTransaction);

module.exports = router;

