import { Package } from '../models/Package.js';
import { makeEtagFromString, maxUpdatedAtIso } from '../utils/etag.js';

export const list = async (req, res, next) => {
  try {
    const packages = await Package.find().sort({ year: 1, part: 1 }).populate('moduleIds');
    const pkgs = packages.map((p) => (p.toObject ? p.toObject() : p));
    const maxUpdated = maxUpdatedAtIso(pkgs);
    const etag = makeEtagFromString(`${req.path}:${JSON.stringify(req.query || {})}:${maxUpdated}`);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(packages);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('moduleIds');
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    const doc = pkg.toObject ? pkg.toObject() : pkg;
    const maxUpdated = maxUpdatedAtIso([doc]);
    const etag = makeEtagFromString(`${req.path}:${req.params.id}:${maxUpdated}`);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(pkg);
  } catch (err) {
    next(err);
  }
};
