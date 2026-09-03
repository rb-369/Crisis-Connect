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
    <div className="max-w-5xl mx-auto py-2 sm:py-6">
      {/* Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#EDE9FE] border border-[#DDD6FE] mb-6 flex items-start justify-between shadow-sm">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-[#4338CA] text-white flex-shrink-0 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-[#4338CA] text-sm sm:text-base">
              Volunteer Mobile Unit Simulator (Dev B Mock)
            </h3>
            <p className="text-xs text-[#6D28D9] mt-0.5 font-medium">
              Simulate accepting emergency requests, changing dispatch status, and exchanging live chat messages with requesters.
            </p>
          </div>
        </div>
        <button
          onClick={fetchUnmatched}
          className="p-2 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#DDD6FE] text-[#4338CA] transition shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Pending Requests Feed */}
        <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
            Available Requests for Volunteer Accept
          </h4>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {requests.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold uppercase text-[#0F172A]">{r.category}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      r.urgency === 'high' ? 'bg-[#DC2626] text-white' : 'bg-[#E2E8F0] text-[#475569]'
                    }`}>
                      {r.urgency}
                    </span>
                    <span className="text-[#64748B] font-mono">[{r.status}]</span>
                  </div>
                  <p className="text-[#475569] mt-1 font-medium line-clamp-1">
                    {r.details || '1-Tap Emergency SOS'}
                  </p>
                </div>

                <button
                  onClick={() => handleAccept(r.id)}
                  disabled={r.status === 'matched' || r.status === 'resolved'}
                  className="px-3.5 py-2 rounded-xl bg-[#4338CA] hover:bg-[#3730A3] text-white font-bold transition disabled:opacity-30 flex-shrink-0 shadow-sm"
                >
                  {r.status === 'matched' ? 'Matched' : 'Accept & Match'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Volunteer Chat & Status Controller */}
        <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Volunteer Dispatch Controls
              </h4>
              {activeMatch ? (
                <span className="text-xs text-[#15803D] font-bold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                  <span>Matched: {activeMatch.requestId.substring(0, 8)}...</span>
                </span>
              ) : (
                <span className="text-xs text-[#94A3B8]">No active match</span>
              )}
            </div>

            {activeMatch && (
              <div className="mb-4 space-y-2">
                <label className="text-xs text-[#64748B] font-bold block">
                  Simulate Volunteer Status Progression:
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() => handleUpdateStatus('en_route')}
                    className="py-2 px-3 rounded-xl bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0284C7] border border-[#BAE6FD] font-bold"
                  >
                    En Route 🚗
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('in_progress')}
                    className="py-2 px-3 rounded-xl bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#B45309] border border-[#FDE68A] font-bold"
                  >
                    On Site 📍
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('resolved')}
                    className="py-2 px-3 rounded-xl bg-[#DCFCE7] hover:bg-[#BBF7D0] text-[#15803D] border border-[#BBF7D0] font-bold"
                  >
                    Resolved ✅
                  </button>
                </div>
              </div>
            )}

            {/* Chat Box */}
            <div className="h-60 bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] overflow-y-auto space-y-2">
              {!activeMatch ? (
                <div className="h-full flex items-center justify-center text-[#94A3B8] text-xs font-medium">
                  Accept a request to open live responder chat
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#94A3B8] text-xs font-medium">
                  No messages yet. Send a note to the citizen.
                </div>
              ) : (
                chatMessages.map((m) => {
                  const isVol = m.sender_id === 'volunteer-mock-id';
                  return (
                    <div key={m.id} className={`flex flex-col ${isVol ? 'items-end' : 'items-start'}`}>
                      <div className={`p-2.5 rounded-xl text-xs max-w-[85%] ${
                        isVol ? 'bg-[#4338CA] text-white' : 'bg-white text-[#0F172A] border border-[#CBD5E1] shadow-sm'
                      }`}>
                        {m.body}
                      </div>
                      <span className="text-[10px] text-[#64748B] mt-0.5">
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
                placeholder="Send message as volunteer..."
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#4338CA]"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-[#4338CA] hover:bg-[#3730A3] text-white shadow-sm"
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
