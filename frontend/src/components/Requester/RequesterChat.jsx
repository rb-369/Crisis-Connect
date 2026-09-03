import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import { getDeviceId } from '../../utils/device';

export default function RequesterChat({ matchId, helperName = 'Emergency Responder' }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const currentDeviceId = getDeviceId();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!matchId) return;

    api.getMessages(matchId)
      .then((history) => {
        setMessages(history);
        setTimeout(scrollToBottom, 100);
      })
      .catch((err) => console.error('Failed to load chat history:', err));

    const wsClient = new CrisisWebSocketClient(
      'match',
      matchId,
      (payload) => {
        if (payload.event === 'new_message' && payload.data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.data.id)) return prev;
            return [...prev, payload.data];
          });
          setTimeout(scrollToBottom, 100);
        }
      }
    );

    return () => {
      wsClient.close();
    };
  }, [matchId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const body = inputText.trim();
    if (!body || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      const created = await api.sendMessage(matchId, currentDeviceId, body);
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col h-[500px] border border-[#E2E8F0] shadow-sm">
      {/* Chat Header */}
      <div className="p-4 bg-[#0F172A] text-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-[#16A34A] text-white flex items-center justify-center font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold leading-tight">{helperName}</h4>
            <span className="text-[11px] text-[#4ADE80] font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              <span>Direct Emergency Connection</span>
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400">Native WebSocket</span>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#64748B]">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-[#64748B]" />
            <p className="text-xs font-bold text-[#0F172A]">Direct link with your responder is ready</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">Send a message to share specific entrance instructions, gate codes, or urgent status.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentDeviceId;
            const timeStr = msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    isMe
                      ? 'bg-[#2563EB] text-white rounded-br-none shadow-sm'
                      : 'bg-white text-[#0F172A] rounded-bl-none border border-[#CBD5E1] shadow-sm'
                  }`}
                >
                  <p>{msg.body}</p>
                </div>
                <span className="text-[10px] text-[#64748B] font-medium mt-1 px-1">
                  {isMe ? 'You' : 'Responder'} &bull; {timeStr}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#E2E8F0] flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message responder directly..."
          className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white disabled:opacity-40 transition shadow-md shadow-blue-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
