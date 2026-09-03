import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, ShieldCheck, Clock, User } from 'lucide-react';
import { api } from '../../services/api';
import { CrisisWebSocketClient } from '../../services/websocket';
import { getDeviceId } from '../../utils/device';

export default function RequesterChat({ matchId, helperName = 'Emergency Responder' }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const currentDeviceId = getDeviceId();

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load message history on mount
  useEffect(() => {
    if (!matchId) return;

    api.getMessages(matchId)
      .then((history) => {
        setMessages(history);
        setTimeout(scrollToBottom, 100);
      })
      .catch((err) => console.error('Failed to load chat history:', err));

    // Subscribe to match WebSocket channel
    const wsClient = new CrisisWebSocketClient(
      'match',
      matchId,
      (payload) => {
        if (payload.event === 'new_message' && payload.data) {
          setMessages((prev) => {
            // Avoid duplicate message if already added locally
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
    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col h-[480px] border border-slate-800">
      {/* Chat Header */}
      <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white leading-tight">{helperName}</h4>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Direct Emergency Link Active</span>
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500">Native WS Channel</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50 text-slate-400" />
            <p className="text-xs">You are directly connected with your responder.</p>
            <p className="text-[11px] text-slate-600 mt-1">Send a message to share specific entrance instructions or immediate updates.</p>
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
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    isMe
                      ? 'bg-red-600 text-white rounded-br-none shadow-md'
                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                  }`}
                >
                  <p>{msg.body}</p>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  {isMe ? 'You' : 'Responder'} · {timeStr}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send Input */}
      <form onSubmit={handleSendMessage} className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message responder directly..."
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition shadow-md shadow-red-600/30"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
