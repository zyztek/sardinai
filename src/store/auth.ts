import { create } from 'zustand'

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
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  
  login: async (email: string, password: string) => {
    set({ loading: true })
    // Minimal implementation
    set({ loading: false })
  },
  
  logout: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
    })
  },
}))