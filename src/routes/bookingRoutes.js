const express = require('express');
const router = express.Router();
const { authenticate, requireOwner } = require('../middleware/auth');
const {
  createBooking,
  getOwnerBookings,
  getMyBookings,
  updateBookingStatus,
} = require('../controllers/bookingController');

router.post('/hostels/:hostelId/bookings', authenticate, createBooking);
router.get('/bookings/mine', authenticate, getMyBookings);
router.get('/bookings/owner', authenticate, requireOwner, getOwnerBookings);
router.put('/bookings/:id/status', authenticate, requireOwner, updateBookingStatus);

module.exports = router;