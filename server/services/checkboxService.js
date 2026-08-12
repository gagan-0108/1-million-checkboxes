import { redis } from '../config/redis.js';

// Redis key for the checkbox bitmap
const BITMAP_KEY = 'cb:state';
const STATS_CACHE_KEY = 'cb:stats:checked';
const TOTAL_CHECKBOXES = parseInt(process.env.CHECKBOX_COUNT || '1000000');

/**
 * Get the state of a single checkbox by index.
 * Uses Redis GETBIT — O(1) operation.
 * @param {number} index - Checkbox index (0 to TOTAL_CHECKBOXES-1)
 * @returns {Promise<boolean>} - true if checked, false if unchecked
 */
export async function getCheckbox(index) {
  if (index < 0 || index >= TOTAL_CHECKBOXES) {
    throw new Error(`Checkbox index ${index} out of range [0, ${TOTAL_CHECKBOXES})`);
  }
  const bit = await redis.getbit(BITMAP_KEY, index);
  return bit === 1;
}

/**
 * Set the state of a single checkbox.
 * Uses Redis SETBIT — O(1) operation.
 * @param {number} index - Checkbox index
 * @param {boolean} checked - New state
 * @returns {Promise<number>} - Previous bit value
 */
export async function setCheckbox(index, checked) {
  if (index < 0 || index >= TOTAL_CHECKBOXES) {
    throw new Error(`Checkbox index ${index} out of range [0, ${TOTAL_CHECKBOXES})`);
  }
  const prev = await redis.setbit(BITMAP_KEY, index, checked ? 1 : 0);
  // Invalidate stats cache
  await redis.del(STATS_CACHE_KEY);
  return prev;
}

/**
 * Get a page of checkbox states.
 * Reads a byte range from the bitmap and unpacks individual bits.
 * @param {number} offset - Starting checkbox index
 * @param {number} count - Number of checkboxes to return
 * @returns {Promise<Uint8Array>} - Array of 0/1 values
 */
export async function getCheckboxPage(offset = 0, count = 10000) {
  // Clamp to valid range
  const start = Math.max(0, Math.min(offset, TOTAL_CHECKBOXES - 1));
  const end = Math.min(start + count, TOTAL_CHECKBOXES);
  const actualCount = end - start;

  // Calculate byte range we need to read
  const startByte = Math.floor(start / 8);
  const endByte = Math.ceil(end / 8);

  // Use GETRANGE to read the byte slice of the bitmap
  const buffer = await redis.getrangeBuffer(BITMAP_KEY, startByte, endByte - 1);

  // Unpack bits into an array
  const result = new Uint8Array(actualCount);
  for (let i = 0; i < actualCount; i++) {
    const globalBitIndex = start + i;
    const byteOffset = Math.floor(globalBitIndex / 8) - startByte;
    const bitOffset = 7 - (globalBitIndex % 8); // Redis uses big-endian bit ordering
    if (byteOffset >= 0 && byteOffset < buffer.length) {
      result[i] = (buffer[byteOffset] >> bitOffset) & 1;
    }
  }

  return result;
}

/**
 * Get global statistics for the checkbox grid.
 * Uses BITCOUNT for efficient counting.
 * @returns {Promise<{totalChecked: number, totalCheckboxes: number}>}
 */
export async function getStats() {
  // Check cache first (expires after 2 seconds)
  const cached = await redis.get(STATS_CACHE_KEY);
  if (cached !== null) {
    return {
      totalChecked: parseInt(cached),
      totalCheckboxes: TOTAL_CHECKBOXES,
    };
  }

  const totalChecked = await redis.bitcount(BITMAP_KEY);

  // Cache for 2 seconds to avoid hammering BITCOUNT on large bitmaps
  await redis.set(STATS_CACHE_KEY, totalChecked.toString(), 'EX', 2);

  return {
    totalChecked,
    totalCheckboxes: TOTAL_CHECKBOXES,
  };
}

/**
 * Get the total checkbox count configured.
 * @returns {number}
 */
export function getTotalCheckboxes() {
  return TOTAL_CHECKBOXES;
}

export default {
  getCheckbox,
  setCheckbox,
  getCheckboxPage,
  getStats,
  getTotalCheckboxes,
};
