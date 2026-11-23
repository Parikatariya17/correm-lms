import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    docType: {
      type: String,
      trim: true,
      // e.g., 'PAN_CARD', 'AADHAAR', 'SALARY_SLIP', 'BANK_STATEMENT', 'ITR'
    },
    url: {
      type: String,
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true, // e.g., 'CREATED_DRAFT', 'SUBMITTED', 'REQUESTED_INFO', 'RECOMMENDED_APPROVE'
    },
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['applicant', 'officer', 'admin'],
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const loanApplicationSchema = new mongoose.Schema(
  {
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'MORE_INFO_NEEDED',
        'RECOMMENDED_APPROVE',
        'RECOMMENDED_REJECT',
        'APPROVED',
        'REJECTED',
      ],
      default: 'DRAFT',
      index: true,
    },
    // Nested fields kept optional so DRAFT applications can be saved partially
    personalDetails: {
      name: { type: String, trim: true },
      dob: { type: Date },
      pan: {
        type: String,
        uppercase: true,
        trim: true,
        match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid Indian PAN format'],
      },
      address: { type: String, trim: true },
    },
    loanDetails: {
      loanType: {
        type: String,
        enum: ['Personal', 'Home', 'Vehicle', 'Business'],
      },
      amount: {
        type: Number,
        min: [10000, 'Minimum loan amount is ₹10,000'],
      },
      tenureMonths: {
        type: Number,
        min: [3, 'Minimum tenure is 3 months'],
        max: [360, 'Maximum tenure is 360 months'],
      },
      purpose: {
        type: String,
        trim: true,
      },
      interestRate: {
        type: Number,
        min: 0,
        max: 50,
      },
    },
    incomeDetails: {
      monthlyIncome: {
        type: Number,
        min: 0,
      },
      employmentType: {
        type: String,
        enum: ['Salaried', 'Self-Employed', 'Business Owner', 'Professional'],
      },
    },
    documents: {
      type: [documentSchema],
      default: [],
    },
    eligibilityReport: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    auditLogs: {
      type: [auditLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

loanApplicationSchema.index({ status: 1, createdAt: -1 });

const LoanApplication = mongoose.model('LoanApplication', loanApplicationSchema);
export default LoanApplication;
