/**
 * Mock Stripe Service
 * Provides payment processing simulation and webhook testing
 */
export class MockStripeService {
  private static isRunning = false;
  private static customers: Map<string, any> = new Map();
  private static subscriptions: Map<string, any> = new Map();
  private static payments: Map<string, any> = new Map();
  private static webhookEvents: Array<any> = [];

  /**
   * Start the mock service
   */
  static async start(): Promise<void> {
    console.log('💳 Starting Stripe mock service...');
    
    this.setupMockData();
    this.interceptStripeRequests();
    this.isRunning = true;
    
    console.log('✅ Stripe mock service active');
  }

  /**
   * Stop the mock service
   */
  static async stop(): Promise<void> {
    this.isRunning = false;
    this.customers.clear();
    this.subscriptions.clear();
    this.payments.clear();
    this.webhookEvents = [];
    console.log('🛑 Stripe mock service stopped');
  }

  /**
   * Check if service is active
   */
  static isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Setup initial mock data
   */
  private static setupMockData(): void {
    // Create test customers
    this.customers.set('cus_test_premium', {
      id: 'cus_test_premium',
      object: 'customer',
      email: 'premium.user@test.com',
      created: Math.floor(Date.now() / 1000),
      subscriptions: {
        object: 'list',
        data: []
      }
    });

    this.customers.set('cus_test_pro', {
      id: 'cus_test_pro', 
      object: 'customer',
      email: 'pro.user@test.com',
      created: Math.floor(Date.now() / 1000),
      subscriptions: {
        object: 'list',
        data: []
      }
    });

    // Create test subscriptions
    const premiumSub = {
      id: 'sub_test_premium',
      object: 'subscription',
      customer: 'cus_test_premium',
      status: 'active',
      items: {
        data: [{
          id: 'si_test_premium',
          price: {
            id: 'price_premium_monthly',
            unit_amount: 2000, // $20 in cents
            currency: 'usd'
          }
        }]
      },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      created: Math.floor(Date.now() / 1000)
    };

    this.subscriptions.set('sub_test_premium', premiumSub);
  }

