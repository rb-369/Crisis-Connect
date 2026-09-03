import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Truck, 
  CheckCircle, 
  MapPin, 
  MessageSquare, 
  AlertCircle,
  Phone,
  ShieldCheck,
  ArrowLeft,
  Search,
  Radio,
  Volume2,
  Play,
  Pause,
  HeartHandshake,
  Pill,
  Wind,
  Home,
  Utensils,
  Sparkles
} from 'lucide-react';
import { CrisisWebSocketClient } from '../../services/websocket';
import { api } from '../../services/api';
import RequesterChat from './RequesterChat';
import DuplicateBadge from './DuplicateBadge';
import RequesterLiveMap from './RequesterLiveMap';
import { getBloodGroupTheme, getCompatibleDonorsForRecipient } from '../../utils/bloodCompatibility';
import { playMatchSuccessChime } from '../../utils/audioChime';

const STATUS_STEPS = [
  { id: 'requested', label: 'Verified & Queued', desc: 'Searching compatible donors in radius', icon: Clock },
  { id: 'matched', label: 'Helper Matched', desc: 'Donor / Volunteer accepted dispatch', icon: UserCheck },
  { id: 'on_the_way', label: 'On The Way', desc: 'Responder transit to hospital / site', icon: Truck },
  { id: 'resolved', label: 'Delivered & Complete', desc: 'Resource provided successfully', icon: CheckCircle },
];


