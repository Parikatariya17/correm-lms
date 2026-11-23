import { z } from 'zod';
import LoanApplication from '../models/LoanApplication.js';
import RepaymentSchedule from '../models/RepaymentSchedule.js';
import {
  getInterestRateForLoanType,
  generateAmortizationSchedule,
} from '../services/loanMathService.js';
import { evaluateEligibility } from '../services/eligibilityService.js';
import { ApiError } from '../utils/ApiError.js';

// --- Zod Validation Schemas ---
const draftSchema = z.object({
  personalDetails: z
    .object({
      name: z.string().trim().optional(),
      dob: z.string().optional(),
      pan: z.string().trim().toUpperCase().optional(),
      address: z.string().trim().optional(),
    })
    .optional(),
  loanDetails: z
    .object({
      loanType: z.enum(['Personal', 'Home', 'Vehicle', 'Business']).optional(),
      amount: z.coerce.number().positive().optional(),
      tenureMonths: z.coerce.number().int().min(3).max(360).optional(),
      purpose: z.string().trim().optional(),
    })
    .optional(),
  incomeDetails: z
    .object({
      monthlyIncome: z.coerce.number().min(0).optional(),
      employmentType: z
        .enum(['Salaried', 'Self-Employed', 'Business Owner', 'Professional'])
        .optional(),
    })
    .optional(),
});

const strictSubmissionSchema = z.object({
  personalDetails: z.object({
    name: z.string().trim().min(2, 'Full name is required'),
    dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Valid date of birth is required',
    }),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Valid 10-character Indian PAN is required'),
    address: z.string().trim().min(10, 'Complete residential address is required'),
  }),
  loanDetails: z.object({
    loanType: z.enum(['Personal', 'Home', 'Vehicle', 'Business'], {
      errorMap: () => ({ message: 'Select a valid loan type' }),
    }),
    amount: z.coerce
      .number()
      .min(10000, 'Loan amount must be at least ₹10,000')
      .max(100000000, 'Loan amount cannot exceed ₹10 Crore'),
    tenureMonths: z.coerce
      .number()
      .int()
      .min(3, 'Minimum tenure is 3 months')
      .max(360, 'Maximum tenure is 360 months'),
    purpose: z.string().trim().min(5, 'Loan purpose is required'),
  }),
  incomeDetails: z.object({
    monthlyIncome: z.coerce
      .number()
      .min(5000, 'Monthly income must be at least ₹5,000'),
    employmentType: z.enum(
      ['Salaried', 'Self-Employed', 'Business Owner', 'Professional'],
      { errorMap: () => ({ message: 'Select a valid employment type' }) }
    ),
  }),
});

const officerActionSchema = z.object({
  status: z.enum([
    'UNDER_REVIEW',
    'MORE_INFO_NEEDED',
    'RECOMMENDED_APPROVE',
    'RECOMMENDED_REJECT',
  ]),
  remarks: z.string().trim().min(3, 'Officer remarks are required'),
});

const adminDecisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().trim().min(3, 'Final decision remarks are required'),
});

// Helper to create consistent audit log entry
const createAuditEntry = (action, status, user, remarks = '') => ({
  action,
  status,
  changedBy: user._id,
  role: user.role,
  remarks,
  timestamp: new Date(),
});

// ============================================================================
// APPLICANT CONTROLLERS
// ============================================================================

