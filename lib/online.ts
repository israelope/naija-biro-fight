import type { ClientMsg, ServerMsg } from '@/shared/protocol';

export type ConnState = 'open' | 'reconnecting' | 'closed';

/** WebSocket wrapper with automatic reconnection (the room server keeps your seat for 30 s). */
export class RoomConnection {
  private ws: WebSocket | null = null;
  private stopped = false;
  private tries = 0;
  private ping: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private url: string, private onMsg: (m: ServerMsg) => void, private onState: (s: ConnState) => void) {}

  connect() {
    if (this.stopped) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0; this.onState('open');
      if (this.ping) clearInterval(this.ping);
      this.ping = setInterval(() => this.send({ t: 'ping' }), 20000);
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data as string) as ServerMsg;
        if (m.t === 'error' && ['BAD_TICKET', 'NOT_FOUND', 'ROOM_FULL', 'EXPIRED'].includes(m.code)) this.stopped = true;
        this.onMsg(m);
      } catch {}
    };
    ws.onclose = (e) => {
      if (this.ping) clearInterval(this.ping);
      if (this.stopped || [4000, 4001, 4002].includes(e.code)) { this.onState('closed'); return; }
      if (++this.tries > 8) { this.onState('closed'); return; }
      this.onState('reconnecting');
      this.retryTimer = setTimeout(() => this.connect(), Math.min(4000, 500 * this.tries));
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }

  send(m: ClientMsg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  close() {
    this.stopped = true;
    if (this.ping) clearInterval(this.ping);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    try { this.ws?.close(); } catch {}
  }
}
