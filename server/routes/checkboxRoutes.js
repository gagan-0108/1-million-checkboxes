import { Router } from 'express';
import { getCheckboxPage, getStats, getTotalCheckboxes } from '../services/checkboxService.js';
import { createHttpRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply rate limiting to checkbox API routes
const apiLimiter = createHttpRateLimiter({
  windowMs: 60 * 1000,    // 1 minute window
  maxRequests: 60,         // 60 requests per minute
  keyPrefix: 'rl:api',
});

router.use(apiLimiter);

/**
 * GET /api/checkboxes?page=0&size=10000
 * Returns a page of checkbox states.
 * Default page size is 10,000 checkboxes.
 */
router.get('/checkboxes', async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page) || 0);
    const size = Math.min(50000, Math.max(1, parseInt(req.query.size) || 10000));
    const offset = page * size;
    const total = getTotalCheckboxes();

    if (offset >= total) {
      return res.json({
        checkboxes: [],
        page,
        size,
        totalPages: Math.ceil(total / size),
        totalCheckboxes: total,
      });
    }

    const states = await getCheckboxPage(offset, size);

    res.json({
      checkboxes: Array.from(states),
      page,
      size,
      offset,
      totalPages: Math.ceil(total / size),
      totalCheckboxes: total,
    });
  } catch (err) {
    console.error('[API] Error fetching checkboxes:', err.message);
    res.status(500).json({ error: 'Failed to fetch checkbox states' });
  }
});

/**
 * GET /api/stats
 * Returns global statistics: total checked, total checkboxes, connected users.
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();

    res.json({
      ...stats,
      percentChecked: ((stats.totalChecked / stats.totalCheckboxes) * 100).toFixed(2),
    });
  } catch (err) {
    console.error('[API] Error fetching stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/health
 * Health check endpoint.
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
