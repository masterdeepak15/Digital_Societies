'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Building2, Phone, Mail, CreditCard, Server, CheckCircle2, Loader2, ArrowRight, ArrowLeft, Sparkles, Settings2 } from 'lucide-react'
import { api } from '@/lib/api'
import { saveSession } from '@/lib/auth'

// ── Schemas ───────────────────────────────────────────────────────────────────
const step1Schema = z.object({
  societyName:    z.string().min(3, 'At least 3 characters'),
  address:        z.string().min(10, 'Full address required'),
  registrationNo: z.string().min(2, 'Enter society registration number'),
  totalFlats:     z.coerce.number().int().min(1),
})
const step2Schema = z.object({
  adminPhone: z.string().regex(/^\+91[6-9]\d{9}$/, 'Valid Indian number required (+91…)'),
  adminName:  z.string().min(2),
})
const step3Schema = z.object({
  smtpHost:     z.string().optional(),
  smtpPort:     z.coerce.number().optional(),
  smtpUser:     z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom:     z.string().email().optional().or(z.literal('')),
})
const step4Schema = z.object({
  razorpayKeyId:     z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  msg91ApiKey:       z.string().optional(),
})
const step5Schema = z.object({
  minioEndpoint:        z.string().optional(),
  minioAccessKey:       z.string().optional(),
  minioSecretKey:       z.string().optional(),
  minioBucket:          z.string().optional(),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>
type Step3 = z.infer<typeof step3Schema>
type Step4 = z.infer<typeof step4Schema>
type Step5 = z.infer<typeof step5Schema>

const STEPS = [
  { label: 'Society',    icon: Building2  },
  { label: 'Admin',      icon: Phone      },
  { label: 'Email',      icon: Mail       },
  { label: 'Payments',   icon: CreditCard },
  { label: 'Storage',    icon: Server     },
]

export default function SetupPage() {
  const router = useRouter()
  // step -1 = mode selection, 0..4 = wizard steps
  const [step, setStep] = useState(-1)
  const [data, setData] = useState<Partial<Step1 & Step2 & Step3 & Step4 & Step5>>({})
  const [otpSent,      setOtpSent]      = useState(false)
  const [otp,          setOtp]          = useState('')
  const [verifying,    setVerifying]    = useState(false)
  const [demoLoading,  setDemoLoading]  = useState(false)

  async function activateDemoMode() {
    setDemoLoading(true)
    try {
      const resp = await api.post<{ accessToken: string; user: { userId: string; name: string; phone: string; roles: string[]; societyId: string } }>(
        '/setup/demo', {}
      )
      saveSession(resp.accessToken, resp.user)
      toast.success('Demo mode activated! Explore with sample data.')
      router.push('/dashboard')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Demo activation failed')
    } finally {
      setDemoLoading(false)
    }
  }

  const s1 = useForm<Step1>({ resolver: zodResolver(step1Schema) })
  const s2 = useForm<Step2>({ resolver: zodResolver(step2Schema) })
  const s3 = useForm<Step3>({ resolver: zodResolver(step3Schema) })
  const s4 = useForm<Step4>({ resolver: zodResolver(step4Schema) })
  const s5 = useForm<Step5>({ resolver: zodResolver(step5Schema) })

  async function sendAdminOtp() {
    const phone = s2.getValues('adminPhone')
    if (!phone) { toast.error('Enter phone first'); return }
    try {
      await api.post('/auth/otp/send', { phone, purpose: 'register' })
      setOtpSent(true)
      toast.success('OTP sent to admin phone!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  async function finish(s5Data: Step5) {
    setVerifying(true)
    const merged = { ...data, ...s5Data }
    try {
      // 1. Create society + admin via setup endpoint
      const resp = await api.post<{ accessToken: string; user: { userId: string; name: string; phone: string; roles: string[]; societyId: string } }>(
        '/setup/initialize',
        {
          society: {
            name: merged.societyName,
            address: merged.address,
            registrationNumber: merged.registrationNo,
            totalFlats: merged.totalFlats,
          },
          admin: { phone: merged.adminPhone, name: merged.adminName, otp },
          smtp: { host: merged.smtpHost, port: merged.smtpPort, user: merged.smtpUser, password: merged.smtpPassword, from: merged.smtpFrom },
          razorpay: { keyId: merged.razorpayKeyId, keySecret: merged.razorpayKeySecret },
          msg91: { apiKey: merged.msg91ApiKey },
          minio: { endpoint: merged.minioEndpoint, accessKey: merged.minioAccessKey, secretKey: merged.minioSecretKey, bucket: merged.minioBucket },
        },
      )
      saveSession(resp.accessToken, resp.user)
      toast.success('Setup complete! Welcome to Digital Societies.')
      router.push('/dashboard')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Setup failed')
    } finally {
      setVerifying(false)
    }
  }

  function next<T extends object>(values: T) {
    setData(d => ({ ...d, ...values }))
    setStep(s => s + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="bg-brand-600 rounded-t-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-7 h-7" />
            <div>
              <p className="font-bold text-lg">Digital Societies</p>
              <p className="text-brand-200 text-sm">
                {step === -1 ? 'Welcome — choose your setup mode' : 'First-run setup wizard'}
              </p>
            </div>
          </div>
          {/* Step progress — hidden on mode selection screen */}
          {step >= 0 && (
            <div className="flex gap-2">
              {STEPS.map((s, i) => (
                <div key={i} className="flex-1">
                  <div className={`h-1.5 rounded-full ${i <= step ? 'bg-white' : 'bg-brand-500'}`} />
                  <p className={`text-xs mt-1 ${i === step ? 'text-white font-medium' : 'text-brand-300'}`}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6">
          {/* ─── Mode selection ────────────────────────────────────────────── */}
          {step === -1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-center text-gray-800">How would you like to start?</h2>
              <p className="text-sm text-gray-500 text-center">Choose demo mode to explore with pre-loaded sample data, or set up your real society from scratch.</p>

              {/* Demo mode card */}
              <button
                onClick={activateDemoMode}
                disabled={demoLoading}
                className="w-full border-2 border-brand-200 hover:border-brand-500 hover:bg-brand-50 rounded-xl p-5 text-left transition group disabled:opacity-60">
                <div className="flex items-start gap-3">
                  <div className="bg-brand-100 group-hover:bg-brand-200 rounded-lg p-2 transition">
                    <Sparkles className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800">Demo Mode</p>
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">Recommended to explore</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Instantly loads 48 demo residents, bills, complaints, visitors, and analytics. No configuration needed.</p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-0.5">
                      <li>✓ All modules pre-populated</li>
                      <li>✓ Skip all setup steps</li>
                      <li>✓ Login as admin: <span className="font-mono">+91 9999900001</span></li>
                    </ul>
                  </div>
                  {demoLoading
                    ? <Loader2 className="w-5 h-5 text-brand-600 animate-spin shrink-0 mt-1" />
                    : <ArrowRight className="w-5 h-5 text-brand-400 group-hover:text-brand-600 shrink-0 mt-1 transition" />
                  }
                </div>
              </button>

              {/* New setup card */}
              <button
                onClick={() => setStep(0)}
                className="w-full border-2 border-gray-200 hover:border-gray-400 rounded-xl p-5 text-left transition group">
                <div className="flex items-start gap-3">
                  <div className="bg-gray-100 group-hover:bg-gray-200 rounded-lg p-2 transition">
                    <Settings2 className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">New Society Setup</p>
                    <p className="text-sm text-gray-500 mt-1">Configure your real society — name, admin account, payments, SMS, and storage. Takes about 5 minutes.</p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-0.5">
                      <li>✓ 5-step guided wizard</li>
                      <li>✓ Razorpay + MSG91 + MinIO</li>
                      <li>✓ Production-ready from day one</li>
                    </ul>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 shrink-0 mt-1 transition" />
                </div>
              </button>
            </div>
          )}

          {/* Step 0 — Society info */}
          {step === 0 && (
            <form onSubmit={s1.handleSubmit(next)} className="space-y-4">
              <h2 className="font-semibold text-lg">Society details</h2>
              {([
                ['societyName',    'Society name',               'Sunrise Heights'],
                ['address',        'Full address',               'Plot 42, Baner Road, Pune 411045'],
                ['registrationNo', 'Registration number',        'MH/2020/12345'],
                ['totalFlats',     'Total flats',                '120'],
              ] as const).map(([field, label, ph]) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input {...s1.register(field)} placeholder={ph}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  {s1.formState.errors[field] && (
                    <p className="text-xs text-red-500 mt-1">{s1.formState.errors[field]?.message}</p>
                  )}
                </div>
              ))}
              <StepActions step={step} setStep={setStep} isFirst />
            </form>
          )}

          {/* Step 1 — Admin user */}
          {step === 1 && (
            <form onSubmit={s2.handleSubmit(next)} className="space-y-4">
              <h2 className="font-semibold text-lg">Admin account</h2>
              <div>
                <label className="block text-sm font-medium mb-1">Admin name</label>
                <input {...s2.register('adminName')} placeholder="Rajesh Sharma"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                {s2.formState.errors.adminName && <p className="text-xs text-red-500 mt-1">{s2.formState.errors.adminName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admin mobile number</label>
                <div className="flex gap-2">
                  <input {...s2.register('adminPhone')} placeholder="+919999999999"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <button type="button" onClick={sendAdminOtp}
                    className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm font-medium">
                    Send OTP
                  </button>
                </div>
                {s2.formState.errors.adminPhone && <p className="text-xs text-red-500 mt-1">{s2.formState.errors.adminPhone.message}</p>}
              </div>
              {otpSent && (
                <div>
                  <label className="block text-sm font-medium mb-1">OTP</label>
                  <input value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} placeholder="123456"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 tracking-widest" />
                </div>
              )}
              <StepActions step={step} setStep={setStep} />
            </form>
          )}

          {/* Step 2 — SMTP */}
          {step === 2 && (
            <form onSubmit={s3.handleSubmit(next)} className="space-y-4">
              <h2 className="font-semibold text-lg">Email (SMTP) <span className="text-gray-400 font-normal text-sm">— optional</span></h2>
              <p className="text-sm text-gray-500">Used for bill receipts and notices. Skip if using OTP-only notifications.</p>
              {([
                ['smtpHost',     'SMTP host',     'smtp.gmail.com'],
                ['smtpPort',     'SMTP port',     '587'],
                ['smtpUser',     'Username',      'society@gmail.com'],
                ['smtpPassword', 'Password',      '••••••••'],
                ['smtpFrom',     'From address',  'noreply@society.com'],
              ] as const).map(([field, label, ph]) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input {...s3.register(field)} placeholder={ph} type={field === 'smtpPassword' ? 'password' : 'text'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              <StepActions step={step} setStep={setStep} />
            </form>
          )}

          {/* Step 3 — Payments */}
          {step === 3 && (
            <form onSubmit={s4.handleSubmit(next)} className="space-y-4">
              <h2 className="font-semibold text-lg">Payment & SMS <span className="text-gray-400 font-normal text-sm">— optional</span></h2>
              <p className="text-sm text-gray-500">Razorpay enables online maintenance payments. MSG91 enables OTP SMS delivery.</p>
              {([
                ['razorpayKeyId',     'Razorpay Key ID',     'rzp_live_…'],
                ['razorpayKeySecret', 'Razorpay Key Secret', 'your_secret'],
                ['msg91ApiKey',       'MSG91 API Key',       'your_msg91_key'],
              ] as const).map(([field, label, ph]) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input {...s4.register(field)} placeholder={ph}
                    type={field.includes('Secret') ? 'password' : 'text'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              <StepActions step={step} setStep={setStep} />
            </form>
          )}

          {/* Step 4 — Storage / finish */}
          {step === 4 && (
            <form onSubmit={s5.handleSubmit(finish)} className="space-y-4">
              <h2 className="font-semibold text-lg">Storage (MinIO / S3) <span className="text-gray-400 font-normal text-sm">— optional</span></h2>
              <p className="text-sm text-gray-500">For complaint images and documents. Leave blank to use the built-in MinIO container.</p>
              {([
                ['minioEndpoint',  'Endpoint',   'http://minio:9000'],
                ['minioAccessKey', 'Access Key', 'minioadmin'],
                ['minioSecretKey', 'Secret Key', '••••••••'],
                ['minioBucket',    'Bucket',     'digital-societies'],
              ] as const).map(([field, label, ph]) => (
                <div key={field}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input {...s5.register(field)} placeholder={ph}
                    type={field.includes('Secret') ? 'password' : 'text'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              <button type="submit" disabled={verifying}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-60">
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Complete Setup
              </button>
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function StepActions({ step, setStep, isFirst }: { step: number; setStep: React.Dispatch<React.SetStateAction<number>>; isFirst?: boolean }) {
  return (
    <div className="flex gap-3 pt-2">
      {!isFirst && (
        <button type="button" onClick={() => setStep(s => s - 1)}
          className="flex-1 border border-gray-300 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      )}
      <button type="submit"
        className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition">
        Continue <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
