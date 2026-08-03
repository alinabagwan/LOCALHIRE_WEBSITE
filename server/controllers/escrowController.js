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

    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Job ID is required' });
    }

    const escrow = await EscrowTransaction.findOne({ job: jobId, status: 'Escrow_Held' });
    if (!escrow) {
      return res.status(404).json({ success: false, message: 'No active held escrow transaction found for this job' });
    }

    // Verify requester is job customer or admin
    if (escrow.customer.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only the customer or admin can release payment' });
    }

    escrow.status = 'Released';
    escrow.releasedAt = new Date();
    await escrow.save();

    // Mark job as completed
    const job = await Job.findById(jobId);
    if (job) {
      job.status = 'Completed';
      await job.save();
    }

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
