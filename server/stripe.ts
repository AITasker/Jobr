import type { Request, Response } from "express";
import { storage } from "./storage";
import { VALID_PRICE_MAPPINGS } from "@shared/schema";

// Initialize Stripe
let stripe: any = null;

// Initialize Stripe if API key is available
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const Stripe = require('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    console.log('Stripe initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize Stripe:', error);
  }
} else {
  console.warn('Stripe not initialized: STRIPE_SECRET_KEY environment variable not found');
}

export class StripeWebhookService {
  // Test mode detection
  static isTestMode(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true';
  }

  /**
   * Process Stripe webhook events with persistent idempotency
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Use mock service in test mode
      if (this.isTestMode()) {
        console.log('💳 Stripe Service: Using mock webhook handler in test mode');
        res.json({ received: true, status: 'mocked' });
        return;
      }

      // Critical: Check if Stripe is properly configured
      if (!stripe) {
        console.error('Stripe webhook called but Stripe not configured');
        res.status(503).json({ 
          message: "Stripe not configured",
          code: "STRIPE_NOT_CONFIGURED"
        });
        return;
      }

      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      // Critical: Validate webhook secret is configured
      if (!webhookSecret) {
        console.error('Stripe webhook secret not configured');
        res.status(400).json({ 
          message: 'Webhook secret not configured',
          code: "WEBHOOK_SECRET_MISSING"
        });
        return;
      }

      if (!sig) {
        console.error('Stripe signature missing');
        res.status(400).json({ 
          message: 'Stripe signature missing',
          code: "SIGNATURE_MISSING"
        });
        return;
      }

      let event;
      try {
        // Critical: Verify webhook signature to prevent tampering
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).json({ 
          message: 'Webhook signature verification failed',
          code: "INVALID_SIGNATURE"
        });
        return;
      }

      // Critical: Persistent idempotency check - prevent double processing
      const existingEvent = await storage.getStripeEventByEventId(event.id);
      if (existingEvent?.processed) {
        console.log(`Webhook event ${event.id} already processed, skipping`);
        res.json({ received: true, status: 'already_processed' });
        return;
      }

      // Record the event in the database for idempotency tracking
      if (!existingEvent) {
        await storage.createStripeEvent({
          eventId: event.id,
          eventType: event.type,
          processed: false,
          metadata: event.data
        });
      }

      console.log(`Processing webhook event: ${event.type} (${event.id})`);

      // Handle subscription events with comprehensive error handling
      try {
        await StripeWebhookService.processEvent(event);
        
        // Mark event as processed successfully
        await storage.markStripeEventProcessed(event.id);
        
        console.log(`Successfully processed webhook event: ${event.type} (${event.id})`);
        res.json({ received: true, status: 'processed' });
      } catch (processingError: any) {
        console.error(`Error processing webhook event ${event.id}:`, processingError);
        
        // Mark event as failed with error message
        await storage.markStripeEventProcessed(event.id, processingError.message);
        
        res.status(500).json({
          message: 'Event processing failed',
          code: "PROCESSING_ERROR",
          eventId: event.id
        });
      }
    } catch (error: any) {
      console.error("Webhook handler error:", error);
      res.status(500).json({
        message: "Internal webhook error",
        code: "WEBHOOK_ERROR"
      });
    }
  }

  /**
   * Process individual Stripe events
   */
  private static async processEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await StripeWebhookService.handleCheckoutSessionCompleted(event);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await StripeWebhookService.handleSubscriptionChange(event);
        break;

      case 'customer.subscription.deleted':
        await StripeWebhookService.handleSubscriptionDeleted(event);
        break;

      case 'invoice.payment_succeeded':
        await StripeWebhookService.handlePaymentSucceeded(event);
        break;

