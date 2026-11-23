import mongoose from 'mongoose';

const installmentSchema = new mongoose.Schema(
  {
    installmentNo: {
      type: Number,
      required: true,
      min: 1,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    emi: {
      type: Number,
      required: true,
      min: 0,
    },
    principal: {
      type: Number,
      required: true,
      min: 0,
    },
    interest: {
      type: Number,
      required: true,
      min: 0,
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'OVERDUE'],
      default: 'PENDING',
    },
  },
  { _id: true }
);

const repaymentScheduleSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: [true, 'Loan Application ID is required'],
      unique: true,
      index: true,
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant ID is required'],
      index: true,
    },
    installments: {
      type: [installmentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const RepaymentSchedule = mongoose.model('RepaymentSchedule', repaymentScheduleSchema);
export default RepaymentSchedule;