// @desc    Create a new DRAFT loan application
// @route   POST /api/v1/loans
export const createDraftApplication = async (req, res, next) => {
  try {
    const parsedData = draftSchema.parse(req.body);

    if (parsedData.loanDetails?.loanType) {
      parsedData.loanDetails.interestRate = getInterestRateForLoanType(
        parsedData.loanDetails.loanType
      );
    }

    const application = await LoanApplication.create({
      applicantId: req.user._id,
      status: 'DRAFT',
      ...parsedData,
      auditLogs: [
        createAuditEntry('CREATED_DRAFT', 'DRAFT', req.user, 'Application draft created'),
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Loan draft created',
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update DRAFT (or MORE_INFO_NEEDED) application fields
// @route   PATCH /api/v1/loans/:id
export const updateApplication = async (req, res, next) => {
  try {
    const application = await LoanApplication.findOne({
      _id: req.params.id,
      applicantId: req.user._id,
    });

    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    if (!['DRAFT', 'MORE_INFO_NEEDED'].includes(application.status)) {
      throw new ApiError(
        400,
        `Application cannot be edited while in '${application.status}' status`
      );
    }

    const parsedData = draftSchema.parse(req.body);

    if (parsedData.personalDetails) {
      application.personalDetails = {
        ...application.personalDetails?.toObject(),
        ...parsedData.personalDetails,
      };
    }
    if (parsedData.loanDetails) {
      const loanType =
        parsedData.loanDetails.loanType || application.loanDetails?.loanType;
      application.loanDetails = {
        ...application.loanDetails?.toObject(),
        ...parsedData.loanDetails,
        ...(loanType && { interestRate: getInterestRateForLoanType(loanType) }),
      };
    }
    if (parsedData.incomeDetails) {
      application.incomeDetails = {
        ...application.incomeDetails?.toObject(),
        ...parsedData.incomeDetails,
      };
    }

    application.auditLogs.push(
      createAuditEntry(
        'UPDATED_APPLICATION',
        application.status,
        req.user,
        'Applicant updated application details'
      )
    );

    await application.save();

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload / Re-upload document (allowed in DRAFT or MORE_INFO_NEEDED)
// @route   POST /api/v1/loans/:id/documents
export const uploadApplicationDocument = async (req, res, next) => {
  try {
    const application = await LoanApplication.findOne({
      _id: req.params.id,
      applicantId: req.user._id,
    });

    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    if (!['DRAFT', 'MORE_INFO_NEEDED'].includes(application.status)) {
      throw new ApiError(
        400,
        `Documents cannot be uploaded when status is '${application.status}'`
      );
    }

    if (!req.uploadedFile) {
      throw new ApiError(400, 'Document upload failed');
    }

    // Replace existing doc of same docType if re-uploading, otherwise push
    const existingIndex = application.documents.findIndex(
      (doc) => doc.docType === req.uploadedFile.docType
    );

    if (existingIndex > -1) {
      application.documents[existingIndex] = {
        ...req.uploadedFile,
        uploadedAt: new Date(),
      };
    } else {
      application.documents.push({
        ...req.uploadedFile,
        uploadedAt: new Date(),
      });
    }

    application.auditLogs.push(
      createAuditEntry(
        'DOCUMENT_UPLOADED',
        application.status,
        req.user,
        `Uploaded document: ${req.uploadedFile.docType}`
      )
    );

    await application.save();

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: req.uploadedFile,
        documents: application.documents,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit or Re-submit application with strict Zod validation
// @route   POST /api/v1/loans/:id/submit
export const submitApplication = async (req, res, next) => {
  try {
    const application = await LoanApplication.findOne({
      _id: req.params.id,
      applicantId: req.user._id,
    });

    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    if (!['DRAFT', 'MORE_INFO_NEEDED'].includes(application.status)) {
      throw new ApiError(
        400,
        `Cannot submit application from '${application.status}' status`
      );
    }

    // Merge optional payload from submit request if passed
    const mergedPayload = {
      personalDetails: {
        ...application.personalDetails?.toObject(),
        ...req.body.personalDetails,
        ...(application.personalDetails?.dob && {
          dob: new Date(application.personalDetails.dob).toISOString(),
        }),
        ...(req.body.personalDetails?.dob && {
          dob: req.body.personalDetails.dob,
        }),
      },
      loanDetails: {
        ...application.loanDetails?.toObject(),
        ...req.body.loanDetails,
      },
      incomeDetails: {
        ...application.incomeDetails?.toObject(),
        ...req.body.incomeDetails,
      },
    };

    // Strict Zod validation before submission
    const validated = strictSubmissionSchema.parse(mergedPayload);

    if (!application.documents || application.documents.length === 0) {
      throw new ApiError(
        400,
        'At least one supporting document (ID or Income proof) must be uploaded before submitting'
      );
    }

    const interestRate = getInterestRateForLoanType(validated.loanDetails.loanType);

    application.personalDetails = validated.personalDetails;
    application.loanDetails = {
      ...validated.loanDetails,
      interestRate,
    };
    application.incomeDetails = validated.incomeDetails;

    // Auto-run initial eligibility report on submission
    application.eligibilityReport = evaluateEligibility(application);

    const previousStatus = application.status;
    application.status = 'SUBMITTED';

    application.auditLogs.push(
      createAuditEntry(
        previousStatus === 'MORE_INFO_NEEDED'
          ? 'RESUBMITTED_APPLICATION'
          : 'SUBMITTED_APPLICATION',
        'SUBMITTED',
        req.user,
        previousStatus === 'MORE_INFO_NEEDED'
          ? 'Applicant provided requested info and resubmitted'
          : 'Applicant submitted loan application for review'
      )
    );

    await application.save();

    res.status(200).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged-in applicant's own applications
// @route   GET /api/v1/loans/my
export const getMyApplications = async (req, res, next) => {
  try {
    const applications = await LoanApplication.find({
      applicantId: req.user._id,
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: { applications },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single loan application details (Applicant owns it, or Officer/Admin)
// @route   GET /api/v1/loans/:id
export const getApplicationById = async (req, res, next) => {
  try {
    const application = await LoanApplication.findById(req.params.id)
      .populate('applicantId', 'name email')
      .populate('auditLogs.changedBy', 'name email role');

    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    if (
      req.user.role === 'applicant' &&
      application.applicantId._id.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, 'You are not authorized to view this application');
    }

    res.status(200).json({
      success: true,
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View repayment schedule for an approved loan
// @route   GET /api/v1/loans/:id/repayment-schedule
export const getRepaymentSchedule = async (req, res, next) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    if (
      req.user.role === 'applicant' &&
      application.applicantId.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, 'Access denied to this repayment schedule');
    }

    const schedule = await RepaymentSchedule.findOne({
      applicationId: req.params.id,
    });

    if (!schedule) {
      throw new ApiError(
        404,
        'Repayment schedule not generated yet (loan must be APPROVED)'
      );
    }

    res.status(200).json({
      success: true,
      data: { schedule },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// OFFICER & ADMIN CONTROLLERS
// ============================================================================

// @desc    Get paginated & filtered applications (Officer / Admin)
// @route   GET /api/v1/loans
export const getAllApplications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { status, loanType, search } = req.query;
    const filter = {};

    // Hide unsubmitted DRAFT applications from officer/admin queues by default
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: 'DRAFT' };
    }

    if (loanType) {
      filter['loanDetails.loanType'] = loanType;
    }

    if (search) {
      filter.$or = [
        { 'personalDetails.name': { $regex: search, $options: 'i' } },
        { 'personalDetails.pan': { $regex: search, $options: 'i' } },
        { 'loanDetails.purpose': { $regex: search, $options: 'i' } },
      ];
    }

    const [applications, total] = await Promise.all([
      LoanApplication.find(filter)
        .populate('applicantId', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      LoanApplication.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        applications,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Run & save deterministic eligibility check (Officer / Admin)
// @route   POST /api/v1/loans/:id/eligibility
export const runEligibilityCheck = async (req, res, next) => {
  try {
    const application = await LoanApplication.findById(req.params.id);
    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    const report = evaluateEligibility(application);
    application.eligibilityReport = report;

    application.auditLogs.push(
      createAuditEntry(
        'RAN_ELIGIBILITY_CHECK',
        application.status,
        req.user,
        `Eligibility check executed: ${report.isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'} (Score: ${report.score}/100)`
      )
    );

    await application.save();

    res.status(200).json({
      success: true,
      message: 'Eligibility evaluation completed',
      data: { eligibilityReport: report },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Officer review action (UNDER_REVIEW, MORE_INFO_NEEDED, RECOMMENDED_APPROVE, RECOMMENDED_REJECT)
// @route   PATCH /api/v1/loans/:id/review
export const officerReviewApplication = async (req, res, next) => {
  try {
    const { status, remarks } = officerActionSchema.parse(req.body);

    const application = await LoanApplication.findById(req.params.id);
    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    const allowedCurrentStatuses = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'MORE_INFO_NEEDED',
    ];

    if (!allowedCurrentStatuses.includes(application.status)) {
      throw new ApiError(
        400,
        `Officer cannot review an application currently in '${application.status}' status`
      );
    }

    // Ensure eligibility report exists before recommending approval/rejection
    if (
      ['RECOMMENDED_APPROVE', 'RECOMMENDED_REJECT'].includes(status) &&
      !application.eligibilityReport
    ) {
      application.eligibilityReport = evaluateEligibility(application);
    }

    application.status = status;
    application.auditLogs.push(
      createAuditEntry(`OFFICER_${status}`, status, req.user, remarks)
    );

    await application.save();

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin final decision (APPROVED or REJECTED) + auto-generate RepaymentSchedule
// @route   PATCH /api/v1/loans/:id/decision
export const adminFinalDecision = async (req, res, next) => {
  try {
    const { status, remarks } = adminDecisionSchema.parse(req.body);

    const application = await LoanApplication.findById(req.params.id);
    if (!application) {
      throw new ApiError(404, 'Loan application not found');
    }

    const allowedForAdmin = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'RECOMMENDED_APPROVE',
      'RECOMMENDED_REJECT',
    ];

    if (!allowedForAdmin.includes(application.status)) {
      throw new ApiError(
        400,
        `Cannot make final decision on an application in '${application.status}' status`
      );
    }

    application.status = status;
    application.auditLogs.push(
      createAuditEntry(`ADMIN_${status}`, status, req.user, remarks)
    );

    await application.save();

    let repaymentSchedule = null;

    // Auto-generate and persist RepaymentSchedule upon APPROVED
    if (status === 'APPROVED') {
      const { amount, interestRate, tenureMonths, loanType } =
        application.loanDetails;
      const effectiveRate =
        interestRate || getInterestRateForLoanType(loanType);

      const installments = generateAmortizationSchedule(
        amount,
        effectiveRate,
        tenureMonths,
        new Date()
      );

      repaymentSchedule = await RepaymentSchedule.findOneAndUpdate(
        { applicationId: application._id },
        {
          applicationId: application._id,
          applicantId: application.applicantId,
          installments,
        },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: `Loan application ${status.toLowerCase()} successfully`,
      data: {
        application,
        ...(repaymentSchedule && { repaymentSchedule }),
      },
    });
  } catch (error) {
    next(error);
  }
};
