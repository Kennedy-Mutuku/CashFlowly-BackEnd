const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getNotifications);
router.route('/:id').put(protect, markAsRead).delete(protect, deleteNotification);

module.exports = router;
