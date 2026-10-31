import Link from "next/link"

const features = [
  ["Sales that stay accurate", "Capture retail, wholesale, cash, transfer, card, and credit sales while keeping stock and payment status aligned."],
  ["Inventory with context", "Track SKUs, pricing, thresholds, stock movements, and the locations that matter to your team."],
  ["Financial clarity", "Separate revenue, cost of goods sold, expenses, and profit so every decision is grounded in the real numbers."],
  ["Teams with guardrails", "Invite staff, assign roles, and keep sensitive business actions permissioned and auditable."],
  ["Built for African businesses", "Start in Nigeria with NGN-ready workflows and a foundation that scales across branches and markets."],
  ["A marketplace path", "Connect with suppliers and wholesale partners without forcing marketplace complexity into your core workflow."],
]

export default function FeaturesPage() {
  return <main className="min-h-screen bg-[#f7f9fc] text-[#10233f]"><header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7"><Link href="/" className="text-xl font-black tracking-tight">CORE GRID <span className="text-[#0b87c9]">AFRICA</span></Link><Link href="/auth/register" className="rounded-full bg-[#0b87c9] px-5 py-3 text-sm font-bold text-white">Get started</Link></header><section className="mx-auto max-w-6xl px-6 pb-20 pt-14"><p className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-[#0b87c9]">BizPilot capabilities</p><h1 className="max-w-3xl text-5xl font-black leading-tight md:text-7xl">The operating layer for ambitious African businesses.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Everything your team needs to sell, stock, spend, report, and grow from one calm, connected workspace.</p><div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{features.map(([title, body]) => <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><div className="mb-12 h-2 w-14 rounded-full bg-[#0b87c9]"/><h2 className="text-xl font-extrabold">{title}</h2><p className="mt-3 leading-7 text-slate-600">{body}</p></article>)}</div></section></main>
}
