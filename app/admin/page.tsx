import Link from 'next/link'
import { ArrowUpRight, Bell, Boxes, ChevronDown, CircleHelp, LayoutDashboard, MoreHorizontal, Package, Plus, Search, Settings, ShoppingBag, Users, Wallet } from 'lucide-react'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Orders', icon: ShoppingBag, count: '24' },
  { label: 'Inventory', icon: Boxes },
  { label: 'Customers', icon: Users },
  { label: 'Finance', icon: Wallet },
]
const products = [['African black soap', 'Beauty / A11', '₦18,500', '142', 'In stock'], ['Premium shea butter', 'Beauty / B08', '₦12,000', '38', 'Low stock'], ['Organic hibiscus tea', 'Food / F02', '₦8,400', '87', 'In stock'], ['Handwoven market basket', 'Home / H19', '₦25,000', '0', 'Out of stock']]

export default function AdminPage() {
  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><span /><span /></span><span>CORE GRID <b>AFRICA</b></span></Link>
      <div className="workspace-switch"><span className="workspace-avatar">K</span><span><small>Workspace</small><strong>Kora Collective</strong></span><ChevronDown size={15} /></div>
      <nav className="admin-nav" aria-label="Admin navigation">{navItems.map(({ label, icon: Icon, active, count }) => <Link className={active ? 'active' : ''} href="#" key={label}><Icon size={18} /><span>{label}</span>{count && <small>{count}</small>}</Link>)}</nav>
      <div className="admin-nav-bottom"><Link href="#"><Settings size={18} />Settings</Link><Link href="#"><CircleHelp size={18} />Help centre</Link></div>
      <div className="sidebar-user"><span className="user-avatar">AO</span><span><strong>Amara Okafor</strong><small>Administrator</small></span><MoreHorizontal size={18} /></div>
    </aside>
    <section className="admin-content">
      <header className="admin-topbar"><div className="admin-breadcrumb"><span>Workspace</span><b>/</b><strong>Overview</strong></div><div className="admin-top-actions"><button aria-label="Search"><Search size={19} /></button><button aria-label="Notifications"><Bell size={19} /><i /></button><Link href="/" className="view-site">View site <ArrowUpRight size={15} /></Link></div></header>
      <div className="admin-main">
        <div className="admin-welcome"><div><span className="section-kicker">Monday, 24 June 2025</span><h1>Good morning, Amara.</h1><p>Here is the pulse of your business today.</p></div><button className="admin-primary"><Plus size={17} /> Create new</button></div>
        <div className="admin-alert"><span className="alert-icon"><Package size={18} /></span><div><strong>Inventory needs your attention</strong><p>4 products are running low. Replenish now to keep your bestsellers moving.</p></div><Link href="#inventory">Review stock <ArrowUpRight size={15} /></Link></div>
        <div className="admin-stats"><article><span>Total revenue <small>ⓘ</small></span><strong>₦24,805,200</strong><em>↗ 18.4% <b>vs last month</b></em></article><article><span>Orders this month</span><strong>384</strong><em>↗ 12.8% <b>vs last month</b></em></article><article><span>Net profit</span><strong>₦8,240,000</strong><em>↗ 9.2% <b>vs last month</b></em></article><article><span>Active customers</span><strong>1,248</strong><em>↗ 24.6% <b>vs last month</b></em></article></div>
        <div className="admin-grid"><article className="panel revenue-panel"><div className="panel-heading"><div><span className="section-kicker">Performance</span><h2>Revenue overview</h2></div><button className="period-button">Last 6 months <ChevronDown size={14} /></button></div><div className="revenue-total">₦24.8m <span>↗ 18.4%</span></div><div className="admin-chart">{[42,51,39,62,55,72,68,80,63,88,76,100].map((height, index) => <span key={index} style={{ height: `${height}%` }} className={index === 11 ? 'active' : ''} />)}</div><div className="chart-labels"><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span></div></article><article className="panel quick-panel"><div className="panel-heading"><div><span className="section-kicker">At a glance</span><h2>Quick actions</h2></div></div><Link href="#"><span className="quick-icon green"><Plus size={18} /></span><span><strong>Add a product</strong><small>Update your catalogue</small></span><ArrowUpRight size={16} /></Link><Link href="#"><span className="quick-icon yellow"><Users size={18} /></span><span><strong>Invite a teammate</strong><small>Grow your workspace</small></span><ArrowUpRight size={16} /></Link><Link href="#"><span className="quick-icon blue"><Wallet size={18} /></span><span><strong>View reports</strong><small>Understand your numbers</small></span><ArrowUpRight size={16} /></Link></article></div>
        <article className="panel inventory-panel" id="inventory"><div className="panel-heading"><div><span className="section-kicker">Catalogue</span><h2>Product inventory</h2></div><Link href="#" className="panel-link">View all <ArrowUpRight size={15} /></Link></div><div className="product-table"><div className="product-row table-head"><span>PRODUCT</span><span>PRICE</span><span>STOCK</span><span>STATUS</span><span /></div>{products.map(([name, sku, price, stock, status]) => <div className="product-row" key={name}><span className="product-name"><i>{name.slice(0,1)}</i><b>{name}<small>{sku}</small></b></span><span>{price}</span><span>{stock}</span><span><em className={status === 'In stock' ? 'stock-good' : status === 'Low stock' ? 'stock-low' : 'stock-out'}>{status}</em></span><button aria-label={`More options for ${name}`}><MoreHorizontal size={17} /></button></div>)}</div></article>
      </div>
    </section>
  </main>
}
