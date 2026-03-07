import { Package } from '../models/Package.js';

export const list = async (req, res, next) => {
  try {
    const packages = await Package.find()
      .sort({ year: 1, part: 1 })
      .populate('moduleIds');

    res.json(packages);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('moduleIds');

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json(pkg);
  } catch (err) {
    next(err);
  }
};