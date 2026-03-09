import { Bookmark } from '../models/Bookmark.js';

export const createBookmark = async (req, res, next) => {
  try {
    const user = req.user._id;
    const { topic, mcq } = req.body;
    if (!topic || !mcq) return res.status(400).json({ message: 'topic and mcq are required' });
    // idempotent: return existing if present
    const existing = await Bookmark.findOne({ user, topic, mcq }).lean();
    if (existing) return res.json(existing);
    const bm = await Bookmark.create({ user, topic, mcq });
    res.status(201).json(bm);
  } catch (err) {
    if (err.code === 11000) {
      // race: find and return
      const found = await Bookmark.findOne({ user: req.user._id, topic: req.body.topic, mcq: req.body.mcq }).lean();
      if (found) return res.json(found);
    }
    next(err);
  }
};

export const deleteBookmark = async (req, res, next) => {
  try {
    const id = req.params.id;
    const bm = await Bookmark.findById(id);
    if (!bm) return res.status(404).json({ message: 'Bookmark not found' });
    if (String(bm.user) !== String(req.user._id)) return res.status(403).json({ message: 'Not allowed' });
    await bm.deleteOne();
    res.json({ message: 'Bookmark removed' });
  } catch (err) {
    next(err);
  }
};

export const listBookmarks = async (req, res, next) => {
  try {
    const user = req.user._id;
    const topic = req.query.topic;
    const filter = { user };
    if (topic) filter.topic = topic;
    const items = await Bookmark.find(filter).populate('mcq').sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
};

