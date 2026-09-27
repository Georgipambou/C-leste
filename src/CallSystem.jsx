import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
  useCalls,
  VideoPreview,
  CallingState,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Phone, ChevronDown } from 'lucide-react';

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const CallContext = createContext(null);
export const useCallSystem = () => useContext(CallContext);

const DEFAULT_T = {
  bg: '#0F0F0F', bg2: '#161616', text: '#F1F1F1', muted: '#8A8A8A',
  gold: '#D4A843', goldL: '#F0C96A', gradGold: 'linear-gradient(135deg,#D4A843 0%,#F0C96A 100%)',
  err: '#C84040', ok: '#3DB654', glass: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)',
};

// Sonneries synthétisées, même style que playNotifSound / playChatSound (App.jsx) : aucun fichier requis.
const RING_PATTERNS = {
  // appelé : petit motif cristallin qui se répète
  incoming: { period: 2.6, notes: [[1047, 0, 0.16], [784, 0.16, 0.16], [1047, 0.5, 0.16], [784, 0.66, 0.16], [1319, 1.05, 0.5]] },
  // appelant : musique d'attente douce
  outgoing: { period: 3.6, notes: [[523, 0, 0.45], [659, 0.5, 0.45], [784, 1.0, 0.45], [659, 1.5, 0.45], [880, 2.0, 0.9]] },
};

function startRingtone(kind) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  const pattern = RING_PATTERNS[kind];
  if (!AC || !pattern) return () => {};
  let ctx;
  try { ctx = new AC(); } catch (e) { return () => {}; }
  let next = 0;
  const playCycle = () => {
    const t0 = ctx.currentTime + 0.03;
    pattern.notes.forEach(([freq, at, dur]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t0 + at);
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + dur + 0.05);
    });
  };
  const tick = () => {
    if (ctx.state !== 'running') { ctx.resume().catch(() => {}); return; }
    if (ctx.currentTime >= next) { playCycle(); next = ctx.currentTime + pattern.period; }
  };
  tick();
  const id = setInterval(tick, 200);
  return () => { clearInterval(id); try { ctx.close(); } catch (e) {} };
}

// Sonnerie de l'appelé : ton fichier /public/sounds/ringtone.mp3 (repli sur le carillon généré si le fichier ne joue pas)
const RINGTONE_FILE = '/sounds/ringtone.mp3';

function useRingtone(kind) {
  useEffect(() => {
    if (!kind) return;
    if (kind === 'incoming') {
      const audio = new Audio(RINGTONE_FILE);
      audio.loop = true;
      const tryPlay = () => audio.play().catch(() => {});
      tryPlay();
      document.addEventListener('pointerdown', tryPlay, { once: true });
      return () => {
        document.removeEventListener('pointerdown', tryPlay);
        audio.pause();
        audio.src = '';
      };
    }
    return startRingtone(kind);
  }, [kind]);
}

// Les utilisateurs doivent exister côté Stream avant qu'un appel les référence.
// Résultat mis en cache : une seule requête par utilisateur et par session.
const ensuredUsers = new Map();
function ensureStreamUsers(sb, ids) {
  const missing = ids.filter(id => id && !ensuredUsers.has(id));
  if (missing.length) {
    const p = sb.functions.invoke('stream-ensure-users', { body: { userIds: missing } })
      .then(({ error }) => { if (error) throw new Error('ensure-users: ' + error.message); });
    missing.forEach(id => ensuredUsers.set(id, p));
    p.catch(() => missing.forEach(id => ensuredUsers.delete(id)));
  }
  return Promise.all(ids.filter(Boolean).map(id => ensuredUsers.get(id)));
}
async function logCallMessage(sb, { meId, otherId, status, video, durationSec }) {
  try {
    const { data: existing } = await sb.from('conversations').select('id')
      .or(`and(user1_id.eq.${meId},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${meId})`)
      .maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: created } = await sb.from('conversations').insert({ user1_id: meId, user2_id: otherId }).select().single();
      convId = created?.id;
    }
    if (convId) {
      await sb.from('messages').insert({
        conv_id: convId, sender_id: meId, type: 'call', text: '',
        call_status: status, call_video: video, call_duration: durationSec || 0,
      });
    }
  } catch (e) { console.warn('[Call] log message:', e); }
}

