import express from 'express';
import {
  createDraftApplication,
  updateApplication,
  uploadApplicationDocument,
  submitApplication,
  getMyApplications,
  getApplicationById,
  getRepaymentSchedule,
  getAllApplications,
  runEligibilityCheck,
  officerReviewApplication,
  adminFinalDecision,
} from '../controllers/loanController.js';
import { verifyJWT, authorizeRoles } from '../middlewares/authMiddleware.js';
import {
  upload,
  handleCloudinaryUpload,
} from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// All loan routes require valid JWT authentication
router.use(verifyJWT);

// --- Applicant Routes ---
router.post('/', authorizeRoles('applicant'), createDraftApplication);
router.get('/my', authorizeRoles('applicant'), getMyApplications);
router.patch('/:id', authorizeRoles('applicant'), updateApplication);
router.post(
  '/:id/documents',
  authorizeRoles('applicant'),
  upload.single('document'),
  handleCloudinaryUpload,
  uploadApplicationDocument
);
router.post('/:id/submit', authorizeRoles('applicant'), submitApplication);

// --- Shared View Routes (Applicant owns it, or Officer / Admin) ---
router.get('/:id', getApplicationById);
router.get('/:id/repayment-schedule', getRepaymentSchedule);

// --- Officer & Admin Routes ---
router.get('/', authorizeRoles('officer', 'admin'), getAllApplications);
router.post(
  '/:id/eligibility',
  authorizeRoles('officer', 'admin'),
  runEligibilityCheck
);
router.patch(
  '/:id/review',
  authorizeRoles('officer'),
  officerReviewApplication
);

// --- Admin Final Decision Route ---
router.patch(
  '/:id/decision',
  authorizeRoles('admin'),
  adminFinalDecision
);

export default router;
