import Link from "next/link"

const faqs = [
  ["What is BizPilot?", "BizPilot is the business operating platform from Core Grid Africa for sales, inventory, customers, expenses, teams, and reports."],
  ["Can I start small?", "Yes. The Free and Starter plans are designed for growing businesses, with clear upgrade paths as your operations expand."],
  ["Is my business data private?", "Each workspace is isolated with Supabase authentication, row-level security, and server-side authorization."],
  ["Can I use it on my phone?", "Yes. The interface is responsive and designed for desktop and Android mobile workflows."],
]

export default function HelpPage() {
  return <main className="min-h-screen bg-[#f7f9fc] text-[#10233f]"><header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-7"><Link href="/" className="text-xl font-black">CORE GRID <span className="text-[#0b87c9]">AFRICA</span></Link><Link href="/auth/login" className="text-sm font-bold text-[#0b87c9]">Sign in</Link></header><section className="mx-auto max-w-3xl px-6 pb-20 pt-14"><p className="text-sm font-bold uppercase tracking-[0.24em] text-[#0b87c9]">Help centre</p><h1 className="mt-4 text-5xl font-black leading-tight">Answers for your next move.</h1><p className="mt-5 text-lg leading-8 text-slate-600">Find the essentials about BizPilot, security, plans, and getting your team started.</p><div className="mt-12 flex flex-col gap-4">{faqs.map(([question, answer]) => <article key={question} className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-extrabold">{question}</h2><p className="mt-2 leading-7 text-slate-600">{answer}</p></article>)}</div><div className="mt-12 rounded-3xl bg-[#10233f] p-8 text-white"><h2 className="text-2xl font-black">Still need help?</h2><p className="mt-2 text-slate-300">Our team can help you plan a practical rollout for your business.</p><Link href="/contact" className="mt-6 inline-flex rounded-full bg-[#0b87c9] px-5 py-3 text-sm font-bold">Contact Core Grid Africa</Link></div></section></main>
}
