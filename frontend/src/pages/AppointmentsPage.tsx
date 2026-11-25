export default function AppointmentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Patient Appointments
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Submit a new clinic intake form or manage your existing bookings.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* 4-Field Patient Intake Form */}
        <section className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              New Appointment Intake
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              All four fields are required. Medical notes are protected at rest.
            </p>

            <form onSubmit={(e) => e.preventDefault()} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="patient_name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Patient Name
                </label>
                <input
                  id="patient_name"
                  name="patient_name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Sara Ahmed"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="department"
                  className="block text-sm font-medium text-slate-700"
                >
                  Department
                </label>
                <select
                  id="department"
                  name="department"
                  required
                  defaultValue=""
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                >
                  <option value="" disabled>
                    Select a clinic department
                  </option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Neurology">Neurology</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="appointment_date"
                  className="block text-sm font-medium text-slate-700"
                >
                  Appointment Date &amp; Time
                </label>
                <input
                  id="appointment_date"
                  name="appointment_date"
                  type="datetime-local"
                  required
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="medical_notes"
                  className="block text-sm font-medium text-slate-700"
                >
                  Medical Notes / Symptoms
                </label>
                <textarea
                  id="medical_notes"
                  name="medical_notes"
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder="Describe your symptoms, relevant history, or reason for visit..."
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
              >
                Book Appointment
              </button>
            </form>
          </div>
        </section>

        {/* Current User's Booked Appointments */}
        <section className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              My Booked Appointments
            </h2>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              3 sample records
            </span>
          </div>

          <div className="space-y-4">
            {/* Sample Scheduled Appointment */}
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      Sara Ahmed
                    </h3>
                    <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                      Cardiology
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Dec 01, 2026 &middot; 10:30 AM
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  scheduled
                </span>
              </div>

              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Mild chest tightness during brisk walking for 3 days.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  Cancel
                </button>
              </div>
            </article>

            {/* Sample Confirmed Appointment */}
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      Sara Ahmed
                    </h3>
                    <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                      General Medicine
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Dec 05, 2026 &middot; 02:00 PM
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  confirmed
                </span>
              </div>

              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Follow-up consultation for seasonal fatigue and routine lab
                review.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  Cancel
                </button>
              </div>
            </article>

            {/* Sample Completed Appointment */}
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      Sara Ahmed
                    </h3>
                    <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                      Dermatology
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Nov 12, 2026 &middot; 11:00 AM
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  completed
                </span>
              </div>

              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                Annual skin checkup and mild dry patch evaluation.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-400"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  )
}
