import Link from 'next/link'
import { ArrowUpRight, Check } from 'lucide-react'

export function MarketingPage({ eyebrow, title, intro, items }: { eyebrow: string; title: string; intro: string; items: string[] }) {
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Core Grid Africa home"><span className="brand-mark"><span /> <span /></span><span>CORE GRID <b>AFRICA</b></span></Link>
        <nav className="desktop-nav" aria-label="Main navigation"><Link href="/features">Features</Link><Link href="/solutions">Solutions</Link><Link href="/pricing">Pricing</Link><Link href="/resources">Resources</Link><Link href="/about">Company</Link></nav>
        <div className="header-actions"><Link href="/auth/login" className="login-link">Log in</Link><Link href="/auth/register" className="button button-small">Get started <ArrowUpRight size={15} /></Link></div>
      </header>
      <section className="intro-section" style={{ paddingTop: '9rem' }}><div className="section-kicker">{eyebrow}</div><div className="intro-grid"><h1>{title}</h1><p>{intro}</p></div></section>
      <section className="feature-section"><div className="feature-grid">{items.map((item) => <article className="feature-card" key={item}><div className="feature-icon"><Check size={21} /></div><h3>{item}</h3><p>Connected to the BizPilot workspace so your team can act on reliable business data.</p></article>)}</div></section>
      <section className="cta-section"><div><div className="eyebrow">Built for the next stage</div><h2>Run your business<br /><em>with clarity.</em></h2></div><Link href="/auth/register" className="button button-light">Get started <ArrowUpRight size={17} /></Link></section>
    </main>
  )
}
