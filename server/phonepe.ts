import type { Request, Response } from "express";
import { storage } from "./storage";
import crypto from "crypto";

// PhonePe Configuration
interface PhonePeConfig {
  merchantId: string;
  saltKey: string;
  saltIndex: number;
  baseUrl: string;
}

// Initialize PhonePe configuration
let phonePeConfig: PhonePeConfig | null = null;

// Initialize PhonePe with environment variables, using test defaults for development
phonePeConfig = {
  merchantId: process.env.PHONEPE_MERCHANT_ID || "PGTESTPAYUAT86",
  saltKey: process.env.PHONEPE_SALT_KEY || "96434309-7796-489d-8924-ab56988a6076",
  saltIndex: parseInt(process.env.PHONEPE_SALT_INDEX || "1"),
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api.phonepe.com/apis/hermes' 
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox'
};

if (process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY) {
  console.log('PhonePe initialized with environment credentials');
} else {
  console.log('PhonePe initialized with test credentials (set PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY for production)');
}

// Price mappings for plans (in paise - 1 rupee = 100 paise)
export const PHONEPE_PRICE_MAPPINGS: Record<string, number> = {
  "Premium": 99900, // ₹999 for Premium plan
};

// Helper function to calculate discounted price
export function calculateDiscountedPrice(originalPrice: number, discountType: string, discountValue: number): number {
  if (discountType === 'fixed') {
    // Discount value is in rupees, convert to paise
    const discountInPaise = discountValue * 100;
    return Math.max(0, originalPrice - discountInPaise);
  } else if (discountType === 'percentage') {
    const discountAmount = Math.floor((originalPrice * discountValue) / 100);
    return Math.max(0, originalPrice - discountAmount);
  }
  return originalPrice;
}

interface PaymentRequest {
  merchantTransactionId: string;
  merchantUserId: string;
  amount: number; // in paise
  redirectUrl: string;
  callbackUrl: string;
  mobileNumber?: string;
}

interface PaymentResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    instrumentResponse: {
      type: string;
      redirectInfo: {
        url: string;
        method: string;
      };
    };
  };
}

export class PhonePeService {
  // Test mode detection
  static isTestMode(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true';
  }

  /**
   * Generate checksum for PhonePe API requests
   */
  private static generateChecksum(payload: string, endpoint: string): string {
    if (!phonePeConfig) {
      throw new Error('PhonePe not configured');
    }
    
    const string = payload + endpoint + phonePeConfig.saltKey;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    return sha256 + '###' + phonePeConfig.saltIndex;
  }

