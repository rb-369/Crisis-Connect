import React, { useState, useEffect } from 'react';
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
  Radio
} from 'lucide-react';
import { CrisisWebSocketClient } from '../../services/websocket';
import { api } from '../../services/api';
import RequesterChat from './RequesterChat';
import DuplicateBadge from './DuplicateBadge';

const STATUS_STEPS = [
  { id: 'requested', label: 'Requested', desc: 'Searching responders in radius', icon: Clock },
  { id: 'matched', label: 'Matched', desc: 'Volunteer / NGO unit assigned', icon: UserCheck },
  { id: 'in_progress', label: 'En Route', desc: 'Responder navigating on-site', icon: Truck },
  { id: 'resolved', label: 'Delivered', desc: 'Aid completed safely', icon: CheckCircle },
];

export default function LiveStatusTracker({ initialRequest, onNewRequest }) {
  const [request, setRequest] = useState(initialRequest);
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' or 'chat'
  const [wsStatus, setWsStatus] = useState('connecting');

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
      case 'in_progress': return 2;
      case 'resolved': return 3;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(request.status);
  const isMatchedOrBeyond = currentIndex >= 1;
  const isArrived = currentIndex >= 2;
  const matchId = request.match_id || `match-${request.id}`;

  return (
    <div className="max-w-3xl mx-auto py-2 sm:py-6 px-2">
      {/* Top back button & WS status */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onNewRequest}
          className="flex items-center space-x-1.5 text-xs font-bold text-[#475569] hover:text-[#0F172A] bg-white px-3 py-1.5 rounded-xl border border-[#E2E8F0] shadow-sm transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>New Emergency SOS</span>
        </button>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white border border-[#E2E8F0] text-[11px] font-mono text-[#475569] shadow-sm">
          <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-[#16A34A] animate-ping-slow' : 'bg-[#D97706]'}`} />
          <span>Live Link: {wsStatus}</span>
        </div>
      </div>

      {/* Dynamic Reassurance Signal Banner (Based on real-time state) */}
      {currentIndex === 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] mb-5 shadow-sm flex items-start space-x-3.5 animate-pulse-subtle">
          <div className="w-10 h-10 rounded-xl bg-[#D97706] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Search className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-[#B45309] text-base">
                Finding Help Near You...
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#D97706]/20 text-[#B45309]">
                Queue Active
              </span>
            </div>
            <p className="text-xs text-[#92400E] font-medium mt-0.5">
              Your request for <strong className="uppercase">{request.category}</strong> is broadcasted to verified local volunteers and dispatchers.
            </p>
          </div>
        </div>
      )}

      {currentIndex === 1 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#E0F2FE] border border-[#BAE6FD] mb-5 shadow-sm flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#0284C7] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-[#0284C7] text-base">
                Helper Matched & Dispatched!
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#0284C7]/20 text-[#0284C7]">
                En Route
              </span>
            </div>
            <p className="text-xs text-[#075985] font-medium mt-0.5">
              A responder has accepted your dispatch and is preparing immediate assistance.
            </p>
          </div>
        </div>
      )}

      {currentIndex >= 2 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#DCFCE7] border border-[#BBF7D0] mb-5 shadow-sm flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#16A34A] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-[#15803D] text-base">
                {currentIndex === 3 ? 'Aid Delivered & Resolved' : 'Help Is On-Site / Near You'}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/20 text-[#15803D]">
                {currentIndex === 3 ? 'Completed' : 'On-Site'}
              </span>
            </div>
            <p className="text-xs text-[#166534] font-medium mt-0.5">
              Emergency assistance has arrived at your reported location.
            </p>
          </div>
        </div>
      )}

      {/* Main Request Summary Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#991B1B] bg-[#FEE2E2] px-2.5 py-1 rounded-lg border border-[#FECACA]">
                {request.category}
              </span>
              {request.urgency === 'high' ? (
                <span className="text-[11px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider bg-[#DC2626] text-white flex items-center space-x-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span>Immediate Life Priority</span>
                </span>
              ) : (
                <span className="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                  Standard Priority
                </span>
              )}
              {request.zone_confirmed && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                  ✓ Area Confirmed Fast-Track
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] mt-2.5">
              Active Request Tracker
            </h2>

            <div className="flex items-center space-x-2 text-xs text-[#64748B] mt-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
              <span>Location: {request.lat?.toFixed(4)}, {request.lng?.toFixed(4)}</span>
              <span>&bull;</span>
              <span className="font-mono">ID: {request.id?.substring(0, 8)}...</span>
            </div>
          </div>

          <div className="sm:text-right">
            <DuplicateBadge linkedCount={request.linked_count} />
          </div>
        </div>
      </div>

      {/* Tabs if Matched (Pipeline vs Chat) */}
      {isMatchedOrBeyond && (
        <div className="flex border-b border-[#CBD5E1] mb-5 gap-4">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`pb-2.5 text-xs sm:text-sm font-extrabold transition flex items-center space-x-1.5 ${
              activeTab === 'tracker'
                ? 'text-[#0F172A] border-b-2 border-[#2563EB]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Dispatch Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-2.5 text-xs sm:text-sm font-extrabold transition flex items-center space-x-1.5 ${
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
          helperName={request.match_info?.helper_name || 'Dr. Sarah Lin (Red Cross Emergency Unit)'}
        />
      ) : (
        <div className="space-y-6">
          {/* Dispatch Pipeline Cards */}
          <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-5">
              Live Dispatch Pipeline
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
                      Verified Responder Assigned
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7] animate-ping" />
                  </div>
                  <h4 className="text-base font-black text-[#0F172A] mt-0.5">
                    {request.match_info?.helper_name || 'Dr. Sarah Lin (Red Cross Emergency Unit)'}
                  </h4>
                  <p className="text-xs text-[#475569] font-medium flex items-center space-x-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>{request.match_info?.helper_phone || '+1-555-0192'}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('chat')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open Responder Chat</span>
              </button>
            </div>
          )}

          {/* Requester Additional Notes */}
          {(request.requester_name || request.details) && (
            <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] text-xs space-y-1.5 shadow-sm">
              <h4 className="font-bold text-[#0F172A]">Requester Note:</h4>
              {request.requester_name && (
                <p className="text-[#475569]"><strong className="text-[#0F172A]">Name:</strong> {request.requester_name}</p>
              )}
              {request.details && (
                <p className="text-[#475569]"><strong className="text-[#0F172A]">Details:</strong> {request.details}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
