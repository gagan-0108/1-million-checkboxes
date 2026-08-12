import { verifyJWT } from './googleOAuth.js';

/**
 * Express middleware: Extracts and verifies JWT from cookie or Authorization header.
 * Attaches user to req.user if valid. Does NOT block — anonymous users pass through
 * with req.user = null (individual routes decide if auth is required).
 */
export function authMiddleware(req, res, next) {
  const token = req.cookies?.token || extractBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    req.user = null;
    return next();
  }

  req.user = decoded;
  next();
}

/**
 * Express middleware: Requires authentication.
 * Returns 401 if no valid user is attached.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to perform this action.',
    });
  }
  next();
}

/**
 * Socket.io middleware: Verifies JWT from handshake auth.
 * Attaches user to socket.data.user if valid.
 * Anonymous sockets are allowed but marked as unauthenticated.
 */
export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.cookie?.match(/token=([^;]+)/)?.[1];

  if (!token) {
    socket.data.user = null;
    socket.data.authenticated = false;
    return next();
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    socket.data.user = null;
    socket.data.authenticated = false;
    return next();
  }

  socket.data.user = decoded;
  socket.data.authenticated = true;
  next();
}

/**
 * Extract Bearer token from Authorization header.
 * @param {Object} req - Express request
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export default { authMiddleware, requireAuth, socketAuthMiddleware };
