import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  Clock,
  WifiOff,
  CheckCircle2,
  Flame,
  Waves,
  Mountain,
  Car,
  LifeBuoy,
  Gauge,
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';

// Incident status ladder -- INTEGRATION-CONTRACT.md section 3, monotonic
// (a status can only ever move forward, enforced server-side in
// backend/app/incident_status.py).
const STATUS_LADDER = [
  { id: 'sos_triggered', label: 'SOS Triggered' },
  { id: 'alert_sent', label: 'Alert Sent to Nearby Responders' },
  { id: 'responder_accepted', label: 'Responder Accepted' },
  { id: 'on_the_way', label: 'Responder On The Way' },
  { id: 'assessed', label: 'Situation Assessed' },
  { id: 'coordinated', label: 'Help Coordinated' },
  { id: 'resolved', label: 'Resolved' },
];
const STATUS_ORDER = STATUS_LADDER.map((s) => s.id);

const CATEGORY_ICON = {
  fire: Flame,
  flood: Waves,
  earthquake: Mountain,
  accident: Car,
  rescue: LifeBuoy,
};

/**
 * Live incident tracker for a critical/SOS request. Subscribes to the
 * incident's own WS channel and renders the full status ladder, priority,
 * request_count ("N reports from this location"), the responder's
 * assessment once submitted, and a distinct offline-queued state.
 *
 * Props:
 *   result   -- exactly what SosButton's onSosSent(result) received:
 *                 online:  { request, incident }
 *                 offline: { offline: true, payload }
 *               Pass the SAME state variable you update from onSosSent --
 *               if a queued SOS syncs later, SosButton calls onSosSent
 *               again with the real { request, incident }, and this
 *               component will transition itself from the offline state
 *               to the live tracker as soon as the parent re-renders it
 *               with the new `result`.
 *   onBack   -- optional; renders a "New Emergency SOS" back button.
 */
