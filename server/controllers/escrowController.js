// LocalHire - Escrow Controller
// Isolated controller handling milestone funding, payment release, disputes, and user ledgers.

const EscrowTransaction = require('../models/EscrowTransaction');
const Job = require('../models/Job');
const User = require('../models/User');

// @desc    Fund job escrow (Hold payment in escrow)
// @route   POST /api/escrow/fund
// @access  Private (Customer)
exports.fundEscrow = async (req, res) => {
  try {
    const { jobId, workerId, amount, paymentMethod } = req.body;

    if (!jobId || !workerId || !amount) {
      return res.status(400).json({ success: false, message: 'Job ID, worker ID, and amount are required' });
    }

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if an active escrow already exists for this job
    const existingEscrow = await EscrowTransaction.findOne({ job: jobId, status: 'Escrow_Held' });
    if (existingEscrow) {
      return res.status(400).json({ success: false, message: 'Escrow is already active and funded for this job' });
    }

    // Generate unique transaction reference
    const transactionRef = 'TXN_ESCROW_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const escrow = await EscrowTransaction.create({
      job: jobId,
      customer: req.user._id,
      worker: workerId,
      amount: parseFloat(amount),
      currency: 'INR',
      status: 'Escrow_Held',
      paymentMethod: paymentMethod || 'UPI / Card (Simulated)',
      transactionRef
    });

    // Update job status to 'In Progress' and assign worker if not already
    job.status = 'In Progress';
    job.assignedWorker = workerId;
    await job.save();

    res.status(201).json({
      success: true,
      message: 'Payment successfully locked in Escrow',
      escrow
    });
  } catch (error) {
    console.error('[Escrow Controller] Fund Error:', error);
    res.status(500).json({ success: false, message: 'Server error while funding escrow', error: error.message });
  }
};

// @desc    Release escrow funds to worker & complete job
// @route   POST /api/escrow/release
// @access  Private (Customer or Admin)
exports.releaseEscrow = async (req, res) => {
  try {
    const { jobId } = req.body;

    console.log('[Escrow Controller] ReleaseEscrow request body', { jobId, userId: req.user?._id?.toString?.() });

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }

    const escrow = await EscrowTransaction.findOne({ job: jobId, status: 'Escrow_Held' });
    console.log('[Escrow Controller] ReleaseEscrow lookup result', { jobId, escrow: escrow ? escrow.toObject() : null });

    if (!escrow) {
      return res.status(404).json({ success: false, message: 'No active held escrow transaction found for this job' });
    }

    // Verify requester is job customer or admin
    if (escrow.customer.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only the customer or admin can release payment' });
    }

    escrow.status = 'Released';
    escrow.releasedAt = new Date();

    console.log('[Escrow Controller] ReleaseEscrow: about to save escrow', {
      jobId,
      escrowId: escrow._id,
      currentStatus: escrow.status
    });

    try {
      await escrow.save();
      console.log('[Escrow Controller] ReleaseEscrow: escrow saved successfully', {
        jobId,
        escrowId: escrow._id,
        status: escrow.status
      });
    } catch (saveError) {
      console.error('[Escrow Controller] ReleaseEscrow save failed:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save escrow release',
        error: saveError.message
      });
    }

    // Mark job as completed
    console.log('[Escrow Controller] ReleaseEscrow: attempting to find job', { jobId });
    
    let job;
    try {
      job = await Job.findById(jobId);
      console.log('[Escrow Controller] ReleaseEscrow: job lookup result', {
        jobId,
        jobFound: !!job,
        jobId_returned: job?._id?.toString?.() || 'N/A',
        currentJobStatus: job?.status || 'N/A'
      });
    } catch (jobLookupError) {
      console.error('[Escrow Controller] ReleaseEscrow: Job lookup error:', jobLookupError);
      return res.status(500).json({
        success: false,
        message: 'Failed to lookup job for completion',
        error: jobLookupError.message
      });
    }

    if (!job) {
      console.warn('[Escrow Controller] ReleaseEscrow: Job not found after lookup', { jobId });
      return res.status(404).json({
        success: false,
        message: 'Job not found for completion update'
      });
    }

    // Update job status to Completed
    console.log('[Escrow Controller] ReleaseEscrow: updating job status', {
      jobId,
      oldStatus: job.status,
      newStatus: 'Completed'
    });

    job.status = 'Completed';

    try {
      await job.save();
      console.log('[Escrow Controller] ReleaseEscrow: job saved successfully', {
        jobId,
        updatedStatus: job.status,
        savedAt: new Date().toISOString()
      });
    } catch (jobSaveError) {
      console.error('[Escrow Controller] ReleaseEscrow: Job save failed:', {
        jobId,
        error: jobSaveError.message,
        stack: jobSaveError.stack
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to save job completion',
        error: jobSaveError.message
      });
    }

    // Send success response
    console.log('[Escrow Controller] ReleaseEscrow: sending success response', {
      jobId,
      escrowId: escrow._id,
      escrowStatus: escrow.status,
      jobStatus: job.status
    });

    res.json({
      success: true,
      message: 'Escrow funds successfully released to worker. Job marked as Completed!',
      escrow
    });
  } catch (error) {
    console.error('[Escrow Controller] Release Error:', error);
    res.status(500).json({ success: false, message: 'Server error while releasing escrow', error: error.message });
  }
};

// @desc    Raise a dispute on held escrow
// @route   POST /api/escrow/dispute
// @access  Private (Customer or Worker)
exports.disputeEscrow = async (req, res) => {
  try {
    const { jobId, reason } = req.body;

    const escrow = await EscrowTransaction.findOne({ job: jobId, status: 'Escrow_Held' });
    if (!escrow) {
      return res.status(404).json({ success: false, message: 'No active held escrow transaction found for this job' });
    }

    escrow.status = 'Disputed';
    escrow.disputeReason = reason || 'Issue reported during job execution';
    await escrow.save();

    res.json({
      success: true,
      message: 'Escrow payment flagged for dispute. Admin team will review.',
      escrow
    });
  } catch (error) {
    console.error('[Escrow Controller] Dispute Error:', error);
    res.status(500).json({ success: false, message: 'Server error while disputing escrow', error: error.message });
  }
};

// @desc    Get escrow status for a specific job
// @route   GET /api/escrow/job/:jobId
// @access  Private
exports.getJobEscrow = async (req, res) => {
  try {
    const escrow = await EscrowTransaction.findOne({ job: req.params.jobId })
      .populate('customer', 'name email')
      .populate('worker', 'name email');

    res.json({
      success: true,
      escrow: escrow || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching job escrow' });
  }
};

// @desc    Get user financial ledger (all escrow transactions)
// @route   GET /api/escrow/ledger
// @access  Private
exports.getUserLedger = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find transactions where user is customer or worker
    const transactions = await EscrowTransaction.find({
      $or: [{ customer: userId }, { worker: userId }]
    })
      .populate('job', 'title category')
      .populate('customer', 'name email')
      .populate('worker', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error fetching transaction ledger' });
  }
};
