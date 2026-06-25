const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { addReview, toggleFavorite, getFavorites } = require('../controllers/interactionController');

router.post('/hostels/:hostelId/reviews', authenticate, addReview);
router.post('/hostels/:hostelId/favorite', authenticate, toggleFavorite);
router.get('/favorites', authenticate, getFavorites);

module.exports = router;
