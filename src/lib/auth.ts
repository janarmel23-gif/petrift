import { isSupabaseConfigured, supabase } from './supabase';
import { localVault } from './local-store';

export interface AuthResult {
  ok: boolean;
  message: string;
  needsConfirmation?: boolean;
}

export interface SessionUser {
  id: string;
  email: string | null;
  guest: boolean;
}

const GUEST_FLAG = 'petrift.guest';

function appUrl(): string {
  return new URL('.', window.location.href).href;
}

export function validateUsername(value: string): string | null {
  const v = value.trim();
  if (v.length < 3) return 'Username needs at least 3 characters.';
  if (v.length > 18) return 'Username must be 18 characters or fewer.';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return 'Use letters, numbers and underscore only.';
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Password needs at least 8 characters.';
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return 'Mix letters and numbers for a stronger password.';
  return null;
}

export function passwordStrength(value: string): { score: number; label: string } {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^a-zA-Z0-9]/.test(value)) score++;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Fortified'];
  return { score, label: labels[Math.min(score, labels.length - 1)] };
}

export const auth = {
  async currentUser(): Promise<SessionUser | null> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        return { id: data.session.user.id, email: data.session.user.email ?? null, guest: false };
      }
    }
    if (localStorage.getItem(GUEST_FLAG) === '1' && localVault.exists()) {
      const vault = localVault.load();
      return vault ? { id: vault.profile.id, email: null, guest: true } : null;
    }
    return null;
  },

  async register(email: string, password: string, username: string): Promise<AuthResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, message: 'Accounts are unavailable because the game server is not connected. Play as guest instead.' };
    }
    localStorage.removeItem(GUEST_FLAG);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: appUrl(), data: { username: username.trim(), display_name: username.trim() } }
    });
    if (error) return { ok: false, message: humanize(error.message) };
    if (data.user && !data.session) {
      return { ok: true, message: 'Check your inbox to confirm the account, then sign in.', needsConfirmation: true };
    }
    return { ok: true, message: 'Account created. Entering the Rift.' };
  },

  async login(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, message: 'Sign in is unavailable because the game server is not connected. Play as guest instead.' };
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, message: humanize(error.message) };
    localStorage.removeItem(GUEST_FLAG);
    return { ok: true, message: 'Welcome back, summoner.' };
  },

  async playAsGuest(username = 'Guest'): Promise<AuthResult> {
    if (!localVault.exists()) localVault.create(username);
    localStorage.setItem(GUEST_FLAG, '1');
    return { ok: true, message: 'Guest session started. Progress stays on this device.' };
  },

  async resetPassword(email: string): Promise<AuthResult> {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, message: 'Password reset needs Supabase. Offline accounts have no password.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl()
    });
    if (error) return { ok: false, message: humanize(error.message) };
    return { ok: true, message: 'Reset link sent. Check your email.' };
  },

  async logout(): Promise<void> {
    localStorage.removeItem(GUEST_FLAG);
    if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
  },

  onChange(handler: (user: SessionUser | null) => void): () => void {
    if (!isSupabaseConfigured || !supabase) return () => undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      handler(session?.user ? { id: session.user.id, email: session.user.email ?? null, guest: false } : null);
    });
    return () => data.subscription.unsubscribe();
  }
};

function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('already registered')) return 'That email already has an account. Try signing in.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('email not confirmed')) return 'Confirm your email address first.';
  if (m.includes('password')) return message;
  if (m.includes('failed to fetch')) return 'Cannot reach the server. Check your connection.';
  return message;
}
