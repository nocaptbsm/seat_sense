/**
 * SummaryCard — displays a single dashboard KPI.
 * @param {string} title
 * @param {number|string} value
 * @param {string} icon — emoji or any inline element
 * @param {string} accent — Tailwind gradient class string
 */
export default function SummaryCard({ title, value, icon, accent = 'from-brand-500 to-purple-600' }) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass p-6 flex flex-col gap-3 shadow-lg">
      {/* Background gradient blob */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />

      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium tracking-wide uppercase">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>

      <p className={`text-4xl font-bold bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>
        {value ?? '—'}
      </p>
    </div>
  )
}
