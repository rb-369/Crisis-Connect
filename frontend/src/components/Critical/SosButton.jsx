import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Waves,
  Mountain,
  Car,
  LifeBuoy,
  ShieldAlert,
  Radio,
  LocateFixed,
  AlertCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { getDeviceId } from '../../utils/device';
import { api } from '../../services/api';
import { queueSos, watchForReconnect } from '../../utils/offlineSos';

// docs/AGENT-FLOW.md section 2/2A -- the critical categories. Deliberately
// separate from the non-critical grid (WEB-NONCRITICAL's InstantReport):
// minimum interaction, no structured form, straight to POST /sos. "rescue"
// is the flowchart's "trapped".
const CRITICAL_CATEGORIES = [
  {
    id: 'fire',
    label: 'Fire',
    icon: Flame,
    iconColor: '#EA580C',
    bgColor: '#FFEDD5',
    borderColor: '#FED7AA',
    desc: 'Structure fire, gas leak, or explosion risk',
  },
  {
    id: 'flood',
    label: 'Flood',
    icon: Waves,
    iconColor: '#0369A1',
    bgColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    desc: 'Rising water, flash flood, or drowning risk',
  },
  {
    id: 'earthquake',
    label: 'Earthquake',
    icon: Mountain,
    iconColor: '#78350F',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
    desc: 'Building collapse or aftershock danger',
  },
  {
    id: 'accident',
    label: 'Accident',
    icon: Car,
    iconColor: '#4338CA',
    bgColor: '#E0E7FF',
    borderColor: '#C7D2FE',
    desc: 'Road accident, injury, or vehicle hazard',
  },
  {
    id: 'rescue',
    label: 'Trapped / Rescue',
    icon: LifeBuoy,
    iconColor: '#991B1B',
    bgColor: '#FEE2E2',
    borderColor: '#FECACA',
    desc: 'Trapped in floodwater or a collapsed structure',
  },
];

const MASTER_SOS_DETAILS =
  'MASTER EMERGENCY SOS TRIGGERED: requester did not specify a hazard type -- ' +
  'treat as highest-priority, unclassified life-critical emergency.';

// Mumbai fallback -- matches the rest of the app's demo coordinates when
// geolocation is denied/unavailable (desktop browsers, permission denied).
const FALLBACK_COORDS = { lat: 19.0760, lng: 72.8777 };

/**
 * Master red SOS button + 5-category critical picker. Mirrors dev-a's
 * InstantReport.jsx "MASTER EMERGENCY SOS" visual language (gradient red,
 * radar-ping, bold black type) -- see dev-a/frontend/src/components/
 * Requester/InstantReport.jsx. A real design pass (Figma) will replace
 * this later; keep to that same visual system in the meantime.
 *
 * Fires `onSosSent(result)` on every outcome:
 *   - online success:  result = { request, incident }        (POST /sos body)
 *   - offline queued:  result = { offline: true, payload }
 * `onSosSent` MAY be called a second time later for the same trigger: if a
 * queued SOS syncs after connectivity returns, this component re-fires
 * onSosSent with the real { request, incident } once the backend has
 * accepted it -- callers should just overwrite their previous result with
 * whatever they most recently received (see components/Critical/__verify.md).
 */
