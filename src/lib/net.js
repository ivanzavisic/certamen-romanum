// Relay transport: both players talk through public MQTT brokers over secure
// WebSockets. Unlike direct WebRTC this works across any home/mobile network,
// because each browser only makes ordinary outgoing wss:// connections.
//
// Public brokers are flaky, so every player connects to ALL of them at once and
// sends each message through every connected broker. The receiver drops
// duplicates. As long as one broker works for both players, the game works.
import mqtt from 'mqtt';
import { log } from './log.svelte.js';

export const BROKERS = [
  { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
  { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
];
const ROOT = 'certamen-romanum/v3';
const CONNECT_TIMEOUT = 10_000;

/**
 * Open a two-way channel for one room.
 * Resolves as soon as the first broker is connected; others join when ready.
 * @param {{room:string, role:'host'|'guest', clientId:string, onMessage:Function, onStatus?:Function}} o
 */
export function openChannel(o) {
  const inTopic = `${ROOT}/${o.room}/${o.role === 'host' ? 'g2h' : 'h2g'}`;
  const outTopic = `${ROOT}/${o.room}/${o.role === 'host' ? 'h2g' : 'g2h'}`;
  const live = new Set(); // connected clients
  const all = [];
  const seen = new Set();
  const seenOrder = [];
  let seq = 0;
  const nonce = Math.random().toString(36).slice(2, 7); // keeps message ids unique across rejoins
  let closed = false;

  const status = () => o.onStatus?.(live.size ? 'online' : 'offline');

  function receive(raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.mid) {
      if (seen.has(m.mid)) return;
      seen.add(m.mid);
      seenOrder.push(m.mid);
      if (seenOrder.length > 2000) seen.delete(seenOrder.shift());
    }
    o.onMessage(m);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let failures = 0;
    const api = {
      send(msg) {
        const payload = JSON.stringify({ ...msg, from: o.clientId, mid: `${o.clientId}:${nonce}:${++seq}` });
        for (const c of live) c.publish(outTopic, payload, { qos: 1 });
      },
      close() {
        closed = true;
        const bye = JSON.stringify({ t: 'bye', from: o.clientId, mid: `${o.clientId}:${nonce}:bye` });
        for (const c of live) { try { c.publish(outTopic, bye, { qos: 0 }); } catch {} }
        setTimeout(() => all.forEach((c) => c.end(true)), 200);
      },
      get relays() { return [...live].map((c) => c.__name); },
    };

    BROKERS.forEach((b) => {
      const started = performance.now();
      const client = mqtt.connect(b.url, {
        clientId: `${o.clientId}-${b.name}-${Math.random().toString(36).slice(2, 6)}`,
        clean: true,
        keepalive: 20,
        connectTimeout: CONNECT_TIMEOUT,
        reconnectPeriod: 3_000,
        will: { topic: outTopic, payload: JSON.stringify({ t: 'bye', from: o.clientId, mid: `${o.clientId}:${nonce}:bye` }), qos: 1 },
      });
      client.__name = b.name;
      all.push(client);
      let everConnected = false;

      const giveUp = setTimeout(() => {
        if (everConnected) return;
        log(`relay ${b.name}: no answer in ${CONNECT_TIMEOUT / 1000}s — skipping it`);
        client.end(true);
        if (++failures === BROKERS.length && !settled) {
          settled = true;
          const err = new Error('no relay reachable');
          err.type = 'network';
          reject(err);
        }
      }, CONNECT_TIMEOUT + 500);

      client.on('connect', () => {
        client.subscribe(inTopic, { qos: 1 }, (err) => {
          if (err) { log(`relay ${b.name}: subscribe failed (${err.message})`); return; }
          if (closed) return client.end(true);
          live.add(client);
          status();
          if (!everConnected) {
            everConnected = true;
            clearTimeout(giveUp);
            log(`relay ${b.name} connected in ${Math.round(performance.now() - started)} ms`);
          } else {
            log(`relay ${b.name} reconnected`);
          }
          if (!settled) { settled = true; resolve(api); }
        });
      });
      client.on('close', () => {
        if (live.delete(client)) {
          log(`relay ${b.name} dropped${closed ? '' : ' — retrying'}`);
          status();
        }
      });
      client.on('error', (e) => log(`relay ${b.name} error: ${e.message}`));
      client.on('message', (_t, buf) => receive(buf.toString()));
    });
    log(`connecting to ${BROKERS.length} relays in parallel: ${BROKERS.map((b) => b.name).join(', ')}`);
  });
}
