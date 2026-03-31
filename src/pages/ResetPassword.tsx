import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase puts access_token in the URL hash after clicking reset link
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      setReady(true)
    } else {
      setError('Invalid or expired reset link. Please request a new one.')
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-pink-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🛡️</div>
          <h1 className="text-2xl font-black text-primary-700">SafeHer Campus</h1>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-5">Set New Password</h2>
          {!ready ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" className="input" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" className="input" value={confirm}
                  onChange={e => setConfirm(e.target.value)} required placeholder="Repeat password" />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
