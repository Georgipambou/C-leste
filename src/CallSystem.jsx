import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  SpeakerLayout,
  useCallStateHooks,
  useCalls,
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

// Place un fichier de sonnerie ici : /public/sounds/ringtone.mp3
const RINGTONE_URL = '/sounds/ringtone.mp3';

// Interrupteur global : passe à true quand la fonctionnalité est prête à être exposée.
// Tant que c'est false, aucune connexion Stream n'est ouverte et les boutons
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
  const ringtoneRef = useRef(null);

  useEffect(() => {
    if (!CALLS_ENABLED || !currentUser?.id || !sb) return;
    let cancelled = false;

    async function init() {
      const { data, error } = await sb.functions.invoke('stream-token');
      if (error || !data?.token) {
        console.error('[Call] Erreur récupération token Stream:', error);
        setCallError("Impossible de se connecter au service d'appel.");
        return;
      }
      const c = StreamVideoClient.getOrCreateInstance({
        apiKey: STREAM_API_KEY,
        user: { id: currentUser.id, name: currentUser.name, image: currentUser.avatar_url },
        token: data.token,
      });
      if (!cancelled) setClient(c);
    }
    init();
    return () => { cancelled = true; };
  }, [currentUser?.id, sb]);

 
  const startCall = useCallback(async (targetUserId, { video = true } = {}) => {
    if (!client || !sb) {
      console.error('[Call] startCall appelé sans client Stream prêt.');
      setCallError("Le service d'appel n'est pas encore prêt, réessaie dans un instant.");
      return;
    }
    setCallError(null);
    setConnecting(true);
    try {
      const { error: ensureError } = await sb.functions.invoke('stream-ensure-users', {
        body: { userIds: [currentUser.id, targetUserId] },
      });
      if (ensureError) throw new Error('ensure-users: ' + ensureError.message);

      const callId = crypto.randomUUID();
      const call = client.call('default', callId);

      await call.getOrCreate({
        ring: true,
        data: {
          members: [{ user_id: currentUser.id }, { user_id: targetUserId }],
          custom: { video },
        },
      });
      await call.join();

      if (!video) { try { await call.camera.disable(); } catch (e) {} }

      setMinimized(false);
      setActiveCall(call);
    } catch (e) {
      console.error('[Call] Échec du démarrage de l\'appel:', e);
      setCallError("L'appel n'a pas pu démarrer : " + (e?.message || 'erreur inconnue'));
    } finally {
      setConnecting(false);
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

  const value = { client, startCall, endCall, activeCall, connecting, minimized, setMinimized, showComingSoon };

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
function useRingtone(active) {
  useEffect(() => {
    if (!active) return;
    const audio = new Audio(RINGTONE_URL);
    audio.loop = true;
    audio.play().catch(() => {});
    return () => { audio.pause(); audio.currentTime = 0; };
  }, [active]);
}

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
  if (callingState !== CallingState.RINGING) return null;

  const accept = async () => {
    try {
      const isVideo = call.state.custom?.video !== false;
      await call.join();
      if (!isVideo) { try { await call.camera.disable(); } catch (e) {} }
      onAccepted(call);
    } catch (e) {
      console.error('[Call] Échec pour rejoindre l\'appel:', e);
      onError("Impossible de rejoindre l'appel.");
    }
  };
  const decline = async () => { try { await call.leave({ reject: true }); } catch (e) {} };

  return <IncomingCallScreen call={call} onAccept={accept} onDecline={decline} T={T} />;
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


function useElapsedSeconds(active) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return sec;
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Écran d'appel entrant
// ─────────────────────────────────────────────
function IncomingCallScreen({ call, onAccept, onDecline, T }) {
  useRingtone(true);
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
  const participants = useParticipants();
  const { microphone, isMute: isMicMuted } = useMicrophoneState();
  const { camera, isMute: isCamMuted } = useCameraState();
  const callingState = useCallCallingState();
  const other = participants.find(p => !p.isLocalParticipant);
  const isRinging = !other && callingState !== CallingState.LEFT;
  useRingtone(isRinging);
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
            <div style={{ width: 110, height: 110, borderRadius: '50%', background: T.gradGold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#000' }}>…</div>
            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, margin: 0 }}>Appel en cours…</p>
            <p style={{ opacity: 0.55, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>En attente de réponse</p>
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