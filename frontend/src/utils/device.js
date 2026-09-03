/**
 * Returns or generates a persistent device UUID for requester identification (no auth needed).
 */
export function getDeviceId() {
  const STORAGE_KEY = 'crisis_connect_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = 'dev-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}
