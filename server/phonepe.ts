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
  "Premium": 49900, // ₹499
  "Pro": 99900,     // ₹999
};

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
      if (!phonePeConfig) {
        throw new Error('PhonePe not configured');
      }

      // Get price for plan
      const amount = PHONEPE_PRICE_MAPPINGS[plan];
      if (!amount) {
        throw new Error(`Invalid plan: ${plan}`);
      }

      const merchantTransactionId = `TXN_${userId}_${Date.now()}`;
      
      const paymentPayload = {
        merchantId: phonePeConfig.merchantId,
        merchantTransactionId,
        merchantUserId: userId,
        amount,
        redirectUrl,
        redirectMode: "POST",
        callbackUrl: `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/phonepe/webhook`,
        paymentInstrument: {
          type: "PAY_PAGE"
        }
      };

      // Base64 encode the payload
      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      
      // Generate checksum
      const checksum = this.generateChecksum(base64Payload, '/pg/v1/pay');

      // Make API request to PhonePe
      const response = await fetch(`${phonePeConfig.baseUrl}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum
        },
        body: JSON.stringify({
          request: base64Payload
        })
      });

      const result = await response.json();

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
        }
      });

      return await response.json();
    } catch (error) {
      console.error('PhonePe status check failed:', error);
      throw error;
    }
  }

  /**
   * Handle PhonePe webhook
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

      // Verify webhook signature if available
      const xVerify = req.headers['x-verify'] as string;
      if (xVerify) {
        // TODO: Implement webhook signature verification
        // PhonePe webhook verification is optional but recommended
      }

      const { merchantTransactionId, transactionId, amount, state, responseCode } = webhookPayload;

      // Check if we already processed this transaction
      const existingEvent = await storage.getStripeEventByEventId(merchantTransactionId);
      if (existingEvent?.processed) {
        console.log(`PhonePe transaction ${merchantTransactionId} already processed`);
        res.json({ received: true, status: 'already_processed' });
        return;
      }

      // Process the payment based on state
      if (state === 'COMPLETED' && responseCode === 'SUCCESS') {
        await this.handleSuccessfulPayment(merchantTransactionId, transactionId, amount);
      } else {
        await this.handleFailedPayment(merchantTransactionId, state, responseCode);
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