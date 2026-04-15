import { useEffect, useRef, useState } from 'react'

/**
 * SessionTimer — displays a live HH:MM:SS counter from a given start time.
 * @param {string | Date} startTime — ISO string or Date object
 */
export default function SessionTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!startTime) return

    const start = new Date(startTime).getTime()

    const tick = () => {
      const now = Date.now()
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)))
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)

    return () => clearInterval(intervalRef.current)
  }, [startTime])

  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  const seconds = elapsed % 60

  const pad = (n) => String(n).padStart(2, '0')

  return (
    <span className="font-mono tabular-nums">
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  )
}
