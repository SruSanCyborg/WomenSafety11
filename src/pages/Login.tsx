import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [isUnconfirmed, setIsUnconfirmed] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const isEmailNotConfirmed = (msg: string) =>
    msg.toLowerCase().includes('email not confirmed') ||
    msg.toLowerCase().includes('not confirmed')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setIsUnconfirmed(false)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      if (isEmailNotConfirmed(error.message)) {
        setIsUnconfirmed(true)
      } else {
        setError(error.message)
      }
    } else {
      navigate('/home')
    }
  }

  async function resendConfirmation() {
    setResendSent(false)
    await supabase.auth.resend({ type: 'signup', email })
    setResendSent(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-pink-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🛡️</div>
          <h1 className="text-2xl font-black text-primary-700">SafeHer Campus</h1>
          <p className="text-sm text-gray-500 mt-1">Your safety, always first.</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-5">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@college.edu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {isUnconfirmed && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 space-y-2">
                <p className="text-yellow-800 text-sm font-semibold">📧 Email not confirmed</p>
                <p className="text-yellow-700 text-xs">
                  Check your inbox for a confirmation link, or resend it below.
                </p>
                {resendSent ? (
                  <p className="text-green-700 text-xs font-medium">✅ Confirmation email resent!</p>
                ) : (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    className="text-xs text-yellow-800 underline font-medium"
                  >
                    Resend confirmation email
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary-600 font-semibold">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
