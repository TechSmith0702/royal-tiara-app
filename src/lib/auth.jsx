import { createContext, useContext, useEffect, useState } from 'react'
import { publicUrl } from './platform.js'
import { disablePush } from './push.js'
import { supabase } from './supabase.js'

const AuthContext = createContext({ session: null, user: null, ready: false })

export const mapProfile = row => ({
  id: row.id,
  role: row.role,
  status: row.status,
  name: row.name,
  business: row.business,
  phone: row.phone,
  email: row.email,
  address: { line1: row.address_line1, line2: row.address_line2 },
  joinPay: row.join_pay,
  memberSince: row.created_at,
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  // Until Supabase has told us whether there is a session, we must not treat
  // anyone as signed out - otherwise a page opened directly at a deep link
  // (a notification, or PayFast sending the buyer back) bounces to sign-in.
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setSessionChecked(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionChecked(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id
  useEffect(() => {
    if (!sessionChecked) return
    if (!uid) {
      setUser(null)
      setReady(true)
      return
    }
    let alive = true
    setReady(false)
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (!alive) return
      setUser(data ? mapProfile(data) : null)
      setReady(true)
    }
    load()
    // Follow our own profile so approval by the admin takes effect immediately.
    const channel = supabase
      .channel('my-profile-' + uid)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + uid }, load)
      .subscribe()
    return () => { alive = false; supabase.removeChannel(channel) }
  }, [uid, sessionChecked])

  return <AuthContext.Provider value={{ session, user, ready }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
export const useCurrentUser = () => useContext(AuthContext).user

function friendly(message) {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid login')) return 'That email or password is not right.'
  if (m.includes('email not confirmed')) return 'Please confirm your email address first - check your inbox.'
  if (m.includes('already registered')) return 'That email already has an account. Try signing in instead.'
  if (m.includes('password')) return 'Your password must be at least 6 characters.'
  return message || 'Something went wrong. Please try again.'
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(friendly(error.message))
}

export async function signUp(form) {
  const { data, error } = await supabase.auth.signUp({
    email: form.email.trim(),
    password: form.password,
    options: {
      // The link in the confirmation email signs them in and opens the waiting screen.
      emailRedirectTo: publicUrl('/pending?confirmed=1'),
      data: {
        name: form.name,
        business: form.business,
        phone: form.phone,
        address: form.address,
        town: form.town,
        join_pay: form.joinPay,
      },
    },
  })
  if (error) throw new Error(friendly(error.message))
  return { needsEmailConfirmation: !data.session }
}

/** Used by the "forgot password" link, and by Account later on. */
export async function setNewPassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(friendly(error.message))
}

export async function signOut() {
  // Stop this phone's notifications first, so the next person to sign in here
  // does not receive the previous account's orders and messages.
  await disablePush().catch(() => {})
  // Only this device: signing out on a laptop leaves the phone app signed in.
  await supabase.auth.signOut({ scope: 'local' })
}

// Set when an account is deleted, read once by the sign-in screen to confirm it.
const DELETED_FLAG = 'rt-account-deleted'

/**
 * After the account has been deleted on the server: forget it on this device.
 * The sign-out is local only, because the login no longer exists to sign out of.
 */
export async function forgetDeletedAccount() {
  try {
    sessionStorage.setItem(DELETED_FLAG, '1')
  } catch {
    // private browsing: the sign-in screen just shows no confirmation
  }
  await disablePush().catch(() => {})
  await supabase.auth.signOut({ scope: 'local' })
}

/** True once, straight after an account was deleted on this device. */
export function wasJustDeleted() {
  try {
    if (sessionStorage.getItem(DELETED_FLAG) !== '1') return false
    sessionStorage.removeItem(DELETED_FLAG)
    return true
  } catch {
    return false
  }
}

export async function sendPasswordReset(email) {
  const redirectTo = publicUrl('/new-password')
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) throw new Error(friendly(error.message))
}