      case 'invoice.payment_failed':
        await StripeWebhookService.handlePaymentFailed(event);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle checkout session completed
   */
  private static async handleCheckoutSessionCompleted(event: any): Promise<void> {
    const session = event.data.object;
    if (session.mode === 'subscription') {
      const customerId = session.customer;
      const user = await storage.getUserByStripeCustomerId(customerId as string);
      
      if (user) {
        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        
        // Determine plan from price ID using secure mapping
        const priceId = subscription.items.data[0]?.price.id;
        let plan = 'Free';
        
        for (const [planName, planPriceId] of Object.entries(VALID_PRICE_MAPPINGS)) {
          if (planPriceId === priceId) {
            plan = planName;
            break;
          }
        }
        
        // Update user plan and subscription info
        await storage.updateUserPlan(
          user.id,
          plan,
          subscription.status,
          new Date(subscription.current_period_end * 1000)
        );
        
        await storage.updateUserStripeInfo(user.id, customerId as string, subscription.id);
        
        console.log(`Successfully processed checkout.session.completed for user ${user.id}, plan: ${plan}`);
      } else {
        console.error(`User not found for Stripe customer ID: ${customerId}`);
      }
    }
  }

  /**
   * Handle subscription created or updated
   */
  private static async handleSubscriptionChange(event: any): Promise<void> {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    
    const user = await storage.getUserByStripeCustomerId(customerId as string);
    
    if (user) {
      // Determine plan from price ID using secure mapping
      const priceId = subscription.items.data[0]?.price.id;
      let plan = 'Free';
      
      for (const [planName, planPriceId] of Object.entries(VALID_PRICE_MAPPINGS)) {
        if (planPriceId === priceId) {
          plan = planName;
          break;
        }
      }
      
      // Update user plan based on subscription status
      if (subscription.status === 'active') {
        await storage.updateUserPlan(
          user.id,
          plan,
          subscription.status,
          new Date(subscription.current_period_end * 1000)
        );
      } else if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
        await storage.updateUserPlan(user.id, 'Free', 'canceled');
      }
      
      await storage.updateUserStripeInfo(user.id, customerId as string, subscription.id);
      
      console.log(`Successfully processed ${event.type} for user ${user.id}, status: ${subscription.status}`);
    } else {
      console.error(`User not found for Stripe customer ID: ${customerId}`);
    }
  }

  /**
   * Handle subscription deleted
   */
  private static async handleSubscriptionDeleted(event: any): Promise<void> {
    const deletedSubscription = event.data.object;
    const deletedCustomerId = deletedSubscription.customer;
    
    const deletedUser = await storage.getUserByStripeCustomerId(deletedCustomerId as string);
    
    if (deletedUser) {
      await storage.updateUserPlan(deletedUser.id, 'Free', 'canceled');
      console.log(`Successfully processed subscription deletion for user ${deletedUser.id}`);
    }
  }

  /**
   * Handle successful payment
   */
  private static async handlePaymentSucceeded(event: any): Promise<void> {
    const invoice = event.data.object;
    if (invoice.subscription) {
      // Payment succeeded - subscription should remain active
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      const customerId = subscription.customer;
      
      const user = await storage.getUserByStripeCustomerId(customerId as string);
      if (user) {
        await storage.updateUserPlan(
          user.id,
          user.plan,
          'active',
          new Date(subscription.current_period_end * 1000)
        );
        console.log(`Payment succeeded for user ${user.id}`);
      }
    }
  }

  /**
   * Handle failed payment
   */
  private static async handlePaymentFailed(event: any): Promise<void> {
    const failedInvoice = event.data.object;
    if (failedInvoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(failedInvoice.subscription as string);
      const customerId = subscription.customer;
      
      const user = await storage.getUserByStripeCustomerId(customerId as string);
      if (user) {
        await storage.updateUserPlan(user.id, user.plan, 'past_due');
        console.log(`Payment failed for user ${user.id}, marked as past_due`);
      }
    }
  }

  /**
   * Cleanup old processed events (call this periodically)
   */
  static async cleanupOldEvents(): Promise<void> {
    try {
      await storage.cleanupOldStripeEvents(30); // Keep events for 30 days
      console.log('Cleaned up old Stripe events');
    } catch (error) {
      console.error('Error cleaning up old Stripe events:', error);
    }
  }
}

export { stripe };