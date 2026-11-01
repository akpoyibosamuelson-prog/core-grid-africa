import Link from 'next/link'
import { ArrowUpRight, BarChart3, Boxes, Check, ChevronRight, CircleDot, Menu, ShieldCheck, Sparkles, Zap } from 'lucide-react'

const metrics = [
  ['2,500+', 'Businesses building better'],
  ['₦18B+', 'Revenue tracked securely'],
  ['99.9%', 'Platform uptime'],
]

const features = [
  { icon: BarChart3, label: 'Clarity', title: 'See the whole business.', text: 'Replace scattered spreadsheets with a live command centre for sales, profit and performance.' },
  { icon: Boxes, label: 'Control', title: 'Make every move count.', text: 'Connect inventory, purchases, expenses and customers in one intelligent workspace.' },
  { icon: ShieldCheck, label: 'Confidence', title: 'Built for serious growth.', text: 'Enterprise-grade security and simple access controls keep your business moving safely.' },
]

export default function Home() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Core Grid Africa home">
          <span className="brand-mark"><span /> <span /></span>
          <span>CORE GRID <b>AFRICA</b></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="#platform">Platform</Link>
          <Link href="#why-us">Why Core Grid</Link>
          <Link href="#pricing">Pricing</Link>
          <Link href="/about">Company</Link>
        </nav>
        <div className="header-actions">
          <Link href="/auth/login" className="login-link">Log in</Link>
          <Link href="/auth/register" className="button button-small">Get started <ArrowUpRight size={15} /></Link>
          <button className="mobile-menu" aria-label="Open menu"><Menu size={21} /></button>
        </div>
      </header>

      <section className="hero" id="platform">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> The operating system for ambitious businesses</div>
          <h1>Build the business<br /><em>you came for.</em></h1>
          <p className="hero-lede">Core Grid Africa gives growing businesses the visibility, control and intelligence to turn momentum into meaningful scale.</p>
          <div className="hero-actions">
            <Link href="/auth/register" className="button">Start with BizPilot <ArrowUpRight size={17} /></Link>
            <Link href="#why-us" className="text-link">Explore the platform <ChevronRight size={16} /></Link>
          </div>
          <div className="hero-note"><CircleDot size={13} /> Trusted by operators across Africa</div>
        </div>
        <div className="hero-visual" aria-label="BizPilot analytics preview">
          <div className="visual-glow" />
          <div className="dashboard-card">
            <div className="dashboard-top"><span className="window-dots"><i /><i /><i /></span><span className="dashboard-label">BIZPILOT / OVERVIEW</span><span className="live-dot">LIVE</span></div>
            <div className="dashboard-heading"><div><span className="muted-label">Good morning, operator</span><h3>Business overview</h3></div><span className="date-pill">This month ⌄</span></div>
            <div className="mini-metrics"><div><span>Revenue</span><strong>₦24.8m</strong><small className="positive">↗ 18.4%</small></div><div><span>Net profit</span><strong>₦8.2m</strong><small className="positive">↗ 12.8%</small></div></div>
            <div className="chart-box"><div className="chart-header"><span>Revenue performance</span><span className="muted-label">Jan — Jun 2025</span></div><div className="bars">{[34,48,40,62,57,78,67,91,76,100].map((height, i) => <span key={i} style={{ height: `${height}%` }} className={i === 9 ? 'active' : ''} />)}</div><div className="chart-axis"><span>JAN</span><span>MAR</span><span>MAY</span><span>JUN</span></div></div>
            <div className="dashboard-footer"><span><i className="status-dot" /> All systems operational</span><span>View reports <ArrowUpRight size={13} /></span></div>
          </div>
          <div className="float-card"><span className="float-icon"><Zap size={15} /></span><span><b>₦4.2m</b><small>Profit this week</small></span><span className="trend">+24%</span></div>
        </div>
      </section>

      <section className="metrics" aria-label="Platform metrics">{metrics.map(([value, label]) => <div className="metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}</section>

      <section className="intro-section" id="why-us">
        <div className="section-kicker">01 / A better way to operate</div>
        <div className="intro-grid"><h2>Less guessing.<br /><span>More building.</span></h2><p>Growth should not feel like a game of catch-up. We bring the essential systems of your business into focus, so you can spend less time searching for answers and more time acting on them.</p></div>
      </section>

      <section className="feature-section"><div className="feature-heading"><div><div className="section-kicker">02 / One clear advantage</div><h2>Everything aligned.<br /><span>Nothing in the way.</span></h2></div><p>One powerful workspace for the numbers, workflows and decisions that move your business forward.</p></div><div className="feature-grid">{features.map(({ icon: Icon, label, title, text }, index) => <article className="feature-card" key={title}><div className="feature-number">0{index + 1}</div><div className="feature-icon"><Icon size={21} /></div><span className="feature-label">{label}</span><h3>{title}</h3><p>{text}</p><Link href="/bizpilot">Learn more <ArrowUpRight size={15} /></Link></article>)}</div></section>

      <section className="cta-section" id="pricing"><div><div className="eyebrow">Ready when you are</div><h2>Make your next chapter<br /><em>your strongest one.</em></h2></div><Link href="/auth/register" className="button button-light">Get started for free <ArrowUpRight size={17} /></Link></section>
      <footer className="site-footer"><Link href="/" className="brand"><span className="brand-mark"><span /><span /></span><span>CORE GRID <b>AFRICA</b></span></Link><span>© 2025 Core Grid Africa</span><div><Link href="/contact">Contact</Link><Link href="/about">About</Link><Link href="/auth/login">Log in</Link></div></footer>
    </main>
  )
}
