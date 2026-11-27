export const DEPARTMENTS = [
  'Cardiology',
  'General Medicine',
  'Orthopedics',
  'Pediatrics',
  'Dermatology',
  'Neurology',
] as const

export type Department = (typeof DEPARTMENTS)[number]

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export type UserRole = 'user' | 'admin'

export interface User {
  id: number
  full_name: string
  email: string
  role: UserRole
}

export interface RegisteredUser extends User {
  created_at: string
}

export interface Appointment {
  id: number
  user_id: number
  patient_name: string
  department: Department
  appointment_date: string
  medical_notes: string
  status: AppointmentStatus
  created_at: string
  updated_at: string
}

export interface HealthData {
  hostname: string
  ip: string
  db_reachable: boolean
}

export interface RegisterPayload {
  full_name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

export interface CreateAppointmentPayload {
  patient_name: string
  department: Department
  appointment_date: string
  medical_notes: string
}

export interface UpdateAppointmentPayload {
  appointment_date?: string
  department?: Department
  medical_notes?: string
  status?: 'cancelled'
}

export interface ApiSuccessEnvelope<T> {
  status: 'ok'
  data: T
}

export interface ApiErrorEnvelope {
  status: 'error'
  error: {
    code: string
    message: string
  }
  data?: unknown
}
