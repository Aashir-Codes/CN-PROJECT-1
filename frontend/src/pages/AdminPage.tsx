export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
            Clinic Staff Only
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Admin Appointments Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Review all patients&apos; bookings, update appointment statuses, and
            delete cancelled records.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Bookings</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">4</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Scheduled</p>
          <p className="mt-1 text-2xl font-semibold text-blue-700">1</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Confirmed</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">1</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Cancelled</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">1</p>
        </div>
      </section>

      {/* All Patients' Appointments Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            All Patient Appointments
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Delete is enabled only for appointments with status{' '}
            <span className="font-medium text-slate-700">cancelled</span>.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  ID
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Patient
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Department
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Date &amp; Time
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Medical Notes
                </th>
                <th scope="col" className="px-5 py-3.5">
                  Status
                </th>
                <th scope="col" className="px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500">
                  #10
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                  Sara Ahmed
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                  Cardiology
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  2026-12-01 10:30
                </td>
                <td className="max-w-xs px-5 py-4 text-slate-600">
                  Mild chest tightness during brisk walking for 3 days.
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <select
                    aria-label="Status for appointment 10"
                    defaultValue="scheduled"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right">
                  <button
                    type="button"
                    disabled
                    title="Only cancelled appointments can be deleted"
                    className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500">
                  #11
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                  Bilal Raza
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                  Orthopedics
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  2026-12-02 14:00
                </td>
                <td className="max-w-xs px-5 py-4 text-slate-600">
                  Right knee stiffness after running; swelling reduced with ice.
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <select
                    aria-label="Status for appointment 11"
                    defaultValue="confirmed"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right">
                  <button
                    type="button"
                    disabled
                    title="Only cancelled appointments can be deleted"
                    className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500">
                  #12
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                  Ayesha Khan
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                  Pediatrics
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  2026-11-28 09:15
                </td>
                <td className="max-w-xs px-5 py-4 text-slate-600">
                  Routine immunization and growth checkup.
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <select
                    aria-label="Status for appointment 12"
                    defaultValue="completed"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right">
                  <button
                    type="button"
                    disabled
                    title="Only cancelled appointments can be deleted"
                    className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>

              <tr className="bg-red-50/30 hover:bg-red-50/50">
                <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500">
                  #13
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                  Hamza Tariq
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                  Neurology
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                  2026-12-04 16:00
                </td>
                <td className="max-w-xs px-5 py-4 text-slate-600">
                  Recurring tension headaches in late afternoon.
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <select
                    aria-label="Status for appointment 13"
                    defaultValue="cancelled"
                    className="rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right">
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
