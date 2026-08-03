const Review = require('../models/Review');
const User = require('../models/User');

// @desc    Add review for a worker
// @route   POST /api/reviews
// @access  Private (Customer)
exports.createReview = async (req, res) => {
  try {
    const { jobId, workerId, rating, comment } = req.body;

    const review = await Review.create({
      job: jobId,
      worker: workerId,
      customer: req.user.id,
      rating: parseFloat(rating),
      comment
    });

    // Recalculate worker rating
    const reviews = await Review.find({ worker: workerId });
    const avgRating = reviews.reduce((acc, item) => acc + item.rating, 0) / reviews.length;

    await User.findByIdAndUpdate(workerId, {
      rating: parseFloat(avgRating.toFixed(1)),
      reviewsCount: reviews.length
    });

    res.status(201).json({ success: true, review, updatedRating: avgRating.toFixed(1) });
  } catch (error) {
    console.error('[Review Controller] createReview error:', error);
    res.status(500).json({ success: false, message: 'Server error creating review' });
  }
};

// @desc    Get reviews for a worker
// @route   GET /api/reviews/worker/:workerId
// @access  Public
exports.getWorkerReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ worker: req.params.workerId })
      .populate('customer', 'name avatarUrl')
      .sort('-createdAt');

    res.json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error retrieving reviews' });
  }
};