  /**
   * Create payment request
   */
  static async createPayment(
    userId: string, 
    plan: string, 
    userEmail: string,
    redirectUrl: string
  ): Promise<PaymentResponse> {
    try {
      // Use mock service in test mode
      if (this.isTestMode()) {
        console.log('💳 PhonePe Service: Using mock payment creation in test mode');
        return {
          success: true,
          code: 'PAYMENT_INITIATED',
          message: 'Payment initiated via mock service',
          data: {
            merchantId: 'MOCK_MERCHANT',
            merchantTransactionId: `MOCK_${userId.replace(/-/g, '').substring(0, 8)}_${Date.now()}`.substring(0, 38),
            instrumentResponse: {
              type: 'PAY_PAGE',
              redirectInfo: {
                url: 'https://mock-payment-page.test',
                method: 'GET'
              }
            }
          }
        };
      }

      if (!phonePeConfig) {
        throw new Error('PhonePe not configured');
      }

      // Get price for plan
      const amount = PHONEPE_PRICE_MAPPINGS[plan];
      if (!amount) {
        throw new Error(`Invalid plan: ${plan}`);
      }

      // PhonePe requires merchantTransactionId to be max 38 chars
      // Create a shorter unique ID using first 8 chars of userId + timestamp
      const shortUserId = userId.replace(/-/g, '').substring(0, 8);
      const merchantTransactionId = `TXN_${shortUserId}_${Date.now()}`.substring(0, 38);
      
      const paymentPayload = {
        merchantId: phonePeConfig.merchantId,
        merchantTransactionId,
        merchantUserId: userId,
        amount,
        redirectUrl,
        redirectMode: "POST",
        callbackUrl: `${process.env.APP_BASE_URL || process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/phonepe/webhook`,
        paymentInstrument: {
          type: "PAY_PAGE"
        }
      };

      // Base64 encode the payload
      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      
      // Generate checksum
      const checksum = this.generateChecksum(base64Payload, '/pg/v1/pay');

      // Make API request to PhonePe with timeout
      const response = await fetch(`${phonePeConfig.baseUrl}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum
        },
        body: JSON.stringify({
          request: base64Payload
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      // CRITICAL: Check response status and content type before parsing JSON
      console.log(`[PhonePe] Payment creation response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PhonePe] Payment creation failed: HTTP ${response.status} - ${errorText}`);
        throw new Error(`PhonePe API request failed: HTTP ${response.status} - ${response.statusText}`);
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error(`[PhonePe] Non-JSON response received: Content-Type=${contentType}, Body=${responseText}`);
        throw new Error(`PhonePe API returned non-JSON response: ${contentType}`);
      }

      // Handle potentially empty JSON response
      const responseText = await response.text();
      if (!responseText.trim()) {
        console.error('[PhonePe] Empty response body received');
        throw new Error('PhonePe API returned empty response');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError) {
        console.error(`[PhonePe] JSON parsing failed: ${jsonError}. Response: ${responseText}`);
        throw new Error(`PhonePe API returned invalid JSON: ${jsonError}`);
      }

      // Store payment intent for tracking
      await storage.createStripeEvent({
        eventId: merchantTransactionId,
        eventType: 'payment.initiated',
        processed: false,
        metadata: {
          userId,
          plan,
          amount,
          email: userEmail,
          paymentPayload
        }
      });

      return result;
    } catch (error) {
      console.error('PhonePe payment creation failed:', error);
      throw error;
    }
  }

  /**
   * Check payment status
   */
  static async checkPaymentStatus(merchantTransactionId: string): Promise<any> {
    try {
      if (!phonePeConfig) {
        throw new Error('PhonePe not configured');
      }

      const endpoint = `/pg/v1/status/${phonePeConfig.merchantId}/${merchantTransactionId}`;
      const checksum = this.generateChecksum('', endpoint);

      const response = await fetch(`${phonePeConfig.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': phonePeConfig.merchantId
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      // CRITICAL: Check response status and content type before parsing JSON
      console.log(`[PhonePe] Status check response: ${response.status} ${response.statusText} for txn: ${merchantTransactionId}`);
      
      // For status checks, handle non-200 responses gracefully without throwing
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[PhonePe] Status check returned non-200: HTTP ${response.status} - ${errorText}`);
        // Return a structured error response instead of throwing
        return {
          success: false,
          code: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          httpStatus: response.status,
          responseBody: errorText
        };
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const responseText = await response.text();
        console.warn(`[PhonePe] Status check returned non-JSON: Content-Type=${contentType}, Body=${responseText}`);
        return {
          success: false,
          code: 'NON_JSON_RESPONSE',
          message: `Non-JSON response received: ${contentType}`,
          responseBody: responseText
        };
      }

      // Handle potentially empty JSON response
      const responseText = await response.text();
      if (!responseText.trim()) {
        console.warn('[PhonePe] Status check returned empty response');
        return {
          success: false,
          code: 'EMPTY_RESPONSE',
          message: 'Empty response body received'
        };
      }

      // Parse JSON with error handling
      try {
        const result = JSON.parse(responseText);
        console.log(`[PhonePe] Status check successful for txn: ${merchantTransactionId}`);
        return result;
      } catch (jsonError) {
        console.error(`[PhonePe] Status check JSON parsing failed: ${jsonError}. Response: ${responseText}`);
        return {
          success: false,
          code: 'JSON_PARSE_ERROR',
          message: `Invalid JSON response: ${jsonError}`,
          responseBody: responseText
        };
      }

    } catch (error) {
      console.error('PhonePe status check failed:', error);
      // Return structured error instead of throwing to prevent webhook failures
      return {
        success: false,
        code: 'REQUEST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error
      };
    }
  }

  /**
   * CRITICAL SECURITY: Verify payment status via API before any state changes
   * This is the primary defense against fake webhook attacks
   */
  private static async verifyPaymentStatusBeforeProcessing(
    merchantTransactionId: string, 
    expectedAmount: number,
    webhookAuthentic: boolean
  ): Promise<{
    isValid: boolean;
    reason?: string;
    verifiedState?: string;
    verifiedResponseCode?: string;
    verifiedAmount?: number;
  }> {
    try {
      console.log(`[SECURITY] Verifying payment status for transaction: ${merchantTransactionId}`);
      
      // Get payment status from PhonePe API (authoritative source)
      const statusResponse = await this.checkPaymentStatus(merchantTransactionId);
      
      if (!statusResponse.success) {
        return {
          isValid: false,
          reason: `PhonePe API returned error: ${statusResponse.message || 'Unknown error'}`
        };
      }

      const { data } = statusResponse;
      if (!data) {
        return {
          isValid: false,
          reason: 'No payment data returned from PhonePe API'
        };
      }

      const { 
        merchantTransactionId: verifiedTxnId,
        transactionId: verifiedTransactionId,
        amount: verifiedAmount,
        state: verifiedState,
        responseCode: verifiedResponseCode 
      } = data;

      // Validate transaction ID matches
      if (verifiedTxnId !== merchantTransactionId) {
        return {
          isValid: false,
          reason: `Transaction ID mismatch: webhook=${merchantTransactionId}, api=${verifiedTxnId}`
        };
      }

      // Validate amount matches (critical for financial security)
      if (verifiedAmount !== expectedAmount) {
        return {
          isValid: false,
          reason: `Amount mismatch: webhook=${expectedAmount}, api=${verifiedAmount}`
        };
      }

      // If webhook signature verification failed, require successful payment state
      if (!webhookAuthentic && !(verifiedState === 'COMPLETED' && verifiedResponseCode === 'SUCCESS')) {
        return {
          isValid: false,
          reason: 'Webhook signature invalid and payment not confirmed as successful by API'
        };
      }

      console.log(`[SECURITY] Payment verification successful: ${merchantTransactionId}`);
      
      return {
        isValid: true,
        verifiedState,
        verifiedResponseCode,
        verifiedAmount
      };
      
    } catch (error) {
      console.error('[SECURITY] Payment status verification failed:', error);
      return {
        isValid: false,
        reason: `Status verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Verify webhook authenticity using Basic Auth or X-VERIFY header
   */
  private static verifyWebhookSignature(req: Request): boolean {
    try {
      // Check for Basic Authentication (recommended approach)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        
        // Calculate expected hash using merchant credentials
        const expectedHash = crypto.createHash('sha256')
          .update(`${phonePeConfig?.merchantId}:${phonePeConfig?.saltKey}`)
          .digest('hex');
        
        const receivedHash = crypto.createHash('sha256')
          .update(`${username}:${password}`)
          .digest('hex');
        
        return expectedHash === receivedHash;
      }

      // Fallback: Check X-VERIFY header (less common for webhooks but possible)
      const xVerify = req.headers['x-verify'] as string;
      if (xVerify && phonePeConfig) {
        const payload = JSON.stringify(req.body);
        const expectedChecksum = this.generateChecksum(payload, '/api/phonepe/webhook');
        return xVerify === expectedChecksum;
      }

      // No authentication headers found
      return false;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Handle PhonePe webhook with comprehensive security verification
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      if (!phonePeConfig) {
        console.error('PhonePe webhook called but PhonePe not configured');
        res.status(503).json({ 
          message: "PhonePe not configured",
          code: "PHONEPE_NOT_CONFIGURED"
        });
        return;
      }

      const webhookPayload = req.body;
      console.log('PhonePe webhook received:', webhookPayload);

      // SECURITY: Verify webhook authenticity (first line of defense)
      const isWebhookAuthentic = this.verifyWebhookSignature(req);
      if (!isWebhookAuthentic) {
        console.warn('PhonePe webhook signature verification failed - potential spoofing attempt');
        // Still proceed but mark for mandatory status verification
      }

      const { merchantTransactionId, transactionId, amount, state, responseCode } = webhookPayload;

      // Check if we already processed this transaction
      const existingEvent = await storage.getStripeEventByEventId(merchantTransactionId);
      if (existingEvent?.processed) {
        console.log(`PhonePe transaction ${merchantTransactionId} already processed`);
        res.json({ received: true, status: 'already_processed' });
        return;
      }

      // SECURITY: ALWAYS verify payment status via API before processing (critical defense)
      // This protects against spoofed webhooks even if signature verification fails
      const statusVerification = await this.verifyPaymentStatusBeforeProcessing(
        merchantTransactionId, 
        amount, 
        isWebhookAuthentic
      );
      
      if (!statusVerification.isValid) {
        console.error(`Payment status verification failed: ${statusVerification.reason}`);
        res.status(400).json({ 
          error: 'Payment verification failed', 
          reason: statusVerification.reason,
          code: 'PAYMENT_VERIFICATION_FAILED'
        });
        return;
      }

      // Process the payment based on VERIFIED state
      if (statusVerification.verifiedState === 'COMPLETED' && statusVerification.verifiedResponseCode === 'SUCCESS') {
        await this.handleSuccessfulPayment(merchantTransactionId, transactionId, statusVerification.verifiedAmount || amount);
      } else {
        await this.handleFailedPayment(merchantTransactionId, statusVerification.verifiedState || state, statusVerification.verifiedResponseCode || responseCode);
      }

      // Mark event as processed
      await storage.markStripeEventProcessed(merchantTransactionId);

      res.json({ received: true, status: 'processed' });
    } catch (error) {
      console.error('PhonePe webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle successful payment
   */
  private static async handleSuccessfulPayment(
    merchantTransactionId: string, 
    transactionId: string, 
    amount: number
  ): Promise<void> {
    try {
      // Get the original payment request data
      const eventRecord = await storage.getStripeEventByEventId(merchantTransactionId);
      if (!eventRecord?.metadata) {
        throw new Error('Payment event not found');
      }

      const { userId, plan } = eventRecord.metadata as any;

      // Update user plan and subscription status
      await storage.updateUserPlan(
        userId,
        plan,
        'active',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      );

      // Create subscription record
      await storage.createSubscription({
        userId,
        stripeSubscriptionId: transactionId, // Use PhonePe transaction ID
        stripePriceId: plan,
        status: 'active',
        plan,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: null,
        cancelAtPeriodEnd: false,
        trialStart: null,
        trialEnd: null,
        metadata: {
          phonePeTransactionId: transactionId,
          merchantTransactionId,
          amount
        }
      });

      console.log(`Successfully processed PhonePe payment for user ${userId}, plan: ${plan}`);
    } catch (error) {
      console.error('Error processing successful payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  private static async handleFailedPayment(
    merchantTransactionId: string, 
    state: string, 
    responseCode: string
  ): Promise<void> {
    console.log(`PhonePe payment failed: ${merchantTransactionId}, state: ${state}, code: ${responseCode}`);
    
    // Optionally notify user or update records about failed payment
    const eventRecord = await storage.getStripeEventByEventId(merchantTransactionId);
    if (eventRecord?.metadata) {
      const { userId } = eventRecord.metadata as any;
      console.log(`Payment failed for user ${userId}`);
      // Could send email notification or update user record here
    }
  }
}

// Export configuration for use in routes
export { phonePeConfig };