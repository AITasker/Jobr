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
      logLevel: LogLevel.Info,
      logRequest: {
        logBody: true,
      },
      logResponse: {
        logHeaders: true,
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
    const { amount, currency, intent } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res
        .status(400)
        .json({
          error: "Invalid amount. Amount must be a positive number.",
        });
    }

    if (!currency) {
      return res
        .status(400)
        .json({ error: "Invalid currency. Currency is required." });
    }

    if (!intent) {
      return res
        .status(400)
        .json({ error: "Invalid intent. Intent is required." });
    }

    // Mock response when PayPal credentials are not configured
    if (!hasPayPalCredentials) {
      console.log(`PayPal: Mock order created - Amount: ${amount} ${currency}`);
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
        intent: intent,
        purchaseUnits: [
          {
            amount: {
              currencyCode: currency,
              value: amount,
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
                currency_code: "USD",
                value: "10.00"
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