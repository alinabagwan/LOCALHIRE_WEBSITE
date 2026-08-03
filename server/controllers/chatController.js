const Message = require('../models/Message');

// @desc    Get message history between two users
// @route   GET /api/chat/messages/:otherUserId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { otherUserId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    }).sort('createdAt');

    res.json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error retrieving messages' });
  }
};

// @desc    Send a message
// @route   POST /api/chat/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, jobId, content } = req.body;

    const message = await Message.create({
      sender: req.user.id,
      receiver: receiverId,
      job: jobId || null,
      content
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
};
