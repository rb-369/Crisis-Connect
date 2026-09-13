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
  XCircle,
  AlertTriangle,
  Radio,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';

// Incident status ladder -- INTEGRATION-CONTRACT.md section 3, monotonic
const STATUS_LADDER = [
  { id: 'sos_triggered', label: 'SOS Triggered', desc: 'Distress beacon broadcasted via GPS' },
  { id: 'alert_sent', label: 'Alert Sent to Nearby Responders', desc: 'Notification pushed to volunteer mobile units' },
  { id: 'responder_accepted', label: 'Responder Accepted', desc: 'Emergency response team has claimed this mission' },
  { id: 'on_the_way', label: 'Responder On The Way', desc: 'Mobile unit is en route with rescue equipment' },
  { id: 'assessed', label: 'Situation Assessed', desc: 'On-scene triage report submitted' },
  { id: 'coordinated', label: 'Help Coordinated', desc: 'Multi-agency support in progress' },
  { id: 'resolved', label: 'Resolved', desc: 'All affected citizens safe & clear' },
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
 * Live incident tracker for a critical/SOS request.
 * Polished with Accidental Emergency Cancellation workflow so citizens can immediately
 * withdraw false alarms from the triage queue and crisis map.
 */
export default function SosStatusView({ result, onBack, onReturnHome, onCancelEmergency }) {
  const initialIncident = result?.incident ?? null;
  const [incident, setIncident] = useState(initialIncident);
  const [loadError, setLoadError] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState(null);
  const offline = !!result?.offline && !incident;

  const requestId = result?.id || result?.request?.id;

  useEffect(() => {
    setIncident(result?.incident ?? null);
  }, [result?.incident?.id]);

  useEffect(() => {
    const id = result?.incident?.id;
    if (!id) return;
    let cancelled = false;
    api.getIncident(id)
      .then((row) => { if (!cancelled) setIncident((prev) => ({ ...prev, ...row })); })
      .catch((err) => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
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

  const handleConfirmCancel = async (reason = 'Accidental trigger by user') => {
    setIsCancelling(true);
    try {
      if (onCancelEmergency) {
        await onCancelEmergency(requestId, reason);
      } else if (requestId) {
        await api.cancelRequest(requestId, reason);
      }
      setCancelSuccessMsg('Emergency alert has been cancelled and withdrawn from all responder queues.');
      setTimeout(() => {
        if (onReturnHome) onReturnHome();
        else if (onBack) onBack();
      }, 1200);
    } catch (err) {
      console.error('Cancellation error:', err);
      alert('Could not cancel on server: ' + err.message);
      setIsCancelling(false);
    }
  };

  const handleReturn = () => {
    if (onReturnHome) onReturnHome();
    else if (onBack) onBack();
  };

  // --- Distinct "SOS queued offline" state -----------------------------
  if (offline) {
    const category = result?.payload?.category;
    const Icon = CATEGORY_ICON[category] || LifeBuoy;
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <button
          onClick={handleReturn}
          className="flex items-center gap-1.5 text-xs font-bold text-[#475569] mb-4 hover:text-[#0F172A] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Safety Menu
        </button>

        <div className="p-6 rounded-3xl bg-[#450A0A] border-2 border-[#DC2626] text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
            <WifiOff className="w-7 h-7 text-[#FCA5A5]" />
          </div>
          <h2 className="text-white font-black text-xl mb-1 flex items-center justify-center gap-2">
            <Icon className="w-5 h-5 text-[#FCA5A5]" />
            SOS Queued Offline
          </h2>
          <p className="text-[#FCA5A5] text-sm font-medium leading-relaxed">
            No connection right now. Your emergency alert is saved on this device and will
            be sent automatically the moment you're back online.
          </p>
          {result?.payload?.client_created_at && (
            <p className="text-[10px] font-mono text-red-200/70 mt-3">
              Triggered at {new Date(result.payload.client_created_at).toLocaleTimeString()}
            </p>
          )}

          <div className="mt-6 pt-4 border-t border-red-900/60">
            <button
              onClick={() => handleConfirmCancel('Cancelled offline SOS')}
              className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 text-xs font-bold border border-red-700/50 transition cursor-pointer"
            >
              Cancel Offline Emergency Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4 text-center text-sm text-[#64748B]">
        <button
          onClick={handleReturn}
          className="flex items-center gap-1.5 text-xs font-bold text-[#475569] mb-4 hover:text-[#0F172A] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Safety Menu
        </button>
        <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
          <RefreshCw className="w-8 h-8 animate-spin text-red-600 mb-3" />
          <p className="font-bold text-slate-700">
            {loadError ? `Could not load incident: ${loadError}` : 'Connecting to live emergency dispatch channel...'}
          </p>
          {requestId && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            >
              Accidentally Pressed? Cancel Emergency
            </button>
          )}
        </div>
      </div>
    );
  }

  const idx = STATUS_ORDER.indexOf(incident.status);
  const CategoryIcon = CATEGORY_ICON[incident.category] || LifeBuoy;
  const progressPercent = Math.min(100, Math.round(((idx + 1) / STATUS_LADDER.length) * 100));

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-6 px-2 sm:px-4">
      
      {/* Top Bar: Return Link + Live Beacon Status + Accidental Cancel Button */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
        <button
          onClick={handleReturn}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Return to Menu</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-extrabold text-red-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>Emergency Active</span>
          </div>

          <button
            onClick={() => setIsCancelModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 text-xs font-extrabold transition shadow-xs flex items-center space-x-1 cursor-pointer"
            title="Cancel emergency if pressed by mistake"
          >
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <span>Cancel Emergency</span>
          </button>
        </div>
      </div>

      {/* Prominent Accidental Press Callout Banner */}
      <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-900 uppercase tracking-wide">
              Accidental Press or False Alarm?
            </div>
            <p className="text-xs text-amber-800 font-medium">
              Tap cancel below to immediately withdraw the alert and notify responders you are safe.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCancelModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-black shadow-xs transition flex items-center justify-center space-x-1.5 flex-shrink-0 cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Cancel Distress Call</span>
        </button>
      </div>

      {/* Hero Distress Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-[#DC2626] via-[#B91C1C] to-[#991B1B] text-white shadow-xl border-4 border-white/20 mb-5 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner">
                <CategoryIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-200">
                  Critical Emergency Beacon
                </span>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-xs">
                  {incident.category} Emergency
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider shadow-xs">
              <Gauge className="w-4 h-4 text-amber-300" />
              <span>Priority {incident.priority}</span>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-red-100">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Current Status: <strong className="text-white">{STATUS_LADDER[idx]?.label || incident.status}</strong></span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-300">
              {progressPercent}% Complete
            </span>
          </div>
        </div>
      </div>

      {/* Progress Timeline Stepper */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs mb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center justify-between">
          <span>Live Dispatch Progression Ladder</span>
          <span className="font-mono text-[11px] text-slate-400">Step {idx + 1} of {STATUS_LADDER.length}</span>
        </h3>

        <div className="space-y-2.5">
          {STATUS_LADDER.map((s, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <div
                key={s.id}
                className={`p-3 rounded-xl border transition-all ${
                  current
                    ? 'bg-red-50/70 border-red-300 ring-2 ring-red-500/20 shadow-xs'
                    : done
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50/60 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {done ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    ) : current ? (
                      <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${current ? 'text-red-950' : done ? 'text-emerald-950' : 'text-slate-600'}`}>
                        {s.label}
                      </span>
                      {current && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-600 text-white uppercase tracking-wider">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 font-medium ${current ? 'text-red-800' : done ? 'text-emerald-800' : 'text-slate-400'}`}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cluster Notice if multiple calls in area */}
      {incident.request_count > 1 ? (
        <div className="flex items-center gap-2.5 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-4 py-3 rounded-2xl mb-4 shadow-xs">
          <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Coordinated Incident Site:</strong> {incident.request_count} citizen reports clustered from this area. Multiple teams dispatched.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl mb-4">
          <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>1 emergency report registered for this specific GPS location.</span>
        </div>
      )}

      {/* Responder On-Scene Assessment Card */}
      {incident.assessment && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs space-y-2 mb-4">
          <div className="font-black text-slate-900 text-sm flex items-center space-x-1.5 border-b border-slate-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Responder's On-Scene Assessment Report</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {incident.assessment.people_affected != null && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Affected</div>
                <div className="font-black text-sm text-slate-900">{incident.assessment.people_affected}</div>
              </div>
            )}
            {incident.assessment.injuries != null && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200">
                <div className="text-[10px] text-red-600 font-bold uppercase">Injuries</div>
                <div className="font-black text-sm text-red-900">{incident.assessment.injuries}</div>
              </div>
            )}
            {incident.assessment.trapped != null && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] text-amber-600 font-bold uppercase">Trapped</div>
                <div className="font-black text-sm text-amber-900">{incident.assessment.trapped}</div>
              </div>
            )}
          </div>

          {[
            ['medical_assistance_required', 'Emergency medical assistance active'],
            ['rescue_required', 'Search & rescue team deployed'],
            ['ambulance_required', 'Ambulance transfer organized'],
            ['food_water_required', 'Emergency rations deployed'],
          ].filter(([k]) => incident.assessment[k]).map(([k, label]) => (
            <div key={k} className="text-red-700 font-bold flex items-center space-x-1.5 pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
              <span>{label}</span>
            </div>
          ))}

          {incident.assessment.other_resources && (
            <div className="pt-1 text-slate-700"><strong className="text-slate-900">Resources:</strong> {incident.assessment.other_resources}</div>
          )}
          {incident.assessment.notes && (
            <div className="pt-2 border-t border-slate-100 text-slate-600 italic">"{incident.assessment.notes}"</div>
          )}
        </div>
      )}

      {/* Coordinating Organizations */}
      {incident.coordinating_orgs?.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium mb-4 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>Coordinating Agencies: <strong>{incident.coordinating_orgs.join(', ')}</strong></span>
        </div>
      )}

      {/* Bottom Emergency Action Strip with Cancel Button */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Incident: {incident.id?.substring(0, 8)}...</span>
        </div>

        <button
          onClick={() => setIsCancelModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-300 hover:border-red-300 font-extrabold text-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
        >
          <XCircle className="w-4 h-4 text-red-500" />
          <span>Cancel Emergency (False Alarm)</span>
        </button>
      </div>

      {/* =========================================================================
          ACCIDENTAL EMERGENCY CANCELLATION CONFIRMATION MODAL
         ========================================================================= */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-black text-slate-900 text-center tracking-tight">
              Cancel Emergency Distress Call?
            </h3>

            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              If you triggered this emergency by accident or are no longer in danger, cancelling will:
            </p>

            <ul className="mt-3.5 space-y-2 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-xs text-slate-700 font-medium">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                <span>Withdraw your live GPS distress beacon immediately.</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                <span>Remove this emergency from the NGO Triage Queue.</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0" />
                <span>Clear the incident pin from the live GIS Crisis Map.</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                <span>Free up responders to attend other urgent emergencies.</span>
              </li>
            </ul>

            {cancelSuccessMsg ? (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
                {cancelSuccessMsg}
              </div>
            ) : (
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => handleConfirmCancel('Accidental SOS trigger by user')}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition shadow-md shadow-red-600/20 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cancelling Emergency...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Yes, Cancel Emergency</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => setIsCancelModalOpen(false)}
                  className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Keep Active
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

