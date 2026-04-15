import SessionTimer from './SessionTimer.jsx'

/**
 * SeatCard — shows a seat's status, student info, and live elapsed time.
 * @param {object} seat — { seat_id, status, student_id, session_id, start_time }
 */
export default function SeatCard({ seat }) {
  const isOccupied = seat.status === 'occupied'

  return (
    <div
      className={`
        relative rounded-2xl p-5 flex flex-col gap-3 shadow-lg transition-all duration-500
        ${isOccupied
          ? 'bg-gradient-to-br from-rose-900/60 to-red-950/60 border border-rose-500/30'
          : 'bg-gradient-to-br from-emerald-900/40 to-teal-950/40 border border-emerald-500/20'}
      `}
    >
      {/* Status dot */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Seat {seat.seat_id}
        </span>
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full
          ${isOccupied
            ? 'bg-rose-500/20 text-rose-300'
            : 'bg-emerald-500/20 text-emerald-300'}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${isOccupied ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
          {isOccupied ? 'Occupied' : 'Available'}
        </span>
      </div>

      {/* Seat icon */}
      <div className="text-4xl text-center py-1">🪑</div>

      {/* Info */}
      {isOccupied ? (
        <div className="space-y-1">
          {seat.student_id && (
            <p className="text-slate-300 text-sm">
              <span className="text-slate-500">Student&nbsp;</span>
              <span className="font-semibold text-white">#{seat.student_id}</span>
            </p>
          )}
          {seat.session_id && (
            <p className="text-slate-400 text-xs">Session #{seat.session_id}</p>
          )}
          {seat.start_time && (
            <p className="text-brand-300 font-mono text-sm mt-1">
              ⏱ <SessionTimer startTime={seat.start_time} />
            </p>
          )}
        </div>
      ) : (
        <p className="text-slate-500 text-sm italic text-center">No active session</p>
      )}
    </div>
  )
}
