import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import SessionTimer from '../components/SessionTimer.jsx'

const API = '/api/v1'
const WS_URL = 'ws://localhost:8000/ws/seats'

const STEP = {
  FORM: 'FORM',
  ACTIVE: 'ACTIVE',
  FINISHED: 'FINISHED',
}

export default function StudentInterface() {
  const { seatId } = useParams()
  const numericSeatId = parseInt(seatId, 10)

  const [step, setStep] = useState(STEP.FORM)
  const [studentIdInput, setStudentIdInput] = useState('')
  const [student, setStudent] = useState(null)
  const [session, setSession] = useState(null)
  const [finalTime, setFinalTime] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [endLoading, setEndLoading] = useState(false)

  // ── Auto-logout via WebSocket ──────────────────────────────────────────

  useEffect(() => {
    if (step !== STEP.ACTIVE || !session) return;
    
    // Connect to WebSocket purely to listen for our session ending automatically
    // (e.g. because the physical sensor marked the seat empty)
    const ws = new WebSocket(WS_URL);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.seat_id === numericSeatId) {
          // If the broadcast says the session_id is no longer ours (or is null)
          if (msg.session_id !== session.session_id) {
            const start = new Date(session.start_time).getTime();
            setFinalTime(Math.max(0, Math.floor((Date.now() - start) / 1000)));
            setStep(STEP.FINISHED);
          }
        }
      } catch (err) {}
    };

    return () => ws.close();
  }, [step, session, numericSeatId]);

  // ── Start session ──────────────────────────────────────────────────────

  const handleStart = useCallback(async (e) => {
    e.preventDefault()
    setError('')
    const sid = parseInt(studentIdInput.trim(), 10)
    if (!sid || isNaN(sid)) {
      setError('Please enter a valid numeric Student ID.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: sid, seat_id: numericSeatId }),
      })

      if (res.status === 409) {
        const body = await res.json()
        setError(body.detail ?? 'Sit down on the seat first, then scan again.')
        return
      }

      if (res.status === 404) {
        const body = await res.json()
        setError(body.detail ?? 'Seat or student not found.')
        return
      }

      if (!res.ok) {
        const body = await res.json()
        setError(body.detail ?? 'Failed to start session. Please try again.')
        return
      }

      const sessionData = await res.json()
      setSession(sessionData)

      // Fetch student details for display
      try {
        const sRes = await fetch(`${API}/students/${sid}`)
        if (sRes.ok) setStudent(await sRes.json())
      } catch {
        // Non-critical — session still active
      }

      setStep(STEP.ACTIVE)
    } catch (err) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [studentIdInput, numericSeatId])

  // ── End session manually ──────────────────────────────────────────────────

  const handleLeave = useCallback(async () => {
    if (!session?.session_id) return
    setEndLoading(true)
    try {
      const res = await fetch(`${API}/sessions/${session.session_id}/end`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.detail ?? 'Failed to end session.')
        return
      }
      
      // Successfully ended
      const start = new Date(session.start_time).getTime()
      setFinalTime(Math.max(0, Math.floor((Date.now() - start) / 1000)))
      setStep(STEP.FINISHED)

    } catch {
      setError('Network error while ending session.')
    } finally {
      setEndLoading(false)
    }
  }, [session])

  // ── Render ─────────────────────────────────────────────────────────────

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🪑</div>
          <h1 className="text-2xl font-bold gradient-text">SeatSense</h1>
          <p className="text-slate-500 text-sm mt-1">
            Seat&nbsp;<span className="text-brand-400 font-semibold">#{numericSeatId}</span>
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-8 shadow-2xl transition-all duration-500">
          {step === STEP.FORM ? (
            /* ── Step 1: Student ID form ── */
            <form onSubmit={handleStart} className="space-y-5" id="student-login-form">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1">Check In</h2>
                <p className="text-sm text-slate-500">Enter your student ID to claim this seat.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="student-id-input" className="block text-xs text-slate-400 font-medium uppercase tracking-wide">
                  Student ID
                </label>
                <input
                  id="student-id-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 1042"
                  value={studentIdInput}
                  onChange={(e) => { setStudentIdInput(e.target.value); setError('') }}
                  required
                  className="
                    w-full rounded-xl bg-white/5 border border-white/10
                    px-4 py-3 text-slate-100 placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:ring-brand-500/60
                    transition-all duration-200
                  "
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                  <span className="mt-0.5">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                id="checkin-submit-btn"
                type="submit"
                disabled={loading}
                className="
                  w-full py-3 rounded-xl font-semibold text-sm
                  bg-gradient-to-r from-brand-500 to-purple-600
                  hover:from-brand-400 hover:to-purple-500
                  active:scale-95 transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-white shadow-lg shadow-brand-500/20
                "
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Checking in…
                  </span>
                ) : 'Check In →'}
              </button>
            </form>
          ) : step === STEP.ACTIVE ? (
            /* ── Step 2: Active session view ── */
            <div className="space-y-6" id="active-session-view">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-100">Session Active</h2>
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Live
                </span>
              </div>

              {/* Info rows */}
              <div className="space-y-3">
                <InfoRow label="Seat" value={`#${numericSeatId}`} />
                {student && <InfoRow label="Name" value={student.name} />}
                <InfoRow label="Student ID" value={`#${session?.student_id}`} />
                <InfoRow label="Session" value={`#${session?.session_id}`} />
                <InfoRow
                  label="Started"
                  value={session?.start_time
                    ? new Date(session.start_time).toLocaleTimeString('en-IN')
                    : '—'}
                />
                <div className="flex items-center justify-between py-2 border-t border-white/10">
                  <span className="text-sm text-slate-500">Elapsed</span>
                  <span className="text-brand-300 text-xl font-bold">
                    <SessionTimer startTime={session?.start_time} />
                  </span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                  <span className="mt-0.5">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                id="leave-seat-btn"
                onClick={handleLeave}
                disabled={endLoading}
                className="
                  w-full py-3 rounded-xl font-semibold text-sm
                  bg-gradient-to-r from-rose-500 to-pink-600
                  hover:from-rose-400 hover:to-pink-500
                  active:scale-95 transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-white shadow-lg shadow-rose-500/20
                "
              >
                {endLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Ending session…
                  </span>
                ) : '🚪 Leave Seat'}
              </button>
            </div>
          ) : (
            /* ── Step 3: Congratulations view ── */
            <div className="space-y-6 text-center animate-pulse-slow" id="congratulations-view">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-slate-100">Session Complete!</h2>
              <p className="text-slate-400 text-sm px-4">
                Great job! Your study session has ended successfully. You achieved an active focus time of:
              </p>
              
              <div className="text-4xl font-bold gradient-text py-4 tabular-nums">
                {formatDuration(finalTime)}
              </div>
              
              <button
                onClick={() => {
                  setStep(STEP.FORM);
                  setSession(null);
                  setStudent(null);
                  setStudentIdInput('');
                }}
                className="
                  w-full py-3 rounded-xl font-semibold text-sm
                  bg-white/10 hover:bg-white/20
                  active:scale-95 transition-all duration-200 text-white
                "
              >
                Start New Session
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">
          SeatSense © {new Date().getFullYear()} — Smart Library
        </p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  )
}
