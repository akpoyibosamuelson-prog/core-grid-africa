import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email(),
  amount: z.number().int().positive(),
  plan: z.enum(['free', 'starter', 'professional', 'business_plus', 'enterprise']),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment details' }, { status: 400 })
  if (!process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({ error: 'Payments are not configured yet' }, { status: 503 })

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: parsed.data.email, amount: parsed.data.amount, metadata: { user_id: user.id, plan: parsed.data.plan } }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.status) return NextResponse.json({ error: 'Unable to initialize payment' }, { status: 502 })
  return NextResponse.json({ authorization_url: payload.data.authorization_url, reference: payload.data.reference })
}