export default function SosStatusView({ result, onBack }) {
  const initialIncident = result?.incident ?? null;
  const [incident, setIncident] = useState(initialIncident);
  const [loadError, setLoadError] = useState(null);
  const offline = !!result?.offline && !incident;

  // If we were only handed an incident id without the full row (shouldn't
  // normally happen -- SosButton always passes the full POST /sos body --
  // but stay defensive), or if `result` swaps to a different incident,
  // sync local state.
  useEffect(() => {
    setIncident(result?.incident ?? null);
  }, [result?.incident?.id]);

  // Fetch the current incident once on mount too (not just rely on the
  // POST /sos response) -- covers the case where this view is mounted from
  // a page reload with only an incident id persisted, and guarantees we
  // have the latest state even if a WS event was missed.
  useEffect(() => {
    const id = result?.incident?.id;
    if (!id) return;
    let cancelled = false;
    api.getIncident(id)
      .then((row) => { if (!cancelled) setIncident((prev) => ({ ...prev, ...row })); })
      .catch((err) => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.incident?.id]);

  useEffect(() => {
    const id = incident?.id;
    if (!id) return;
    const ws = new CrisisWebSocketClient('incident', id, (frame) => {
      if (frame.event === 'incident_update' && frame.data) {
        setIncident((prev) => ({ ...prev, ...frame.data }));
      }
    });
    return () => ws.close();
  }, [incident?.id]);

  const BackLink = onBack ? (
    <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-[#475569] mb-4 hover:text-[#0F172A] transition cursor-pointer">
      <ArrowLeft className="w-4 h-4" /> New Emergency SOS
    </button>
  ) : null;

  // --- Distinct "SOS queued offline" state -----------------------------
  if (offline) {
    const category = result?.payload?.category;
    const Icon = CATEGORY_ICON[category] || LifeBuoy;
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        {BackLink}
        <div className="p-6 rounded-3xl bg-[#450A0A] border-2 border-[#DC2626] text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
            <WifiOff className="w-7 h-7 text-[#FCA5A5]" />
          </div>
          <h2 className="text-white font-black text-xl mb-1 flex items-center justify-center gap-2">
            <Icon className="w-5 h-5 text-[#FCA5A5]" />
            SOS Queued Offline
          </h2>
          <p className="text-[#FCA5A5] text-sm font-medium leading-relaxed">
            No connection right now. Your emergency alert is saved on this device and will
            be sent automatically the moment you're back online -- you don't need to do
            anything or resubmit.
          </p>
          {result?.payload?.client_created_at && (
            <p className="text-[10px] font-mono text-red-200/70 mt-3">
              Triggered at {new Date(result.payload.client_created_at).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4 text-center text-sm text-[#64748B]">
        {BackLink}
        {loadError ? `Could not load incident: ${loadError}` : 'Loading incident status...'}
      </div>
    );
  }

  const idx = STATUS_ORDER.indexOf(incident.status);
  const CategoryIcon = CATEGORY_ICON[incident.category] || LifeBuoy;

  return (
    <div className="max-w-xl mx-auto py-6 px-4">
      {BackLink}

      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#991B1B] border-4 border-white/20 shadow-xl mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <CategoryIcon className="w-5 h-5 text-white" />
            </div>
            <div className="text-white font-black text-xl uppercase tracking-tight">
              {incident.category}
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-black uppercase tracking-wide">
            <Gauge className="w-3.5 h-3.5" />
            Priority {incident.priority}
          </div>
        </div>
        <div className="text-red-100 text-sm font-bold">
          {STATUS_LADDER[idx]?.label || incident.status}
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        {STATUS_LADDER.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div
              key={s.id}
              className={`text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 transition ${
                current
                  ? 'bg-[#DC2626]/10 text-[#991B1B] ring-1 ring-[#DC2626]/30'
                  : done
                  ? 'bg-[#16A34A]/15 text-[#15803D]'
                  : 'bg-[#F1F5F9] text-[#94A3B8]'
              }`}
            >
              {done ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : (
                <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 ${current ? 'border-[#DC2626] animate-pulse' : 'border-[#CBD5E1]'}`} />
              )}
              {s.label}
            </div>
          );
        })}
      </div>

      {incident.request_count > 1 ? (
        <div className="flex items-center gap-2 text-xs font-bold text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] px-3 py-2 rounded-xl mb-3">
          <Users className="w-4 h-4 flex-shrink-0" />
          {incident.request_count} reports from this location -- treated as one incident
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] bg-[#F1F5F9] px-3 py-2 rounded-xl mb-3">
          <Users className="w-4 h-4 flex-shrink-0" />
          1 report from this location so far
        </div>
      )}

      {incident.assessment && (
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm text-xs space-y-1.5 mb-3">
          <div className="font-black text-[#0F172A] mb-1">Responder's on-scene assessment</div>
          {incident.assessment.people_affected != null && (
            <div className="flex justify-between"><span className="text-[#64748B]">People affected</span><span className="font-bold text-[#0F172A]">{incident.assessment.people_affected}</span></div>
          )}
          {incident.assessment.injuries != null && (
            <div className="flex justify-between"><span className="text-[#64748B]">Injuries</span><span className="font-bold text-[#0F172A]">{incident.assessment.injuries}</span></div>
          )}
          {incident.assessment.trapped != null && (
            <div className="flex justify-between"><span className="text-[#64748B]">Trapped</span><span className="font-bold text-[#0F172A]">{incident.assessment.trapped}</span></div>
          )}
          {[
            ['medical_assistance_required', 'Medical assistance needed'],
            ['rescue_required', 'Rescue team needed'],
            ['ambulance_required', 'Ambulance needed'],
            ['food_water_required', 'Food/water needed'],
          ].filter(([k]) => incident.assessment[k]).map(([k, label]) => (
            <div key={k} className="text-[#991B1B] font-bold">&bull; {label}</div>
          ))}
          {incident.assessment.other_resources && (
            <div><span className="text-[#64748B]">Other resources: </span>{incident.assessment.other_resources}</div>
          )}
          {incident.assessment.notes && (
            <div className="pt-1 border-t border-[#F1F5F9] mt-1.5">{incident.assessment.notes}</div>
          )}
        </div>
      )}

      {incident.coordinating_orgs?.length > 0 && (
        <div className="text-xs text-[#475569] font-semibold mb-3">
          Coordinating: {incident.coordinating_orgs.join(', ')}
        </div>
      )}

      <div className="text-[11px] text-[#94A3B8] flex items-center gap-1">
        <Clock className="w-3 h-3" /> Incident ID: {incident.id?.substring(0, 8)}...
      </div>
    </div>
  );
}
