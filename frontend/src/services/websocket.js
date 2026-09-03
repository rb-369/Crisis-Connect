/**
 * Native WebSocket Client with automatic reconnection and environment detection.
 * Connects to Render (wss://crisis-connect-m6da.onrender.com) when deployed on Vercel,
 * and connects to local port 8000 when running locally.
 */
const PROD_WS_URL = 'wss://crisis-connect-m6da.onrender.com';

export class CrisisWebSocketClient {
  constructor(channelType, channelId, onMessage, onStatusChange) {
    this.channelType = channelType;
    this.channelId = channelId;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.isClosedManually = false;
    this.connect();
  }

  getWebSocketUrl() {
    // 1. Explicit environment variable (if provided)
    if (import.meta.env.VITE_WS_URL) {
      const base = import.meta.env.VITE_WS_URL.replace(/\/$/, '');
      return `${base}/ws/${this.channelType}/${encodeURIComponent(this.channelId)}`;
    }

    // 2. Automatic local environment detection
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname || 'localhost';
      const isLocal = hostname === 'localhost' || 
                      hostname === '127.0.0.1' || 
                      hostname.startsWith('192.168.') || 
                      hostname.startsWith('10.') || 
                      hostname.endsWith('.local');

      if (isLocal) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProtocol}//${hostname}:8000/ws/${this.channelType}/${encodeURIComponent(this.channelId)}`;
      }
    }

    // 3. Fallback for Vercel (crisisconnect369.vercel.app) to connect to live Render backend
    return `${PROD_WS_URL}/ws/${this.channelType}/${encodeURIComponent(this.channelId)}`;
  }

  connect() {
    if (this.isClosedManually) return;

    try {
      const url = this.getWebSocketUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.onStatusChange) this.onStatusChange('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(payload);
        } catch (e) {
          console.error('[WebSocket Parse Error]:', e, event.data);
        }
      };

      this.ws.onclose = () => {
        if (!this.isClosedManually) {
          if (this.onStatusChange) this.onStatusChange('reconnecting');
          this.scheduleReconnect();
        } else {
          if (this.onStatusChange) this.onStatusChange('disconnected');
        }
      };

      this.ws.onerror = (err) => {
        console.warn(`[WebSocket Error] on channel ${this.channelType}:`, err);
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (err) {
      console.error('[WebSocket Init Error]:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WebSocket Max Reconnects reached]. Manual reload required.');
      if (this.onStatusChange) this.onStatusChange('failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  sendMessage(messageObj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(messageObj));
    } else {
      console.warn('[WebSocket not open]. Cannot send message.');
    }
  }

  close() {
    this.isClosedManually = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}
