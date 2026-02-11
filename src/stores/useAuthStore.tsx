import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from 'react'
import { supabase } from '@/lib/supabase/client'
import type { User, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  users: User[]
  fetchOrgUsers: () => Promise<void>
  updateUserStatus: (userId: string, active: boolean) => void
  updateProfile: (data: { name: string; avatar?: File }) => Promise<void>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function loadUserProfile(authUserId: string, authEmail: string): Promise<User> {
  const [profileRes, membershipRes] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url').eq('id', authUserId).single(),
    supabase.from('memberships').select('role, organization_id').eq('user_id', authUserId).limit(1).single(),
  ])

  if (membershipRes.error || !membershipRes.data) {
    console.error('[loadUserProfile] Membership lookup failed', {
      authUserId,
      error: membershipRes.error,
    })
    throw new Error('Usuário não pertence a nenhuma organização.')
  }

  const profile = profileRes.data
  const membership = membershipRes.data

  return {
    id: authUserId,
    name: profile?.full_name || authEmail.split('@')[0],
    email: authEmail,
    role: membership.role as UserRole,
    avatar: profile?.avatar_url || undefined,
    companyId: membership.organization_id,
    active: true,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)
  const loginInProgressRef = useRef<((v: boolean) => void) | null>(null)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    let handledByGetSession = false
    let loginInProgress = false

    // Expose loginInProgress setter for the login function
    loginInProgressRef.current = (v: boolean) => { loginInProgress = v }

    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handledByGetSession = true
        loadUserProfile(session.user.id, session.user.email || '').then(
          (u) => { setUser(u); setLoading(false) },
          () => { handledByGetSession = false; setLoading(false) },
        )
      } else {
        setLoading(false)
      }
    }).catch(() => {
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          if (handledByGetSession || loginInProgress) {
            handledByGetSession = false
            return
          }
          loadUserProfile(session.user.id, session.user.email || '').then(
            (u) => { setUser(u); setLoading(false) },
            () => { setLoading(false) },
          )
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setUsers([])
          setLoading(false)
        } else if (event === 'PASSWORD_RECOVERY') {
          // Recovery token exchanged -- session exists but we don't load profile.
          // ResetPassword page handles the password update and signOut.
          setLoading(false)
        }
      },
    )

    return () => { subscription.unsubscribe() }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    loginInProgressRef.current?.(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      if (data.session?.user) {
        const u = await loadUserProfile(data.session.user.id, data.session.user.email || '')
        setUser(u)
        setLoading(false)
      }
    } finally {
      loginInProgressRef.current?.(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUsers([])
  }, [])

  const fetchOrgUsers = useCallback(async () => {
    if (!user) return

    const { data: memberships, error: mErr } = await supabase
      .from('memberships')
      .select('user_id, role, organization_id')
      .eq('organization_id', user.companyId)

    if (mErr || !memberships) return

    const userIds = memberships.map((m) => m.user_id)
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    if (pErr || !profiles) return

    const profileMap = new Map(profiles.map((p) => [p.id, p]))

    const orgUsers: User[] = memberships.map((m) => {
      const p = profileMap.get(m.user_id)
      return {
        id: m.user_id,
        name: p?.full_name || 'Usuário',
        email: '',
        role: m.role as UserRole,
        avatar: p?.avatar_url || undefined,
        companyId: m.organization_id,
        active: true,
      }
    })

    setUsers(orgUsers)
  }, [user])

  // Auto-fetch org users when user logs in (for name resolution)
  useEffect(() => {
    if (user) {
      fetchOrgUsers()
    }
  }, [user, fetchOrgUsers])

  const updateUserStatus = useCallback((_userId: string, _active: boolean) => {
    // No-op: DB doesn't have an active field on memberships.
    // Could be implemented as membership deletion in the future.
  }, [])

  const updateProfile = useCallback(async (data: { name: string; avatar?: File }) => {
    if (!user) return

    let avatarUrl = user.avatar

    if (data.avatar) {
      const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
      if (!ALLOWED_MIME.includes(data.avatar.type)) {
        throw new Error('Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.')
      }
      if (data.avatar.size > MAX_SIZE) {
        throw new Error('Arquivo muito grande. O tamanho máximo é 2 MB.')
      }

      const ext = data.avatar.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, data.avatar, { upsert: true, contentType: data.avatar.type })

      if (uploadErr) {
        throw uploadErr
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = urlData.publicUrl
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: data.name,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) throw error

    const updatedUser = { ...user, name: data.name, avatar: avatarUrl }
    setUser(updatedUser)
  }, [user])

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user?.email) throw new Error('Usuário não autenticado')

    // Reauthenticate with current password before allowing change
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (authErr) throw new Error('Senha atual incorreta')

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        users,
        fetchOrgUsers,
        updateUserStatus,
        updateProfile,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

const useAuthStore = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuthStore must be used within AuthProvider')
  return context
}

export default useAuthStore
