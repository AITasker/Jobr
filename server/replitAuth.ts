import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // SECURITY: Validate SESSION_SECRET exists and meets minimum security requirements
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required for session security");
  }
  
  // SECURITY: Validate SESSION_SECRET strength for production
  if (process.env.NODE_ENV === 'production' && process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters for production security");
  }
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      // For faster logout, redirect immediately to homepage
      // The OIDC provider session will naturally expire
      res.redirect("/");
    });
  });

  // Optional: Background OIDC logout endpoint for complete cleanup
  app.get("/api/logout/complete", (req, res) => {
    res.redirect(
      client.buildEndSessionUrl(config, {
        client_id: process.env.REPL_ID!,
        post_logout_redirect_uri: `${req.protocol}://${req.hostname}/`,
      }).href
    );
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Import JWT utilities dynamically to avoid circular dependencies
  const { JwtUtils } = await import('./jwtUtils');
  const { storage } = await import('./storage');
  const { AuthLogger } = await import('./utils/errorHandler');

  // First, try JWT authentication from cookies
  const jwtPayload = JwtUtils.getPayloadFromRequest(req);
  if (jwtPayload && !JwtUtils.isTokenExpired(jwtPayload)) {
    try {
      // Get user data for JWT authentication
      const user = await storage.getUser(jwtPayload.userId);
      if (user) {
        // Check if token needs refresh and add header hint
        if (JwtUtils.needsRefresh(jwtPayload)) {
          res.setHeader('X-Token-Refresh-Suggested', 'true');
          res.setHeader('X-Token-Expires-In', JwtUtils.getTimeUntilExpiry(jwtPayload).toString());
        }

        // Add user info to request for compatibility with existing code
        req.user = {
          claims: {
            sub: user.id,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            profile_image_url: user.profileImageUrl
          },
          authMethod: 'jwt',
          tokenPayload: jwtPayload
        };
        return next();
      }
    } catch (error) {
      console.error('JWT authentication error:', error);
      AuthLogger.logAuthEvent({
        userId: jwtPayload?.userId,
        email: jwtPayload?.email,
        method: 'replit',
        action: 'refresh',
        success: false,
        errorCode: 'JWT_AUTH_ERROR',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      // Fall through to try Replit auth
    }
  }

  // Fallback to existing Replit session authentication
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    // Log failed authentication attempt
    AuthLogger.logAuthEvent({
      method: 'replit',
      action: 'failed_attempt',
      success: false,
      errorCode: 'UNAUTHORIZED',
      ip: req.ip || req.connection?.remoteAddress
    });
    return res.status(401).json({ 
      message: "Unauthorized",
      code: "UNAUTHORIZED"
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    // Mark as Replit auth for any code that needs to distinguish
    user.authMethod = 'replit';
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    user.authMethod = 'replit';
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};