/**
 * Persistent mock volunteer identity for the demo surfaces (VolunteerMock,
 * AdminMap's 1-tap accept). The backend's accept endpoint requires a real
 * `helper_id` -- there is no anonymous accept, by design (accountability for
 * people *providing* help, per the PRD). Since these are demo/simulator
 * surfaces standing in for a logged-in volunteer, this bootstraps one real
 * helper account through the actual mock-OTP flow the Flutter app uses, and
 * caches it -- so it behaves like a real (if synthetic) logged-in volunteer,
 * not a bypass of the accept contract.
 */
import { api } from '../services/api';

const STORAGE_KEY = 'crisis_connect_mock_helper';

export async function getMockHelper() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Deterministic-but-unique phone per browser so reloading doesn't spawn a
  // fresh helper account every time (request-otp upserts by phone).
  let seed = localStorage.getItem('crisis_connect_mock_helper_seed');
  if (!seed) {
    seed = Math.floor(1000000000 + Math.random() * 8999999999).toString();
    localStorage.setItem('crisis_connect_mock_helper_seed', seed);
  }
  const phone = `+91${seed}`;

  await api.requestOtp(phone, 'Volunteer Simulator');
  const { token, helper } = await api.verifyOtp(phone, '000000');
  const record = { token, helper };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

export async function getMockHelperId() {
  const { helper } = await getMockHelper();
  return helper.id;
}
