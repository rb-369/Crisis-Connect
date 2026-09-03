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
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { CrisisWebSocketClient } from '../../services/websocket';
import { api } from '../../services/api';
import RequesterChat from './RequesterChat';
import DuplicateBadge from './DuplicateBadge';

const STATUS_STEPS = [
  { id: 'requested', label: 'Requested', desc: 'Alert broadcasted to responders', icon: Clock },
  { id: 'matched', label: 'Matched', desc: 'Volunteer / NGO unit assigned', icon: UserCheck },
  { id: 'in_progress', label: 'In Progress', desc: 'Responder is en route or on-site', icon: Truck },
  { id: 'resolved', label: 'Resolved', desc: 'Aid delivered safely', icon: CheckCircle },
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

  // Determine active step index
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
  const matchId = request.match_id || `match-${request.id}`;

  return (
    <div className="max-w-3xl mx-auto py-4 px-2 sm:px-4">
      {/* Top action bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onNewRequest}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>New Emergency Report</span>
        </button>

        <div className="flex items-center space-x-2">
          {/* WebSocket Status */}
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-ping-slow' : 'bg-amber-400'}`} />
            <span className="text-slate-400">Live Request Socket: {wsStatus}</span>
          </div>
        </div>
      </div>

      {/* Main Request Header Banner */}
      <div className={`p-5 rounded-2xl mb-6 border transition-all ${
        request.urgency === 'high'
          ? 'bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-950 border-red-500/40 shadow-xl shadow-red-950/30'
          : 'glass-panel border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                {request.category}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                request.urgency === 'high' ? 'bg-red-600 text-white font-bold animate-pulse' : 'bg-slate-800 text-slate-300'
              }`}>
                {request.urgency === 'high' ? 'CRITICAL URGENCY' : 'Standard Priority'}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ID: {request.id?.substring(0, 8)}...
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-2">
              Emergency Request Live
            </h2>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
              <MapPin className="w-3.5 h-3.5 text-red-400" />
              <span>Location: {request.lat?.toFixed(4)}, {request.lng?.toFixed(4)}</span>
            </div>
          </div>

          {/* Step 8 Duplicate Indicator */}
          <div className="sm:text-right">
            <DuplicateBadge linkedCount={request.linked_count} />
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs if Matched */}
      {isMatchedOrBeyond && (
        <div className="flex border-b border-slate-800 mb-6 gap-3">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`pb-2 text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'tracker'
                ? 'text-red-400 border-b-2 border-red-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Status Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`pb-2 text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'chat'
                ? 'text-red-400 border-b-2 border-red-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Direct Responder Chat</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
          </button>
        </div>
      )}

      {/* View Content */}
      {activeTab === 'chat' && isMatchedOrBeyond ? (
        <RequesterChat
          matchId={matchId}
          helperName={request.match_info?.helper_name || 'Assigned Crisis Volunteer'}
        />
      ) : (
        <div className="space-y-6">
          {/* Status Pipeline Progress Card */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">
              Live Dispatch Pipeline
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {STATUS_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = idx < currentIndex;
                const isCurrent = idx === currentIndex;

                return (
                  <div
                    key={step.id}
                    className={`relative p-4 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-slate-900 border-red-500 shadow-lg shadow-red-950/30'
                        : isPassed
                        ? 'bg-slate-900/50 border-emerald-500/40 text-emerald-400'
                        : 'bg-slate-950/40 border-slate-800 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`p-2 rounded-lg ${
                        isCurrent
                          ? 'bg-red-500 text-white animate-pulse'
                          : isPassed
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-xs font-bold ${isCurrent ? 'text-white' : isPassed ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assigned Responder Card if Matched */}
          {isMatchedOrBeyond && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Responder Matched</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <h4 className="text-base font-bold text-white mt-0.5">
                    {request.match_info?.helper_name || 'Dr. Sarah Lin (Red Cross Emergency Unit)'}
                  </h4>
                  <p className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{request.match_info?.helper_phone || '+1-555-0192'}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('chat')}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-600/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open Live Chat</span>
              </button>
            </div>
          )}

          {/* Additional details provided in Step 2 */}
          {(request.requester_name || request.details) && (
            <div className="p-4 rounded-xl glass-panel text-xs space-y-2">
              <h4 className="font-semibold text-slate-300">Notes Attached by Requester:</h4>
              {request.requester_name && (
                <p className="text-slate-400"><span className="text-slate-200 font-medium">Name:</span> {request.requester_name}</p>
              )}
              {request.requester_phone && (
                <p className="text-slate-400"><span className="text-slate-200 font-medium">Phone:</span> {request.requester_phone}</p>
              )}
              {request.details && (
                <p className="text-slate-400"><span className="text-slate-200 font-medium">Details:</span> {request.details}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
