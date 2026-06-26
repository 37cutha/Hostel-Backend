const { importFromOpenStreetMap } = require('../controllers/importController');
const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate, requireOwner } = require('../middleware/auth');
const {
  createHostel,
  getNearbyHostels,
  getHostelById,
  updateHostel,
  deleteHostel,
  getMyHostels,
} = require('../controllers/hostelController');

// Public
router.get('/nearby', getNearbyHostels);

// Owner only (must be before /:id)
router.post('/import/osm', authenticate, requireOwner, importFromOpenStreetMap);
router.post('/', authenticate, requireOwner, upload.array('photos', 10), createHostel);
router.get('/mine/list', authenticate, requireOwner, getMyHostels);

// Dynamic routes (must be last)
router.get('/:id', getHostelById);
router.put('/:id', authenticate, requireOwner, updateHostel);
router.delete('/:id', authenticate, requireOwner, deleteHostel);

module.exports = router;