export default function LiveStatusTracker({ initialRequest, onNewRequest }) {
  const [request, setRequest] = useState(initialRequest);
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' or 'chat'
  const [wsStatus, setWsStatus] = useState('connecting');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [matchNotification, setMatchNotification] = useState(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    if (!request?.id) return;

    // Subscribe to specific request channel: /ws/request/{request.id}
    const wsClient = new CrisisWebSocketClient(
      'request',
      request.id,
      (payload) => {
        if (payload.event === 'status_update' || payload.event === 'matched') {
          setRequest((prev) => ({
            ...prev,
            ...payload.data,
          }));

          // When a volunteer/donor accepts the request, alert the user with helper details & chime!
          if (payload.event === 'matched') {
            const helperName = payload.data.match_info?.helper_name || payload.data.helper_name || 'Verified Volunteer Responder';
            const helperPhone = payload.data.match_info?.helper_phone || payload.data.helper_phone;
            const helperBlood = payload.data.match_info?.blood_group || payload.data.blood_group;

            playMatchSuccessChime();
            setMatchNotification({
              helperName,
              helperPhone,
              helperBlood,
              category: payload.data.category,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            });

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('CrisisConnect: Responder Matched!', {
                  body: `${helperName} has accepted your request!`,
                  icon: '/favicon.ico',
                });
              } catch (_) {}
            }
          }
        }
      },
      (status) => setWsStatus(status)
    );

    return () => {
      wsClient.close();
    };
  }, [request?.id]);

  const getStepIndex = (status) => {
    switch (status) {
      case 'requested': return 0;
      case 'matched': return 1;
      case 'en_route':
      case 'on_the_way':
      case 'in_progress': return 2;
      case 'resolved':
      case 'completed': return 3;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(request.status);
  const isMatchedOrBeyond = currentIndex >= 1;
  const matchId = request.match_id || `match-${request.id}`;

  const toggleVoiceNote = () => {
    if (!audioPlayerRef.current) return;
    if (isPlayingAudio) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleConfirmResolution = async () => {
    if (window.confirm('Confirm that you have received the required emergency assistance?')) {
      setIsResolving(true);
      try {
        const updated = await api.patchRequest(request.id, {
          status: 'resolved',
        });
        setRequest((prev) => ({ ...prev, ...updated }));
        setIsResolving(false);
      } catch (err) {
        alert('Could not update status: ' + err.message);
        setIsResolving(false);
      }
    }
  };

  const bloodGroup = request.service_details?.blood_group;
  const bloodTheme = bloodGroup ? getBloodGroupTheme(bloodGroup) : null;
  const compatibleDonors = bloodGroup ? getCompatibleDonorsForRecipient(bloodGroup) : [];

  return (
    <div className="max-w-3xl mx-auto py-2 sm:py-6 px-2">
      {/* Top back button & WS status */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onNewRequest}
          className="flex items-center space-x-1.5 text-xs font-bold text-[#475569] hover:text-[#0F172A] bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1] shadow-sm transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>New Emergency Request</span>
        </button>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-[11px] font-mono text-[#475569] shadow-sm">
          <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-[#16A34A] animate-ping-slow' : 'bg-[#D97706]'}`} />
          <span>Live Link: {wsStatus}</span>
        </div>
      </div>

      {/* Live Responder Acceptance Notification Modal / Banner */}
      {matchNotification && (
        <div className="mb-5 p-5 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white shadow-2xl border-2 border-emerald-400 ring-4 ring-emerald-500/20 animate-in slide-in-from-top-3 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/40">
                    🎉 Volunteer / Donor Matched & Dispatched!
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {matchNotification.time}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">
                  {matchNotification.helperName}
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Has accepted your emergency request and is currently en route with assistance.
                </p>
                {matchNotification.helperBlood && (
                  <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold font-mono">
                    <span>🩸 Donor Blood Group: {matchNotification.helperBlood}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setMatchNotification(null)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-3">
            {matchNotification.helperPhone && (
              <a
                href={`tel:${matchNotification.helperPhone}`}
                className="text-xs font-bold text-slate-200 hover:text-white flex items-center space-x-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call Responder: {matchNotification.helperPhone}</span>
              </a>
            )}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setActiveTab('chat');
                  setMatchNotification(null);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open Direct Chat</span>
              </button>
              <button
                onClick={() => setMatchNotification(null)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Reassurance Signal Banner (Based on real-time state) */}
      {currentIndex === 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] mb-5 shadow-sm flex items-start space-x-3.5 animate-pulse-subtle">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Search className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-[#1E40AF] text-base">
                Request Auto-Verified & Searching Donors...
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#2563EB]/15 text-[#1E40AF]">
                Active Broadcast
              </span>
            </div>
            <p className="text-xs text-[#1E3A8A] font-medium mt-0.5">
              Your request for <strong className="uppercase">{request.category}</strong> has been verified. Matching nearby available volunteers & donors in your radius.
            </p>
          </div>
        </div>
      )}

      {currentIndex === 1 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#E0F2FE] border border-[#BAE6FD] mb-5 shadow-sm flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#0284C7] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-[#0284C7] text-base">
                Volunteer / Donor Accepted Your Request!
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#0284C7]/20 text-[#0284C7]">
                Matched
              </span>
            </div>
            <p className="text-xs text-[#075985] font-medium mt-0.5">
              {request.match_info?.helper_name || 'A verified responder'} is preparing assistance. You can coordinate directly via in-app chat.
            </p>
          </div>
        </div>
      )}

      {currentIndex === 2 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] mb-5 shadow-sm flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#D97706] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-[#B45309] text-base">
                Helper Is On The Way!
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#D97706]/20 text-[#B45309]">
                In Transit
              </span>
            </div>
            <p className="text-xs text-[#92400E] font-medium mt-0.5">
              Responder is en route with the requested resource to your designated location.
            </p>
          </div>
        </div>
      )}

      {currentIndex === 3 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#DCFCE7] border border-[#BBF7D0] mb-5 shadow-sm flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#16A34A] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-[#15803D] text-base">
                Assistance Delivered & Issue Resolved
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/20 text-[#15803D]">
                Completed
              </span>
            </div>
            <p className="text-xs text-[#166534] font-medium mt-0.5">
              Emergency assistance has been fulfilled and verified. Thank you to all community responders.
            </p>
          </div>
        </div>
      )}

      {/* Main Request Summary Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#991B1B] bg-[#FEE2E2] px-2.5 py-1 rounded-lg border border-[#FECACA]">
                {request.category}
              </span>
              
              {bloodGroup && (
                <span 
                  style={{ backgroundColor: bloodTheme.bg, color: bloodTheme.text, borderColor: bloodTheme.border }}
                  className="text-xs font-black px-2.5 py-1 rounded-lg border flex items-center space-x-1"
                >
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>Blood Group: {bloodGroup} ({request.service_details?.units || 2} Units)</span>
                </span>
              )}

              <span className="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                ✓ Auto-Verified Need
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] mt-2.5">
              {request.category === 'blood' 
                ? `Blood Transfusion Assistance (${bloodGroup})` 
                : `${request.category.toUpperCase()} Relief Request`}
            </h2>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] mt-1 font-medium">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>GPS: {request.lat?.toFixed(4)}, {request.lng?.toFixed(4)} (Mumbai)</span>
              </span>
              <span>&bull;</span>
              <span className="font-mono">ID: {request.id?.substring(0, 8)}</span>
            </div>
          </div>

          <div className="sm:text-right">
            <DuplicateBadge linkedCount={request.linked_count} />
          </div>
        </div>

        {/* Blood Donor Compatibility Sub-Banner */}
        {bloodGroup && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FECDD3] text-xs">
            <div className="font-bold text-[#9F1239] mb-1 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-[#E11D48]" />
              <span>Compatible Donor Groups for {bloodGroup} Recipient:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {compatibleDonors.map((dg) => (
                <span key={dg} className="px-2 py-0.5 rounded-md bg-white border border-[#FDA4AF] font-mono font-bold text-[#BE123C] text-[11px]">
                  {dg}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Audio Voice Note Player if Present */}
        {request.voice_note_url && (
          <div className="mt-4 p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between">
            <audio
              ref={audioPlayerRef}
              src={request.voice_note_url}
              onEnded={() => setIsPlayingAudio(false)}
              className="hidden"
            />
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={toggleVoiceNote}
                className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-sm hover:bg-[#1D4ED8] transition cursor-pointer"
              >
                {isPlayingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <div>
                <div className="text-xs font-black text-[#0F172A] flex items-center space-x-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Requester Voice Recording</span>
                </div>
                <div className="text-[10px] text-[#64748B]">
                  Tap to listen to original voice memo
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs if Matched (Pipeline vs Chat) */}
      {isMatchedOrBeyond && (
        <div className="flex border-b border-[#CBD5E1] mb-5 gap-4">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`pb-2.5 text-xs sm:text-sm font-extrabold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'tracker'
                ? 'text-[#0F172A] border-b-2 border-[#2563EB]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Delivery Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-2.5 text-xs sm:text-sm font-extrabold transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'chat'
                ? 'text-[#0F172A] border-b-2 border-[#2563EB]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#2563EB]" />
            <span>Direct Responder Chat</span>
            <span className="w-2 h-2 rounded-full bg-[#16A34A] inline-block animate-pulse" />
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'chat' && isMatchedOrBeyond ? (
        <RequesterChat
          matchId={matchId}
          helperName={request.match_info?.helper_name || 'Dr. Rohit Deshmukh (Red Cross Mumbai)'}
        />
      ) : (
        <div className="space-y-6">
          {/* Live MapLibre Dispatch & Shortest Road Route Map */}
          <RequesterLiveMap 
            request={request} 
            helperInfo={request.match_info} 
          />

          {/* Dispatch Pipeline Cards */}
          <div className="bg-white border border-[#CBD5E1] p-6 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-5">
              Live Fulfillment Progression
            </h3>


            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {STATUS_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = idx < currentIndex;
                const isCurrent = idx === currentIndex;

                return (
                  <div
                    key={step.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-[#F8FAFC] border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-sm'
                        : isPassed
                        ? 'bg-[#DCFCE7]/40 border-[#BBF7D0] text-[#15803D]'
                        : 'bg-[#F8FAFC]/50 border-[#E2E8F0] text-[#94A3B8]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 mb-1.5">
                      <div className={`p-2 rounded-lg ${
                        isCurrent
                          ? 'bg-[#2563EB] text-white shadow-sm'
                          : isPassed
                          ? 'bg-[#16A34A] text-white'
                          : 'bg-[#E2E8F0] text-[#64748B]'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-black ${isCurrent ? 'text-[#0F172A]' : isPassed ? 'text-[#15803D]' : 'text-[#64748B]'}`}>
                        {step.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] font-medium leading-tight">
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assigned Responder Box */}
          {isMatchedOrBeyond && (
            <div className="p-5 rounded-2xl bg-[#E0F2FE] border border-[#BAE6FD] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shadow-md">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-extrabold text-[#0284C7] uppercase tracking-wider">
                      Verified Helper Assigned
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7] animate-ping" />
                  </div>
                  <h4 className="text-base font-black text-[#0F172A] mt-0.5">
                    {request.match_info?.helper_name || 'Dr. Rohit Deshmukh (Red Cross Mumbai)'}
                  </h4>
                  <p className="text-xs text-[#475569] font-medium flex items-center space-x-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>{request.match_info?.helper_phone || '+91 98201 55019'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('chat')}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Open Live Chat</span>
                </button>

                {currentIndex < 3 && (
                  <button
                    onClick={handleConfirmResolution}
                    disabled={isResolving}
                    className="px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-black transition flex items-center justify-center space-x-1.5 shadow-md shadow-green-600/20 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm Received</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Requester Additional Notes & Specifics */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#CBD5E1] text-xs space-y-2 shadow-sm">
            <h4 className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] text-[#64748B]">
              Request Details & Specifics:
            </h4>
            {request.requester_name && (
              <p className="text-[#475569]"><strong className="text-[#0F172A]">Requester:</strong> {request.requester_name} {request.requester_phone ? `(${request.requester_phone})` : ''}</p>
            )}
            {request.details && (
              <p className="text-[#475569]"><strong className="text-[#0F172A]">Details:</strong> {request.details}</p>
            )}
            {request.service_details && (
              <div className="mt-2 p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] space-y-1">
                {Object.entries(request.service_details).map(([key, value]) => {
                  if (typeof value === 'boolean' && !value) return null;
                  return (
                    <div key={key} className="flex justify-between text-[11px]">
                      <span className="font-bold capitalize text-[#64748B]">{key.replace(/_/g, ' ')}:</span>
                      <span className="font-semibold text-[#0F172A]">{String(value)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
