import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { CheckinSchedule } from '../types'

export default function Schedule() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<CheckinSchedule[]>([])
  const [form, setForm] = useState({ label: '', interval_min: 5 })
  const [loading, setLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('checkin_schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSchedules(data ?? []))
  }, [user])

  async function createSchedule(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('checkin_schedules')
      .insert({
        user_id: user.id,
        label: form.label,
        interval_min: form.interval_min,
        is_active: false,
      })
      .select()
      .single()
    if (data) setSchedules((prev) => [data, ...prev])
    setForm({ label: '', interval_min: 5 })
    setLoading(false)
  }

  async function toggleSchedule(schedule: CheckinSchedule) {
    const next = !schedule.is_active
    await supabase
      .from('checkin_schedules')
      .update({ is_active: next, start_time: next ? new Date().toISOString() : null })
      .eq('id', schedule.id)
    setSchedules((prev) =>
      prev.map((s) => (s.id === schedule.id ? { ...s, is_active: next } : s))
    )
  }

  async function sendCheckin(schedule: CheckinSchedule) {
    setCheckingIn(true)
    await supabase
      .from('checkin_schedules')
      .update({ last_checkin: new Date().toISOString() })
      .eq('id', schedule.id)
    setSchedules((prev) =>
      prev.map((s) => (s.id === schedule.id ? { ...s, last_checkin: new Date().toISOString() } : s))
    )
    setCheckingIn(false)
  }

  async function deleteSchedule(id: string) {
    await supabase.from('checkin_schedules').delete().eq('id', id)
    setSchedules((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="py-4 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Safety Check-in</h1>
        <p className="text-sm text-gray-500">Set a schedule — miss it and SOS auto-triggers</p>
      </div>

      {/* Create form */}
      <form onSubmit={createSchedule} className="card space-y-3">
        <p className="font-semibold text-sm text-gray-800">New Schedule</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
          <input
            type="text"
            className="input"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            required
            placeholder="e.g. Walking home at 11 PM"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Check-in every <strong>{form.interval_min} min</strong>
          </label>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={form.interval_min}
            onChange={(e) => setForm((f) => ({ ...f, interval_min: Number(e.target.value) }))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>2 min</span><span>30 min</span>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating...' : 'Create Schedule'}
        </button>
      </form>

      {/* Schedules list */}
      <div className="space-y-3">
        {schedules.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-3xl mb-2">⏰</p>
            <p className="text-gray-500 text-sm">No schedules yet. Create one above.</p>
          </div>
        )}
        {schedules.map((s) => (
          <div key={s.id} className={`card border-l-4 ${s.is_active ? 'border-green-500' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-800">{s.label || 'Unnamed Schedule'}</p>
                <p className="text-xs text-gray-500">Every {s.interval_min} minutes</p>
                {s.last_checkin && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last check-in: {new Date(s.last_checkin).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {s.is_active && (
                  <button
                    onClick={() => sendCheckin(s)}
                    disabled={checkingIn}
                    className="text-xs bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-lg"
                  >
                    ✓ Check In
                  </button>
                )}
                <button
                  onClick={() => toggleSchedule(s)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${s.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${s.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            </div>
            <button
              onClick={() => deleteSchedule(s.id)}
              className="mt-2 text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
