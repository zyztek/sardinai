import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  updateProfile: (userData: Partial<User>) => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: true,

      login: async (email: string, password: string) => {
        try {
          set({ loading: true })
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error al iniciar sesión')
          }

          const data = await response.json()
          
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            loading: false,
          })

          // Store token in localStorage for API calls
          localStorage.setItem('auth_token', data.access_token)
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      register: async (username: string, email: string, password: string) => {
        try {
          set({ loading: true })
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error al registrarse')
          }

          const data = await response.json()
          
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            loading: false,
          })

          localStorage.setItem('auth_token', data.access_token)
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          loading: false,
        })
        localStorage.removeItem('auth_token')
      },

      updateProfile: async (userData: Partial<User>) => {
        try {
          const { token } = get()
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Error al actualizar perfil')
          }

          const data = await response.json()
          
          set({
            user: data.user,
          })
        } catch (error) {
          throw error
        }
      },

      checkAuth: async () => {
        try {
          const token = localStorage.getItem('auth_token')
          
          if (!token) {
            set({ loading: false })
            return
          }

          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            set({
              user: data.user,
              token,
              isAuthenticated: true,
              loading: false,
            })
          } else {
            // Token is invalid, clear auth state
            localStorage.removeItem('auth_token')
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              loading: false,
            })
          }
        } catch (error) {
          localStorage.removeItem('auth_token')
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            loading: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)