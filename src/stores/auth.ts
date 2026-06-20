import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { post, get } from '@/utils/api'

interface User {
  id: number
  email: string
  name: string
  role: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isAuthenticated = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const res = await post<{ token: string; user: User }>('/auth/login', { email, password })
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
  }

  async function register(email: string, password: string, name: string) {
    const res = await post<{ token: string; user: User }>('/auth/register', { email, password, name })
    token.value = res.token
    user.value = res.user
    localStorage.setItem('token', res.token)
  }

  async function fetchMe() {
    try {
      const res = await get<User>('/auth/me')
      user.value = res
    } catch {
      logout()
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return { user, token, isAuthenticated, login, register, fetchMe, logout }
})
