import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Flag, 
  AlertTriangle, 
  MapPin, 
  Clock, 
  Shield, 
  RefreshCw,
  CheckCircle2,
  Users,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import DuplicateBadge from '../Requester/DuplicateBadge';

export default function AdminDashboard({ onOpenMap }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(''); // '' = all, 'pending', 'approved', 'rejected', 'flagged'
  const [actionInProgress, setActionInProgress] = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getRequests(statusFilter || null);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load admin queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const wsClient = new CrisisWebSocketClient(
      'admin',
      'all',
      (payload) => {
        if (payload.event === 'new_request') {
          setRequests((prev) => {
            if (prev.some((r) => r.id === payload.data.id)) return prev;
            const updated = [payload.data, ...prev];
            return updated.sort((a, b) => (a.urgency === 'high' ? -1 : 1));
          });
        } else if (payload.event === 'status_update' || payload.event === 'matched') {
          setRequests((prev) =>
            prev.map((r) => (r.id === payload.data.id ? { ...r, ...payload.data } : r))
          );
        }
      }
    );

    return () => {
      wsClient.close();
    };
  }, [statusFilter]);

  const handleTriage = async (requestId, newAdminStatus) => {
    setActionInProgress(requestId);
    try {
      const updated = await api.patchRequest(requestId, { admin_status: newAdminStatus });
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, admin_status: updated.admin_status } : r))
      );
    } catch (err) {
      console.error('Failed to triage request:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="py-2 sm:py-6">
      {/* Top Mission Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#0F172A] text-white">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                NGO Dispatch & Moderation Queue
              </h1>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">
                Real-time emergency triage sorted by Priority (High Urgency first) then Recency.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchRequests}
            className="px-3 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] transition flex items-center space-x-1.5 text-xs font-bold shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>

          <button
            onClick={onOpenMap}
            className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white transition flex items-center space-x-2 text-xs font-extrabold shadow-sm"
          >
            <MapPin className="w-4 h-4 text-red-400" />
            <span>Open GIS Crisis Map</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-5 border-b border-[#CBD5E1]">
        {[
          { id: '', label: 'All Requests' },
          { id: 'pending', label: 'Pending Review' },
          { id: 'approved', label: 'Approved & Dispatched' },
          { id: 'flagged', label: 'Flagged / Investigate' },
          { id: 'rejected', label: 'Rejected / Spam' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-[#0F172A] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Data Cards */}
      {loading ? (
        <div className="p-16 text-center text-[#64748B] bg-white rounded-2xl border border-[#E2E8F0] flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-[#2563EB]" />
          <p className="text-sm font-bold text-[#0F172A]">Refreshing emergency triage stream...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl border border-[#E2E8F0] text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-[#16A34A]" />
          <h3 className="text-base font-extrabold text-[#0F172A]">Queue Is Currently Clear</h3>
          <p className="text-xs text-[#64748B] mt-1 font-medium">No emergency requests match the active filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {requests.map((req) => {
            const isHigh = req.urgency === 'high';

            return (
              <div
                key={req.id}
                className={`p-5 rounded-2xl bg-white border transition-all shadow-sm ${
                  isHigh
                    ? 'border-[#FECACA] ring-1 ring-[#DC2626]/20 bg-gradient-to-r from-[#FEF2F2]/60 to-white'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left Metadata & Needs */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-[#0F172A] text-white">
                        {req.category}
                      </span>

                      {/* Life-Threatening Priority Badge */}
                      {isHigh && (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] flex items-center space-x-1.5 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                          <span>HIGH URGENCY</span>
                        </span>
                      )}

                      {/* Admin Triage Status Pill */}
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase ${
                        req.admin_status === 'approved'
                          ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                          : req.admin_status === 'rejected'
                          ? 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]'
                          : req.admin_status === 'flagged'
                          ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                          : 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]'
                      }`}>
                        Admin: {req.admin_status}
                      </span>

                      {/* ML Corroboration Badge */}
                      {req.ml_status && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE] flex items-center space-x-1">
                          <Sparkles className="w-3 h-3" />
                          <span>ML Corroborated</span>
                        </span>
                      )}

                      {/* Org-Verified Badge */}
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD] flex items-center space-x-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Org-Verified</span>
                      </span>

                      {/* Step 8 Duplicate Indicator */}
                      <DuplicateBadge linkedCount={req.linked_count} />
                    </div>

                    <p className="text-sm font-bold text-[#0F172A] leading-snug">
                      {req.details || '1-Tap Emergency SOS (No additional text note attached)'}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] font-medium pt-0.5">
                      {req.requester_name && (
                        <span><strong className="text-[#0F172A]">Requester:</strong> {req.requester_name}</span>
                      )}
                      {req.requester_phone && (
                        <span><strong className="text-[#0F172A]">Phone:</strong> {req.requester_phone}</span>
                      )}
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
                        <span className="font-mono">{req.lat?.toFixed(4)}, {req.lng?.toFixed(4)}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                        <span>{req.created_at ? new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                      </span>
                      <span className="font-mono text-[#94A3B8]">
                        ID: {req.id?.substring(0, 8)}...
                      </span>
                    </div>
                  </div>

                  {/* Right: Moderation Triage Actions */}
                  <div className="flex items-center space-x-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#E2E8F0]">
                    {/* Approve Action */}
                    <button
                      disabled={actionInProgress === req.id || req.admin_status === 'approved'}
                      onClick={() => handleTriage(req.id, 'approved')}
                      title="Approve and push to volunteer matching queue"
                      className="px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-30 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve</span>
                    </button>

                    {/* Flag for Review */}
                    <button
                      disabled={actionInProgress === req.id || req.admin_status === 'flagged'}
                      onClick={() => handleTriage(req.id, 'flagged')}
                      title="Flag for location verification or investigation"
                      className="px-3 py-2 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-30 shadow-sm"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Flag</span>
                    </button>

                    {/* Reject / Spam */}
                    <button
                      disabled={actionInProgress === req.id || req.admin_status === 'rejected'}
                      onClick={() => handleTriage(req.id, 'rejected')}
                      title="Reject fake or duplicate report"
                      className="px-3 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-30 shadow-sm"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
