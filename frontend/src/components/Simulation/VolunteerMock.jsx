import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Send, Truck, Check, RefreshCw, MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';

export default function VolunteerMock() {
  const [requests, setRequests] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchUnmatched = async () => {
    setLoading(true);
    try {
      const data = await api.getRequests();
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnmatched();
  }, []);

  // Listen for chat messages when a match is active
  useEffect(() => {
    if (!activeMatch) return;

    api.getMessages(activeMatch.id).then(setChatMessages).catch(console.error);

    const wsClient = new CrisisWebSocketClient(
      'match',
      activeMatch.id,
      (payload) => {
        if (payload.event === 'new_message' && payload.data) {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === payload.data.id)) return prev;
            return [...prev, payload.data];
          });
        }
      }
    );

    return () => wsClient.close();
  }, [activeMatch?.id]);

  const handleAccept = async (reqId) => {
    try {
      const res = await api.simulateAccept(reqId);
      setActiveMatch({
        id: res.match.id,
        requestId: reqId,
        helperName: res.match.helper_name,
      });
      fetchUnmatched();
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!activeMatch) return;
    try {
      await api.patchRequest(activeMatch.requestId, { status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendVolunteerMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeMatch) return;
    const body = chatInput.trim();
    setChatInput('');
    try {
      const sent = await api.sendMessage(activeMatch.id, 'volunteer-mock-id', body);
      setChatMessages((prev) => [...prev, sent]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Banner */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6 flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Volunteer Mobile Simulation Unit (Dev B Mock)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Use this screen to test the complete requester loop. Accept a pending request, update its status, and exchange live messages over the WebSocket channel.
            </p>
          </div>
        </div>
        <button
          onClick={fetchUnmatched}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Pending Requests Feed */}
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Available Requests for Volunteer Accept
          </h4>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {requests.map((r) => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold uppercase text-red-400">{r.category}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      r.urgency === 'high' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {r.urgency}
                    </span>
                    <span className="text-slate-500 font-mono">[{r.status}]</span>
                  </div>
                  <p className="text-slate-300 mt-1 font-medium line-clamp-1">
                    {r.details || '1-Tap Emergency SOS'}
                  </p>
                </div>

                <button
                  onClick={() => handleAccept(r.id)}
                  disabled={r.status === 'matched' || r.status === 'resolved'}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition disabled:opacity-30 flex-shrink-0"
                >
                  {r.status === 'matched' ? 'Matched' : 'Accept & Match'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Volunteer Chat & Status Controller */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Volunteer Dispatch Controls
              </h4>
              {activeMatch ? (
                <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Matched: {activeMatch.requestId.substring(0, 8)}...</span>
                </span>
              ) : (
                <span className="text-xs text-slate-500">No match selected</span>
              )}
            </div>

            {activeMatch && (
              <div className="mb-4 space-y-2">
                <label className="text-[11px] text-slate-400 font-semibold block">
                  Simulate Volunteer Status Progression:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() => handleUpdateStatus('en_route')}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold"
                  >
                    En Route 🚗
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('in_progress')}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold"
                  >
                    On Site 📍
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('resolved')}
                    className="p-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-semibold"
                  >
                    Resolved ✅
                  </button>
                </div>
              </div>
            )}

            {/* Chat Box */}
            <div className="h-60 bg-slate-950 rounded-xl p-3 border border-slate-800 overflow-y-auto space-y-2">
              {!activeMatch ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                  Accept a request to open live responder chat
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                  No messages yet. Send a note to the citizen.
                </div>
              ) : (
                chatMessages.map((m) => {
                  const isVol = m.sender_id === 'volunteer-mock-id';
                  return (
                    <div key={m.id} className={`flex flex-col ${isVol ? 'items-end' : 'items-start'}`}>
                      <div className={`p-2 rounded-xl text-xs max-w-[85%] ${
                        isVol ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'
                      }`}>
                        {m.body}
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5">
                        {isVol ? 'Volunteer' : 'Requester'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat send form */}
          {activeMatch && (
            <form onSubmit={handleSendVolunteerMessage} className="mt-4 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send message to requester as volunteer..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
