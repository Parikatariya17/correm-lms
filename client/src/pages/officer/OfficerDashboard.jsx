import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/common/StatusBadge';
import toast from 'react-hot-toast';
import {
  Search,
  Filter,
  Eye,
  X,
  FileText,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  MessageSquareWarning,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Inbox,
} from 'lucide-react';

export default function OfficerDashboard() {
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    loanType: '',
    search: '',
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review Drawer / Modal state
  const [selectedApp, setSelectedApp] = useState(null);
  const [runningEligibility, setRunningEligibility] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchApplications = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = { page, limit: 10 };
        if (filters.status) params.status = filters.status;
        if (filters.loanType) params.loanType = filters.loanType;
        if (filters.search.trim()) params.search = filters.search.trim();

        const { data } = await axiosInstance.get('/loans', { params });
        setApplications(data.data.applications || []);
        setPagination(data.data.pagination || { page: 1, totalPages: 1, total: 0 });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load loan queue');
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchApplications(1);
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchApplications]);

  const handleOpenReview = (app) => {
    setSelectedApp(app);
    setRemarks('');
  };

  const handleRunEligibility = async () => {
    if (!selectedApp) return;
    setRunningEligibility(true);
    try {
      const { data } = await axiosInstance.post(
        `/loans/${selectedApp._id}/eligibility`
      );
      const updatedReport = data.data.eligibilityReport;

      setSelectedApp((prev) => ({
        ...prev,
        eligibilityReport: updatedReport,
      }));
      setApplications((prev) =>
        prev.map((a) =>
          a._id === selectedApp._id ? { ...a, eligibilityReport: updatedReport } : a
        )
      );
      toast.success('Eligibility check completed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Eligibility check failed');
    } finally {
      setRunningEligibility(false);
    }
  };

  const handleOfficerDecision = async (targetStatus) => {
    if (!remarks.trim() || remarks.trim().length < 3) {
      return toast.error('Please enter mandatory officer remarks (min 3 characters)');
    }

    setSubmittingReview(true);
    try {
      await axiosInstance.patch(`/loans/${selectedApp._id}/review`, {
        status: targetStatus,
        remarks: remarks.trim(),
      });

      toast.success(`Application marked as ${targetStatus.replace(/_/g, ' ')}`);
      setSelectedApp(null);
      fetchApplications(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update application status');
    } finally {
      setSubmittingReview(false);
    }
  };

  const canReviewSelected =
    selectedApp &&
    ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_NEEDED'].includes(selectedApp.status);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Loan Officer Underwriting Queue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verify KYC documents, run deterministic eligibility checks, and recommend decisions.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search by applicant name, PAN, or loan purpose..."
            className="w-full pl-10 pr-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Active Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="MORE_INFO_NEEDED">More Info Needed</option>
            <option value="RECOMMENDED_APPROVE">Recommended Approve</option>
            <option value="RECOMMENDED_REJECT">Recommended Reject</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div>
          <select
            value={filters.loanType}
            onChange={(e) => setFilters({ ...filters, loanType: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Loan Types</option>
            <option value="Home">Home Loan</option>
            <option value="Vehicle">Vehicle Loan</option>
            <option value="Personal">Personal Loan</option>
            <option value="Business">Business Loan</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-sm text-slate-500">Fetching applications...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-rose-800">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={() => fetchApplications(pagination.page)}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && applications.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900">
            No matching applications found
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Try clearing your search or status filter criteria.
          </p>
        </div>
      )}

      {/* Paginated Applications Table */}
      {!loading && !error && applications.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5 text-left">Applicant</th>
                  <th className="px-5 py-3.5 text-left">Loan Type</th>
                  <th className="px-5 py-3.5 text-right">Amount / Tenure</th>
                  <th className="px-5 py-3.5 text-right">Monthly Income</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">
                        {app.personalDetails?.name || app.applicantId?.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        PAN: {app.personalDetails?.pan || 'N/A'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">
                      {app.loanDetails?.loanType}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="font-semibold text-slate-900">
                        ₹{app.loanDetails?.amount?.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-slate-500">
                        {app.loanDetails?.tenureMonths} months @{' '}
                        {app.loanDetails?.interestRate}%
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-700 font-medium">
                      ₹{app.incomeDetails?.monthlyIncome?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenReview(app)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect &amp; Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing page <strong>{pagination.page}</strong> of{' '}
              <strong>{pagination.totalPages}</strong> ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchApplications(pagination.page - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchApplications(pagination.page + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium disabled:opacity-40 hover:bg-slate-50"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW DRAWER / MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl border-l border-slate-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-slate-900">
                    Application Underwriting
                  </h3>
                  <StatusBadge status={selectedApp.status} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID: #{selectedApp._id} • Applicant: {selectedApp.applicantId?.email}
                </p>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Applicant & Loan Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Full Name</p>
                  <p className="font-semibold text-slate-900">
                    {selectedApp.personalDetails?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">
                    DOB &amp; PAN
                  </p>
                  <p className="font-semibold text-slate-900">
                    {selectedApp.personalDetails?.dob
                      ? new Date(selectedApp.personalDetails.dob).toLocaleDateString('en-IN')
                      : 'N/A'}{' '}
                    • {selectedApp.personalDetails?.pan}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">
                    Loan Request
                  </p>
                  <p className="font-semibold text-slate-900">
                    {selectedApp.loanDetails?.loanType} — ₹
                    {selectedApp.loanDetails?.amount?.toLocaleString('en-IN')} (
                    {selectedApp.loanDetails?.tenureMonths}m)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">
                    Employment &amp; Income
                  </p>
                  <p className="font-semibold text-slate-900">
                    {selectedApp.incomeDetails?.employmentType} — ₹
                    {selectedApp.incomeDetails?.monthlyIncome?.toLocaleString('en-IN')}/mo
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Address</p>
                  <p className="text-slate-700">{selectedApp.personalDetails?.address}</p>
                </div>
              </div>

              {/* Uploaded Documents */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2.5">
                  Attached Documents ({selectedApp.documents?.length || 0})
                </h4>
                {selectedApp.documents?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedApp.documents.map((doc, i) => (
                      <a
                        key={i}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-5 h-5 text-indigo-600" />
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              {doc.docType.replace(/_/g, ' ')}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Click to inspect file
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-400" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-rose-600">No documents attached.</p>
                )}
              </div>

              {/* Deterministic Eligibility Check Section */}
              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Automated Eligibility Engine
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunEligibility}
                    disabled={runningEligibility}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {runningEligibility && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Run Eligibility Check
                  </button>
                </div>

                {selectedApp.eligibilityReport ? (
                  <div className="space-y-3">
                    <div
                      className={`p-3 rounded-lg flex items-center justify-between text-xs font-bold ${
                        selectedApp.eligibilityReport.isEligible
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <span>
                        Result:{' '}
                        {selectedApp.eligibilityReport.isEligible
                          ? 'ELIGIBLE'
                          : 'CRITERIA FAILED'}
                      </span>
                      <span>
                        Score: {selectedApp.eligibilityReport.score}/100 • EMI: ₹
                        {selectedApp.eligibilityReport.calculatedEmi?.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {selectedApp.eligibilityReport.checks?.map((check) => (
                        <div
                          key={check.code}
                          className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-slate-50"
                        >
                          {check.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-semibold text-slate-800">{check.label}</p>
                            <p className="text-slate-500 mt-0.5">{check.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Click &ldquo;Run Eligibility Check&rdquo; to evaluate age, 3x EMI
                    affordability, and KYC documents.
                  </p>
                )}
              </div>

              {/* Officer Decision & Mandatory Remarks */}
              {canReviewSelected ? (
                <div className="border-t border-slate-200 pt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">
                      Officer Underwriting Remarks *
                    </label>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter verification findings, missing document details, or recommendation justification..."
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      disabled={submittingReview}
                      onClick={() => handleOfficerDecision('RECOMMENDED_APPROVE')}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Recommend Approve
                    </button>

                    <button
                      type="button"
                      disabled={submittingReview}
                      onClick={() => handleOfficerDecision('MORE_INFO_NEEDED')}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition"
                    >
                      <MessageSquareWarning className="w-4 h-4" />
                      Request More Info
                    </button>

                    <button
                      type="button"
                      disabled={submittingReview}
                      onClick={() => handleOfficerDecision('RECOMMENDED_REJECT')}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Recommend Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-100 text-xs text-slate-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
                  This application is currently in <strong>{selectedApp.status}</strong>{' '}
                  status and awaits Admin final decision or is already closed.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