  /**
   * Intercept Stripe API requests
   */
  private static interceptStripeRequests(): void {
    const originalFetch = global.fetch;
    
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      // Intercept Stripe API calls
      if (url.includes('api.stripe.com')) {
        return this.handleStripeMockRequest(url, init);
      }
      
      // Pass through other requests
      return originalFetch(input, init);
    };
  }

  /**
   * Handle mock Stripe API requests
   */
  private static async handleStripeMockRequest(url: string, init?: RequestInit): Promise<Response> {
    console.log('💳 Intercepted Stripe API request:', url);
    
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

    const method = init?.method || 'GET';
    
    // Handle customer creation
    if (url.includes('/customers') && method === 'POST') {
      const body = init?.body as string || '';
      const params = new URLSearchParams(body);
      
      const customerId = `cus_mock_${Math.random().toString(36).substr(2, 9)}`;
      const customer = {
        id: customerId,
        object: 'customer',
        email: params.get('email'),
        created: Math.floor(Date.now() / 1000),
        subscriptions: {
          object: 'list',
          data: []
        }
      };
      
      this.customers.set(customerId, customer);
      
      return new Response(JSON.stringify(customer), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle subscription creation
    if (url.includes('/subscriptions') && method === 'POST') {
      const body = init?.body as string || '';
      const params = new URLSearchParams(body);
      
      const subscriptionId = `sub_mock_${Math.random().toString(36).substr(2, 9)}`;
      const customerId = params.get('customer');
      const priceId = params.get('items[0][price]');
      
      const subscription = {
        id: subscriptionId,
        object: 'subscription',
        customer: customerId,
        status: 'active',
        items: {
          data: [{
            id: `si_mock_${Math.random().toString(36).substr(2, 9)}`,
            price: {
              id: priceId,
              unit_amount: priceId === 'price_premium_monthly' ? 2000 : 5000,
              currency: 'usd'
            }
          }]
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        created: Math.floor(Date.now() / 1000)
      };
      
      this.subscriptions.set(subscriptionId, subscription);
      
      // Trigger webhook for subscription created
      setTimeout(() => {
        this.triggerWebhook({
          id: `evt_mock_${Math.random().toString(36).substr(2, 9)}`,
          object: 'event',
          type: 'customer.subscription.created',
          data: {
            object: subscription
          },
          created: Math.floor(Date.now() / 1000)
        });
      }, 100);
      
      return new Response(JSON.stringify(subscription), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle payment intent creation
    if (url.includes('/payment_intents') && method === 'POST') {
      const body = init?.body as string || '';
      const params = new URLSearchParams(body);
      
      const paymentIntentId = `pi_mock_${Math.random().toString(36).substr(2, 9)}`;
      const amount = parseInt(params.get('amount') || '0');
      
      const paymentIntent = {
        id: paymentIntentId,
        object: 'payment_intent',
        amount: amount,
        currency: params.get('currency') || 'usd',
        status: 'requires_payment_method',
        client_secret: `${paymentIntentId}_secret_mock`,
        created: Math.floor(Date.now() / 1000)
      };
      
      this.payments.set(paymentIntentId, paymentIntent);
      
      return new Response(JSON.stringify(paymentIntent), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle webhook event construction (for testing)
    if (url.includes('/webhook_endpoints')) {
      return new Response(JSON.stringify({
        id: 'we_mock_test',
        object: 'webhook_endpoint',
        url: 'http://localhost:5000/api/webhooks/stripe',
        enabled_events: ['*']
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return error for unknown endpoints
    return new Response(JSON.stringify({
      error: {
        type: 'invalid_request_error',
        message: 'Mock Stripe: Unknown endpoint'
      }
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Trigger webhook event
   */
  private static triggerWebhook(event: any): void {
    this.webhookEvents.push(event);
    console.log(`💳 Stripe webhook triggered: ${event.type}`);
  }

  /**
   * Get webhook events
   */
  static getWebhookEvents(): Array<any> {
    return [...this.webhookEvents];
  }

  /**
   * Get customer by ID
   */
  static getCustomer(customerId: string): any {
    return this.customers.get(customerId);
  }

  /**
   * Get subscription by ID
   */
  static getSubscription(subscriptionId: string): any {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get payment by ID
   */
  static getPayment(paymentId: string): any {
    return this.payments.get(paymentId);
  }

  /**
   * Simulate payment success
   */
  static simulatePaymentSuccess(paymentIntentId: string): void {
    const payment = this.payments.get(paymentIntentId);
    if (payment) {
      payment.status = 'succeeded';
      
      this.triggerWebhook({
        id: `evt_mock_${Math.random().toString(36).substr(2, 9)}`,
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: payment
        },
        created: Math.floor(Date.now() / 1000)
      });
    }
  }

  /**
   * Simulate payment failure
   */
  static simulatePaymentFailure(shouldFail = true): void {
    if (shouldFail) {
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input.toString();
        if (url.includes('api.stripe.com/v1/payment_intents')) {
          return new Response(JSON.stringify({
            error: {
              type: 'card_error',
              code: 'card_declined',
              message: 'Your card was declined.'
            }
          }), {
            status: 402,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(input, init);
      };
    } else {
      // Reset to normal mock behavior
      this.interceptStripeRequests();
    }
  }

  /**
   * Clear all data
   */
  static clearAll(): void {
    this.customers.clear();
    this.subscriptions.clear();
    this.payments.clear();
    this.webhookEvents = [];
    this.setupMockData();
  }

  /**
   * Get service statistics
   */
  static getStats(): {
    customers: number;
    subscriptions: number;
    payments: number;
    webhooks: number;
  } {
    return {
      customers: this.customers.size,
      subscriptions: this.subscriptions.size,
      payments: this.payments.size,
      webhooks: this.webhookEvents.length
    };
  }
}