const User = require('../models/User');

// @desc    Get workers with optional search, category & geospatial filters
// @route   GET /api/users/workers
// @access  Public
exports.getWorkers = async (req, res) => {
  try {
    const { q, category, maxPrice, lat, lng, maxDistanceKm } = req.query;

    let query = { role: 'Worker' };

    if (category) {
      query.category = category;
    }

    if (maxPrice && !isNaN(maxPrice)) {
      query.hourlyRate = { $lte: parseFloat(maxPrice) };
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [
        { name: regex },
        { category: regex },
        { skills: regex },
        { bio: regex }
      ];
    }

    // Geospatial filter using 2dsphere index if lat and lng provided
    if (lat && lng) {
      const radiusInMeters = (parseFloat(maxDistanceKm) || 20) * 1000;
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: radiusInMeters
        }
      };
    }

    const workers = await User.find(query);

    // Format output with id
    const formatted = workers.map(w => {
      const obj = w.toObject();
      return {
        id: obj._id,
        ...obj
      };
    });

    res.json({ success: true, count: formatted.length, workers: formatted });
  } catch (error) {
    console.error('[User Controller] getWorkers error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving workers', error: error.message });
  }
};

// @desc    Get worker by ID
// @route   GET /api/users/workers/:id
// @access  Public
exports.getWorkerById = async (req, res) => {
  try {
    const worker = await User.findById(req.params.id);
    if (!worker || worker.role !== 'Worker') {
      return res.status(404).json({ success: false, message: 'Worker profile not found' });
    }
    const obj = worker.toObject();
    res.json({ success: true, worker: { id: obj._id, ...obj } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error retrieving worker profile' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = { ...req.body };

    // Format location if lat/lng are supplied
    if (fieldsToUpdate.lat && fieldsToUpdate.lng) {
      fieldsToUpdate.location = {
        type: 'Point',
        coordinates: [parseFloat(fieldsToUpdate.lng), parseFloat(fieldsToUpdate.lat)],
        address: fieldsToUpdate.address || 'Local GPS location'
      };
      delete fieldsToUpdate.lat;
      delete fieldsToUpdate.lng;
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    const obj = user.toObject();
    res.json({ success: true, user: { id: obj._id, ...obj } });
  } catch (error) {
    console.error('[User Controller] updateProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};
