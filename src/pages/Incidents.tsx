import { useState, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getCurrentPosition } from '../lib/geolocation'

const categories = [
  { value: 'harassment', label: '😠 Harassment' },
  { value: 'suspicious', label: '👀 Suspicious Activity' },
  { value: 'unsafe_area', label: '⚠️ Unsafe Area' },
  { value: 'other', label: '📝 Other' },
]

export default function Incidents() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    category: 'harassment',
    description: '',
    location_name: '',
    severity: 3,
    is_anonymous: false,
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const coords = await getCurrentPosition().catch(() => null)

    const { error: err } = await supabase.from('incident_reports').insert({
      reporter_id: form.is_anonymous ? null : user?.id,
      is_anonymous: form.is_anonymous,
      category: form.category,
      description: form.description,
      location_name: form.location_name || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      severity: form.severity,
    })

    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setForm({ category: 'harassment', description: '', location_name: '', severity: 3, is_anonymous: false })
    }
  }

  return (
    <div className="py-4 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Report Incident</h1>
        <p className="text-sm text-gray-500">Help keep campus safe. Reports are reviewed by security.</p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-center">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800">Report submitted</p>
            <p className="text-sm text-green-600">Thank you. Security will review your report.</p>
          </div>
          <button onClick={() => setSuccess(false)} className="ml-auto text-green-600 text-sm underline">
            Report another
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Incident Type</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, category: cat.value }))}
                className={`py-2 px-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                  form.category === cat.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            className="input resize-none"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            required
            placeholder="Describe what happened..."
          />
        </div>

        {/* Location name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
          <input
            type="text"
            className="input"
            value={form.location_name}
            onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
            placeholder="e.g. Near Block C hostel"
          />
        </div>

        {/* Severity slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Severity: <span className="text-primary-600 font-bold">{form.severity}/5</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            value={form.severity}
            onChange={(e) => setForm((f) => ({ ...f, severity: Number(e.target.value) }))}
            className="w-full accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Low</span><span>High</span>
          </div>
        </div>

        {/* Anonymous toggle */}
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">Submit anonymously</p>
            <p className="text-xs text-gray-400">Your identity won't be linked to this report</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, is_anonymous: !f.is_anonymous }))}
            className={`w-12 h-6 rounded-full transition-colors relative ${form.is_anonymous ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_anonymous ? 'translate-x-6' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}
