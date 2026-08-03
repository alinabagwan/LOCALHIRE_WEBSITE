const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

// @desc    Get system-wide governance metrics
// @route   GET /api/admin/metrics
// @access  Private (Admin)
exports.getMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalWorkers = await User.countDocuments({ role: 'Worker' });
    const totalCustomers = await User.countDocuments({ role: 'Customer' });
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ status: { $in: ['Open', 'In Progress'] } });
    const completedJobs = await Job.countDocuments({ status: 'Completed' });
    const totalApplications = await Application.countDocuments();

    res.json({
      success: true,
      metrics: {
        totalUsers,
        totalWorkers,
        totalCustomers,
        totalJobs,
        activeJobs,
        completedJobs,
        totalApplications
      }
    });
  } catch (error) {
    console.error('[Admin Controller] getMetrics error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving admin metrics' });
  }
};

// @desc    Get all users for admin listing
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('-createdAt');
    const formatted = users.map(u => {
      const obj = u.toObject();
      return {
        id: obj._id,
        ...obj
      };
    });

    res.json({ success: true, count: formatted.length, users: formatted });
  } catch (error) {
    console.error('[Admin Controller] getAllUsers error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving user accounts' });
  }
};

// @desc    Delete a user account
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.deleteOne();
    res.json({ success: true, message: 'User account removed successfully' });
  } catch (error) {
    console.error('[Admin Controller] deleteUser error:', error);
    res.status(500).json({ success: false, message: 'Server error removing user' });
  }
};

// @desc    Delete/Moderate a job post
// @route   DELETE /api/admin/jobs/:id
// @access  Private (Admin)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job post not found' });
    }

    await job.deleteOne();
    res.json({ success: true, message: 'Job post removed successfully' });
  } catch (error) {
    console.error('[Admin Controller] deleteJob error:', error);
    res.status(500).json({ success: false, message: 'Server error moderating job post' });
  }
};
