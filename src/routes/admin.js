import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import { uploadToCloudinary } from '../config/cloudinary.js';
import * as admin from '../controllers/adminContentController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
router.use(auth);
router.use(requireRole('admin'));

router.post('/upload-image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Image file required' });
    const result = await uploadToCloudinary(req.file.buffer, 'medease/resources');
    res.json({ url: result.secure_url });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', admin.dashboardStats);

router.get('/years', admin.listYears);
router.post('/years', admin.createYear);
router.put('/years/:id', admin.updateYear);
router.delete('/years/:id', admin.deleteYear);

router.get('/years/:yearId/modules', admin.listModules);
router.post('/years/:yearId/modules', admin.createModule);
router.put('/modules/:id', admin.updateModule);
router.delete('/modules/:id', admin.deleteModule);

router.get('/modules/:moduleId/subjects', admin.listSubjects);
router.post('/modules/:moduleId/subjects', admin.createSubject);
router.put('/subjects/:id', admin.updateSubject);
router.delete('/subjects/:id', admin.deleteSubject);

router.get('/subjects/:subjectId/topics', admin.listTopics);
router.post('/subjects/:subjectId/topics', admin.createTopic);
router.put('/topics/:id', admin.updateTopic);
router.delete('/topics/:id', admin.deleteTopic);

router.get('/topics/:topicId/mcqs', admin.listMcqs);
router.post('/topics/:topicId/mcqs', admin.createMcq);
router.put('/topics/:topicId/mcqs/:mcqId', admin.updateMcq);
router.delete('/topics/:topicId/mcqs/:mcqId', admin.deleteMcq);
router.post('/topics/:topicId/mcqs/bulk', admin.bulkCreateMcqs);

router.get('/modules/:moduleId/ospes', admin.listOspes);
router.post('/modules/:moduleId/ospes', admin.createOspe);
router.put('/ospes/:id', admin.updateOspe);
router.delete('/ospes/:id', admin.deleteOspe);

router.get('/proff', admin.listProff);
router.put('/proff', admin.upsertProff);

router.get('/packages', admin.listPackagesAdmin);
router.post('/packages', admin.createPackage);
router.put('/packages/:id', admin.updatePackage);
router.delete('/packages/:id', admin.deletePackage);

export default router;
