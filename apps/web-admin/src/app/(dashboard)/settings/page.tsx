'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Building2, Bell, Shield, CreditCard, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'

// ── Types ─────────────────────────────────────────────────────────────────────
// API GET /settings → { id, name, address, registrationNumber, tier, isActive, totalFlats }
// API PATCH /settings → { name?, address? }  — only these two are persisted server-side.
//
// All fields beyond name/address are UI-local preferences stored in component state.
// A banner in the UI makes this clear so admins know what is/isn't saved.

// Shape of API GET /settings response
interface ApiSettings {
  id:                 string
  name:               string
  address:            string
  registrationNumber: string
  tier:               string
  isActive:           boolean
  totalFlats:         number
}

interface SocietySettings {
  // Server-persisted — sent on PATCH /settings
  societyName:         string   // maps to API `name`
  address:             string
  // Read-only from API
  registrationNumber:  string
  // UI-local only — NOT persisted to server
  city:                string
  pincode:             string
  contactEmail:        string
  contactPhone:        string
  maintenanceAmount:   number
  billingCycleDay:     number
  gracePeriodDays:     number
  latePenaltyPercent:  number
  gstEnabled:          boolean
  gstNumber:           string
  smsEnabled:          boolean
  pushEnabled:         boolean
  emailEnabled:        boolean
  visitorAlerts:       boolean
  paymentReminders:    boolean
  visitorQrTtlMinutes: number
  offlineSyncEnabled:  boolean
  piiWipeDays:         number
}

type Tab = 'general' | 'billing' | 'notifications' | 'security'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general',       label: 'General',       icon: Building2 },
  { id: 'billing',       label: 'Billing',        icon: CreditCard },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'security',      label: 'Security',        icon: Shield },
]

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
    />
  )
}