// Interrupteur global : passe à false pour désactiver la fonctionnalité.
// Quand c'est false, aucune connexion Stream n'est ouverte et les boutons
// d'appel affichent juste un message "prochaine mise à jour".
const CALLS_ENABLED = true;

// sb = client Supabase — currentUser = { id, name, avatar_url } — T = thème actif de App.jsx
export function CallProvider({ sb, currentUser, T, children }) {
  const [client, setClient] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [callError, setCallError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const theme = T || DEFAULT_T;
  const clientRef = useRef(null);

  // Connexion Stream : token renouvelé automatiquement, déconnexion propre à la déconnexion du compte
  useEffect(() => {
    if (!CALLS_ENABLED || !sb) return;
    if (!currentUser?.id) {
      const old = clientRef.current;
      clientRef.current = null;
      setClient(null);
      old?.disconnectUser().catch(() => {});
      return;
    }
    try {
      const c = StreamVideoClient.getOrCreateInstance({
        apiKey: STREAM_API_KEY,
        user: { id: currentUser.id, name: currentUser.name, image: currentUser.avatar_url },
        tokenProvider: async () => {
          const { data, error } = await sb.functions.invoke('stream-token');
          if (error || !data?.token) throw new Error('stream-token indisponible');
          return data.token;
        },
        options: { timeout: 20000 },
      });
      clientRef.current = c;
      setClient(c);
    } catch (e) {
      console.error('[Call] Init Stream impossible:', e);
      setCallError("Impossible de se connecter au service d'appel.");
    }
  }, [currentUser?.id, sb]);

  useEffect(() => {
    if (!client) return;
    const handleSignal = async (e) => {
      const { callId, action } = e.detail || {};
      if (!callId) return;
      const [type, id] = callId.includes(':') ? callId.split(':') : ['default', callId];
      const call = client.call(type, id);
      try {
        if (action === 'accept') {
          setMinimized(false);
          setActiveCall(call);
          try { await call.microphone.enable(); } catch (err) {}
          try {
            const isVideo = call.state.custom?.video !== false;
            if (isVideo) await call.camera.enable(); else await call.camera.disable();
          } catch (err) {}
          await call.join({ joinResponseTimeout: 20000, rpcRequestTimeout: 15000 });
        } else if (action === 'decline') {
          await call.leave({ reject: true });
        }
      } catch (err) {
        console.error('[Call] signal natif:', err);
        setCallError("Impossible de rejoindre l'appel depuis l'écran natif.");
      }
    };
    if (window.__celesteIncomingCallSignal) {
      handleSignal({ detail: window.__celesteIncomingCallSignal });
      window.__celesteIncomingCallSignal = null;
    }
    window.addEventListener('celeste-call-signal', handleSignal);
    return () => window.removeEventListener('celeste-call-signal', handleSignal);
  }, [client]);

  const startCall = useCallback(async (targetUserId, { video = true } = {}) => {
    if (!client || !sb) {
      console.error('[Call] startCall appelé sans client Stream prêt.');
      setCallError("Le service d'appel n'est pas encore prêt, réessaie dans un instant.");
      return;
    }
    if (connecting || activeCall) return;
    setCallError(null);
    setConnecting(true);
    try {
      const { data: targetProfile } = await sb.from('profiles').select('no_calls').eq('id', targetUserId).maybeSingle();
      if (targetProfile?.no_calls) {
        setCallError("Cette personne n'accepte pas les appels pour le moment.");
        setConnecting(false);
        return;
      }
      const call = client.call('default', crypto.randomUUID());
      call.__outgoing = true;
      call.__otherUserId = targetUserId;
      setMinimized(false);
      setActiveCall(call);
      await ensureStreamUsers(sb, [currentUser.id, targetUserId]);
      try { if (video) await call.camera.enable(); else await call.camera.disable(); } catch (e) { console.warn('[Call] caméra:', e); }
      try { await call.microphone.enable(); } catch (e) { console.warn('[Call] micro:', e); }
      await call.join({
        joinResponseTimeout: 20000,
        rpcRequestTimeout: 15000,
        create: true,
        ring: true,
        video,
        data: {
          members: [{ user_id: currentUser.id }, { user_id: targetUserId }],
          custom: { video },
          settings_override: {
            ring: { auto_cancel_timeout_ms: 45000, incoming_call_timeout_ms: 45000 },
          },
        },
      });
    } catch (e) {
      console.error('[Call] Échec du démarrage de l\'appel:', e);
      setActiveCall(null);
      setCallError("L'appel n'a pas pu démarrer : " + (e?.message || 'erreur inconnue'));
    } finally {
      setConnecting(false);
    }
  }, [client, sb, currentUser?.id, connecting, activeCall]);

  // Prépare l'utilisateur ciblé côté Stream dès l'affichage du bouton d'appel
  const prepareCall = useCallback((targetUserId) => {
    if (client && sb && currentUser?.id && targetUserId) {
      ensureStreamUsers(sb, [currentUser.id, targetUserId]).catch(() => {});
    }
  }, [client, sb, currentUser?.id]);

  const endCall = useCallback(async () => {
    const c = activeCall;
    setActiveCall(null);
    setMinimized(false);
    try { await c?.leave(); } catch (e) {}
  }, [activeCall]);

  const showComingSoon = useCallback(() => {
    setNotice('📞 Les appels arrivent dans une prochaine mise à jour !');
    setTimeout(() => setNotice(null), 3000);
  }, []);

  const value = { client, startCall, prepareCall, endCall, activeCall, connecting, minimized, setMinimized, showComingSoon };

  return (
    <CallContext.Provider value={value}>
      {children}

      {callError && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999999, background: theme.err, color: '#fff', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontFamily: "'DM Sans',sans-serif", maxWidth: '90vw', textAlign: 'center' }}
             onClick={() => setCallError(null)}>
          {callError}
        </div>
      )}

      {notice && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999999, background: theme.bg2, border: `1px solid ${theme.gold}`, color: theme.text, padding: '10px 18px', borderRadius: 12, fontSize: 13, fontFamily: "'DM Sans',sans-serif", maxWidth: '90vw', textAlign: 'center' }}>
          {notice}
        </div>
      )}

      {client && (
        <StreamVideo client={client}>
          <IncomingCallHandler T={theme} onAccepted={(c) => { setMinimized(false); setActiveCall(c); }} onError={setCallError} />
          {activeCall && (
            <StreamCall call={activeCall}>
              <CallOutcomeLogger sb={sb} meId={currentUser.id} otherId={activeCall.__otherUserId || activeCall.state.createdBy?.id} />
              {minimized
                ? <MinimizedCallBubble onExpand={() => setMinimized(false)} onEnd={endCall} T={theme} />
                : <InCallScreen onEnd={endCall} onMinimize={() => setMinimized(true)} T={theme} />}
            </StreamCall>
          )}
        </StreamVideo>
      )}
    </CallContext.Provider>
  );
}

