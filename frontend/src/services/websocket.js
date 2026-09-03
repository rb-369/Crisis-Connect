/**
 * Native WebSocket Client with automatic reconnection and channel subscription
 */
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
    const defaultWsHost = 'localhost:8000';
    return `ws://${defaultWsHost}/ws/${this.channelType}/${encodeURIComponent(this.channelId)}`;
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
          if (this.onStatusChange) this.onStatusChange('disconnected');
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        if (this.onStatusChange) this.onStatusChange('error');
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.onStatusChange) this.onStatusChange('failed');
      return;
    }
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const text = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(text);
    }
  }

  close() {
    this.isClosedManually = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.onStatusChange) this.onStatusChange('closed');
  }
}
