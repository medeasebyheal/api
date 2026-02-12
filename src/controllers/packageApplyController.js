import { Package } from '../models/Package.js';
import { UserPackage } from '../models/UserPackage.js';
import { User } from '../models/User.js';

function isHalfPackage(pkg) {
  return pkg.type === 'year_half_part1' || pkg.type === 'year_half_part2';
}

export const apply = async (req, res, next) => {
  try {
    const { packageId, academicDetails } = req.body;
    const pkg = await Package.findById(packageId);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });

    if (isHalfPackage(pkg) && pkg.year != null) {
      const existing = await UserPackage.findOne({
        user: req.user._id,
        status: 'active',
      }).populate('package');
      if (existing?.package && isHalfPackage(existing.package) && existing.package.year === pkg.year) {
        return res.status(400).json({
          message: 'You can only have one half-package per year at a time. Complete or wait for current package before applying for another half.',
        });
      }
    }

    await User.findByIdAndUpdate(req.user._id, {
      academicDetails: academicDetails || {},
    });

    res.json({
      message: 'Application received. Please upload your payment receipt to complete the process.',
      package: pkg,
    });
  } catch (err) {
    next(err);
  }
};
