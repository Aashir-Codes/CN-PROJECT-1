import { Link } from 'react-router-dom'

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Create Patient Account
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Register to submit appointment intake forms and manage your bookings.
          </p>
        </div>

        {/* Inline validation error alert slot (e.g. 400 VALIDATION_ERROR / EMAIL_ALREADY_EXISTS) */}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div>
            <label
              htmlFor="full_name"
              className="block text-sm font-medium text-slate-700"
            >
              Full Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              placeholder="Sara Ahmed"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <p className="mt-1 text-xs text-slate-500">2 to 120 characters.</p>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={255}
              autoComplete="email"
              placeholder="sara.ahmed@example.com"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Must be 8 to 128 characters.
            </p>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </section>
  )
}
