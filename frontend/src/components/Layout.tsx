import { Link, NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-teal-50 text-teal-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/appointments"
            className="flex items-center gap-2.5 text-slate-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight tracking-tight">
                Clinic Intake Portal
              </p>
              <p className="text-xs text-slate-500">
                Patient Appointment System
              </p>
            </div>
          </Link>

          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1">
            <NavLink to="/appointments" className={navLinkClass}>
              Appointments
            </NavLink>
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
            <NavLink to="/change-password" className={navLinkClass}>
              Change Password
            </NavLink>
            <span
              className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline-block"
              aria-hidden="true"
            />
            <NavLink to="/login" className={navLinkClass}>
              Login
            </NavLink>
            <NavLink
              to="/register"
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-700 text-white'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
                }`
              }
            >
              Register
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>Clinic Patient Appointment &amp; Intake Portal</p>
          <p>Department of Computer Science, ITU</p>
        </div>
      </footer>
    </div>
  )
}
