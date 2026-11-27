import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiClientError } from '../api/client'
import { useAuth } from '../context/useAuth'

interface LoginLocationState {
  from?: string
  registeredEmail?: string
  message?: string
}

interface LoginErrorState {
  variant: 'credentials' | 'rate_limit' | 'generic'
  title: string
  detail: string
}

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state as LoginLocationState | null) ?? null

  const [email, setEmail] = useState(navState?.registeredEmail ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorState, setErrorState] = useState<LoginErrorState | null>(null)

  if (!loading && user) {
    return (
      <Navigate to={user.role === 'admin' ? '/admin' : '/appointments'} replace />
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorState(null)
    setSubmitting(true)

    try {
      const loggedIn = await login({ email: email.trim(), password })
      const target =
        navState?.from && navState.from !== '/login' && navState.from !== '/register'
          ? navState.from
          : loggedIn.role === 'admin'
            ? '/admin'
            : '/appointments'
      navigate(target, { replace: true })
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 429 || err.code === 'RATE_LIMITED') {
          setErrorState({
            variant: 'rate_limit',
            title: '429 Too many attempts',
            detail:
              err.message ||
              'Too many login attempts. Please wait a minute and try again.',
          })
        } else if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
          setErrorState({
            variant: 'credentials',
            title: '401 Invalid credentials',
            detail: err.message || 'Invalid email or password.',
          })
        } else {
          setErrorState({
            variant: 'generic',
            title: err.status ? `Error (${err.status})` : 'Sign in failed',
            detail: err.message,
          })
        }
      } else {
        setErrorState({
          variant: 'generic',
          title: 'Sign in failed',
          detail: 'An unexpected error occurred. Please try again.',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Sign In
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Log in to manage your clinic appointments or access the staff portal.
          </p>
        </div>

        {navState?.message && !errorState && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {navState.message}
          </div>
        )}

        {errorState && (
          <div
            role="alert"
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              errorState.variant === 'rate_limit'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <p className="font-semibold">{errorState.title}</p>
            <p className="mt-0.5">{errorState.detail}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login_email"
              className="block text-sm font-medium text-slate-700"
            >
              Email Address
            </label>
            <input
              id="login_email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sara.ahmed@example.com"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="login_password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="login_password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
          <p>
            New patient?{' '}
            <Link
              to="/register"
              className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
