import { Link } from 'react-router-dom'

export default function ChangePasswordPage() {
  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Change Password
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Verify your current password before saving a new one.
          </p>
        </div>

        {/* Success / Error feedback banner slot */}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div>
            <label
              htmlFor="current_password"
              className="block text-sm font-medium text-slate-700"
            >
              Current Password
            </label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter current password"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="new_password"
              className="block text-sm font-medium text-slate-700"
            >
              New Password
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              8 to 128 characters; must differ from your current password.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="block text-sm font-medium text-slate-700"
            >
              Confirm New Password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Update Password
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link
            to="/appointments"
            className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
          >
            Back to Appointments
          </Link>
        </p>
      </div>
    </section>
  )
}
