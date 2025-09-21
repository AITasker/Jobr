// PayPal integration with graceful fallback for development
import {
  Client,
  Environment,
  LogLevel,
  OAuthAuthorizationController,
  OrdersController,
} from "@paypal/paypal-server-sdk";
import { Request, Response } from "express";

/* PayPal Controllers Setup */

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

// Development mode detection
const isDevelopment = process.env.NODE_ENV === 'development';
const hasPayPalCredentials = PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET;

if (!hasPayPalCredentials && !isDevelopment) {
  throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in production");
}

// Log PayPal status
if (hasPayPalCredentials) {
  console.log('PayPal initialized with real credentials');
} else {
  console.log('PayPal running in mock mode - set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET for real payments');
}
// Initialize PayPal client only if credentials are available
let client: Client | null = null;
let ordersController: OrdersController | null = null;
let oAuthAuthorizationController: OAuthAuthorizationController | null = null;

if (hasPayPalCredentials) {
  client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: PAYPAL_CLIENT_ID!,
      oAuthClientSecret: PAYPAL_CLIENT_SECRET!,
    },
    timeout: 0,
    environment:
                  process.env.NODE_ENV === "production"
                    ? Environment.Production
                    : Environment.Sandbox,
    logging: {
      logLevel: process.env.NODE_ENV === "production" ? LogLevel.Error : LogLevel.Warn,
      logRequest: {
        logBody: false, // Never log request bodies - security risk
      },
      logResponse: {
        logHeaders: false, // Never log response headers - security risk
      },
    },
  });
  ordersController = new OrdersController(client);
  oAuthAuthorizationController = new OAuthAuthorizationController(client);
}

/* Token generation helpers */

export async function getClientToken() {
  if (!hasPayPalCredentials) {
    console.log('PayPal: Returning mock client token (credentials not configured)');
    return 'mock_client_token_for_development';
  }

  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");

  const { result } = await oAuthAuthorizationController!.requestToken(
    {
      authorization: `Basic ${auth}`,
    },
    { intent: "sdk_init", response_type: "client_token" },
  );

  return result.accessToken;
}

/*  Process transactions */

export async function createPaypalOrder(req: Request, res: Response) {
  try {
    const { plan, amount, currency, intent } = req.body;

    // Server-authoritative pricing - prefer plan-based pricing for security
    const planPricing: { [key: string]: { amount: string; currency: string } } = {
      'Premium': { amount: '499.00', currency: 'INR' },
      'Pro': { amount: '999.00', currency: 'INR' }
    };

    let finalAmount: string;
    let finalCurrency: string;
    let finalIntent: string;

    if (plan && planPricing[plan]) {
      // New secure method: use server-authoritative pricing
      finalAmount = planPricing[plan].amount;
      finalCurrency = planPricing[plan].currency;
      finalIntent = 'capture';
    } else if (amount && currency && intent) {
      // Legacy method: validate client values against allowed amounts
      const allowedAmounts = ['499', '499.00', '999', '999.00'];
      const allowedCurrency = 'INR';
      
      if (!allowedAmounts.includes(amount) || currency !== allowedCurrency) {
        return res
          .status(400)
          .json({ error: "Invalid payment amount or currency. Only Premium (₹499) and Pro (₹999) plans are allowed." });
      }
      
      finalAmount = parseFloat(amount).toFixed(2);
      finalCurrency = currency;
      finalIntent = intent;
    } else {
      return res
        .status(400)
        .json({ error: "Invalid request. Provide either 'plan' (Premium/Pro) or valid 'amount', 'currency', and 'intent'." });
    }

    // Mock response when PayPal credentials are not configured
    if (!hasPayPalCredentials) {
      console.log(`PayPal: Mock order created - Amount: ${finalAmount} ${finalCurrency}`);
      const mockOrderResponse = {
        id: `mock_order_${Date.now()}`,
        status: "CREATED",
        links: [{
          href: "https://mock-paypal-checkout.local",
          rel: "approve",
          method: "GET"
        }]
      };
      return res.status(201).json(mockOrderResponse);
    }

    const collect = {
      body: {
        intent: finalIntent,
        purchaseUnits: [
          {
            amount: {
              currencyCode: finalCurrency,
              value: finalAmount,
            },
          },
        ],
      },
      prefer: "return=minimal",
    };

    const { body, ...httpResponse } =
          await ordersController!.createOrder(collect);

    const jsonResponse = JSON.parse(String(body));
    const httpStatusCode = httpResponse.statusCode;

    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
}

export async function capturePaypalOrder(req: Request, res: Response) {
  try {
    const { orderID } = req.params;

    // Mock response when PayPal credentials are not configured
    if (!hasPayPalCredentials) {
      console.log(`PayPal: Mock order captured - OrderID: ${orderID}`);
      // Use realistic mock response with INR currency
      const mockCaptureResponse = {
        id: orderID,
        status: "COMPLETED",
        payer: {
          email_address: "mock_user@example.com",
          payer_id: "mock_payer_id"
        },
        purchase_units: [{
          payments: {
            captures: [{
              id: `mock_capture_${Date.now()}`,
              status: "COMPLETED",
              amount: {
                currency_code: "INR",
                value: "499.00" // Default to Premium price for mock
              }
            }]
          }
        }]
      };
      return res.status(201).json(mockCaptureResponse);
    }

    const collect = {
      id: orderID,
      prefer: "return=minimal",
    };

    const { body, ...httpResponse } =
          await ordersController!.captureOrder(collect);

    const jsonResponse = JSON.parse(String(body));
    const httpStatusCode = httpResponse.statusCode;

    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
}

export async function loadPaypalDefault(req: Request, res: Response) {
  const clientToken = await getClientToken();
  res.json({
    clientToken,
  });
}