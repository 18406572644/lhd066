const BASE_URL = '/api'

function getToken(): string | null {
  return localStorage.getItem('token')
}

function buildHeaders(custom?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...custom,
  }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function request<T>(method: string, path: string, data?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: buildHeaders(),
  }
  if (data !== undefined) {
    opts.body = JSON.stringify(data)
  }
  const res = await fetch(`${BASE_URL}${path}`, opts)
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  const json = await res.json()
  return ('data' in json ? json.data : json) as T
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function post<T>(path: string, data?: unknown): Promise<T> {
  return request<T>('POST', path, data)
}

export function put<T>(path: string, data?: unknown): Promise<T> {
  return request<T>('PUT', path, data)
}

export function del<T>(path: string): Promise<T> {
  return request<T>('DELETE', path)
}

export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  const json = await res.json()
  return ('data' in json ? json.data : json) as T
}
