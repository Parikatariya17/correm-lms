const STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MORE_INFO_NEEDED: 'bg-amber-50 text-amber-700 border-amber-200',
  RECOMMENDED_APPROVE: 'bg-teal-50 text-teal-700 border-teal-200',
  RECOMMENDED_REJECT: 'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  const label = (status || 'UNKNOWN').replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${style}`}
    >
      {label}
    </span>
  );
}
