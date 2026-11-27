import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiClientError, appointmentsApi } from '../api/client'
import { DEPARTMENTS } from '../api/types'
import type { Appointment, AppointmentStatus, Department } from '../api/types'
import { useAuth } from '../context/useAuth'

function statusBadgeClass(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-50 text-blue-700'
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700'
    case 'completed':
      return 'bg-slate-100 text-slate-700'
    case 'cancelled':
      return 'bg-red-50 text-red-700'
  }
}

function formatDisplayDate(iso: string): string {
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

function toDateTimeLocalValue(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function AppointmentsPage() {
  const { user } = useAuth()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // Intake form state
  const [patientName, setPatientName] = useState(user?.full_name ?? '')
  const [department, setDepartment] = useState<Department | ''>('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [medicalNotes, setMedicalNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // Inline reschedule / cancel state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDepartment, setEditDepartment] = useState<Department>('Cardiology')
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [actionBusyId, setActionBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadAppointments = useCallback(async () => {
    setListError(null)
    setLoadingList(true)
    try {
      const rows = await appointmentsApi.listMine()
      setAppointments(rows)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setListError(err.message)
      } else {
        setListError('Failed to load appointments.')
      }
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    appointmentsApi
      .listMine()
      .then((rows) => {
        if (!cancelled) {
          setAppointments(rows)
          setListError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setListError(
            err instanceof ApiClientError
              ? err.message
              : 'Failed to load appointments.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleBook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    if (!department) {
      setFormError('Please select a clinic department.')
      return
    }

    const parsedDate = new Date(appointmentDate)
    if (Number.isNaN(parsedDate.getTime())) {
      setFormError('Please enter a valid appointment date and time.')
      return
    }

    setSubmitting(true)
    try {
      const created = await appointmentsApi.create({
        patient_name: patientName.trim(),
        department,
        appointment_date: parsedDate.toISOString(),
        medical_notes: medicalNotes.trim(),
      })
      setAppointments((prev) => [created, ...prev])
      setDepartment('')
      setAppointmentDate('')
      setMedicalNotes('')
      setFormSuccess('Appointment booked successfully.')
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message)
      } else {
        setFormError('Unable to book appointment. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function startReschedule(appt: Appointment) {
    setActionError(null)
    setEditingId(appt.id)
    setEditDepartment(appt.department)
    setEditDate(toDateTimeLocalValue(appt.appointment_date))
    setEditNotes(appt.medical_notes)
  }

  async function handleSaveReschedule(apptId: number) {
    setActionError(null)
    const parsedDate = new Date(editDate)
    if (Number.isNaN(parsedDate.getTime())) {
      setActionError('Please enter a valid rescheduled date and time.')
      return
    }

    setActionBusyId(apptId)
    try {
      const updated = await appointmentsApi.update(apptId, {
        department: editDepartment,
        appointment_date: parsedDate.toISOString(),
        medical_notes: editNotes.trim(),
      })
      setAppointments((prev) =>
        prev.map((item) => (item.id === apptId ? updated : item)),
      )
      setEditingId(null)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setActionError(err.message)
      } else {
        setActionError('Failed to reschedule appointment.')
      }
    } finally {
      setActionBusyId(null)
    }
  }

  async function handleCancel(apptId: number) {
    setActionError(null)
    setActionBusyId(apptId)
    try {
      const updated = await appointmentsApi.update(apptId, {
        status: 'cancelled',
      })
      setAppointments((prev) =>
        prev.map((item) => (item.id === apptId ? updated : item)),
      )
      if (editingId === apptId) {
        setEditingId(null)
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setActionError(err.message)
      } else {
        setActionError('Failed to cancel appointment.')
      }
    } finally {
      setActionBusyId(null)
    }
  }

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
              All four fields are required. Medical notes are encrypted at rest.
            </p>

            {formSuccess && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800"
              >
                {formSuccess}
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleBook} className="mt-5 space-y-4">
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
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
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
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                >
                  <option value="" disabled>
                    Select a clinic department
                  </option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
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
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
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
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  placeholder="Describe your symptoms, relevant history, or reason for visit..."
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Booking Appointment...' : 'Book Appointment'}
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
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {appointments.length}{' '}
                {appointments.length === 1 ? 'record' : 'records'}
              </span>
              <button
                type="button"
                onClick={() => void loadAppointments()}
                disabled={loadingList}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {actionError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {actionError}
            </div>
          )}

          {loadingList ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Loading your appointments...
            </div>
          ) : listError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
            >
              <p className="font-medium">Could not load appointments</p>
              <p className="mt-1">{listError}</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No appointments booked yet. Use the intake form to schedule your
              first visit.
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                const isLocked =
                  appt.status === 'completed' || appt.status === 'cancelled'
                const isBusy = actionBusyId === appt.id
                const isEditing = editingId === appt.id

                return (
                  <article
                    key={appt.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {appt.patient_name}
                          </h3>
                          <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                            {appt.department}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDisplayDate(appt.appointment_date)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(appt.status)}`}
                      >
                        {appt.status}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`edit-dept-${appt.id}`}
                              className="block text-xs font-medium text-slate-700"
                            >
                              Department
                            </label>
                            <select
                              id={`edit-dept-${appt.id}`}
                              value={editDepartment}
                              onChange={(e) =>
                                setEditDepartment(e.target.value as Department)
                              }
                              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                            >
                              {DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`edit-date-${appt.id}`}
                              className="block text-xs font-medium text-slate-700"
                            >
                              Date &amp; Time
                            </label>
                            <input
                              id={`edit-date-${appt.id}`}
                              type="datetime-local"
                              required
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-notes-${appt.id}`}
                            className="block text-xs font-medium text-slate-700"
                          >
                            Medical Notes
                          </label>
                          <textarea
                            id={`edit-notes-${appt.id}`}
                            rows={3}
                            required
                            maxLength={4000}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSaveReschedule(appt.id)}
                            className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
                          >
                            {isBusy ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                          {appt.medical_notes}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isLocked || isBusy}
                            onClick={() => startReschedule(appt)}
                            className={
                              isLocked
                                ? 'cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-400'
                                : 'rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60'
                            }
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            disabled={isLocked || isBusy}
                            onClick={() => void handleCancel(appt.id)}
                            className={
                              isLocked
                                ? 'cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-400'
                                : 'rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60'
                            }
                          >
                            {isBusy ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
