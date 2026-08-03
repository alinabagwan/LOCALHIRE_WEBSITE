const express = require('express');
const { getWorkers, getWorkerById, updateProfile } = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/workers', getWorkers);
router.get('/workers/:id', getWorkerById);
router.put('/profile', protect, updateProfile);

module.exports = router;