function NumberInput({ value, onChange, min, max }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
    />
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={cn('w-11 h-6 rounded-full transition relative',
          checked ? 'bg-brand-600' : 'bg-gray-200')}>
        <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0')} />
      </div>
    </label>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('general')

  // API: GET /settings → { id, name, address, registrationNumber, tier, isActive, totalFlats }
  // Map API response to form shape; fill UI-local fields from DEMO_SETTINGS defaults.
  const { data: settings = DEMO_SETTINGS } = useQuery<SocietySettings>({
    queryKey: ['society-settings'],
    queryFn:  async () => {
      const raw = await api.get<ApiSettings>('/settings')
      return {
        ...DEMO_SETTINGS,               // UI-local defaults
        societyName:        raw.name,
        address:            raw.address,
        registrationNumber: raw.registrationNumber,
      }
    },
  })

  const [form, setForm] = useState<SocietySettings>(settings)
  const set = <K extends keyof SocietySettings>(k: K, v: SocietySettings[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  // API only persists name + address — send only those two fields.
  const saveMutation = useMutation({
    mutationFn: () => api.patch('/settings', { name: form.societyName, address: form.address }),
    onSuccess:  () => { toast.success('Society name and address saved'); qc.invalidateQueries({ queryKey: ['society-settings'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Society profile, billing rules, and platform configuration"
        action={
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      {/* Banner — inform admin which settings are server-persisted */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <b>Note:</b> Only <b>Society Name</b> and <b>Address</b> (General tab) are saved to the server via the API. All other fields on this page are UI preferences stored locally — they will reset on refresh until the backend exposes additional settings endpoints.
      </div>

      <div className="flex gap-5">
        {/* Sidebar tabs */}
        <nav className="shrink-0 w-44 space-y-1">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition',
                  tab === t.id
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800')}>
                <Icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">

          {/* ── General ───────────────────────────────────────────────────────── */}
          {tab === 'general' && (
            <>
              <h2 className="font-semibold text-gray-800">Society Profile</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Society Name">
                  <TextInput value={form.societyName} onChange={v => set('societyName', v)} />
                </Field>
                <Field label="Registration Number">
                  <TextInput value={form.registrationNumber} onChange={v => set('registrationNumber', v)} placeholder="MH/001/2010" />
                </Field>
                <Field label="Address" >
                  <TextInput value={form.address} onChange={v => set('address', v)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <TextInput value={form.city} onChange={v => set('city', v)} />
                  </Field>
                  <Field label="Pincode">
                    <TextInput value={form.pincode} onChange={v => set('pincode', v)} />
                  </Field>
                </div>
                <Field label="Contact Email">
                  <TextInput value={form.contactEmail} onChange={v => set('contactEmail', v)} type="email" />
                </Field>
                <Field label="Contact Phone">
                  <TextInput value={form.contactPhone} onChange={v => set('contactPhone', v)} placeholder="+91 98765 43210" />
                </Field>
              </div>
            </>
          )}

          {/* ── Billing ──────────────────────────────────────────────────────── */}
          {tab === 'billing' && (
            <>
              <h2 className="font-semibold text-gray-800">Billing Rules</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Monthly Maintenance (₹)" hint="Applied to all flats unless overridden">
                  <NumberInput value={form.maintenanceAmount} onChange={v => set('maintenanceAmount', v)} min={0} />
                </Field>
                <Field label="Billing Cycle Day" hint="Day of month when bills are generated (1–28)">
                  <NumberInput value={form.billingCycleDay} onChange={v => set('billingCycleDay', v)} min={1} max={28} />
                </Field>
                <Field label="Grace Period (days)" hint="Days after due date before late fee applies">
                  <NumberInput value={form.gracePeriodDays} onChange={v => set('gracePeriodDays', v)} min={0} max={30} />
                </Field>
                <Field label="Late Payment Penalty (%)" hint="Compounded monthly after grace period">
                  <NumberInput value={form.latePenaltyPercent} onChange={v => set('latePenaltyPercent', v)} min={0} max={36} />
                </Field>
              </div>
              <div className="space-y-4 pt-2 border-t border-gray-50">
                <Toggle checked={form.gstEnabled} onChange={v => set('gstEnabled', v)} label="Enable GST on maintenance bills" />
                {form.gstEnabled && (
                  <Field label="GST Number">
                    <TextInput value={form.gstNumber} onChange={v => set('gstNumber', v)} placeholder="27AAPFU0939F1ZV" />
                  </Field>
                )}
              </div>
            </>
          )}

          {/* ── Notifications ─────────────────────────────────────────────────── */}
          {tab === 'notifications' && (
            <>
              <h2 className="font-semibold text-gray-800">Notification Channels</h2>
              <div className="space-y-4">
                <Toggle checked={form.pushEnabled}  onChange={v => set('pushEnabled', v)}  label="Push notifications (Expo)" />
                <Toggle checked={form.smsEnabled}   onChange={v => set('smsEnabled', v)}   label="SMS via MSG91" />
                <Toggle checked={form.emailEnabled} onChange={v => set('emailEnabled', v)} label="Email notifications" />
              </div>
              <div className="border-t border-gray-50 pt-5 space-y-1">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Event Triggers</h3>
                <Toggle checked={form.visitorAlerts}    onChange={v => set('visitorAlerts', v)}    label="Visitor arrival alerts to residents" />
                <div className="h-3" />
                <Toggle checked={form.paymentReminders} onChange={v => set('paymentReminders', v)} label="Payment due reminders (3 days before)" />
              </div>
            </>
          )}

          {/* ── Security ─────────────────────────────────────────────────────── */}
          {tab === 'security' && (
            <>
              <h2 className="font-semibold text-gray-800">Security &amp; Privacy</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Visitor QR TTL (minutes)" hint="How long resident-approved QR codes are valid">
                  <NumberInput value={form.visitorQrTtlMinutes} onChange={v => set('visitorQrTtlMinutes', v)} min={1} max={30} />
                </Field>
                <Field label="Guard Device PII Wipe (days)" hint="Auto-delete visitor PII from guard device after N days">
                  <NumberInput value={form.piiWipeDays} onChange={v => set('piiWipeDays', v)} min={1} max={30} />
                </Field>
              </div>
              <div className="border-t border-gray-50 pt-5 space-y-4">
                <Toggle
                  checked={form.offlineSyncEnabled}
                  onChange={v => set('offlineSyncEnabled', v)}
                  label="Allow offline guard operations (WatermelonDB sync)" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
                <p className="font-semibold">Data Retention Policy</p>
                <p>Visitor PII on guard devices is automatically wiped after <b>{form.piiWipeDays} days</b>. Only synced records are eligible for wipe — pending offline records are preserved until sync.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_SETTINGS: SocietySettings = {
  societyName:         'Greenview Heights Co-operative Society',
  registrationNumber:  'MH/MUM/001/2010',
  address:             '14, Greenview Marg, Bandra West',
  city:                'Mumbai',
  pincode:             '400050',
  contactEmail:        'admin@greenviewheights.in',
  contactPhone:        '+91 98765 43210',
  maintenanceAmount:   3500,
  billingCycleDay:     1,
  gracePeriodDays:     7,
  latePenaltyPercent:  2,
  gstEnabled:          false,
  gstNumber:           '',
  smsEnabled:          true,
  pushEnabled:         true,
  emailEnabled:        false,
  visitorAlerts:       true,
  paymentReminders:    true,
  visitorQrTtlMinutes: 2,
  offlineSyncEnabled:  true,
  piiWipeDays:         7,
}
