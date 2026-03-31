import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-pink-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🛡️</div>
          <h1 className="text-2xl font-black text-primary-700">SafeHer Campus</h1>
        </div>

        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <p className="text-4xl mb-3">📧</p>
              <h2 className="text-lg font-bold text-gray-800 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-4">
                We sent a password reset link to <strong>{email}</strong>
              </p>
              <Link to="/login" className="btn-primary block text-center">Back to Sign In</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-1">Forgot Password</h2>
              <p className="text-sm text-gray-500 mb-5">Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="email" className="input" value={email}
                  onChange={e => setEmail(e.target.value)} required placeholder="you@college.edu" />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-4">
                <Link to="/login" className="text-primary-600 font-semibold">← Back to Sign In</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
