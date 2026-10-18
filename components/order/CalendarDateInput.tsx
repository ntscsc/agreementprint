'use client';

export function CalendarDateInput({ id, value, onChange, error }: { id: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <div className="space-y-2">
    <input
      id={id}
      type="date"
      required
      value={value}
      onChange={event => onChange(event.target.value)}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`min-h-11 w-full min-w-0 rounded-xl border bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 ${error ? 'border-rose-400 focus:ring-rose-500' : 'border-stone-300 focus:ring-amber-500'}`}
    />
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
