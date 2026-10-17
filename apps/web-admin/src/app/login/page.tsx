'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, Mail, ShieldCheck, Loader2, KeyRound } from 'lucide-react'
import { api } from '@/lib/api'
import { saveSession, type AdminUser } from '@/lib/auth'

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().max(250).email('Enter a valid email address'),
})
const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
})
const totpSchema = z.object({
  totp: z.string().length(6, 'Authenticator code must be 6 digits').regex(/^\d{6}$/),
})

type EmailForm = z.infer<typeof emailSchema>
type OtpForm   = z.infer<typeof otpSchema>
type TotpForm  = z.infer<typeof totpSchema>

interface SendOtpResp   { maskedEmail: string; expiresInSeconds: number }
interface VerifyOtpResp {
  accessToken:      string
  user:             AdminUser
  requiresTwoFactor?: boolean
  pendingUserId?:   string
}

export default function LoginPage() {
  const router = useRouter()
  // 'email' → 'otp' → ['totp' if 2FA enabled] → dashboard
  const [step,          setStep]          = useState<'email' | 'otp' | 'totp'>('email')
  const [email,         setEmail]         = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [cooldown,      setCooldown]      = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const otpForm   = useForm<OtpForm>  ({ resolver: zodResolver(otpSchema)  })
  const totpForm  = useForm<TotpForm> ({ resolver: zodResolver(totpSchema) })

  async function sendCode(address: string) {
    try {
      await api.post<SendOtpResp>('/auth/otp/send', { email: address, purpose: 'login' })
      setEmail(address)
      setStep('otp')
      setCooldown(60)
      toast.success('Code sent! Check your email.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send code')
    }
  }

  async function onSendOtp(data: EmailForm) {
    await sendCode(data.email)
  }

  async function onVerifyOtp(data: OtpForm) {
    try {
      const resp = await api.post<VerifyOtpResp>('/auth/otp/verify', {
        email,
        otp: data.otp,
        purpose: 'login',
      })

      // 2FA gate: backend says we need a second factor
      if (resp.requiresTwoFactor && resp.pendingUserId) {
        setPendingUserId(resp.pendingUserId)
        setStep('totp')
        return
      }

      // Guard: only admin / accountant can access web console
      const allowed = ['admin', 'accountant']
      if (!resp.user?.roles?.some(r => allowed.includes(r.toLowerCase()))) {
        toast.error('Access denied. Only Admin or Accountant accounts may log in here.')
        return
      }
      saveSession(resp.accessToken, resp.user)
      router.push('/dashboard')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invalid OTP')
    }
  }

  async function onVerifyTotp(data: TotpForm) {
    if (!pendingUserId) return
    try {
      const resp = await api.post<VerifyOtpResp>('/auth/2fa/verify', {
        pendingUserId,
        totpCode: data.totp,
      })
      const allowed = ['admin', 'accountant']
      if (!resp.user?.roles?.some(r => allowed.includes(r.toLowerCase()))) {
        toast.error('Access denied.')
        return
      }
      saveSession(resp.accessToken, resp.user)
      router.push('/dashboard')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invalid authenticator code')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-brand-600 rounded-xl p-2.5">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">Digital Societies</p>
            <p className="text-xs text-gray-500">Admin Console</p>
          </div>
        </div>

        {step === 'email' && (
          <form onSubmit={emailForm.handleSubmit(onSendOtp)} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Sign in</h1>
              <p className="text-sm text-gray-500 mt-1">Enter your registered email address</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...emailForm.register('email')}
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  placeholder="admin@society.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {emailForm.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{emailForm.formState.errors.email.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={emailForm.formState.isSubmitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {emailForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Send code
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Enter code</h1>
              <p className="text-sm text-gray-500 mt-1">Sent to <strong>{email}</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">6-digit code</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...otpForm.register('otp')}
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 tracking-widest"
                />
              </div>
              {otpForm.formState.errors.otp && (
                <p className="text-xs text-red-500 mt-1">{otpForm.formState.errors.otp.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={otpForm.formState.isSubmitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {otpForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify & Sign in
            </button>
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={() => sendCode(email)}
              className="w-full text-sm text-brand-600 hover:text-brand-700 disabled:text-gray-400"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Change email
            </button>
          </form>
        )}

        {/* ── 2FA step — shown only when account has TOTP enabled ────────── */}
        {step === 'totp' && (
          <form onSubmit={totpForm.handleSubmit(onVerifyTotp)} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-2">
                <KeyRound className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Two-factor auth</h1>
                <p className="text-xs text-gray-500">Open your authenticator app</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-800">Enter the 6-digit code from your authenticator app</p>
              <p className="text-xs text-gray-400">Google Authenticator, Authy, or any TOTP app. Codes refresh every 30 seconds.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Authenticator code</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...totpForm.register('totp')}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 tracking-widest font-mono"
                />
              </div>
              {totpForm.formState.errors.totp && (
                <p className="text-xs text-red-500 mt-1">{totpForm.formState.errors.totp.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={totpForm.formState.isSubmitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {totpForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify Code
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setPendingUserId(null) }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Start over
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
