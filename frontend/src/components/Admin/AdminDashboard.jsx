import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Flag, 
  AlertTriangle, 
  MapPin, 
  Clock, 
  Shield, 
  Filter, 
  RefreshCw,
  Search,
  CheckCircle2,
  Users
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

    // Subscribe to admin WebSocket channel to see real-time new incoming requests and status updates
    const wsClient = new CrisisWebSocketClient(
      'admin',
      'all',
      (payload) => {
        if (payload.event === 'new_request') {
          setRequests((prev) => {
            if (prev.some((r) => r.id === payload.data.id)) return prev;
            // Prepend new request and re-sort urgency
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
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header & Stats bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-red-500" />
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              NGO / Dispatch Admin Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Emergency Triage Queue — sorted by Priority (High Urgency first) then Recency.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchRequests}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center space-x-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onOpenMap}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition flex items-center space-x-1.5 text-xs font-bold shadow-lg shadow-red-600/20"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>View Crisis GIS Map</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-3 mb-6 border-b border-slate-800">
        {[
          { id: '', label: 'All Requests' },
          { id: 'pending', label: 'Pending Review' },
          { id: 'approved', label: 'Approved' },
          { id: 'flagged', label: 'Flagged / Investigate' },
          { id: 'rejected', label: 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests Triage Table / Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin mb-2 text-red-500" />
          <p className="text-xs">Loading emergency triage queue...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center text-slate-500">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <h3 className="text-sm font-bold text-slate-300">Queue is Clear</h3>
          <p className="text-xs text-slate-500 mt-1">No requests currently match the selected status filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isHigh = req.urgency === 'high';
            const isPending = req.admin_status === 'pending';

            return (
              <div
                key={req.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isHigh
                    ? 'bg-gradient-to-r from-red-950/40 via-slate-900/90 to-slate-950 border-red-500/50 shadow-lg shadow-red-950/20'
                    : 'glass-panel border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Category & details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase tracking-wide bg-slate-800 text-red-400 border border-slate-700">
                        {req.category}
                      </span>

                      {isHigh ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-red-600 text-white uppercase tracking-wider flex items-center space-x-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          <span>HIGH URGENCY</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">
                          Normal Urgency
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                        req.admin_status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : req.admin_status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : req.admin_status === 'flagged'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        Admin: {req.admin_status}
                      </span>

                      <span className="text-[11px] font-mono text-slate-500">
                        Status: <strong className="text-slate-300 capitalize">{req.status}</strong>
                      </span>

                      {/* Step 8: Duplicate Indicator */}
                      <DuplicateBadge linkedCount={req.linked_count} />
                    </div>

                    <p className="text-sm font-medium text-slate-200">
                      {req.details || 'No detailed note provided by requester (1-Tap Immediate Dispatch)'}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      {req.requester_name && (
                        <span><strong className="text-slate-300">Name:</strong> {req.requester_name}</span>
                      )}
                      {req.requester_phone && (
                        <span><strong className="text-slate-300">Phone:</strong> {req.requester_phone}</span>
                      )}
                      <span className="flex items-center space-x-1 text-slate-400">
                        <MapPin className="w-3 h-3 text-red-400" />
                        <span>{req.lat?.toFixed(4)}, {req.lng?.toFixed(4)}</span>
                      </span>
                      <span className="flex items-center space-x-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{req.created_at ? new Date(req.created_at).toLocaleTimeString() : 'Just now'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Triage Action Buttons */}
                  <div className="flex items-center space-x-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    <button
                      disabled={actionInProgress === req.id || req.admin_status === 'approved'}
                      onClick={() => handleTriage(req.id, 'approved')}
                      title="Approve request for volunteer dispatch"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center space-x-1 disabled:opacity-40 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>

                    <button
                      disabled={actionInProgress === req.id || req.admin_status === 'flagged'}
                      onClick={() => handleTriage(req.id, 'flagged')}
                      title="Flag for suspicious activity or verification"
                      className="px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center space-x-1 disabled:opacity-40 shadow-sm"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Flag</span>
                    </button>

                    <button
                      disabled={actionInProgress === req.id || req.admin_status === 'rejected'}
                      onClick={() => handleTriage(req.id, 'rejected')}
                      title="Reject request"
                      className="px-3 py-1.5 rounded-xl bg-rose-700/80 hover:bg-rose-600 text-white text-xs font-bold transition flex items-center space-x-1 disabled:opacity-40 shadow-sm"
                    >
                      <X className="w-3.5 h-3.5" />
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
