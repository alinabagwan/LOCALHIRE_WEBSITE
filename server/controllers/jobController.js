const Job = require('../models/Job');

// @desc    Get all jobs with optional filters
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    const { q, category, status } = req.query;

    let query = {};

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [
        { title: regex },
        { description: regex },
        { category: regex }
      ];
    }

    const jobs = await Job.find(query).populate('customer', 'name email avatarUrl').sort('-createdAt');

    const formatted = jobs.map(j => {
      const obj = j.toObject();
      return {
        id: obj._id,
        customerName: obj.customer ? obj.customer.name : 'Anonymous',
        customerId: obj.customer ? obj.customer._id : null,
        ...obj
      };
    });

    res.json({ success: true, count: formatted.length, jobs: formatted });
  } catch (error) {
    console.error('[Job Controller] getJobs error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving jobs' });
  }
};

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('customer', 'name email avatarUrl');
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job post not found' });
    }
    const obj = job.toObject();
    res.json({
      success: true,
      job: {
        id: obj._id,
        customerName: obj.customer ? obj.customer.name : 'Anonymous',
        customerId: obj.customer ? obj.customer._id : null,
        ...obj
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error retrieving job details' });
  }
};

// @desc    Create new job post
// @route   POST /api/jobs
// @access  Private (Customer)
exports.createJob = async (req, res) => {
  try {
    const { title, description, category, budget, urgency, location, lat, lng } = req.body;

    const jobData = {
      title,
      description,
      category,
      budget,
      urgency: urgency || 'Flexible',
      customer: req.user.id
    };

    if (lat && lng) {
      jobData.location = {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)],
        address: location || ''
      };
    }

    const job = await Job.create(jobData);
    const populated = await job.populate('customer', 'name email avatarUrl');
    const obj = populated.toObject();

    res.status(201).json({
      success: true,
      job: {
        id: obj._id,
        customerName: req.user.name,
        customerId: req.user.id,
        ...obj
      }
    });
  } catch (error) {
    console.error('[Job Controller] createJob error:', error);
    res.status(500).json({ success: false, message: 'Server error creating job post', error: error.message });
  }
};

// @desc    Update job status (e.g. Open -> In Progress -> Completed)
// @route   PUT /api/jobs/:id/status
// @access  Private
exports.updateJobStatus = async (req, res) => {
  try {
    const { status, assignedWorkerId } = req.body;
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (status) job.status = status;
    if (assignedWorkerId) job.assignedWorker = assignedWorkerId;

    await job.save();
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error updating job status' });
  }
};
