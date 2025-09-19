/**
 * Mock PhonePe Service
 * Provides payment processing simulation for Indian payment gateway
 */
export class MockPhonePeService {
  private static isRunning = false;
  private static transactions: Map<string, any> = new Map();
  private static webhookEvents: Array<any> = [];

  /**
   * Start the mock service
   */
  static async start(): Promise<void> {
    console.log('💰 Starting PhonePe mock service...');
    
    this.interceptPhonePeRequests();
    this.isRunning = true;
    
    console.log('✅ PhonePe mock service active');
  }

  /**
   * Stop the mock service
   */
  static async stop(): Promise<void> {
    this.isRunning = false;
    this.transactions.clear();
    this.webhookEvents = [];
    console.log('🛑 PhonePe mock service stopped');
  }

  /**
   * Check if service is active
   */
  static isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Intercept PhonePe API requests
   */
  private static interceptPhonePeRequests(): void {
    const originalFetch = global.fetch;
    
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      // Intercept PhonePe API calls
      if (url.includes('api.phonepe.com') || url.includes('api-preprod.phonepe.com')) {
        return this.handlePhonePeMockRequest(url, init);
      }
      
      // Pass through other requests
      return originalFetch(input, init);
    };
  }

  /**
   * Handle mock PhonePe API requests
   */
  private static async handlePhonePeMockRequest(url: string, init?: RequestInit): Promise<Response> {
    console.log('💰 Intercepted PhonePe API request:', url);
    
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    const method = init?.method || 'GET';
    
    // Handle payment initiation
    if (url.includes('/pay') && method === 'POST') {
      const body = init?.body as string || '';
      let payload;
      
      try {
        // PhonePe sends base64 encoded payload
        const decodedPayload = Buffer.from(body, 'base64').toString();
        payload = JSON.parse(decodedPayload);
      } catch (error) {
        // Fallback for direct JSON
        try {
          payload = JSON.parse(body);
        } catch {
          payload = {};
        }
      }
      
      const merchantTransactionId = payload.merchantTransactionId || `txn_mock_${Math.random().toString(36).substr(2, 9)}`;
      const amount = payload.amount || 0;
      
      const transaction = {
        merchantId: payload.merchantId || 'PGTESTPAYUAT86',
        merchantTransactionId,
        transactionId: `T${Date.now()}`,
        amount,
        state: 'PENDING',
        responseCode: 'PAYMENT_INITIATED',
        paymentInstrument: {
          type: 'UPI'
        },
        createdAt: new Date().toISOString()
      };
      
      this.transactions.set(merchantTransactionId, transaction);
      
      // Simulate payment URL
      const paymentUrl = `https://mercury-t2.phonepe.com/transact?token=mock_${merchantTransactionId}`;
      
      // Schedule success/failure after random delay
      setTimeout(() => {
        this.simulateTransactionCompletion(merchantTransactionId, Math.random() > 0.1); // 90% success rate
      }, 2000 + Math.random() * 3000);
      
      return new Response(JSON.stringify({
        success: true,
        code: 'PAYMENT_INITIATED',
        message: 'Payment initiated successfully',
        data: {
          merchantId: transaction.merchantId,
          merchantTransactionId,
          instrumentResponse: {
            type: 'PAY_PAGE',
            redirectInfo: {
              url: paymentUrl,
              method: 'GET'
            }
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle payment status check
    if (url.includes('/status/') && method === 'GET') {
      const urlParts = url.split('/');
      const merchantTransactionId = urlParts[urlParts.length - 1];
      
      const transaction = this.transactions.get(merchantTransactionId);
      
      if (!transaction) {
        return new Response(JSON.stringify({
          success: false,
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        success: transaction.state === 'COMPLETED',
        code: transaction.responseCode,
        message: 'Transaction status retrieved successfully',
        data: {
          merchantId: transaction.merchantId,
          merchantTransactionId: transaction.merchantTransactionId,
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          state: transaction.state,
          responseCode: transaction.responseCode,
          paymentInstrument: transaction.paymentInstrument
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return error for unknown endpoints
    return new Response(JSON.stringify({
      success: false,
      code: 'INVALID_REQUEST',
      message: 'Mock PhonePe: Unknown endpoint'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Simulate transaction completion
   */
  private static simulateTransactionCompletion(merchantTransactionId: string, success: boolean): void {
    const transaction = this.transactions.get(merchantTransactionId);
    
    if (!transaction) return;
    
    if (success) {
      transaction.state = 'COMPLETED';
      transaction.responseCode = 'PAYMENT_SUCCESS';
      transaction.completedAt = new Date().toISOString();
      
      // Generate transaction ID
      transaction.transactionId = `T${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
      
      console.log(`💰 PhonePe payment completed successfully: ${merchantTransactionId}`);
    } else {
      transaction.state = 'FAILED';
      transaction.responseCode = 'PAYMENT_ERROR';
      transaction.error = 'Payment failed due to insufficient funds';
      transaction.failedAt = new Date().toISOString();
      
      console.log(`💰 PhonePe payment failed: ${merchantTransactionId}`);
    }
    
    this.transactions.set(merchantTransactionId, transaction);
    
    // Trigger webhook event
    this.triggerWebhook({
      merchantId: transaction.merchantId,
      merchantTransactionId: transaction.merchantTransactionId,
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      state: transaction.state,
      responseCode: transaction.responseCode,
      paymentInstrument: transaction.paymentInstrument,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger webhook event
   */
  private static triggerWebhook(event: any): void {
    this.webhookEvents.push(event);
    console.log(`💰 PhonePe webhook triggered: ${event.state} for ${event.merchantTransactionId}`);
  }

  /**
   * Get transaction by merchant transaction ID
   */
  static getTransaction(merchantTransactionId: string): any {
    return this.transactions.get(merchantTransactionId);
  }

  /**
   * Get all transactions
   */
  static getAllTransactions(): Array<any> {
    return Array.from(this.transactions.values());
  }

  /**
   * Get webhook events
   */
  static getWebhookEvents(): Array<any> {
    return [...this.webhookEvents];
  }

  /**
   * Force transaction success for testing
   */
  static forceTransactionSuccess(merchantTransactionId: string): void {
    this.simulateTransactionCompletion(merchantTransactionId, true);
  }

  /**
   * Force transaction failure for testing
   */
  static forceTransactionFailure(merchantTransactionId: string): void {
    this.simulateTransactionCompletion(merchantTransactionId, false);
  }

  /**
   * Simulate API failure
   */
  static simulateApiFailure(shouldFail = true): void {
    if (shouldFail) {
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input.toString();
        if (url.includes('api.phonepe.com') || url.includes('api-preprod.phonepe.com')) {
          return new Response(JSON.stringify({
            success: false,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'PhonePe service temporarily unavailable'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(input, init);
      };
    } else {
      // Reset to normal mock behavior
      this.interceptPhonePeRequests();
    }
  }

  /**
   * Clear all data
   */
  static clearAll(): void {
    this.transactions.clear();
    this.webhookEvents = [];
  }

  /**
   * Get service statistics
   */
  static getStats(): {
    totalTransactions: number;
    completedTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
    successRate: number;
  } {
    const transactions = Array.from(this.transactions.values());
    const completed = transactions.filter(t => t.state === 'COMPLETED').length;
    const failed = transactions.filter(t => t.state === 'FAILED').length;
    const pending = transactions.filter(t => t.state === 'PENDING').length;
    
    return {
      totalTransactions: transactions.length,
      completedTransactions: completed,
      failedTransactions: failed,
      pendingTransactions: pending,
      successRate: transactions.length > 0 ? (completed / transactions.length) * 100 : 0
    };
  }
}