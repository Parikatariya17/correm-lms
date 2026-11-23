import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/common/StatusBadge';
import toast from 'react-hot-toast';
import {
  Plus,
  Clock,
  AlertTriangle,
  Calendar,
  FileEdit,
  Eye,
  X,
  CheckCircle2,
  Loader2,
  IndianRupee,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';

export default function ApplicantDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [timelineApp, setTimelineApp] = useState(null);
  const [scheduleModal, setScheduleModal] = useState({
    open: false,
    loading: false,
    application: null,
    installments: [],
  });

  const fetchMyLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosInstance.get('/loans/my');
      setApplications(data.data.applications || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your loan applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLoans();
  }, []);

  const handleOpenSchedule = async (app) => {
    setScheduleModal({
      open: true,
      loading: true,
      application: app,
      installments: [],
    });

    try {
      const { data } = await axiosInstance.get(`/loans/${app._id}/repayment-schedule`);
      setScheduleModal({
        open: true,
        loading: false,
        application: app,
        installments: data.data.schedule?.installments || [],
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load repayment schedule');
      setScheduleModal((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  const getLatestOfficerRemark = (app) => {
    if (!app.auditLogs?.length) return null;
    return [...app.auditLogs].reverse().find((log) => log.status === 'MORE_INFO_NEEDED');
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Loan Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track application status, respond to officer queries, and view EMI schedules.
          </p>
        </div>

        <Link
          to="/applicant/apply"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Apply for New Loan
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm text-slate-500">Loading your loan portfolio...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            onClick={fetchMyLoans}
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && applications.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No loan applications yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Start a new application for a Home, Vehicle, Personal, or Business loan in just 4 simple steps.
          </p>
          <Link
            to="/applicant/apply"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Start First Application
          </Link>
        </div>
      )}

      {/* Applications List */}
      {!loading && !error && applications.length > 0 && (
        <div className="space-y-4">
          {applications.map((app) => {
            const officerRemarkLog =
              app.status === 'MORE_INFO_NEEDED' ? getLatestOfficerRemark(app) : null;

            return (
              <div
                key={app._id}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm hover:border-slate-300 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Loan Summary */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-base font-bold text-slate-900">
                        {app.loanDetails?.loanType || 'Unconfigured'} Loan
                      </span>
                      <StatusBadge status={app.status} />
                      <span className="text-xs text-slate-400 font-mono">
                        #{app._id.slice(-6).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-600">
                      <span>
                        Amount:{' '}
                        <strong className="text-slate-900">
                          {app.loanDetails?.amount
                            ? `₹${app.loanDetails.amount.toLocaleString('en-IN')}`
                            : 'Not set'}
                        </strong>
                      </span>
                      <span>
                        Tenure:{' '}
                        <strong className="text-slate-900">
                          {app.loanDetails?.tenureMonths
                            ? `${app.loanDetails.tenureMonths} mos`
                            : 'Not set'}
                        </strong>
                      </span>
                      {app.loanDetails?.interestRate && (
                        <span>
                          Interest:{' '}
                          <strong className="text-slate-900">
                            {app.loanDetails.interestRate}% p.a.
                          </strong>
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        Updated {new Date(app.updatedAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {app.status === 'DRAFT' && (
                      <Link
                        to={`/applicant/apply/${app._id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        Resume Draft
                      </Link>
                    )}

                    {app.status === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => handleOpenSchedule(app)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        View EMI Schedule
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setTimelineApp(app)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Status Timeline ({app.auditLogs?.length || 0})
                    </button>
                  </div>
                </div>

                {/* Alert Box for MORE_INFO_NEEDED */}
                {app.status === 'MORE_INFO_NEEDED' && (
                  <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                          Action Required — Officer Remarks
                        </p>
                        <p className="text-sm text-amber-900 mt-0.5">
                          {officerRemarkLog?.remarks ||
                            'Please update your application details or re-upload clear documents.'}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/applicant/apply/${app._id}`}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      Edit &amp; Re-upload Docs
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Visual Status Timeline (auditLogs) */}
      {timelineApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Application Audit Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  {timelineApp.loanDetails?.loanType} Loan • #
                  {timelineApp._id.slice(-6).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setTimelineApp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <ol className="relative border-s-2 border-indigo-100 ml-3 space-y-6">
                {(timelineApp.auditLogs || []).map((log, idx) => (
                  <li key={idx} className="ms-6">
                    <span className="absolute -start-2.5 flex items-center justify-center w-5 h-5 bg-indigo-600 rounded-full ring-4 ring-white">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={log.status} />
                      <time className="text-xs text-slate-400">
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </time>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-slate-800">
                      {log.remarks || log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-slate-400 capitalize mt-0.5">
                      Updated by: {log.role}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Full EMI Repayment Schedule */}
      {scheduleModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-emerald-600" />
                  Approved EMI Repayment Schedule
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Principal: ₹
                  {scheduleModal.application?.loanDetails?.amount?.toLocaleString('en-IN')}{' '}
                  • Rate: {scheduleModal.application?.loanDetails?.interestRate}% p.a. •
                  Tenure: {scheduleModal.application?.loanDetails?.tenureMonths} Months
                </p>
              </div>
              <button
                onClick={() =>
                  setScheduleModal({
                    open: false,
                    loading: false,
                    application: null,
                    installments: [],
                  })
                }
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {scheduleModal.loading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Due Date</th>
                        <th className="px-4 py-3 text-right">EMI (₹)</th>
                        <th className="px-4 py-3 text-right">Principal (₹)</th>
                        <th className="px-4 py-3 text-right">Interest (₹)</th>
                        <th className="px-4 py-3 text-right">Balance (₹)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {scheduleModal.installments.map((item) => (
                        <tr key={item.installmentNo} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {item.installmentNo}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {new Date(item.dueDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                            ₹{item.emi.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-right text-emerald-700">
                            ₹{item.principal.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-right text-amber-700">
                            ₹{item.interest.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            ₹{item.balance.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
