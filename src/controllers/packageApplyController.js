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

    // If package has a year defined, ensure it doesn't violate rules with existing active packages.
    if (pkg.year != null) {
      const existingPackages = await UserPackage.find({
        user: req.user._id,
        status: 'active',
      }).populate('package');

      for (const ex of existingPackages) {
        if (!ex?.package) continue;
        const existingType = ex.package.type;
        const existingYear = ex.package.year;

        // Only consider packages for the same year
        if (existingYear !== pkg.year) continue;

        // Duplicate exact package (same type & year)
        if (existingType === pkg.type) {
          return res.status(400).json({ message: 'You already have this package active.' });
        }

        // If user already has a full-year for this year, block any new purchase for same year
        if (existingType === 'year_full') {
          return res.status(400).json({ message: 'You already have a full-year package for this year.' });
        }

        // If user has a half package and is trying to buy full-year for same year, block upgrade/switch
        if ((existingType === 'year_half_part1' || existingType === 'year_half_part2') && pkg.type === 'year_full') {
          return res.status(400).json({ message: 'Cannot switch/upgrade to full-year while a half-year package is active.' });
        }

        // Otherwise (existing is a half and new is the other half) => allow
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
