'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Building2, Phone, ShieldCheck, Loader2, KeyRound } from 'lucide-react'
import { api } from '@/lib/api'
import { saveSession, type AdminUser } from '@/lib/auth'

const phoneSchema = z.object({
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number with +91'),
})
const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
})
const totpSchema = z.object({
  totp: z.string().length(6, 'Authenticator code must be 6 digits').regex(/^\d{6}$/),
})

type PhoneForm = z.infer<typeof phoneSchema>
type OtpForm   = z.infer<typeof otpSchema>
type TotpForm  = z.infer<typeof totpSchema>

interface SendOtpResp   { message: string }
interface VerifyOtpResp {
  accessToken:      string
  user:             AdminUser
  requiresTwoFactor?: boolean
  pendingUserId?:   string
}

export default function LoginPage() {
  const router = useRouter()
  // 'phone' → 'otp' → ['totp' if 2FA enabled] → dashboard
  const [step,          setStep]          = useState<'phone' | 'otp' | 'totp'>('phone')
  const [phone,         setPhone]         = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema) })
  const otpForm   = useForm<OtpForm>  ({ resolver: zodResolver(otpSchema)  })
  const totpForm  = useForm<TotpForm> ({ resolver: zodResolver(totpSchema) })

  async function onSendOtp(data: PhoneForm) {
    try {
      await api.post<SendOtpResp>('/auth/otp/send', { phone: data.phone, purpose: 'login' })
      setPhone(data.phone)
      setStep('otp')
      toast.success('OTP sent!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send OTP')
    }
  }

  async function onVerifyOtp(data: OtpForm) {
    try {
      const resp = await api.post<VerifyOtpResp>('/auth/otp/verify', {
        phone,
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

        {step === 'phone' && (
          <form onSubmit={phoneForm.handleSubmit(onSendOtp)} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Sign in</h1>
              <p className="text-sm text-gray-500 mt-1">Enter your registered mobile number</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mobile number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...phoneForm.register('phone')}
                  placeholder="+919999999999"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {phoneForm.formState.errors.phone && (
                <p className="text-xs text-red-500 mt-1">{phoneForm.formState.errors.phone.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={phoneForm.formState.isSubmitting}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {phoneForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Send OTP
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Enter OTP</h1>
              <p className="text-sm text-gray-500 mt-1">Sent to <strong>{phone}</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">6-digit OTP</label>
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
              onClick={() => setStep('phone')}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Change number
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
              onClick={() => { setStep('phone'); setPendingUserId(null) }}
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
