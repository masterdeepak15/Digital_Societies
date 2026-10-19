'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AppDownload } from '@/components/AppDownload'
import { api } from '@/lib/api'
import { saveSession, profileToAdminUser, type ApiProfile } from '@/lib/auth'

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
  refreshToken:     string
  profile:          ApiProfile
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
      const user = profileToAdminUser(resp.profile)
      if (!user.roles.some(r => allowed.includes(r))) {
        toast.error('Access denied. Only Admin or Accountant accounts may log in here.')
        return
      }
      saveSession(resp.accessToken, user, resp.refreshToken)
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
      const user = profileToAdminUser(resp.profile)
      if (!user.roles.some(r => allowed.includes(r))) {
        toast.error('Access denied.')
        return
      }
      saveSession(resp.accessToken, user, resp.refreshToken)
      router.push('/dashboard')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invalid authenticator code')
    }
  }

  const labelClass = 'mb-1 block text-sm font-semibold text-ink'
  const errorClass = 'mt-1 text-xs text-bad'

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-nav p-12 text-nav-text lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 text-white" />
          <span className="text-lg font-bold text-white">Digital Societies</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white">Run your society from one place.</h2>
          <p className="mt-3 text-[15px] leading-relaxed">Bills, visitors, complaints and notices for the managing committee, with every resident one tap away on the mobile app.</p>
        </div>
        <p className="text-xs">Admin console · a SpyderEye product</p>
      </aside>

      <main className="flex items-center justify-center bg-paper p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-11 w-11 text-ink" />
            <div>
              <p className="text-lg font-bold leading-tight text-ink">Digital Societies</p>
              <p className="text-xs text-mute">Admin console</p>
            </div>
          </div>

          {step === 'email' && (
            <form onSubmit={emailForm.handleSubmit(onSendOtp)} className="space-y-5" noValidate>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sign in</h1>
                <p className="mt-1 text-sm text-mute">Enter your registered email address. We will send you a 6-digit code.</p>
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>Email</label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  placeholder="admin@society.com"
                  invalid={!!emailForm.formState.errors.email}
                  {...emailForm.register('email')}
                />
                {emailForm.formState.errors.email && (
                  <p role="alert" className={errorClass}>{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" loading={emailForm.formState.isSubmitting} className="w-full">Send code</Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-5" noValidate>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">Enter your code</h1>
                <p className="mt-1 text-sm text-mute">Sent to <strong className="text-ink">{email}</strong></p>
              </div>
              <div>
                <label htmlFor="otp" className={labelClass}>6-digit code</label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  autoFocus
                  invalid={!!otpForm.formState.errors.otp}
                  className="tracking-[0.3em]"
                  {...otpForm.register('otp')}
                />
                {otpForm.formState.errors.otp && (
                  <p role="alert" className={errorClass}>{otpForm.formState.errors.otp.message}</p>
                )}
              </div>
              <Button type="submit" loading={otpForm.formState.isSubmitting} className="w-full">Verify and sign in</Button>
              <div className="flex gap-3">
                <Button variant="secondary" disabled={cooldown > 0} onClick={() => sendCode(email)} className="flex-1">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </Button>
                <Button variant="ghost" onClick={() => setStep('email')} className="flex-1">Change email</Button>
              </div>
            </form>
          )}

          {step === 'totp' && (
            <form onSubmit={totpForm.handleSubmit(onVerifyTotp)} className="space-y-5" noValidate>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">Two-step verification</h1>
                <p className="mt-1 text-sm text-mute">Open your authenticator app (Google Authenticator, Authy or similar) and enter the current 6-digit code.</p>
              </div>
              <div>
                <label htmlFor="totp" className={labelClass}>Authenticator code</label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  autoFocus
                  invalid={!!totpForm.formState.errors.totp}
                  className="tracking-[0.3em]"
                  {...totpForm.register('totp')}
                />
                {totpForm.formState.errors.totp && (
                  <p role="alert" className={errorClass}>{totpForm.formState.errors.totp.message}</p>
                )}
              </div>
              <Button type="submit" loading={totpForm.formState.isSubmitting} className="w-full">Verify code</Button>
              <Button variant="ghost" onClick={() => { setStep('email'); setPendingUserId(null) }} className="w-full">Start over</Button>
            </form>
          )}

          <AppDownload />
        </div>
      </main>
    </div>
  )
}
