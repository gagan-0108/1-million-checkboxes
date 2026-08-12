import { Router } from 'express';
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserProfile,
  generateJWT,
} from '../auth/googleOAuth.js';

const router = Router();

/**
 * GET /auth/google
 * Redirects user to Google OAuth 2.0 consent screen.
 */
router.get('/google', (req, res) => {
  const authUrl = getGoogleAuthUrl();
  res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Handles the OAuth callback from Google.
 * Exchanges authorization code for tokens, fetches profile, creates JWT.
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange code for access token
    const tokens = await exchangeCodeForTokens(code);

    // Fetch user profile from Google
    const profile = await getGoogleUserProfile(tokens.access_token);

    // Generate our own JWT
    const jwt = generateJWT({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    // Set JWT as httpOnly cookie
    res.cookie('token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect back to the app
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:7000';
    res.redirect(clientUrl);
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err.message);
    res.status(500).json({
      error: 'Authentication failed',
      message: err.message,
    });
  }
});

/**
 * GET /auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }

  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
    },
  });
});

/**
 * POST /auth/logout
 * Clears the auth cookie and logs the user out.
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
