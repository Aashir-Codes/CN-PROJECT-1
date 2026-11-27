import axios from 'axios'
import type {
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
  Appointment,
  AppointmentStatus,
  ChangePasswordPayload,
  CreateAppointmentPayload,
  HealthData,
  LoginPayload,
  RegisterPayload,
  RegisteredUser,
  UpdateAppointmentPayload,
  User,
} from './types'

export class ApiClientError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (candidate.status !== 'error') return false
  const err = candidate.error as Record<string, unknown> | undefined
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof err.code === 'string' &&
    typeof err.message === 'string'
  )
}

function fallbackMessageForStatus(status: number): { code: string; message: string } {
  switch (status) {
    case 400:
      return { code: 'VALIDATION_ERROR', message: 'Invalid request data.' }
    case 401:
      return { code: 'UNAUTHORIZED', message: 'Authentication required or invalid credentials.' }
    case 403:
      return { code: 'FORBIDDEN', message: 'Access forbidden.' }
    case 404:
      return { code: 'NOT_FOUND', message: 'Requested resource was not found.' }
    case 429:
      return {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.',
      }
    default:
      return {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred. Please try again.',
      }
  }
}

export function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new ApiClientError(
        0,
        'NETWORK_ERROR',
        'Unable to reach the server. Please verify the backend is running.',
      )
    }

    const { status, data, headers } = error.response
    const contentType = String(headers?.['content-type'] ?? '').toLowerCase()

    // Defensively handle non-JSON HTML error pages (e.g. Nginx 429 or ModSecurity 403).
    if (contentType.includes('application/json') && isApiErrorEnvelope(data)) {
      return new ApiClientError(status, data.error.code, data.error.message)
    }

    if (isApiErrorEnvelope(data)) {
      return new ApiClientError(status, data.error.code, data.error.message)
    }

    const fallback = fallbackMessageForStatus(status)
    return new ApiClientError(status, fallback.code, fallback.message)
  }

  if (error instanceof Error) {
    return new ApiClientError(0, 'UNKNOWN_ERROR', error.message)
  }

  return new ApiClientError(0, 'UNKNOWN_ERROR', 'An unexpected error occurred.')
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeApiError(error)),
)

export const healthApi = {
  async check(): Promise<HealthData> {
    const res = await apiClient.get<ApiSuccessEnvelope<HealthData>>('/health')
    return res.data.data
  },
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<RegisteredUser> {
    const res = await apiClient.post<ApiSuccessEnvelope<RegisteredUser>>(
      '/auth/register',
      payload,
    )
    return res.data.data
  },

  async login(payload: LoginPayload): Promise<User> {
    const res = await apiClient.post<ApiSuccessEnvelope<User>>(
      '/auth/login',
      payload,
    )
    return res.data.data
  },

  async logout(): Promise<{ message: string }> {
    const res = await apiClient.post<ApiSuccessEnvelope<{ message: string }>>(
      '/auth/logout',
    )
    return res.data.data
  },

  async me(): Promise<User> {
    const res = await apiClient.get<ApiSuccessEnvelope<User>>('/auth/me')
    return res.data.data
  },

  async changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
    const res = await apiClient.patch<ApiSuccessEnvelope<{ message: string }>>(
      '/auth/change-password',
      payload,
    )
    return res.data.data
  },
}

export const appointmentsApi = {
  async listMine(): Promise<Appointment[]> {
    const res = await apiClient.get<ApiSuccessEnvelope<{ appointments: Appointment[] }>>(
      '/appointments',
    )
    return res.data.data.appointments
  },

  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const res = await apiClient.post<ApiSuccessEnvelope<Appointment>>(
      '/appointments',
      payload,
    )
    return res.data.data
  },

  async getById(id: number): Promise<Appointment> {
    const res = await apiClient.get<ApiSuccessEnvelope<Appointment>>(
      `/appointments/${id}`,
    )
    return res.data.data
  },

  async update(id: number, payload: UpdateAppointmentPayload): Promise<Appointment> {
    const res = await apiClient.patch<ApiSuccessEnvelope<Appointment>>(
      `/appointments/${id}`,
      payload,
    )
    return res.data.data
  },
}

export const adminApi = {
  async listAll(): Promise<Appointment[]> {
    const res = await apiClient.get<ApiSuccessEnvelope<{ appointments: Appointment[] }>>(
      '/admin/appointments',
    )
    return res.data.data.appointments
  },

  async updateStatus(id: number, status: AppointmentStatus): Promise<Appointment> {
    const res = await apiClient.patch<ApiSuccessEnvelope<Appointment>>(
      `/admin/appointments/${id}/status`,
      { status },
    )
    return res.data.data
  },

  async deleteCancelled(id: number): Promise<{ deleted_id: number; message: string }> {
    const res = await apiClient.delete<
      ApiSuccessEnvelope<{ deleted_id: number; message: string }>
    >(`/admin/appointments/${id}`)
    return res.data.data
  },
}
