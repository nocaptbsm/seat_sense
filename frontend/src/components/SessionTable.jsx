const STATUS_BADGE = {
  active:   'bg-brand-500/20 text-brand-300',
  ended:    'bg-slate-500/20 text-slate-400',
  timeout:  'bg-amber-500/20 text-amber-300',
  replaced: 'bg-purple-500/20 text-purple-300',
}

function formatDuration(seconds) {
  if (seconds == null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/**
 * SessionTable — renders recent sessions in a styled table.
 * @param {Array} sessions
 */
export default function SessionTable({ sessions = [] }) {
  return (
    <div className="overflow-x-auto rounded-2xl glass shadow-lg">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-widest">
            <th className="px-4 py-3">Session</th>
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Seat</th>
            <th className="px-4 py-3">Start</th>
            <th className="px-4 py-3">End</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Duration</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-10 text-slate-500 italic">
                No sessions recorded yet.
              </td>
            </tr>
          ) : (
            sessions.map((s) => (
              <tr
                key={s.session_id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors duration-150"
              >
                <td className="px-4 py-3 font-mono text-slate-300">#{s.session_id}</td>
                <td className="px-4 py-3 text-slate-300">#{s.student_id}</td>
                <td className="px-4 py-3 text-slate-300">#{s.seat_id}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(s.start_time)}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(s.end_time)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[s.session_status] ?? 'bg-slate-500/20 text-slate-400'}`}>
                    {s.session_status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-slate-400">
                  {formatDuration(s.duration_seconds)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
