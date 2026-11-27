import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClientError, adminApi } from '../api/client'
import { APPOINTMENT_STATUSES } from '../api/types'
import type { Appointment, AppointmentStatus } from '../api/types'
import { useAuth } from '../context/useAuth'

function formatTableDate(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(isAdmin)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const loadAll = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const rows = await adminApi.listAll()
      setAppointments(rows)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(
          err.status === 403
            ? '403 Forbidden: Administrator privileges are required.'
            : err.message,
        )
      } else {
        setError('Failed to load clinic appointments.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    adminApi
      .listAll()
      .then((rows) => {
        if (!cancelled) {
          setAppointments(rows)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.status === 403
                ? '403 Forbidden: Administrator privileges are required.'
                : err.message
              : 'Failed to load clinic appointments.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  async function handleStatusChange(
    apptId: number,
    newStatus: AppointmentStatus,
  ) {
    setError(null)
    setFeedback(null)
    setBusyId(apptId)
    try {
      const updated = await adminApi.updateStatus(apptId, newStatus)
      setAppointments((prev) =>
        prev.map((item) => (item.id === apptId ? updated : item)),
      )
      setFeedback(`Appointment #${apptId} status updated to "${newStatus}".`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
      } else {
        setError('Unable to update appointment status.')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(apptId: number) {
    setError(null)
    setFeedback(null)
    setBusyId(apptId)
    try {
      const result = await adminApi.deleteCancelled(apptId)
      setAppointments((prev) => prev.filter((item) => item.id !== apptId))
      setFeedback(result.message || `Cancelled appointment #${apptId} deleted.`)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
      } else {
        setError('Unable to delete appointment.')
      }
    } finally {
      setBusyId(null)
    }
  }

  if (!isAdmin) {
    return (
      <section className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
          403 Forbidden
        </span>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">
          Clinic Staff Access Required
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This dashboard is restricted to authorized clinic administrators.
        </p>
        <Link
          to="/appointments"
          className="mt-5 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          Go to My Appointments
        </Link>
      </section>
    )
  }

  const scheduledCount = appointments.filter((a) => a.status === 'scheduled').length
  const confirmedCount = appointments.filter((a) => a.status === 'confirmed').length
  const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length

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
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {feedback}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Bookings</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {appointments.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Scheduled</p>
          <p className="mt-1 text-2xl font-semibold text-blue-700">
            {scheduledCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Confirmed</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">
            {confirmedCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Cancelled</p>
          <p className="mt-1 text-2xl font-semibold text-red-700">
            {cancelledCount}
          </p>
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

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading clinic appointments...
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No patient appointments have been booked yet.
          </div>
        ) : (
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
                {appointments.map((appt) => {
                  const isCancelled = appt.status === 'cancelled'
                  const isBusy = busyId === appt.id

                  return (
                    <tr
                      key={appt.id}
                      className={
                        isCancelled
                          ? 'bg-red-50/30 hover:bg-red-50/50'
                          : 'hover:bg-slate-50/70'
                      }
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500">
                        #{appt.id}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                        {appt.patient_name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {appt.department}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatTableDate(appt.appointment_date)}
                      </td>
                      <td className="max-w-xs px-5 py-4 text-slate-600">
                        {appt.medical_notes}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <select
                          aria-label={`Status for appointment ${appt.id}`}
                          value={appt.status}
                          disabled={isBusy}
                          onChange={(e) =>
                            void handleStatusChange(
                              appt.id,
                              e.target.value as AppointmentStatus,
                            )
                          }
                          className={`rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:opacity-60 ${
                            isCancelled
                              ? 'border-red-300 text-red-700'
                              : 'border-slate-300 text-slate-800'
                          }`}
                        >
                          {APPOINTMENT_STATUSES.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {statusOption}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <button
                          type="button"
                          disabled={!isCancelled || isBusy}
                          onClick={() => void handleDelete(appt.id)}
                          title={
                            isCancelled
                              ? 'Permanently delete cancelled appointment'
                              : 'Only cancelled appointments can be deleted'
                          }
                          className={
                            isCancelled
                              ? 'rounded-lg border border-red-200 bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60'
                              : 'cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400'
                          }
                        >
                          {isBusy && isCancelled ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
