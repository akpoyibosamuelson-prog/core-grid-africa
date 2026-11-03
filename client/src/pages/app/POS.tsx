import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, Printer, ArrowLeft } from "lucide-react";
import { PageHeader, LoadingState, EmptyState, MoneyInput } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { formatMoney, toNaira } from "@shared/format";

interface CartLine { productId?: string; name: string; quantity: number; unitPrice: number; costPrice: number; discount: number; }

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "POS", label: "POS terminal" },
  { value: "ONLINE", label: "Online payment" },
  { value: "OTHER", label: "Other" },
];

export default function POS() {
  const { active } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const bizId = active?.businessId ?? "";

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<{ reference: string; total: number; paid: number; change: number } | null>(null);

  const products = trpc.product.list.useQuery({ businessId: bizId, search: search || undefined }, { enabled: !!active });
  const customers = trpc.customer.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const utils = trpc.useUtils();

  const createM = trpc.sale.create.useMutation({
    onSuccess: (sale) => {
      const total = sale.total;
      setReceipt({ reference: sale.reference, total, paid: amountPaid, change: Math.max(0, amountPaid - total) });
      setCart([]); setDiscount(0); setAmountPaid(0); setNotes(""); setCustomerId("");
      void utils.product.list.invalidate(); void utils.product.summary.invalidate(); void utils.sale.list.invalidate();
      push({ kind: "success", title: "Sale recorded", message: `Receipt ${sale.reference}` });
    },
    onError: (e) => push({ kind: "error", title: "Sale failed", message: e.message }),
  });

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity - l.discount, 0), [cart]);
  const taxAmount = useMemo(() => Math.round(((subtotal - discount) * taxRate) / 10000), [subtotal, discount, taxRate]);
  const total = Math.max(0, subtotal - discount + taxAmount);

  function addProduct(p: { id: string; name: string; retailPrice: number; costPrice: number }) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) return prev.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { productId: p.id, name: p.name, quantity: 1, unitPrice: p.retailPrice, costPrice: p.costPrice, discount: 0 }];
    });
  }

  function setQty(idx: number, q: number) {
    setCart((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: Math.max(1, q) } : l)));
  }

  function checkout() {
    if (cart.length === 0) return;
    createM.mutate({
      businessId: bizId,
      customerId: customerId || undefined,
      reference: `SALE-${Date.now().toString(36).toUpperCase()}`,
      items: cart.map((l) => ({ productId: l.productId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, costPrice: l.costPrice, discount: l.discount })),
      discount, taxRate, amountPaid: amountPaid || total, paymentMethod: paymentMethod as "CASH", notes: notes || undefined,
    });
  }

  if (!active) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Point of Sale" description="Record a sale — inventory and finances update automatically" actions={<Button asChild variant="outline"><Link to="/app/sales"><ArrowLeft className="h-4 w-4" /> Sales history</Link></Button>} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name, SKU or barcode…" className="pl-9" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.isLoading ? <LoadingState /> : (products.data ?? []).length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3">
                <EmptyState title="No products found" description="Add products to your inventory first, then sell them here." action={<Button asChild><Link to="/app/inventory">Go to inventory</Link></Button>} />
              </div>
            ) : (products.data ?? []).map((p) => (
              <button key={p.id} onClick={() => addProduct(p)} disabled={p.quantity <= 0}
                className="flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
                <p className="line-clamp-2 text-sm font-medium text-navy">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.quantity} {p.unit} in stock</p>
                <p className="mt-2 text-base font-bold text-primary">{formatMoney(p.retailPrice, sym)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-20 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-navy">Current sale</h3>
              <Badge variant="muted" className="ml-auto">{cart.length} item(s)</Badge>
            </div>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Tap a product to add it to the sale.</p>
              ) : cart.map((l, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{l.name}</p>
                    <button onClick={() => setCart((prev) => prev.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(i, l.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center text-sm font-medium">{l.quantity}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setQty(i, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="text-sm font-semibold text-navy">{formatMoney(l.unitPrice * l.quantity - l.discount, sym)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Discount</Label><MoneyInput value={discount} onChange={setDiscount} symbol={sym} /></div>
                <div className="space-y-2"><Label>Tax (%)</Label><Input type="number" step="0.01" min="0" value={taxRate / 100} onChange={(e) => setTaxRate(Math.round(Number(e.target.value) * 100))} /></div>
              </div>
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </Select>
              </div>
              <div className="space-y-2"><Label>Amount paid</Label><MoneyInput value={amountPaid} onChange={setAmountPaid} symbol={sym} placeholder={toNaira(total).toFixed(2)} /></div>
            </div>

            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(subtotal, sym)}</span></div>
              {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatMoney(discount, sym)}</span></div>}
              {taxAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatMoney(taxAmount, sym)}</span></div>}
              <div className="flex justify-between text-lg font-bold text-navy"><span>Total</span><span>{formatMoney(total, sym)}</span></div>
              {amountPaid > 0 && amountPaid < total && <div className="flex justify-between text-destructive"><span>Balance</span><span>{formatMoney(total - amountPaid, sym)}</span></div>}
            </div>

            <Button className="mt-4 w-full" size="lg" onClick={checkout} disabled={cart.length === 0 || createM.isPending}>
              {createM.isPending ? "Recording…" : `Complete sale · ${formatMoney(total, sym)}`}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!receipt} onClose={() => setReceipt(null)} title="Sale complete" className="max-w-sm"
        footer={<><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print receipt</Button><Button onClick={() => setReceipt(null)}>New sale</Button></>}>
        {receipt && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <p className="mt-3 text-sm text-muted-foreground">Receipt {receipt.reference}</p>
            <p className="mt-2 text-3xl font-bold text-navy">{formatMoney(receipt.total, sym)}</p>
            <div className="mt-4 space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{formatMoney(receipt.paid, sym)}</span></div>
              {receipt.change > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Change</span><span>{formatMoney(receipt.change, sym)}</span></div>}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
