'use client'

import React, { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Bell, Shield, CreditCard, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { RULE_DEFAULTS, rulesError, rulesFrom, type ApiSettings, type SocietyRules } from '@/lib/societySettings'

// GET   /settings → { id, name, address, registrationNumber, tier, isActive, totalFlats, settings: { ...rules } }
// PATCH /settings ← { name, address, registrationNumber, settings: { ...rules } }
// Everything on this page is saved on the server and acted on by the system.

type Tab = 'general' | 'billing' | 'notifications' | 'security'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general',       label: 'General',       icon: Building2 },
  { id: 'billing',       label: 'Billing',       icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security',      label: 'Security',      icon: Shield },
]

interface Profile { name: string; address: string; registrationNumber: string }

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

/** Keeps what is being typed as text, so "2." or an empty box never turns into 0 under the cursor. */
function NumberInput({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  const [text, setText] = useState(String(value))
  useEffect(() => { if (Number(text) !== value) setText(String(value)) }, [value])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={e => { setText(e.target.value); if (e.target.value.trim() !== '' && Number.isFinite(Number(e.target.value))) onChange(Number(e.target.value)) }}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
    />
  )
}

function Toggle({ checked, onChange, label, rule }: { checked: boolean; onChange: (v: boolean) => void; label: string; rule?: keyof SocietyRules }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('w-11 h-6 rounded-full transition relative', checked ? 'bg-brand-600' : 'bg-gray-200')}>
        <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </label>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('general')

  const { data, isLoading, isError, refetch } = useQuery<ApiSettings>({
    queryKey: ['society-settings'],
    queryFn:  () => api.get<ApiSettings>('/settings'),
  })

  const [profile, setProfile] = useState<Profile>({ name: '', address: '', registrationNumber: '' })
  const [rules, setRules] = useState<SocietyRules>(RULE_DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  // Copy the server's values in once they arrive (and again after a save, so the form shows what is stored).
  useEffect(() => {
    if (!data) return
    setProfile({ name: data.name, address: data.address, registrationNumber: data.registrationNumber })
    setRules(rulesFrom(data))
    setLoaded(true)
  }, [data])

  const setRule = <K extends keyof SocietyRules>(k: K, v: SocietyRules[K]) => setRules(prev => ({ ...prev, [k]: v }))
  const problem = rulesError(rules)

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/settings', { name: profile.name, address: profile.address, registrationNumber: profile.registrationNumber, settings: rules }),
    onSuccess:  () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['society-settings'] }) },
    onError:    (e: Error) => toast.error(e.message),
  })

  const save = () => { if (problem) toast.error(problem); else saveMutation.mutate() }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Society profile, billing rules, and how the society is notified"
        action={
          <button
            onClick={save}
            disabled={saveMutation.isPending || !loaded}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      {isError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          Could not load your settings.
          <button onClick={() => refetch()} className="font-semibold underline">Try again</button>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
        Everything here is saved with your society and used by the system. Anything that sends mail or creates charges by itself is <b>off</b> until you turn it on.
      </div>

      <div className="flex gap-5">
        <nav className="shrink-0 w-44 space-y-1">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition',
                  tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800')}>
                <Icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            )
          })}
        </nav>

        <div className={cn('flex-1 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6', isLoading && 'opacity-60')}>

          {tab === 'general' && (
            <>
              <h2 className="font-semibold text-gray-800">Society Profile</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Society Name">
                  <TextInput value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} />
                </Field>
                <Field label="Registration Number">
                  <TextInput value={profile.registrationNumber} onChange={v => setProfile(p => ({ ...p, registrationNumber: v }))} placeholder="MH/001/2010" />
                </Field>
                <Field label="Address">
                  <TextInput value={profile.address} onChange={v => setProfile(p => ({ ...p, address: v }))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City"><TextInput value={rules.city} onChange={v => setRule('city', v)} /></Field>
                  <Field label="Pincode"><TextInput value={rules.pincode} onChange={v => setRule('pincode', v)} /></Field>
                </div>
                <Field label="Contact Email">
                  <TextInput value={rules.contactEmail} onChange={v => setRule('contactEmail', v)} type="email" />
                </Field>
                <Field label="Contact Phone">
                  <TextInput value={rules.contactPhone} onChange={v => setRule('contactPhone', v)} placeholder="+91 98765 43210" />
                </Field>
              </div>
            </>
          )}

          {tab === 'billing' && (
            <>
              <h2 className="font-semibold text-gray-800">Billing Rules</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Monthly Maintenance (₹)" hint="Used when bills are generated without typing an amount">
                  <NumberInput value={rules.maintenanceAmount} onChange={v => setRule('maintenanceAmount', v)} min={0} />
                </Field>
                <Field label="Billing Cycle Day" hint="Day of the month bills go out (1–28)">
                  <NumberInput value={rules.billingCycleDay} onChange={v => setRule('billingCycleDay', v)} min={1} max={28} />
                </Field>
                <Field label="Grace Period (days)" hint="Days after the due date before a late fee can be added">
                  <NumberInput value={rules.gracePeriodDays} onChange={v => setRule('gracePeriodDays', v)} min={0} max={30} />
                </Field>
                <Field label="Pay within (days)" hint="A bill falls due this many days after it goes out">
                  <NumberInput value={rules.dueDays} onChange={v => setRule('dueDays', v)} min={1} max={60} />
                </Field>
                <Field label="Late Payment Penalty (%)" hint="Added once to a bill past its grace period (press “Apply late fees” on the Billing page, or turn on automatic late fees below). 0 means no late fee.">
                  <NumberInput value={rules.latePenaltyPercent} onChange={v => setRule('latePenaltyPercent', v)} min={0} max={36} step={0.5} />
                </Field>
              </div>
              <div className="space-y-4 pt-2 border-t border-gray-50">
                <Toggle checked={rules.gstEnabled} onChange={v => setRule('gstEnabled', v)} label="Add GST to maintenance bills" />
                {rules.gstEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="GST Number" hint="Printed on each bill">
                      <TextInput value={rules.gstNumber} onChange={v => setRule('gstNumber', v)} placeholder="27AAPFU0939F1ZV" />
                    </Field>
                    <Field label="GST rate (%)" hint="Added on top of the monthly maintenance">
                      <NumberInput value={rules.gstPercent} onChange={v => setRule('gstPercent', v)} min={1} max={28} step={0.5} />
                    </Field>
                  </div>
                )}
              </div>
              <div className="space-y-4 pt-2 border-t border-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Automatic billing (checked every morning at 9)</h3>
                <Toggle checked={rules.autoGenerateBills} onChange={v => setRule('autoGenerateBills', v)} label="Send the monthly bills by themselves on the billing day" />
                <Toggle checked={rules.autoLateFees} onChange={v => setRule('autoLateFees', v)} label="Add the late fee by itself once a bill is past its grace period" />
                <p className="text-xs text-gray-400">Off by default. When on, bills and late fees are created without anyone pressing a button. Each bill is charged once.</p>
              </div>
            </>
          )}

          {tab === 'notifications' && (
            <>
              <h2 className="font-semibold text-gray-800">Notification Channels</h2>
              <div className="space-y-4">
                <Toggle checked={rules.pushEnabled}  onChange={v => setRule('pushEnabled', v)}  label="Push notifications to residents' phones" />
                <Toggle checked={rules.smsEnabled}   onChange={v => setRule('smsEnabled', v)}   label="SMS (needs an SMS service set up on the server)" />
                <Toggle checked={rules.emailEnabled} onChange={v => setRule('emailEnabled', v)} label="Email every new notice to all members who have an email address" />
              </div>
              <div className="border-t border-gray-50 pt-5 space-y-1">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Event Triggers</h3>
                <Toggle checked={rules.visitorAlerts}    onChange={v => setRule('visitorAlerts', v)}    label="Visitor at the gate rings residents' phones" />
                <div className="h-3" />
                <Toggle checked={rules.paymentReminders} onChange={v => setRule('paymentReminders', v)} label="Remind a flat 3 days before its bill falls due (push)" />
              </div>
            </>
          )}

          {tab === 'security' && (
            <>
              <h2 className="font-semibold text-gray-800">Security &amp; Privacy</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Visitor QR lifetime (minutes)" hint="How long a QR code works after a resident approves a visitor (1–30)">
                  <NumberInput value={rules.visitorQrTtlMinutes} onChange={v => setRule('visitorQrTtlMinutes', v)} min={1} max={30} />
                </Field>
                <Field label="Guard phone: keep visitor details (days)" hint="The guard's phone deletes visitor details older than this">
                  <NumberInput value={rules.piiWipeDays} onChange={v => setRule('piiWipeDays', v)} min={1} max={30} />
                </Field>
              </div>
              <div className="border-t border-gray-50 pt-5 space-y-4">
                <Toggle checked={rules.offlineSyncEnabled} onChange={v => setRule('offlineSyncEnabled', v)} label="Allow guards to add visitors with no internet (synced later). Off: they must be online." />
              </div>
            </>
          )}

          {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        </div>
      </div>
    </div>
  )
}
