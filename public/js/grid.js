/**
 * Virtual Scroll Grid for 1 Million Checkboxes
 *
 * Renders only the visible rows in the viewport.
 * Uses a spacer element to maintain correct scrollbar size.
 * Local state stored in a Uint8Array (1 byte per checkbox = 1MB).
 */

const TOTAL_CHECKBOXES = 1_000_000;
const COLS_PER_ROW = 50;           // Checkboxes per row
const ROW_HEIGHT = 24;             // px per row (22px cell + 2px gap)
const TOTAL_ROWS = Math.ceil(TOTAL_CHECKBOXES / COLS_PER_ROW);  // 20,000 rows
const BUFFER_ROWS = 10;            // Extra rows rendered above/below viewport
const PAGE_SIZE = 10_000;          // Checkboxes loaded per API request

// Local state for all checkbox values
const checkboxState = new Uint8Array(TOTAL_CHECKBOXES);
const loadedPages = new Set();     // Track which pages are loaded
let isReadOnly = true;             // Until authenticated

/**
 * Initialize the virtual-scroll grid.
 * @param {HTMLElement} viewport - The scrollable container
 * @param {HTMLElement} spacer - The tall spacer element
 * @param {HTMLElement} content - The positioned content container
 * @param {Function} onToggle - Callback when a checkbox is toggled: (index, checked) => void
 */
export function initGrid(viewport, spacer, content, onToggle) {
  // Set spacer height to represent all rows
  const totalHeight = TOTAL_ROWS * ROW_HEIGHT;
  spacer.style.height = `${totalHeight}px`;

  // Render initial visible rows
  renderVisibleRows(viewport, content, onToggle);

  // Scroll handler with requestAnimationFrame throttle
  let ticking = false;
  viewport.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        renderVisibleRows(viewport, content, onToggle);
        ticking = false;
      });
      ticking = true;
    }
  });
}

/**
 * Render only the rows visible in the viewport (+ buffer).
 */
function renderVisibleRows(viewport, content, onToggle) {
  const scrollTop = viewport.scrollTop;
  const viewportHeight = viewport.clientHeight;

  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endRow = Math.min(
    TOTAL_ROWS - 1,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS
  );

  // Position the content container
  content.style.transform = `translateY(${startRow * ROW_HEIGHT}px)`;

  // Check if we need to load more data
  const startIndex = startRow * COLS_PER_ROW;
  const endIndex = Math.min((endRow + 1) * COLS_PER_ROW, TOTAL_CHECKBOXES);
  loadRangeIfNeeded(startIndex, endIndex);

  // Build HTML for visible rows
  const fragment = document.createDocumentFragment();

  for (let row = startRow; row <= endRow; row++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'checkbox-row';

    const rowStart = row * COLS_PER_ROW;
    const rowEnd = Math.min(rowStart + COLS_PER_ROW, TOTAL_CHECKBOXES);

    for (let i = rowStart; i < rowEnd; i++) {
      const cell = document.createElement('div');
      cell.className = 'cb-cell';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checkboxState[i] === 1;
      input.dataset.index = i;
      input.disabled = isReadOnly;

      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const checked = e.target.checked;
        checkboxState[index] = checked ? 1 : 0;
        onToggle(index, checked);
      });

      cell.appendChild(input);
      rowDiv.appendChild(cell);
    }

    fragment.appendChild(rowDiv);
  }

  content.innerHTML = '';
  content.appendChild(fragment);
}

/**
 * Load checkbox state pages from the API if not already loaded.
 */
async function loadRangeIfNeeded(startIndex, endIndex) {
  const startPage = Math.floor(startIndex / PAGE_SIZE);
  const endPage = Math.floor(endIndex / PAGE_SIZE);

  for (let page = startPage; page <= endPage; page++) {
    if (loadedPages.has(page)) continue;
    loadedPages.add(page); // Mark as loading to prevent duplicate requests

    try {
      const response = await fetch(`/api/checkboxes?page=${page}&size=${PAGE_SIZE}`);
      const data = await response.json();

      if (data.checkboxes) {
        const offset = page * PAGE_SIZE;
        for (let i = 0; i < data.checkboxes.length; i++) {
          checkboxState[offset + i] = data.checkboxes[i];
        }
      }
    } catch (err) {
      console.error(`[Grid] Failed to load page ${page}:`, err);
      loadedPages.delete(page); // Allow retry
    }
  }
}

/**
 * Update a single checkbox in the local state (from server broadcast).
 * @param {number} index - Checkbox index
 * @param {boolean} checked - New state
 */
export function updateCheckbox(index, checked) {
  if (index >= 0 && index < TOTAL_CHECKBOXES) {
    checkboxState[index] = checked ? 1 : 0;

    // Update the DOM if the checkbox is currently rendered
    const input = document.querySelector(`input[data-index="${index}"]`);
    if (input) {
      input.checked = checked;
    }
  }
}

/**
 * Set whether the grid is read-only (unauthenticated) or interactive.
 * @param {boolean} readOnly
 */
export function setReadOnly(readOnly) {
  isReadOnly = readOnly;
  // Update all currently rendered checkboxes
  document.querySelectorAll('.cb-cell input[type="checkbox"]').forEach((input) => {
    input.disabled = readOnly;
  });
}

/**
 * Get local checkbox state at an index.
 */
export function getCheckboxState(index) {
  return checkboxState[index] === 1;
}

/**
 * Force re-render the currently visible rows.
 */
export function refreshGrid() {
  const viewport = document.getElementById('grid-viewport');
  const content = document.getElementById('grid-content');
  if (viewport && content) {
    // Trigger scroll handler
    viewport.dispatchEvent(new Event('scroll'));
  }
}

export default { initGrid, updateCheckbox, setReadOnly, getCheckboxState, refreshGrid };
