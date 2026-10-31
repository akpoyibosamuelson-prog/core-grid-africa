import { NextResponse } from 'next/server'
import crypto from 'node:crypto'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  const event = JSON.parse(rawBody) as { event?: string; data?: { reference?: string; status?: string } }
  if (event.event === 'charge.success' && event.data?.status === 'success') {
    // Persist the verified reference in the subscriptions/payments ledger when billing tables are enabled.
    console.info('[payments] verified Paystack reference', event.data.reference)
  }
  return NextResponse.json({ received: true })
}
