import { useEffect, useRef, useState, useCallback } from 'react'
import SeatCard from '../components/SeatCard.jsx'
import SummaryCard from '../components/SummaryCard.jsx'
import SessionTable from '../components/SessionTable.jsx'

const API_BASE = import.meta.env.VITE_API_URL || '';
const API = `${API_BASE}/api/v1`;
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/seats';
const SUMMARY_INTERVAL_MS = 30_000

export default function AdminDashboard() {
  const [seats, setSeats] = useState([])           // { seat_id, status, student_id, session_id, start_time }
  const [summary, setSummary] = useState(null)
  const [sessions, setSessions] = useState([])
  const [wsStatus, setWsStatus] = useState('connecting') // 'connecting' | 'open' | 'closed'
  const wsRef = useRef(null)
  const summaryTimerRef = useRef(null)

  // ── Fetch helpers ──────────────────────────────────────────────────────

  const fetchSeats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seats`)
      if (!res.ok) throw new Error('Failed to fetch seats')
      const data = await res.json()
      // Normalise: add runtime fields as undefined initially
      setSeats(data.map((s) => ({
        seat_id: s.seat_id,
        status: s.status,
        student_id: undefined,
        session_id: undefined,
        start_time: undefined,
      })))
    } catch (err) {
      console.error('[AdminDashboard] fetchSeats:', err)
    }
  }, [])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/dashboard/summary`)
      if (!res.ok) throw new Error('Failed to fetch summary')
      setSummary(await res.json())
    } catch (err) {
      console.error('[AdminDashboard] fetchSummary:', err)
    }
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/dashboard/sessions?limit=50`)
      if (!res.ok) throw new Error('Failed to fetch sessions')
      setSessions(await res.json())
    } catch (err) {
      console.error('[AdminDashboard] fetchSessions:', err)
    }
  }, [])

  // ── Initial data load ──────────────────────────────────────────────────

  useEffect(() => {
    fetchSeats()
    fetchSummary()
    fetchSessions()
  }, [fetchSeats, fetchSummary, fetchSessions])

  // ── Summary polling every 30 s ─────────────────────────────────────────

  useEffect(() => {
    summaryTimerRef.current = setInterval(() => {
      fetchSummary()
      fetchSessions()
    }, SUMMARY_INTERVAL_MS)
    return () => clearInterval(summaryTimerRef.current)
  }, [fetchSummary, fetchSessions])

  // ── WebSocket ──────────────────────────────────────────────────────────

  useEffect(() => {
    let reconnectTimer = null

    const connect = () => {
      setWsStatus('connecting')
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setWsStatus('open')

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          // msg: { seat_id, status, student_id, session_id, start_time }
          setSeats((prev) =>
            prev.map((seat) =>
              seat.seat_id === msg.seat_id
                ? {
                    ...seat,
                    status: msg.status,
                    student_id: msg.student_id ?? undefined,
                    session_id: msg.session_id ?? undefined,
                    start_time: msg.start_time ?? undefined,
                  }
                : seat
            )
          )
          // Refresh summary on every seat event
          fetchSummary()
          fetchSessions()
        } catch (err) {
          console.error('[AdminDashboard] WS parse error:', err)
        }
      }

      ws.onerror = () => {
        console.warn('[AdminDashboard] WebSocket error')
      }

      ws.onclose = () => {
        setWsStatus('closed')
        // Reconnect after 3 s
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [fetchSummary, fetchSessions])

  // ── Render ─────────────────────────────────────────────────────────────

  const WS_DOT = {
    connecting: 'bg-amber-400 animate-pulse',
    open: 'bg-emerald-400',
    closed: 'bg-rose-500 animate-pulse',
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🪑</span>
          <div>
            <h1 className="text-lg font-bold leading-none gradient-text">SeatSense</h1>
            <p className="text-xs text-slate-500 mt-0.5">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`w-2 h-2 rounded-full ${WS_DOT[wsStatus]}`} />
          <span className="capitalize">{wsStatus === 'open' ? 'Live' : wsStatus}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* ── Summary cards ── */}
        <section aria-label="Summary">
          <h2 className="text-xs text-slate-500 uppercase tracking-widest mb-4">Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Seats"
              value={summary?.total_seats}
              icon="🪑"
              accent="from-brand-400 to-indigo-500"
            />
            <SummaryCard
              title="Occupied"
              value={summary?.occupied_seats}
              icon="🔴"
              accent="from-rose-400 to-pink-600"
            />
            <SummaryCard
              title="Available"
              value={summary?.available_seats}
              icon="🟢"
              accent="from-emerald-400 to-teal-500"
            />
            <SummaryCard
              title="Active Sessions"
              value={summary?.active_sessions}
              icon="⚡"
              accent="from-amber-400 to-orange-500"
            />
          </div>
        </section>

        {/* ── Seat grid ── */}
        <section aria-label="Seat grid">
          <h2 className="text-xs text-slate-500 uppercase tracking-widest mb-4">
            Seat Map
            <span className="ml-2 text-slate-600 normal-case">({seats.length} seats)</span>
          </h2>
          {seats.length === 0 ? (
            <div className="glass rounded-2xl py-16 text-center text-slate-500 italic">
              No seats configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {seats.map((seat) => (
                <SeatCard key={seat.seat_id} seat={seat} />
              ))}
            </div>
          )}
        </section>

        {/* ── Recent sessions ── */}
        <section aria-label="Recent sessions">
          <h2 className="text-xs text-slate-500 uppercase tracking-widest mb-4">
            Recent Sessions
          </h2>
          <SessionTable sessions={sessions} />
        </section>
      </main>
    </div>
  )
}
