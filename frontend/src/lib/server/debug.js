const DEBUG_ENABLED = process.env.DEBUG_LOGS === 'true';

export function debugLog(label, data) {
  if (!DEBUG_ENABLED) {
    return;
  }

  if (data === undefined) {
    // eslint-disable-next-line no-console
    console.log(`[debug] ${label}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[debug] ${label}`, data);
  }
}
