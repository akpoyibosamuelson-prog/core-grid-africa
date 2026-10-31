import Link from "next/link"

const categories = ["Food & Beverage", "Fashion", "Beauty", "Electronics", "Home & Office"]

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-black tracking-tight">CORE GRID <span className="text-cyan-600">AFRICA</span></Link>
          <div className="flex items-center gap-4"><Link href="/dashboard" className="text-sm font-semibold text-slate-600">Open BizPilot</Link><Link href="/auth/login" className="rounded-full bg-slate-950 px-5 py-2 text-sm font-bold text-white">Sign in</Link></div>
        </div>
      </header>
      <section className="bg-slate-950 px-6 py-20 text-white"><div className="mx-auto max-w-7xl"><p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-cyan-400">BizPilot Marketplace</p><h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">Source better. Sell faster. Grow together.</h1><p className="mt-6 max-w-2xl text-lg text-slate-300">A trusted B2B network for African wholesalers, retailers, distributors and suppliers.</p><div className="mt-8 flex max-w-2xl gap-3"><input aria-label="Search marketplace" placeholder="Search products, suppliers or categories" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white px-4 py-3 text-slate-950 outline-none" /><button className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">Search</button></div></div></section>
      <section className="mx-auto max-w-7xl px-6 py-14"><div className="flex items-end justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-700">Explore</p><h2 className="mt-2 text-3xl font-black">Browse by category</h2></div><Link href="/auth/register" className="hidden rounded-full border border-slate-300 px-5 py-2 text-sm font-bold md:block">List your products</Link></div><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{categories.map((category) => <div key={category} className="rounded-2xl border border-slate-200 bg-white p-6 font-bold shadow-sm transition hover:-translate-y-1 hover:border-cyan-400">{category}<p className="mt-2 text-sm font-normal text-slate-500">Discover verified suppliers</p></div>)}</div><div className="mt-16 rounded-3xl bg-cyan-50 p-8 md:p-12"><div className="max-w-xl"><h2 className="text-3xl font-black">Built into your business workspace</h2><p className="mt-4 text-slate-600">Manage your inventory and marketplace orders from one operating system. No spreadsheets. No disconnected tools.</p><Link href="/bizpilot" className="mt-7 inline-flex rounded-full bg-slate-950 px-6 py-3 font-bold text-white">Explore BizPilot</Link></div></div></section>
    </main>
  )
}
