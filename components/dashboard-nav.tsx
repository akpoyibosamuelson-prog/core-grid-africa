'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BarChart3, Boxes, ChevronDown, ChevronRight, LayoutDashboard, Menu, Package, Search, Settings, Users, WalletCards, X } from 'lucide-react'

const groups = [
  { label: 'Overview', items: [['Dashboard', '/dashboard', LayoutDashboard], ['Analytics', '/dashboard/analytics', BarChart3]] },
  { label: 'Sales & revenue', items: [['Point of Sale', '/dashboard/pos', WalletCards], ['Sales', '/dashboard/sales', WalletCards], ['Invoices', '/dashboard/invoices', WalletCards]] },
  { label: 'Inventory & products', items: [['Inventory overview', '/dashboard/products', Boxes], ['Products', '/dashboard/products', Package], ['Stock management', '/dashboard/stock', Boxes]] },
  { label: 'Customers & CRM', items: [['Customers', '/dashboard/customers', Users], ['Customer transactions', '/dashboard/customers', WalletCards]] },
  { label: 'Settings', items: [['Business settings', '/dashboard/settings', Settings], ['Subscription & billing', '/dashboard/billing', CreditCardIcon]] },
] as const

function CreditCardIcon(props: { className?: string }) { return <WalletCards {...props} /> }

export function DashboardNav({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => groups.map((group) => ({ ...group, items: group.items.filter(([label]) => label.toLowerCase().includes(query.toLowerCase())) })).filter((group) => group.items.length), [query])
  return <>
    <button onClick={() => setOpen(true)} className="fixed left-4 top-4 z-30 grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden" aria-label="Open BizPilot navigation"><Menu className="size-5" /></button>
    {open && <button onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" aria-label="Close navigation" />}
    <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white p-5 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#1463df] text-sm font-bold text-white">CG</span><span className="font-bold text-[#0b1d38]">BizPilot</span></Link><button onClick={() => setOpen(false)} className="text-slate-500 lg:hidden" aria-label="Close navigation"><X className="size-5" /></button></div>
      <label className="mt-8 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400"><Search className="size-4" /><span className="sr-only">Search navigation</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" /></label>
      <nav className="mt-6 flex max-h-[calc(100vh-170px)] flex-col gap-5 overflow-y-auto" aria-label="BizPilot navigation">{filtered.map((group) => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</p><div className="flex flex-col gap-1">{group.items.map(([label, href, Icon]) => <Link key={label} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${label === 'Dashboard' ? 'bg-blue-50 text-[#1463df]' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="size-4" />{label}<ChevronRight className="ml-auto size-3.5 text-slate-300" /></Link>)}</div></div>)}</nav>
      <div className="absolute bottom-5 left-5 right-5 border-t border-slate-100 pt-4"><p className="truncate px-2 text-xs text-slate-500">{email}</p><Link href="/" className="mt-3 flex items-center gap-2 px-2 text-sm text-slate-500">Exit workspace</Link></div>
    </aside>
  </>
}
