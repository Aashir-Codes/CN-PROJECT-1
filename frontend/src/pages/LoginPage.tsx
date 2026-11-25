import { Link } from 'react-router-dom'

export default function LoginPage() {
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

        {/* Error alert slots for 401 Invalid credentials and 429 Too many attempts */}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
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
              placeholder="Enter your password"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Sign In
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
