import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';
import {
  User,
  IndianRupee,
  Briefcase,
  FileUp,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Save,
  Send,
  AlertTriangle,
  FileText,
  Calculator,
  Loader2,
  ExternalLink,
} from 'lucide-react';

const INTEREST_RATES = {
  Home: 8.5,
  Vehicle: 10.5,
  Personal: 13.5,
  Business: 15.0,
};

const STEPS = [
  { id: 1, title: 'Personal Details', icon: User },
  { id: 2, title: 'Loan & EMI', icon: IndianRupee },
  { id: 3, title: 'Income Info', icon: Briefcase },
  { id: 4, title: 'Documents', icon: FileUp },
];

const REQUIRED_DOC_SLOTS = [
  {
    docType: 'ID_PROOF',
    label: 'Identity Proof (PAN / Aadhaar / Passport)',
    hint: 'PDF, JPG, or PNG up to 5MB',
  },
  {
    docType: 'INCOME_PROOF',
    label: 'Income Proof (Salary Slip / Bank Statement / ITR)',
    hint: 'PDF, JPG, or PNG up to 5MB',
  },
];

export default function ApplyLoan() {
  const { id } = useParams(); // Optional: present when resuming DRAFT or MORE_INFO_NEEDED
  const navigate = useNavigate();

  const [applicationId, setApplicationId] = useState(id || null);
  const [appStatus, setAppStatus] = useState('DRAFT');
  const [officerRemarks, setOfficerRemarks] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(!!id);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  const [personalDetails, setPersonalDetails] = useState({
    name: '',
    dob: '',
    pan: '',
    address: '',
  });

  const [loanDetails, setLoanDetails] = useState({
    loanType: 'Personal',
    amount: 200000,
    tenureMonths: 24,
    purpose: '',
  });

  const [incomeDetails, setIncomeDetails] = useState({
    monthlyIncome: '',
    employmentType: 'Salaried',
  });

  const [documents, setDocuments] = useState([]);

  // Load existing application if editing a DRAFT or responding to MORE_INFO_NEEDED
  useEffect(() => {
    if (!id) return;

    const fetchExistingApplication = async () => {
      try {
        const { data } = await axiosInstance.get(`/loans/${id}`);
        const app = data.data.application;

        setApplicationId(app._id);
        setAppStatus(app.status);

        if (app.personalDetails) {
          setPersonalDetails({
            name: app.personalDetails.name || '',
            dob: app.personalDetails.dob
              ? new Date(app.personalDetails.dob).toISOString().split('T')[0]
              : '',
            pan: app.personalDetails.pan || '',
            address: app.personalDetails.address || '',
          });
        }

        if (app.loanDetails) {
          setLoanDetails({
            loanType: app.loanDetails.loanType || 'Personal',
            amount: app.loanDetails.amount || 200000,
            tenureMonths: app.loanDetails.tenureMonths || 24,
            purpose: app.loanDetails.purpose || '',
          });
        }

        if (app.incomeDetails) {
          setIncomeDetails({
            monthlyIncome: app.incomeDetails.monthlyIncome || '',
            employmentType: app.incomeDetails.employmentType || 'Salaried',
          });
        }

        setDocuments(app.documents || []);

        // Find latest officer remark if MORE_INFO_NEEDED
        if (app.status === 'MORE_INFO_NEEDED' && app.auditLogs?.length) {
          const lastOfficerLog = [...app.auditLogs]
            .reverse()
            .find((log) => log.status === 'MORE_INFO_NEEDED');
          if (lastOfficerLog) {
            setOfficerRemarks(lastOfficerLog.remarks);
          }
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load application');
        navigate('/applicant/dashboard');
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchExistingApplication();
  }, [id, navigate]);

  // Live Reducing-Balance EMI Calculation
  const emiSummary = useMemo(() => {
    const P = Number(loanDetails.amount) || 0;
    const n = Number(loanDetails.tenureMonths) || 0;
    const annualRate = INTEREST_RATES[loanDetails.loanType] || 13.5;

    if (P <= 0 || n <= 0) {
      return { emi: 0, totalPayable: 0, totalInterest: 0, annualRate };
    }

    const r = annualRate / 12 / 100;
    const factor = Math.pow(1 + r, n);
    const emi = Math.round((P * r * factor) / (factor - 1));
    const totalPayable = emi * n;
    const totalInterest = Math.max(0, totalPayable - P);

    return { emi, totalPayable, totalInterest, annualRate };
  }, [loanDetails.amount, loanDetails.tenureMonths, loanDetails.loanType]);

  // Build clean payload omitting empty strings
  const buildDraftPayload = () => {
    const payload = {};

    const cleanPersonal = {};
    if (personalDetails.name) cleanPersonal.name = personalDetails.name;
    if (personalDetails.dob) cleanPersonal.dob = personalDetails.dob;
    if (personalDetails.pan) cleanPersonal.pan = personalDetails.pan.toUpperCase();
    if (personalDetails.address) cleanPersonal.address = personalDetails.address;
    if (Object.keys(cleanPersonal).length) payload.personalDetails = cleanPersonal;

    const cleanLoan = {};
    if (loanDetails.loanType) cleanLoan.loanType = loanDetails.loanType;
    if (loanDetails.amount) cleanLoan.amount = Number(loanDetails.amount);
    if (loanDetails.tenureMonths)
      cleanLoan.tenureMonths = Number(loanDetails.tenureMonths);
    if (loanDetails.purpose) cleanLoan.purpose = loanDetails.purpose;
    if (Object.keys(cleanLoan).length) payload.loanDetails = cleanLoan;

    const cleanIncome = {};
    if (incomeDetails.monthlyIncome !== '')
      cleanIncome.monthlyIncome = Number(incomeDetails.monthlyIncome);
    if (incomeDetails.employmentType)
      cleanIncome.employmentType = incomeDetails.employmentType;
    if (Object.keys(cleanIncome).length) payload.incomeDetails = cleanIncome;

    return payload;
  };

  // Persist draft on server (returns applicationId for subsequent doc uploads/submission)
  const persistApplicationRecord = async (silent = false) => {
    const payload = buildDraftPayload();

    if (!applicationId) {
      const { data } = await axiosInstance.post('/loans', payload);
      const createdId = data.data.application._id;
      setApplicationId(createdId);
      if (!silent) toast.success('Application saved as draft');
      return createdId;
    } else {
      await axiosInstance.patch(`/loans/${applicationId}`, payload);
      if (!silent) toast.success('Progress saved');
      return applicationId;
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await persistApplicationRecord(false);
    } catch (error) {
      const errMsg =
        error.response?.data?.errors?.[0]?.message ||
        error.response?.data?.message ||
        'Could not save draft';
      toast.error(errMsg);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFileUpload = async (docType, file) => {
    if (!file) return;
    setUploadingSlot(docType);

    try {
      // Ensure a draft record exists in MongoDB before attaching documents
      const targetAppId = await persistApplicationRecord(true);

      const formData = new FormData();
      formData.append('document', file);
      formData.append('docType', docType);

      const { data } = await axiosInstance.post(
        `/loans/${targetAppId}/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setDocuments(data.data.documents);
      toast.success(`${docType.replace('_', ' ')} uploaded successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Document upload failed');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const targetAppId = await persistApplicationRecord(true);

      await axiosInstance.post(`/loans/${targetAppId}/submit`, {
        personalDetails: {
          ...personalDetails,
          pan: personalDetails.pan.toUpperCase(),
        },
        loanDetails: {
          ...loanDetails,
          amount: Number(loanDetails.amount),
          tenureMonths: Number(loanDetails.tenureMonths),
        },
        incomeDetails: {
          ...incomeDetails,
          monthlyIncome: Number(incomeDetails.monthlyIncome),
        },
      });

      toast.success(
        appStatus === 'MORE_INFO_NEEDED'
          ? 'Updated application resubmitted for review!'
          : 'Loan application submitted successfully!'
      );
      navigate('/applicant/dashboard');
    } catch (error) {
      const validationErrors = error.response?.data?.errors;
      if (validationErrors?.length) {
        toast.error(`${validationErrors[0].field}: ${validationErrors[0].message}`);
      } else {
        toast.error(error.response?.data?.message || 'Submission failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {appStatus === 'MORE_INFO_NEEDED'
              ? 'Update & Resubmit Loan Application'
              : applicationId
              ? 'Resume Loan Application'
              : 'New Loan Application'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete all 4 steps or save your progress anytime as a draft.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={savingDraft || submitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          {savingDraft ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 text-slate-500" />
          )}
          Save as Draft
        </button>
      </div>

      {/* Officer Remarks Banner when MORE_INFO_NEEDED */}
      {appStatus === 'MORE_INFO_NEEDED' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              Additional Information Requested by Loan Officer
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              {officerRemarks ||
                'Please review your details and re-upload clear supporting documents before resubmitting.'}
            </p>
          </div>
        </div>
      )}

      {/* 4-Step Progress Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <Icon className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* STEP 1: PERSONAL DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 1: Personal &amp; KYC Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name (as per PAN) *
                </label>
                <input
                  type="text"
                  value={personalDetails.name}
                  onChange={(e) =>
                    setPersonalDetails({ ...personalDetails, name: e.target.value })
                  }
                  placeholder="Rohan Verma"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date of Birth (Min Age: 21) *
                </label>
                <input
                  type="date"
                  value={personalDetails.dob}
                  onChange={(e) =>
                    setPersonalDetails({ ...personalDetails, dob: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PAN Card Number *
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={personalDetails.pan}
                  onChange={(e) =>
                    setPersonalDetails({
                      ...personalDetails,
                      pan: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="ABCDE1234F"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Residential Address *
                </label>
                <textarea
                  rows={3}
                  value={personalDetails.address}
                  onChange={(e) =>
                    setPersonalDetails({
                      ...personalDetails,
                      address: e.target.value,
                    })
                  }
                  placeholder="Flat 402, Greenview Apartments, Sector 62, Noida, UP - 201309"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: LOAN DETAILS + LIVE EMI PREVIEW */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 2: Loan Configuration &amp; EMI Preview
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Loan Type *
                  </label>
                  <select
                    value={loanDetails.loanType}
                    onChange={(e) =>
                      setLoanDetails({ ...loanDetails, loanType: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Home">Home Loan (8.5% p.a.)</option>
                    <option value="Vehicle">Vehicle Loan (10.5% p.a.)</option>
                    <option value="Personal">Personal Loan (13.5% p.a.)</option>
                    <option value="Business">Business Loan (15.0% p.a.)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Loan Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={10000}
                    step={5000}
                    value={loanDetails.amount}
                    onChange={(e) =>
                      setLoanDetails({ ...loanDetails, amount: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <label className="font-medium text-slate-700">
                      Tenure (Months) *
                    </label>
                    <span className="font-semibold text-indigo-600">
                      {loanDetails.tenureMonths} months (
                      {(loanDetails.tenureMonths / 12).toFixed(1)} yrs)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={240}
                    step={6}
                    value={loanDetails.tenureMonths}
                    onChange={(e) =>
                      setLoanDetails({
                        ...loanDetails,
                        tenureMonths: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Purpose of Loan *
                  </label>
                  <input
                    type="text"
                    value={loanDetails.purpose}
                    onChange={(e) =>
                      setLoanDetails({ ...loanDetails, purpose: e.target.value })
                    }
                    placeholder="e.g., Home renovation / Working capital expansion"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Auto-Calculated EMI Preview Box */}
              <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl p-5 flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex items-center gap-2 text-indigo-100 text-xs font-semibold uppercase tracking-wider">
                    <Calculator className="w-4 h-4" />
                    Live EMI Estimate
                  </div>
                  <p className="mt-4 text-3xl font-bold">
                    ₹{emiSummary.emi.toLocaleString('en-IN')}
                    <span className="text-sm font-normal text-indigo-200">
                      {' '}
                      / month
                    </span>
                  </p>
                  <p className="text-xs text-indigo-200 mt-1">
                    Fixed Rate: {emiSummary.annualRate}% p.a. (Reducing Balance)
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-indigo-500/50 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-indigo-200">Principal Amount</span>
                    <span className="font-medium">
                      ₹{(Number(loanDetails.amount) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-indigo-200">Total Interest</span>
                    <span className="font-medium">
                      ₹{emiSummary.totalInterest.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-indigo-500/50 font-semibold">
                    <span>Total Payable</span>
                    <span>₹{emiSummary.totalPayable.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: INCOME DETAILS */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 3: Employment &amp; Income Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employment Type *
                </label>
                <select
                  value={incomeDetails.employmentType}
                  onChange={(e) =>
                    setIncomeDetails({
                      ...incomeDetails,
                      employmentType: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="Salaried">Salaried</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Business Owner">Business Owner</option>
                  <option value="Professional">Professional (Doctor/CA/etc.)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Net Monthly Income (₹) *
                </label>
                <input
                  type="number"
                  min={0}
                  value={incomeDetails.monthlyIncome}
                  onChange={(e) =>
                    setIncomeDetails({
                      ...incomeDetails,
                      monthlyIncome: e.target.value,
                    })
                  }
                  placeholder="75000"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Instant Affordability Hint */}
            {Number(incomeDetails.monthlyIncome) > 0 && emiSummary.emi > 0 && (
              <div
                className={`p-4 rounded-xl border text-sm ${
                  Number(incomeDetails.monthlyIncome) >= emiSummary.emi * 3
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {Number(incomeDetails.monthlyIncome) >= emiSummary.emi * 3 ? (
                  <span>
                    Great! Your monthly income (₹
                    {Number(incomeDetails.monthlyIncome).toLocaleString('en-IN')})
                    meets the 3x EMI eligibility benchmark (₹
                    {(emiSummary.emi * 3).toLocaleString('en-IN')}).
                  </span>
                ) : (
                  <span>
                    Note: Recommended monthly income for an EMI of ₹
                    {emiSummary.emi.toLocaleString('en-IN')} is at least ₹
                    {(emiSummary.emi * 3).toLocaleString('en-IN')} (3x EMI).
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: DOCUMENT UPLOAD */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 4: Supporting KYC &amp; Income Documents
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {REQUIRED_DOC_SLOTS.map((slot) => {
                const uploadedDoc = documents.find(
                  (d) => d.docType === slot.docType
                );
                const isUploading = uploadingSlot === slot.docType;

                return (
                  <div
                    key={slot.docType}
                    className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/50"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {slot.label}
                        </h3>
                        {uploadedDoc && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{slot.hint}</p>

                      {uploadedDoc && (
                        <a
                          href={uploadedDoc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Uploaded Document
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <label className="mt-4 cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-indigo-300 bg-white text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition">
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <FileUp className="w-4 h-4" />
                          {uploadedDoc ? 'Replace Document' : 'Select & Upload File'}
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        disabled={isUploading}
                        onChange={(e) =>
                          handleFileUpload(slot.docType, e.target.files?.[0])
                        }
                        className="hidden"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-3">
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
              >
                Next Step
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || !!uploadingSlot}
                onClick={handleFinalSubmit}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {appStatus === 'MORE_INFO_NEEDED'
                      ? 'Resubmit Application'
                      : 'Submit Application'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