export default function SosButton({ onSosSent }) {
  const [coords, setCoords] = useState(FALLBACK_COORDS);
  const [gpsStatus, setGpsStatus] = useState('detecting'); // detecting | acquired | denied
  const [busy, setBusy] = useState(false);
  const [busyCategory, setBusyCategory] = useState(null);
  const [error, setError] = useState(null);

  // The most recently queued-offline item, kept so we can recognize it in
  // a later flushQueue() result and promote the UI from "queued" to "sent".
  const pendingRef = useRef(null);

  // Capture GPS immediately on mount -- do not wait for a tap. A person
  // mid-emergency needs the location locked in *before* they decide which
  // button to press, not after.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsStatus('acquired');
      },
      (err) => {
        console.warn('[SosButton] geolocation denied/failed:', err.message);
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }, []);

  // Catch up on any SOS that synced while this component (or a previous
  // page load) was offline. Fires once on mount and again on every
  // 'online' event -- see utils/offlineSos.js.
  useEffect(() => {
    const stop = watchForReconnect((flushResult) => {
      const pending = pendingRef.current;
      if (!pending) return;
      const match = flushResult.results.find(
        (r) => !r.error
          && r.item.client_created_at === pending.client_created_at
          && r.item.requester_device_id === pending.requester_device_id,
      );
      if (match) {
        pendingRef.current = null;
        setBusy(false);
        setBusyCategory(null);
        setError(null);
        onSosSent && onSosSent(match.response);
      }
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dial112 = () => {
    // Real mechanism (tel: URI), attempted regardless of what the network
    // call below does -- calling 112 must never depend on this app's own
    // backend being reachable. On a desktop browser with no telephony
    // stack this is a silent no-op (there is no dialer to hand off to);
    // on a phone it opens the native dialer pre-filled with 112.
    try {
      window.location.href = 'tel:112';
    } catch (_) {/* no telephony available on this device */}
  };

  const trigger = async (category, { isMaster = false } = {}) => {
    setBusy(true);
    setBusyCategory(category);
    setError(null);

    dial112();

    const payload = {
      category,
      lat: coords.lat,
      lng: coords.lng,
      requester_device_id: getDeviceId(),
      ...(isMaster ? { details: MASTER_SOS_DETAILS } : {}),
    };

    if (!navigator.onLine) {
      const queued = queueSos(payload);
      pendingRef.current = queued;
      setBusy(false);
      onSosSent && onSosSent({ offline: true, payload: queued });
      return;
    }

    try {
      const result = await api.createSos(payload);
      setBusy(false);
      setBusyCategory(null);
      onSosSent && onSosSent(result);
    } catch (err) {
      // Network claimed to be up but the call failed anyway (flaky
      // connection, server hiccup mid-disaster) -- queue it rather than
      // losing it. Same offline path, different trigger.
      console.error('[SosButton] POST /sos failed, queuing offline:', err);
      const queued = queueSos(payload);
      pendingRef.current = queued;
      setBusy(false);
      setError('Could not reach the server -- your SOS is saved and will send automatically the moment connectivity returns.');
      onSosSent && onSosSent({ offline: true, payload: queued });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* =====================================================================
          MASTER EMERGENCY SOS -- highest priority, single tap, category
          defaults to 'rescue' (matches dev-a's master-SOS behavior: assume
          the worst-case life-critical scenario when the requester hasn't
          told us which hazard this is).
         ===================================================================== */}
      <button
        disabled={busy}
        onClick={() => trigger('rescue', { isMaster: true })}
        className="w-full relative overflow-hidden group rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#991B1B] text-white shadow-2xl hover:shadow-red-600/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 border-4 border-white/20 text-left cursor-pointer disabled:opacity-80 disabled:cursor-wait"
      >
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-2xl group-hover:scale-150 transition duration-500" />
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center animate-ping-slow">
            <ShieldAlert className="w-12 h-12 text-white" />
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="flex items-center space-x-2.5 mb-2">
            <span className="px-3 py-1 rounded-full bg-white text-[#DC2626] font-black text-xs uppercase tracking-widest flex items-center space-x-1.5 shadow-md">
              <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
              <span>Life-Critical Priority</span>
            </span>
            <span className="text-xs font-mono text-red-100/90 font-bold hidden sm:inline">
              Zero Login &bull; 1-Tap Trigger
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-none text-white drop-shadow-sm">
            EMERGENCY SOS
          </h1>

          <p className="text-xs sm:text-sm text-red-100 font-semibold mt-2 leading-relaxed max-w-md">
            Tap for immediate rescue. Attempts to dial 112 and broadcasts your live GPS
            coordinates directly to all nearby emergency response teams and NGOs.
          </p>

          <div className="mt-4 inline-flex items-center space-x-2 bg-black/25 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-xs font-black uppercase tracking-wider text-white group-hover:bg-white group-hover:text-[#DC2626] transition">
            {busy && busyCategory === 'rescue' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Dispatching Distress Beacon...</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Broadcast Master Distress Beacon Now &rarr;</span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* GPS Location Signal Bar */}
      <div className="mt-4 mb-6 p-4 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
          gpsStatus === 'acquired' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'
        }`}>
          <LocateFixed className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-xs sm:text-sm text-[#0F172A] flex items-center space-x-1.5">
            <span>
              {gpsStatus === 'acquired'
                ? 'Exact GPS Location Locked'
                : gpsStatus === 'detecting'
                ? 'Acquiring GPS Signal...'
                : 'GPS Unavailable (Using Fallback Coordinate Pin)'}
            </span>
            {gpsStatus === 'acquired' && (
              <span className="w-2 h-2 rounded-full bg-[#15803D] inline-block animate-ping-slow" />
            )}
          </div>
          <div className="text-xs font-mono text-[#64748B] truncate">
            Coordinates: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =====================================================================
          CRITICAL CATEGORY PICKER -- 1-tap dispatch per hazard type, no
          structured form (unlike the non-critical relief grid): a person
          mid-disaster does not fill out a modal. See backend/app/routers/
          sos.py's docstring for why this endpoint is minimum-interaction.
         ===================================================================== */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A] tracking-tight">
            Or Specify the Emergency Type
          </h2>
          <p className="text-xs text-[#64748B] font-medium">
            1-tap dispatch. Helps responders arrive prepared for the right hazard.
          </p>
        </div>
        <span className="text-[11px] font-mono text-[#64748B] font-bold">
          5 Critical Categories
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {CRITICAL_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isBusyHere = busy && busyCategory === cat.id;
          return (
            <button
              key={cat.id}
              disabled={busy}
              onClick={() => trigger(cat.id)}
              style={{ backgroundColor: cat.bgColor, borderColor: cat.borderColor }}
              className="group relative text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-150 shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between min-h-[125px] cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  style={{ backgroundColor: 'white', color: cat.iconColor }}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm border border-black/5 flex-shrink-0"
                >
                  {isBusyHere ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#DC2626] text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span>Critical 1-Tap</span>
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] group-hover:text-[#991B1B] transition">
                    {cat.label}
                  </h3>
                  <ChevronRight className="w-4 h-4 text-[#475569] group-hover:translate-x-1 transition" />
                </div>
                <p className="text-[11px] text-[#475569] mt-0.5 leading-snug font-medium line-clamp-2">
                  {cat.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {busy && (
        <div className="mt-6 p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm text-center flex items-center justify-center space-x-3 text-sm font-bold text-[#0F172A]">
          <div className="w-5 h-5 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
          <span>Dispatching emergency distress beacon...</span>
        </div>
      )}
    </div>
  );
}