export function CallButton({ targetUserId, video = true, style, children }) {
  const ctx = useCallSystem();
  const prepare = ctx?.prepareCall;
  useEffect(() => { prepare?.(targetUserId); }, [prepare, targetUserId]);
  if (!ctx) return null;
  const onClick = CALLS_ENABLED
    ? () => ctx.startCall(targetUserId, { video })
    : () => ctx.showComingSoon();
  return (
    <button onClick={onClick} style={style} aria-label={video ? 'Appel vidéo' : 'Appel audio'}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// Détection des appels entrants (instances Call réelles du SDK)
// ─────────────────────────────────────────────
function IncomingCallHandler({ T, onAccepted, onError }) {
  const calls = useCalls();
  return calls.filter(c => !c.isCreatedByMe).map(c => (
    <StreamCall key={c.cid} call={c}>
      <IncomingCallGate call={c} T={T} onAccepted={onAccepted} onError={onError} />
    </StreamCall>
  ));
}

function IncomingCallGate({ call, T, onAccepted, onError }) {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const [answered, setAnswered] = useState(false);
  if (callingState !== CallingState.RINGING || answered) return null;

  const otherUserId = call.state.createdBy?.id;
  const accept = async () => {
    setAnswered(true);
    onAccepted(call);
    try {
      const isVideo = call.state.custom?.video !== false;
      try { if (isVideo) await call.camera.enable(); else await call.camera.disable(); } catch (e) { console.warn('[Call] caméra:', e); }
      try { await call.microphone.enable(); } catch (e) { console.warn('[Call] micro:', e); }
      await call.join({ joinResponseTimeout: 20000, rpcRequestTimeout: 15000 });
    } catch (e) {
      console.error('[Call] Échec pour rejoindre l\'appel:', e);
      setAnswered(false);
      onAccepted(null);
      onError("Impossible de rejoindre l'appel.");
    }
  };
  const decline = async () => { try { await call.leave({ reject: true }); } catch (e) {} };

  return <IncomingCallScreen call={call} onAccept={accept} onDecline={decline} T={T} />;
}

// Ne s'exécute que côté appelant : évite un doublon dans la conversation
function CallOutcomeLogger({ sb, meId, otherId }) {
  const call = useCall();
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!call?.isCreatedByMe) return;
    return call.on('call.rejected', () => { call.__rejected = true; });
  }, [call]);

  useEffect(() => {
    if (!call?.isCreatedByMe || loggedRef.current) return;
    if (callingState !== CallingState.LEFT) return;
    loggedRef.current = true;
    const video = call.state.custom?.video !== false;
    const connectedAt = call.__connectedAt;
    const status = connectedAt ? 'completed' : (call.__rejected ? 'declined' : 'missed');
    const durationSec = connectedAt ? Math.floor((Date.now() - connectedAt) / 1000) : 0;
    logCallMessage(sb, { meId, otherId, status, video, durationSec });
    if (status === 'missed') {
      sb.functions.invoke('send-push', {
        body: { targetUserId: otherId, title: '📵 Appel manqué', body: `${call.state.createdBy?.name || 'Quelqu\u2019un'} a essayé de t'appeler` },
      }).catch(() => {});
    }
  }, [callingState, call, sb, meId, otherId]);

  return null;
}
function IconLabel({ onClick, active, danger, T, icon, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <button onClick={onClick} style={{
        width: 52, height: 52, borderRadius: '50%', border: 'none',
        background: danger ? T.err : 'rgba(255,255,255,0.14)',
        color: active === false ? T.gold : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </button>
      <span style={{ fontSize: 11, opacity: 0.75, color: T.text }}>{label}</span>
    </div>
  );
}


// Chrono basé sur l'heure de connexion de l'appel : ne repart pas à zéro quand on réduit/agrandit l'écran
function useElapsedSeconds(active) {
  const call = useCall();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active || !call) return;
    if (!call.__connectedAt) call.__connectedAt = Date.now();
    const id = setInterval(() => tick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [active, call]);
  return active && call?.__connectedAt ? Math.floor((Date.now() - call.__connectedAt) / 1000) : 0;
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Écran d'appel entrant
// ─────────────────────────────────────────────
function IncomingCallScreen({ call, onAccept, onDecline, T }) {
  useRingtone('incoming');
  const callerName = call.state.createdBy?.name || 'Appel entrant';
  const callerImage = call.state.createdBy?.image;
  const isVideo = call.state.custom?.video !== false;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999,
      background: `radial-gradient(circle at 50% 20%, ${T.bg2} 0%, ${T.bg} 70%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: '70px 24px 60px', color: T.text, fontFamily: "'DM Sans',sans-serif",
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, marginTop: 30 }}>
        {callerImage
          ? <img src={callerImage} alt="" style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${T.gold}` }} />
          : <div style={{ width: 110, height: 110, borderRadius: '50%', background: T.gradGold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#000' }}>{callerName[0]}</div>}
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, margin: 0 }}>{callerName}</p>
        <p style={{ opacity: 0.55, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>{isVideo ? 'Appel vidéo entrant' : 'Appel audio entrant'}</p>
      </div>

      <div style={{ display: 'flex', gap: 64 }}>
        <IconLabel onClick={onDecline} danger T={T} icon={<PhoneOff size={22} />} label="Refuser" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <button onClick={onAccept} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: T.ok, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={22} />
          </button>
          <span style={{ fontSize: 11, opacity: 0.75 }}>Accepter</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Bulle flottante — appel réduit pendant la navigation
// ─────────────────────────────────────────────
function MinimizedCallBubble({ onExpand, onEnd, T }) {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const other = participants.find(p => !p.isLocalParticipant);
  const sec = useElapsedSeconds(true);

  return (
    <div onClick={onExpand} style={{
      position: 'fixed', bottom: 90, right: 16, zIndex: 999997,
      display: 'flex', alignItems: 'center', gap: 10,
      background: T.bg2, border: `1px solid ${T.gold}55`, borderRadius: 30,
      padding: '8px 14px 8px 8px', boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
      cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
    }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.gradGold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#000', flexShrink: 0 }}>
        {(other?.name || '?')[0]}
      </div>
      <span style={{ color: T.text, fontSize: 12 }}>{formatDuration(sec)}</span>
      <button onClick={(e) => { e.stopPropagation(); onEnd(); }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: T.err, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <PhoneOff size={14} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Écran d'appel en cours — plein écran
// ─────────────────────────────────────────────
function InCallScreen({ onEnd, onMinimize, T }) {
  const { useParticipants, useMicrophoneState, useCameraState, useCallCallingState } = useCallStateHooks();
  const call = useCall();
  const participants = useParticipants();
  const { microphone, isMute: isMicMuted } = useMicrophoneState();
  const { camera, isMute: isCamMuted } = useCameraState();
  const callingState = useCallCallingState();
  const other = participants.find(p => !p.isLocalParticipant);
  const wasConnected = useRef(false);
  if (other) wasConnected.current = true;
  useEffect(() => {
    if (wasConnected.current && !other) onEnd();
  }, [other]);
  const isRinging = !wasConnected.current && !other && callingState !== CallingState.LEFT;
  useRingtone(isRinging && call?.__outgoing ? 'outgoing' : null);
  useEffect(() => { if (callingState === CallingState.LEFT) onEnd(); }, [callingState]);
  const sec = useElapsedSeconds(!!other);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999,
      background: isRinging ? `radial-gradient(circle at 50% 20%, ${T.bg2} 0%, ${T.bg} 70%)` : T.bg,
      display: 'flex', flexDirection: 'column', color: T.text, fontFamily: "'DM Sans',sans-serif",
    }}>
      {/* Barre du haut : réduire + statut connexion */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
        <button onClick={onMinimize} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronDown size={18} />
        </button>
        {callingState === 'reconnecting' && (
          <span style={{ background: T.err, color: '#fff', fontSize: 11, padding: '4px 10px', borderRadius: 10 }}>Connexion instable…</span>
        )}
        <div style={{ width: 36 }} />
      </div>

      {isRinging ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '30px 24px 60px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, marginTop: 30 }}>
            {call?.state.custom?.video !== false && !isCamMuted ? (
              <div style={{ width: 200, height: 270, borderRadius: 18, overflow: 'hidden', border: `2px solid ${T.gold}`, background: '#000' }}>
                <VideoPreview />
              </div>
            ) : (
              <div style={{ width: 110, height: 110, borderRadius: '50%', background: T.gradGold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#000' }}>…</div>
            )}
            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, margin: 0 }}>Appel en cours…</p>
            <p style={{ opacity: 0.55, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>{callingState === CallingState.JOINING ? 'Connexion…' : 'En attente de réponse'}</p>
          </div>
          <IconLabel onClick={onEnd} danger T={T} icon={<PhoneOff size={22} />} label="Annuler" />
        </div>
      ) : (
        <>
          <div style={{ flex: 1, position: 'relative', background: '#000' }}>
            <SpeakerLayout />
            <span style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 10 }}>{formatDuration(sec)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', padding: '20px 24px calc(20px + env(safe-area-inset-bottom,0px))', background: T.bg2 }}>
            <IconLabel onClick={() => microphone.toggle()} active={!isMicMuted} T={T} icon={isMicMuted ? <MicOff size={20} /> : <Mic size={20} />} label={isMicMuted ? 'Micro coupé' : 'Micro'} />
            <IconLabel onClick={() => camera.toggle()} active={!isCamMuted} T={T} icon={isCamMuted ? <VideoOff size={20} /> : <VideoIcon size={20} />} label={isCamMuted ? 'Caméra coupée' : 'Caméra'} />
            <IconLabel danger T={T} onClick={onEnd} icon={<PhoneOff size={20} />} label="Raccrocher" />
          </div>
        </>
      )}
    </div>
  );
}