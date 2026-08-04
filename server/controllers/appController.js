const Application = require('../models/Application');
const Job = require('../models/Job');

// @desc    Submit a quote/application for a job
// @route   POST /api/applications
// @access  Private (Worker)
exports.createApplication = async (req, res) => {
  try {
    const jobId = req.body.jobId || req.body.job;
    const { quote, message } = req.body;

    console.error('[Application Controller] createApplication payload:', {
      jobId,
      quote: quote || '',
      message: message || '',
      workerId: req.user ? req.user.id : null
    });

    const jobExists = await Job.findById(jobId);
    if (!jobExists) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if worker already applied
    const existing = await Application.findOne({ job: jobId, worker: req.user.id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already submitted a quote for this job' });
    }

    const app = await Application.create({
      job: jobId,
      worker: req.user.id,
      quote,
      message,
      status: 'Pending'
    });

    const populated = await app.populate('worker', 'name avatarUrl email category rating');
    const obj = populated.toObject();

    res.status(201).json({
      success: true,
      application: {
        id: obj._id,
        jobId: obj.job,
        workerId: obj.worker._id,
        workerName: obj.worker.name,
        workerAvatar: obj.worker.avatarUrl,
        quote: obj.quote,
        message: obj.message,
        status: obj.status
      }
    });
  } catch (error) {
    console.error('[Application Controller] createApplication error:', error);
    res.status(500).json({
      success: false,
      message: error && error.message ? error.message : 'Server error submitting application'
    });
  }
};

// @desc    Get applications for a job (Customer view)
// @route   GET /api/applications/job/:jobId
// @access  Private
exports.getApplicationsForJob = async (req, res) => {
  try {
    const apps = await Application.find({ job: req.params.jobId }).populate('worker', 'name avatarUrl email category rating');
    const formatted = apps.map(a => {
      const obj = a.toObject();
      return {
        id: obj._id,
        jobId: obj.job,
        workerId: obj.worker ? obj.worker._id : null,
        workerName: obj.worker ? obj.worker.name : 'Unknown Worker',
        workerAvatar: obj.worker ? obj.worker.avatarUrl : '',
        quote: obj.quote,
        message: obj.message,
        status: obj.status
      };
    });

    res.json({ success: true, count: formatted.length, applications: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error getting job applications' });
  }
};

// @desc    Get applications submitted by logged-in worker
// @route   GET /api/applications/worker/me
// @access  Private (Worker)
exports.getWorkerApplications = async (req, res) => {
  try {
    const apps = await Application.find({ worker: req.user.id }).populate('job');
    const formatted = apps.map(a => {
      const obj = a.toObject();
      return {
        id: obj._id,
        jobId: obj.job ? obj.job._id : null,
        jobTitle: obj.job ? obj.job.title : '',
        quote: obj.quote,
        message: obj.message,
        status: obj.status
      };
    });

    res.json({ success: true, count: formatted.length, applications: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error getting worker applications' });
  }
};

// @desc    Accept a quote proposal
// @route   PUT /api/applications/:id/accept
// @access  Private (Customer)
exports.acceptQuote = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Quote proposal not found' });
    }

    app.status = 'Accepted';
    await app.save();

    // Assign worker and set job to 'In Progress'
    await Job.findByIdAndUpdate(app.job, {
      status: 'In Progress',
      assignedWorker: app.worker
    });

    res.json({ success: true, message: 'Quote accepted successfully! Job status updated to In Progress.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error accepting quote' });
  }
};
