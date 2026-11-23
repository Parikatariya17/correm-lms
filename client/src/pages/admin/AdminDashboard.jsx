import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Loader2,
  AlertCircle,
  Inbox,
  FileText,
  ExternalLink,
} from 'lucide-react';

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals' | 'users'

  // Tab 1: Pending Final Approval state
  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(true);
  const [loansError, setLoansError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('RECOMMENDED'); // 'RECOMMENDED' | 'ALL'

  // Final Decision Modal state
  const [decisionModalApp, setDecisionModalApp] = useState(null);
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [processingDecision, setProcessingDecision] = useState(false);

  // Tab 2: User Management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const fetchLoansForAdmin = useCallback(async () => {
    setLoansLoading(true);
    setLoansError(null);
    try {
      const { data } = await axiosInstance.get('/loans', {
        params: { page: 1, limit: 50 },
      });
      const all = data.data.applications || [];

      if (statusFilter === 'RECOMMENDED') {
        setLoans(
          all.filter((a) =>
            ['RECOMMENDED_APPROVE', 'RECOMMENDED_REJECT'].includes(a.status)
          )
        );
      } else {
        setLoans(all);
      }
    } catch (err) {
      setLoansError(err.response?.data?.message || 'Failed to fetch applications');
    } finally {
      setLoansLoading(false);
    }
  }, [statusFilter]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const { data } = await axiosInstance.get('/users');
      setUsers(data.data.users || []);
    } catch (err) {
      setUsersError(err.response?.data?.message || 'Failed to load system users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchLoansForAdmin();
    } else {
      fetchUsers();
    }
  }, [activeTab, fetchLoansForAdmin, fetchUsers]);

  const handleFinalDecision = async (finalStatus) => {
    if (!decisionRemarks.trim() || decisionRemarks.trim().length < 3) {
      return toast.error('Please enter final decision remarks (min 3 characters)');
    }

    setProcessingDecision(true);
    try {
      await axiosInstance.patch(`/loans/${decisionModalApp._id}/decision`, {
        status: finalStatus,
        remarks: decisionRemarks.trim(),
      });

      toast.success(
        finalStatus === 'APPROVED'
          ? 'Loan APPROVED & Repayment Schedule generated!'
          : 'Loan application REJECTED.'
      );
      setDecisionModalApp(null);
      setDecisionRemarks('');
      fetchLoansForAdmin();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Final decision failed');
    } finally {
      setProcessingDecision(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingUserId(userId);
    try {
      await axiosInstance.patch(`/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
      toast.success(`User role updated to ${newRole}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Governance Portal</h1>
        <p className="text-sm text-slate-500 mt-1">
          Issue final loan sanction approvals and manage platform user roles.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'approvals'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Pending Final Approval
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          User Management
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PENDING FINAL APPROVAL                                         */}
      {/* ===================================================================== */}
      {activeTab === 'approvals' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setStatusFilter('RECOMMENDED')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === 'RECOMMENDED'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Officer Recommended Queue
              </button>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Non-Draft Applications
              </button>
            </div>
          </div>

          {loansLoading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          )}

          {!loansLoading && loansError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-center justify-between text-rose-800 text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>{loansError}</span>
              </div>
              <button
                onClick={fetchLoansForAdmin}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {!loansLoading && !loansError && loans.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">
                No applications pending final decision
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Applications recommended by Loan Officers will appear here for sanction.
              </p>
            </div>
          )}

          {!loansLoading && !loansError && loans.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-5 py-3.5 text-left">Applicant</th>
                      <th className="px-5 py-3.5 text-left">Loan Facility</th>
                      <th className="px-5 py-3.5 text-center">Eligibility Score</th>
                      <th className="px-5 py-3.5 text-center">Officer Recommendation</th>
                      <th className="px-5 py-3.5 text-right">Final Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loans.map((app) => (
                      <tr key={app._id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {app.personalDetails?.name || app.applicantId?.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Income: ₹
                            {app.incomeDetails?.monthlyIncome?.toLocaleString('en-IN')}/mo
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {app.loanDetails?.loanType} — ₹
                            {app.loanDetails?.amount?.toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-slate-500">
                            {app.loanDetails?.tenureMonths} months @{' '}
                            {app.loanDetails?.interestRate}% p.a.
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {app.eligibilityReport ? (
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                app.eligibilityReport.isEligible
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {app.eligibilityReport.score}/100
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <StatusBadge status={app.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => {
                              setDecisionModalApp(app);
                              setDecisionRemarks('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Review &amp; Decide
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: USER MANAGEMENT                                                */}
      {/* ===================================================================== */}
      {activeTab === 'users' && (
        <div>
          {usersLoading && (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          )}

          {!usersLoading && usersError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-center justify-between text-rose-800 text-sm">
              <span>{usersError}</span>
              <button
                onClick={fetchUsers}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {!usersLoading && !usersError && users.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-5 py-3.5 text-left">Name</th>
                      <th className="px-5 py-3.5 text-left">Email</th>
                      <th className="px-5 py-3.5 text-left">Joined</th>
                      <th className="px-5 py-3.5 text-right">Role Assignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isSelf = u._id === currentUser?._id;
                      return (
                        <tr key={u._id} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-semibold text-slate-900">
                            {u.name}{' '}
                            {isSelf && (
                              <span className="ml-1.5 text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                You
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs">
                            {new Date(u.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <select
                              disabled={isSelf || updatingUserId === u._id}
                              value={u.role}
                              onChange={(e) => handleRoleChange(u._id, e.target.value)}
                              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white capitalize disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            >
                              <option value="applicant">Applicant</option>
                              <option value="officer">Officer</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FINAL APPROVAL / REJECTION MODAL WITH AUDIT LOGS                      */}
      {/* ===================================================================== */}
      {decisionModalApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-slate-900">
                    Final Sanction Review
                  </h3>
                  <StatusBadge status={decisionModalApp.status} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {decisionModalApp.personalDetails?.name} •{' '}
                  {decisionModalApp.loanDetails?.loanType} Loan (₹
                  {decisionModalApp.loanDetails?.amount?.toLocaleString('en-IN')})
                </p>
              </div>
              <button
                onClick={() => setDecisionModalApp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Quick Financial & Eligibility Snapshot */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block">Calculated EMI</span>
                  <strong className="text-sm text-slate-900">
                    ₹
                    {decisionModalApp.eligibilityReport?.calculatedEmi?.toLocaleString(
                      'en-IN'
                    ) || 'N/A'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Monthly Income</span>
                  <strong className="text-sm text-slate-900">
                    ₹
                    {decisionModalApp.incomeDetails?.monthlyIncome?.toLocaleString(
                      'en-IN'
                    )}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Eligibility Score</span>
                  <strong className="text-sm text-indigo-700">
                    {decisionModalApp.eligibilityReport?.score ?? 'N/A'} / 100
                  </strong>
                </div>
              </div>

              {/* Documents Links */}
              <div className="flex flex-wrap gap-2">
                {(decisionModalApp.documents || []).map((doc, idx) => (
                  <a
                    key={idx}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {doc.docType}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>

              {/* Complete Audit History */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Audit &amp; Underwriting Trail
                </h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {(decisionModalApp.auditLogs || []).map((log, i) => (
                    <div key={i} className="p-3 text-xs flex items-start justify-between gap-3">
                      <div>
                        <span className="font-bold text-slate-800 capitalize">
                          [{log.role}]
                        </span>{' '}
                        <span className="text-slate-700">{log.remarks || log.action}</span>
                      </div>
                      <span className="text-slate-400 shrink-0">
                        {new Date(log.timestamp).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Decision Controls */}
              {!['APPROVED', 'REJECTED'].includes(decisionModalApp.status) && (
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">
                      Admin Final Sanction Remarks *
                    </label>
                    <textarea
                      rows={2}
                      value={decisionRemarks}
                      onChange={(e) => setDecisionRemarks(e.target.value)}
                      placeholder="Enter final sanction approval notes or rejection reason..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={processingDecision}
                      onClick={() => handleFinalDecision('APPROVED')}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      {processingDecision ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve &amp; Generate EMI
                    </button>

                    <button
                      type="button"
                      disabled={processingDecision}
                      onClick={() => handleFinalDecision('REJECTED')}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition"
                    >
                      {processingDecision ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Reject Application
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
