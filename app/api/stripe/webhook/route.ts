import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        const userEmail = session.customer_email || session.metadata?.userEmail;

        // Get subscription details
        const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string);
        const subscription = subscriptionResponse as any; // Type assertion for API compatibility

        // Forward to agent to update database
        await fetch(`${process.env.NEXT_PUBLIC_AGENT_URL}/webhook/stripe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'checkout.session.completed',
            customer_email: userEmail,
            subscription_id: subscription.id,
            customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
            subscription_status: subscription.status,
            current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          }),
        });

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any; // Type assertion for API compatibility
        console.log(`Subscription ${event.type}:`, subscription.id);

        // Get customer email
        const customerResponse = await stripe.customers.retrieve(subscription.customer as string);
        const customer = customerResponse as any;
        const customerEmail = customer.email || null;

        // Forward to agent
        await fetch(`${process.env.NEXT_PUBLIC_AGENT_URL}/webhook/stripe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: event.type,
            customer_email: customerEmail,
            subscription_id: subscription.id,
            customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
            subscription_status: subscription.status,
            current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          }),
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any; // Type assertion for API compatibility
        console.log('Subscription cancelled:', subscription.id);

        // Get customer email
        const customerResponse = await stripe.customers.retrieve(subscription.customer as string);
        const customer = customerResponse as any;
        const customerEmail = customer.email || null;

        // Forward to agent
        await fetch(`${process.env.NEXT_PUBLIC_AGENT_URL}/webhook/stripe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'customer.subscription.deleted',
            customer_email: customerEmail,
            subscription_id: subscription.id,
            customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
            subscription_status: 'canceled',
            current_period_end: null,
          }),
        });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any; // Type assertion for API compatibility
        console.log('Payment failed:', invoice.id);

        // Get customer email and notify via agent
        const customerResponse = await stripe.customers.retrieve(invoice.customer as string);
        const customer = customerResponse as any;
        const customerEmail = customer.email || null;

        await fetch(`${process.env.NEXT_PUBLIC_AGENT_URL}/webhook/stripe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'invoice.payment_failed',
            customer_email: customerEmail,
            subscription_status: 'past_due',
          }),
        });

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
