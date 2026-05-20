// =====================================================================
//  App.jsx — Application sociale premium
//  Stack : React + Supabase + Tailwind
//  Adapté à ton schéma : profiles, posts, likes, comments, comment_likes,
//  comment_replies, connections, conversations, messages, statuses,
//  status_likes, status_views, notifications, saved_posts, blocks, badges
//
//  Setup avant de coller :
//    npm i @supabase/supabase-js lucide-react
//  Et un fichier ./supabaseClient.js qui exporte `supabase`.
// =====================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, Bell, MessageCircle, User, Search, Plus, Heart, MessageSquare,
  Share2, Bookmark, MoreHorizontal, Send, Image as ImageIcon, X,
  ArrowLeft, Camera, Settings, LogOut, Check, CheckCheck, Eye,
  Pin, Edit2, Trash2, Reply, Users, Sparkles, Mic, Paperclip
} from "lucide-react";

/* ============================================================
   CONTEXTE GLOBAL
============================================================ */
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

/* ============================================================
   HELPERS
============================================================ */
const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}j`;
  return new Date(date).toLocaleDateString("fr-FR");
};

const cls = (...a) => a.filter(Boolean).join(" ");

/* ============================================================
   APP ROOT
============================================================ */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("feed"); // feed | notifs | messages | profile | search | post | conv | userProfile
  const [viewParam, setViewParam] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "auto");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  // Theme
  useEffect(() => {
    const dark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Profile
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  // Compteurs realtime
  useEffect(() => {
    if (!session) return;
    const loadCounts = async () => {
      const [{ count: n }, { data: convs }] = await Promise.all([
        supabase.from("notifications").select("*", { count: "exact", head: true })
          .eq("user_id", session.user.id).eq("read", false),
        supabase.from("conversations").select("id")
          .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`),
      ]);
      setUnreadNotifs(n || 0);
      if (convs?.length) {
        const { count: m } = await supabase.from("messages").select("*", { count: "exact", head: true })
          .in("conv_id", convs.map(c => c.id))
          .neq("sender_id", session.user.id)
          .eq("is_read", false);
        setUnreadMsgs(m || 0);
      }
    };
    loadCounts();

    const ch = supabase.channel("global-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` }, loadCounts)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, loadCounts)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [session]);

  const navigate = (v, p = null) => { setView(v); setViewParam(p); window.scrollTo(0, 0); };

  if (!session) return <AuthScreen />;
  if (!profile) return <LoadingScreen />;
  if (profile.suspended) return <SuspendedScreen onLogout={() => supabase.auth.signOut()} />;

  return (
    <AppContext.Provider value={{ session, profile, setProfile, navigate, theme, setTheme }}>
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-[system-ui]">
        <main className="max-w-2xl mx-auto pb-24 md:pb-8 md:pt-4">
          {view === "feed"        && <FeedScreen />}
          {view === "notifs"      && <NotifsScreen />}
          {view === "messages"    && <MessagesScreen />}
          {view === "conv"        && <ConversationScreen convId={viewParam} />}
          {view === "profile"     && <ProfileScreen userId={profile.id} isMe />}
          {view === "userProfile" && <ProfileScreen userId={viewParam} />}
          {view === "search"      && <SearchScreen />}
          {view === "post"        && <PostDetailScreen postId={viewParam} />}
          {view === "saved"       && <SavedScreen />}
          {view === "settings"    && <SettingsScreen />}
        </main>
        <BottomNav active={view} unreadNotifs={unreadNotifs} unreadMsgs={unreadMsgs} />
      </div>
    </AppContext.Provider>
  );
}

/* ============================================================
   AUTH / LOADING / SUSPENDED
============================================================ */
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [paroisse, setParoisse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").insert({
            id: data.user.id, prenom, nom, paroisse, status: "actif",
            joined_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">✨</div>
          <h1 className="text-2xl font-bold">{mode === "login" ? "Bon retour" : "Rejoins-nous"}</h1>
          <p className="text-sm text-zinc-500 mt-1">Communauté chrétienne premium</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <input className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 outline-none" placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} required />
              <input className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 outline-none" placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} required />
              <input className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 outline-none" placeholder="Paroisse" value={paroisse} onChange={e => setParoisse(e.target.value)} required />
            </>
          )}
          <input type="email" className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 outline-none" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 outline-none" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button disabled={loading} className="w-full p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-50">
            {loading ? "..." : mode === "login" ? "Connexion" : "Créer un compte"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="w-full mt-4 text-sm text-indigo-600 dark:text-indigo-400">
          {mode === "login" ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Se connecter"}
        </button>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
      <div className="animate-spin h-10 w-10 rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>
  );
}

function SuspendedScreen({ onLogout }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-black">
      <div className="text-6xl mb-4">🚫</div>
      <h1 className="text-2xl font-bold mb-2">Compte suspendu</h1>
      <p className="text-zinc-500 mb-6">Contacte un administrateur pour plus d'infos.</p>
      <button onClick={onLogout} className="px-6 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800">Déconnexion</button>
    </div>
  );
}

/* ============================================================
   BOTTOM NAV
============================================================ */
function BottomNav({ active, unreadNotifs, unreadMsgs }) {
  const { navigate, profile } = useApp();
  const items = [
    { id: "feed",     icon: Home,          label: "Accueil" },
    { id: "search",   icon: Search,        label: "Recherche" },
    { id: "notifs",   icon: Bell,          label: "Activité", badge: unreadNotifs },
    { id: "messages", icon: MessageCircle, label: "Messages", badge: unreadMsgs },
    { id: "profile",  icon: User,          label: "Profil" },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 md:hidden">
      <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
        {items.map(it => {
          const Icon = it.icon;
          const isActive = active === it.id || (it.id === "profile" && active === "userProfile");
          return (
            <button key={it.id} onClick={() => navigate(it.id)} className="relative flex flex-col items-center justify-center w-full h-full">
              <Icon size={24} className={cls("transition", isActive ? "text-indigo-600 dark:text-indigo-400 scale-110" : "text-zinc-400")} fill={isActive ? "currentColor" : "none"} strokeWidth={isActive ? 0 : 2} />
              {it.badge > 0 && (
                <span className="absolute top-2 right-1/4 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ============================================================
   FEED
============================================================ */
function FeedScreen() {
  const { profile, navigate } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*, profiles!posts_author_id_fkey(*)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime new posts
  useEffect(() => {
    const ch = supabase.channel("feed-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">✨ Communauté</h1>
        <button onClick={() => navigate("notifs")} className="p-2"><Sparkles size={20} /></button>
      </header>

      {/* Stories */}
      <StoriesBar />

      {/* Composer trigger */}
      <button onClick={() => setComposerOpen(true)} className="w-full px-4 py-3 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition">
        <Avatar url={profile.avatar_url} name={profile.prenom} size={36} />
        <span className="text-zinc-500 flex-1 text-left">Partage quelque chose...</span>
        <Plus size={20} className="text-indigo-600" />
      </button>

      {composerOpen && <Composer onClose={() => setComposerOpen(false)} onPosted={load} />}

      {/* Feed */}
      {loading ? <FeedSkeleton /> : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {posts.map(p => <PostCard key={p.id} post={p} onChange={load} />)}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1,2,3].map(i => (
        <div key={i} className="animate-pulse space-y-3">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
          <div className="h-20 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   POST CARD
============================================================ */
function PostCard({ post, onChange }) {
  const { profile, navigate } = useApp();
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  const author = post.profiles;
  const isMine = post.author_id === profile.id;
  const images = post.img_urls?.length ? post.img_urls : (post.img_url ? [post.img_url] : []);

  const loadMeta = useCallback(async () => {
    const [{ count: lc }, { data: ml }, { count: cc }, { data: sv }] = await Promise.all([
      supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", profile.id).maybeSingle(),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      supabase.from("saved_posts").select("id").eq("post_id", post.id).eq("user_id", profile.id).maybeSingle(),
    ]);
    setLikes(lc || 0); setLiked(!!ml); setCommentCount(cc || 0); setSaved(!!sv);
  }, [post.id, profile.id]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const toggleLike = async () => {
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", profile.id);
      setLiked(false); setLikes(l => l - 1);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: profile.id });
      setLiked(true); setLikes(l => l + 1);
    }
  };

  const toggleSave = async () => {
    if (saved) {
      await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", profile.id);
      setSaved(false);
    } else {
      await supabase.from("saved_posts").insert({ post_id: post.id, user_id: profile.id });
      setSaved(true);
    }
  };

  const deletePost = async () => {
    if (!confirm("Supprimer ce post ?")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    onChange?.();
  };

  const togglePin = async () => {
    await supabase.from("posts").update({ pinned: !post.pinned }).eq("id", post.id);
    onChange?.();
  };

  return (
    <article className="px-4 py-4">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate("userProfile", author.id)}>
          <Avatar url={author?.avatar_url} name={author?.prenom} size={40} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <button onClick={() => navigate("userProfile", author.id)} className="font-semibold truncate hover:underline">
                {author?.prenom} {author?.nom}
              </button>
              {author?.badge && <BadgeIcon code={author.badge} />}
              <span className="text-zinc-400 text-sm">·</span>
              <span className="text-zinc-400 text-sm">{timeAgo(post.created_at)}</span>
              {post.pinned && <Pin size={12} className="text-indigo-500 ml-1" />}
              {post.edited_at && <span className="text-zinc-400 text-xs">(modifié)</span>}
            </div>
            <button onClick={() => setShowMenu(s => !s)} className="p-1 relative">
              <MoreHorizontal size={18} className="text-zinc-500" />
              {showMenu && (
                <div className="absolute right-0 top-8 z-20 bg-white dark:bg-zinc-900 shadow-xl rounded-xl border border-zinc-200 dark:border-zinc-800 py-1 min-w-[160px]">
                  {isMine && <button onClick={togglePin} className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"><Pin size={14}/>{post.pinned ? "Désépingler" : "Épingler"}</button>}
                  {isMine && <button onClick={deletePost} className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2"><Trash2 size={14}/>Supprimer</button>}
                  {!isMine && <button className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">Signaler</button>}
                </div>
              )}
            </button>
          </div>

          {post.text && <p className="mt-1 whitespace-pre-wrap leading-relaxed">{post.text}</p>}

          {post.type === "event" && (
            <div className="mt-3 p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-900">
              <p className="font-semibold text-indigo-700 dark:text-indigo-300">📅 {post.event_title}</p>
              {post.event_date && <p className="text-sm mt-1">{post.event_date}</p>}
              {post.event_loc && <p className="text-sm text-zinc-500">📍 {post.event_loc}</p>}
            </div>
          )}

          {images.length > 0 && (
            <div className="mt-3 rounded-2xl overflow-hidden relative">
              <img src={images[imgIdx]} alt="" className="w-full max-h-[500px] object-cover" />
              {images.length > 1 && (
                <>
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">{imgIdx+1}/{images.length}</div>
                  <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                    {images.map((_, i) => (
                      <button key={i} onClick={() => setImgIdx(i)} className={cls("w-1.5 h-1.5 rounded-full", i === imgIdx ? "bg-white" : "bg-white/40")} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 mt-3 -ml-2">
            <ActionBtn icon={Heart} active={liked} count={likes} onClick={toggleLike} activeColor="text-red-500" />
            <ActionBtn icon={MessageSquare} count={commentCount} onClick={() => setShowComments(s => !s)} />
            <ActionBtn icon={Share2} />
            <div className="flex-1" />
            <button onClick={toggleSave} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Bookmark size={20} className={saved ? "text-indigo-600 fill-current" : "text-zinc-500"} />
            </button>
          </div>

          {showComments && <CommentsSection postId={post.id} onCountChange={setCommentCount} />}
        </div>
      </div>
    </article>
  );
}

function ActionBtn({ icon: Icon, count, active, onClick, activeColor }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
      <Icon size={20} className={cls("transition", active ? activeColor || "text-indigo-600" : "text-zinc-500")} fill={active ? "currentColor" : "none"} />
      {count > 0 && <span className="text-sm text-zinc-600 dark:text-zinc-400">{count}</span>}
    </button>
  );
}

/* ============================================================
   COMPOSER
============================================================ */
function Composer({ onClose, onPosted }) {
  const { profile } = useApp();
  const [text, setText] = useState("");
  const [type, setType] = useState("text"); // text | event
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLoc, setEventLoc] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleFiles = (e) => {
    const arr = Array.from(e.target.files).slice(0, 4);
    setFiles(arr);
  };

  const submit = async () => {
    if (!text.trim() && files.length === 0 && type !== "event") return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const path = `${profile.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("posts").upload(path, file);
        if (!error) {
          const { data } = supabase.storage.from("posts").getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      }
      await supabase.from("posts").insert({
        author_id: profile.id, type, text: text.trim() || null,
        img_urls: urls.length ? urls : null,
        img_url: urls[0] || null,
        event_title: type === "event" ? eventTitle : null,
        event_date: type === "event" ? eventDate : null,
        event_loc: type === "event" ? eventLoc : null,
      });
      onPosted?.(); onClose();
    } finally { setUploading(false); }
  };

  return (
    <Modal onClose={onClose} title="Nouveau post">
      <div className="flex gap-3">
        <Avatar url={profile.avatar_url} name={profile.prenom} size={40} />
        <div className="flex-1 space-y-3">
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder="Que veux-tu partager ?"
            className="w-full bg-transparent outline-none resize-none text-lg" rows={4} />

          <div className="flex gap-2">
            <button onClick={() => setType("text")} className={cls("px-3 py-1.5 rounded-full text-sm", type==="text" ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-800")}>Texte</button>
            <button onClick={() => setType("event")} className={cls("px-3 py-1.5 rounded-full text-sm", type==="event" ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-800")}>Événement</button>
          </div>

          {type === "event" && (
            <div className="space-y-2">
              <input className="w-full p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800" placeholder="Titre" value={eventTitle} onChange={e => setEventTitle(e.target.value)} />
              <input className="w-full p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800" placeholder="Date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              <input className="w-full p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800" placeholder="Lieu" value={eventLoc} onChange={e => setEventLoc(e.target.value)} />
            </div>
          )}

          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt="" className="rounded-xl w-full h-32 object-cover" />
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X size={14} className="text-white" /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button onClick={() => fileRef.current.click()} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ImageIcon size={20} className="text-indigo-600" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
            <button onClick={submit} disabled={uploading} className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-50">
              {uploading ? "..." : "Publier"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   COMMENTS
============================================================ */
function CommentsSection({ postId, onCountChange }) {
  const { profile, navigate } = useApp();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("comments")
      .select("*, profiles!comments_author_id_fkey(*)")
      .eq("post_id", postId).order("created_at", { ascending: true });
    setComments(data || []);
    onCountChange?.(data?.length || 0);
  }, [postId, onCountChange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`comments-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [postId, load]);

  const submit = async () => {
    if (!text.trim()) return;
    setPosting(true);
    await supabase.from("comments").insert({ post_id: postId, author_id: profile.id, text: text.trim() });
    setText(""); setPosting(false);
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
      {comments.map(c => <CommentItem key={c.id} comment={c} onChange={load} />)}
      <div className="flex gap-2 items-center pt-2">
        <Avatar url={profile.avatar_url} name={profile.prenom} size={28} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Ajouter un commentaire..." className="flex-1 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm outline-none" />
        <button onClick={submit} disabled={posting || !text.trim()} className="text-indigo-600 disabled:opacity-30"><Send size={18} /></button>
      </div>
    </div>
  );
}

function CommentItem({ comment, onChange }) {
  const { profile, navigate } = useApp();
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [replies, setReplies] = useState([]);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const isMine = comment.author_id === profile.id;

  const loadMeta = useCallback(async () => {
    const [{ count: lc }, { data: ml }, { data: rep }] = await Promise.all([
      supabase.from("comment_likes").select("*", { count: "exact", head: true }).eq("comment_id", comment.id),
      supabase.from("comment_likes").select("id").eq("comment_id", comment.id).eq("user_id", profile.id).maybeSingle(),
      supabase.from("comment_replies").select("*, profiles!comment_replies_author_id_fkey(*)").eq("parent_comment_id", comment.id).order("created_at"),
    ]);
    setLikes(lc || 0); setLiked(!!ml); setReplies(rep || []);
  }, [comment.id, profile.id]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const toggleLike = async () => {
    if (liked) { await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", profile.id); setLiked(false); setLikes(l => l - 1); }
    else { await supabase.from("comment_likes").insert({ comment_id: comment.id, user_id: profile.id }); setLiked(true); setLikes(l => l + 1); }
  };

  const submitReply = async () => {
    if (!replyText.trim()) return;
    await supabase.from("comment_replies").insert({ parent_comment_id: comment.id, author_id: profile.id, text: replyText.trim() });
    setReplyText(""); setReplying(false); loadMeta();
  };

  const del = async () => {
    if (!confirm("Supprimer ?")) return;
    await supabase.from("comments").delete().eq("id", comment.id);
    onChange?.();
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => navigate("userProfile", comment.profiles.id)}>
        <Avatar url={comment.profiles?.avatar_url} name={comment.profiles?.prenom} size={28} />
      </button>
      <div className="flex-1">
        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-3 py-2 inline-block max-w-full">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm">{comment.profiles?.prenom}</span>
            {comment.profiles?.badge && <BadgeIcon code={comment.profiles.badge} small />}
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{comment.text}</p>
        </div>
        <div className="flex items-center gap-3 px-3 mt-1 text-xs text-zinc-500">
          <span>{timeAgo(comment.created_at)}</span>
          <button onClick={toggleLike} className={cls(liked && "text-red-500 font-semibold")}>J'aime {likes > 0 && `(${likes})`}</button>
          <button onClick={() => setReplying(r => !r)}>Répondre</button>
          {isMine && <button onClick={del} className="text-red-500">Supprimer</button>}
        </div>

        {replying && (
          <div className="flex gap-2 items-center mt-2">
            <input autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === "Enter" && submitReply()}
              placeholder="Répondre..." className="flex-1 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm outline-none" />
            <button onClick={submitReply} className="text-indigo-600"><Send size={16} /></button>
          </div>
        )}

        {replies.length > 0 && (
          <button onClick={() => setShowReplies(s => !s)} className="text-xs text-indigo-600 mt-1 px-3">
            {showReplies ? "Masquer" : `Voir ${replies.length} réponse${replies.length>1?'s':''}`}
          </button>
        )}

        {showReplies && (
          <div className="mt-2 space-y-2 pl-2 border-l-2 border-zinc-100 dark:border-zinc-800">
            {replies.map(r => (
              <div key={r.id} className="flex gap-2">
                <Avatar url={r.profiles?.avatar_url} name={r.profiles?.prenom} size={24} />
                <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl px-3 py-1.5">
                  <span className="font-semibold text-xs">{r.profiles?.prenom}</span>
                  <p className="text-sm">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   STORIES
============================================================ */
function StoriesBar() {
  const { profile, navigate } = useApp();
  const [groups, setGroups] = useState([]); // [{ user, statuses }]
  const [viewer, setViewer] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("statuses")
      .select("*, profiles!statuses_user_id_fkey(*)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    const map = new Map();
    (data || []).forEach(s => {
      if (!map.has(s.user_id)) map.set(s.user_id, { user: s.profiles, statuses: [] });
      map.get(s.user_id).statuses.push(s);
    });
    setGroups(Array.from(map.values()));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-4 no-scrollbar border-b border-zinc-100 dark:border-zinc-900">
        <button onClick={() => setCreating(true)} className="flex flex-col items-center gap-1 shrink-0">
          <div className="relative">
            <Avatar url={profile.avatar_url} name={profile.prenom} size={60} />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full border-2 border-white dark:border-black flex items-center justify-center">
              <Plus size={12} className="text-white" />
            </div>
          </div>
          <span className="text-xs">Ton statut</span>
        </button>
        {groups.map(g => (
          <button key={g.user.id} onClick={() => setViewer(g)} className="flex flex-col items-center gap-1 shrink-0">
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500">
              <div className="p-0.5 bg-white dark:bg-black rounded-full">
                <Avatar url={g.user.avatar_url} name={g.user.prenom} size={56} />
              </div>
            </div>
            <span className="text-xs max-w-[70px] truncate">{g.user.prenom}</span>
          </button>
        ))}
      </div>
      {viewer && <StoryViewer group={viewer} onClose={() => { setViewer(null); load(); }} />}
      {creating && <StoryCreator onClose={() => { setCreating(false); load(); }} />}
    </>
  );
}

function StoryCreator({ onClose }) {
  const { profile } = useApp();
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const submit = async () => {
    if (!text.trim() && !file) return;
    setUploading(true);
    let media_url = null;
    if (file) {
      const path = `${profile.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("statuses").upload(path, file);
      if (!error) media_url = supabase.storage.from("statuses").getPublicUrl(path).data.publicUrl;
    }
    await supabase.from("statuses").insert({
      user_id: profile.id, type: file ? "image" : "text", text: text.trim() || null, media_url,
      expires_at: new Date(Date.now() + 24*3600*1000).toISOString(),
    });
    setUploading(false); onClose();
  };

  return (
    <Modal onClose={onClose} title="Nouveau statut">
      <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
        placeholder="Que se passe-t-il ?" className="w-full bg-transparent outline-none resize-none text-lg" rows={3} />
      {file && <img src={URL.createObjectURL(file)} alt="" className="w-full max-h-60 object-cover rounded-xl" />}
      <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-800 mt-3">
        <button onClick={() => fileRef.current.click()} className="p-2"><ImageIcon className="text-indigo-600" /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => setFile(e.target.files[0])} />
        <button onClick={submit} disabled={uploading} className="px-5 py-2 rounded-full bg-indigo-600 text-white font-semibold disabled:opacity-50">{uploading ? "..." : "Publier"}</button>
      </div>
    </Modal>
  );
}

function StoryViewer({ group, onClose }) {
  const { profile } = useApp();
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const current = group.statuses[idx];

  useEffect(() => {
    if (!current) return;
    supabase.from("status_views").insert({ status_id: current.id, viewer_id: profile.id }).then(() => {});
    setProgress(0);
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(100, (Date.now() - start) / 50);
      setProgress(p);
      if (p >= 100) {
        clearInterval(t);
        if (idx < group.statuses.length - 1) setIdx(idx + 1); else onClose();
      }
    }, 50);
    return () => clearInterval(t);
  }, [current, idx]);

  if (!current) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex gap-1 p-2">
        {group.statuses.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: `${i < idx ? 100 : i === idx ? progress : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-4 py-2 text-white">
        <Avatar url={group.user.avatar_url} name={group.user.prenom} size={32} />
        <span className="font-semibold">{group.user.prenom}</span>
        <span className="text-sm text-white/60">{timeAgo(current.created_at)}</span>
        <div className="flex-1" />
        <button onClick={onClose}><X /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        {current.media_url && <img src={current.media_url} alt="" className="max-h-full max-w-full" />}
        {current.text && <p className="text-white text-2xl text-center font-medium">{current.text}</p>}
      </div>
      <div className="absolute inset-y-0 left-0 w-1/3" onClick={() => idx > 0 && setIdx(idx - 1)} />
      <div className="absolute inset-y-0 right-0 w-1/3" onClick={() => idx < group.statuses.length-1 ? setIdx(idx+1) : onClose()} />
    </div>
  );
}

/* ============================================================
   NOTIFICATIONS
============================================================ */
function NotifsScreen() {
  const { profile, navigate } = useApp();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("notifications")
      .select("*, from:profiles!notifications_from_id_fkey(*)")
      .eq("user_id", profile.id).order("created_at", { ascending: false }).limit(100);
    setNotifs(data || []);
    setLoading(false);
    await supabase.from("notifications").update({ read: true }).eq("user_id", profile.id).eq("read", false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`notifs-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile.id, load]);

  const label = (n) => ({
    like: "a aimé ton post", comment: "a commenté ton post", reply: "a répondu à ton commentaire",
    comment_like: "a aimé ton commentaire", follow: "te suit maintenant",
    status_like: "a aimé ton statut", status_view: "a vu ton statut",
  }[n.type] || n.type);

  return (
    <div>
      <Header title="Activité" />
      {loading ? <FeedSkeleton /> : notifs.length === 0 ? (
        <EmptyState icon={Bell} text="Aucune notification" />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {notifs.map(n => (
            <li key={n.id} onClick={() => n.post_id ? navigate("post", n.post_id) : navigate("userProfile", n.from_id)}
                className={cls("px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900", !n.read && "bg-indigo-50/50 dark:bg-indigo-950/20")}>
              <Avatar url={n.from?.avatar_url} name={n.from?.prenom} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-sm"><span className="font-semibold">{n.from?.prenom} {n.from?.nom}</span> {label(n)}</p>
                <p className="text-xs text-zinc-500">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================
   MESSAGES
============================================================ */
function MessagesScreen() {
  const { profile, navigate } = useApp();
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("conversations")
      .select("*, u1:profiles!conversations_user1_id_fkey(*), u2:profiles!conversations_user2_id_fkey(*)")
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
      .order("created_at", { ascending: false });

    const enriched = await Promise.all((data || []).map(async c => {
      const other = c.user1_id === profile.id ? c.u2 : c.u1;
      const { data: last } = await supabase.from("messages").select("*").eq("conv_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { count: unread } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("conv_id", c.id).neq("sender_id", profile.id).eq("is_read", false);
      return { ...c, other, last, unread };
    }));
    enriched.sort((a, b) => new Date(b.last?.created_at || b.created_at) - new Date(a.last?.created_at || a.created_at));
    setConvs(enriched); setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("convs-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  return (
    <div>
      <Header title="Messages" />
      {loading ? <FeedSkeleton /> : convs.length === 0 ? (
        <EmptyState icon={MessageCircle} text="Aucune conversation" />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {convs.map(c => (
            <li key={c.id} onClick={() => navigate("conv", c.id)} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <Avatar url={c.other?.avatar_url} name={c.other?.prenom} size={52} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="font-semibold truncate">{c.other?.prenom} {c.other?.nom}</p>
                  <span className="text-xs text-zinc-500 shrink-0 ml-2">{c.last && timeAgo(c.last.created_at)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={cls("text-sm truncate", c.unread > 0 ? "font-semibold" : "text-zinc-500")}>
                    {c.last?.type === "image" ? "📷 Photo" : c.last?.type === "audio" ? "🎤 Audio" : c.last?.text || "Démarrer la conversation"}
                  </p>
                  {c.unread > 0 && <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">{c.unread}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversationScreen({ convId }) {
  const { profile, navigate } = useApp();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef();
  const fileRef = useRef();

  useEffect(() => {
    supabase.from("conversations").select("*, u1:profiles!conversations_user1_id_fkey(*), u2:profiles!conversations_user2_id_fkey(*)").eq("id", convId).single()
      .then(({ data }) => setConv({ ...data, other: data.user1_id === profile.id ? data.u2 : data.u1 }));
  }, [convId, profile.id]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("messages").select("*").eq("conv_id", convId).order("created_at");
    setMessages(data || []);
    await supabase.from("messages").update({ is_read: true }).eq("conv_id", convId).neq("sender_id", profile.id).eq("is_read", false);
  }, [convId, profile.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`conv-${convId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conv_id=eq.${convId}` }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [convId, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const t = text.trim(); setText("");
    await supabase.from("messages").insert({ conv_id: convId, sender_id: profile.id, type: "text", text: t, is_read: false });
  };

  const sendImage = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const path = `${convId}/${Date.now()}-${file.name}`;
    await supabase.storage.from("messages").upload(path, file);
    const url = supabase.storage.from("messages").getPublicUrl(path).data.publicUrl;
    await supabase.from("messages").insert({ conv_id: convId, sender_id: profile.id, type: "image", file_url: url, file_name: file.name, is_read: false });
  };

  return (
    <div className="flex flex-col h-screen md:h-[80vh]">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-black/90 backdrop-blur-xl flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-900">
        <button onClick={() => navigate("messages")}><ArrowLeft /></button>
        {conv && <>
          <button onClick={() => navigate("userProfile", conv.other.id)} className="flex items-center gap-2">
            <Avatar url={conv.other?.avatar_url} name={conv.other?.prenom} size={36} />
            <span className="font-semibold">{conv.other?.prenom} {conv.other?.nom}</span>
          </button>
        </>}
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => {
          const mine = m.sender_id === profile.id;
          return (
            <div key={m.id} className={cls("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cls("max-w-[75%] rounded-2xl px-4 py-2", mine ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-800")}>
                {m.type === "image" && <img src={m.file_url} alt="" className="rounded-xl max-h-60 mb-1" />}
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                <div className={cls("text-[10px] mt-1 flex items-center gap-1 justify-end", mine ? "text-white/70" : "text-zinc-500")}>
                  {timeAgo(m.created_at)}
                  {mine && (m.is_read ? <CheckCheck size={12} /> : <Check size={12} />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-zinc-100 dark:border-zinc-900 p-3 flex items-center gap-2 bg-white dark:bg-black">
        <button onClick={() => fileRef.current.click()} className="p-2"><Paperclip size={20} className="text-zinc-500" /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={sendImage} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Message..." className="flex-1 p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 outline-none" />
        <button onClick={send} className="p-2.5 rounded-full bg-indigo-600 text-white"><Send size={18} /></button>
      </div>
    </div>
  );
}

/* ============================================================
   PROFILE
============================================================ */
function ProfileScreen({ userId, isMe }) {
  const { profile: me, navigate } = useApp();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState("posts");

  const load = useCallback(async () => {
    const [{ data: u }, { data: ps }, { count: fr }, { count: fg }, { data: con }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("posts").select("*, profiles!posts_author_id_fkey(*)").eq("author_id", userId).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("connections").select("*", { count: "exact", head: true }).eq("to_id", userId),
      supabase.from("connections").select("*", { count: "exact", head: true }).eq("from_id", userId),
      supabase.from("connections").select("id").eq("from_id", me.id).eq("to_id", userId).maybeSingle(),
    ]);
    setUser(u); setPosts(ps || []);
    setStats({ followers: fr || 0, following: fg || 0, posts: ps?.length || 0 });
    setFollowing(!!con);
  }, [userId, me.id]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (following) {
      await supabase.from("connections").delete().eq("from_id", me.id).eq("to_id", userId);
      setFollowing(false); setStats(s => ({ ...s, followers: s.followers - 1 }));
    } else {
      await supabase.from("connections").insert({ from_id: me.id, to_id: userId });
      setFollowing(true); setStats(s => ({ ...s, followers: s.followers + 1 }));
    }
  };

  const startConv = async () => {
    const a = me.id < userId ? me.id : userId;
    const b = me.id < userId ? userId : me.id;
    const { data: existing } = await supabase.from("conversations")
      .select("id").or(`and(user1_id.eq.${a},user2_id.eq.${b}),and(user1_id.eq.${b},user2_id.eq.${a})`).maybeSingle();
    if (existing) return navigate("conv", existing.id);
    const { data: c } = await supabase.from("conversations").insert({ user1_id: me.id, user2_id: userId }).select().single();
    navigate("conv", c.id);
  };

  if (!user) return <LoadingScreen />;

  return (
    <div>
      <div className="relative">
        <div className="h-40 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
          {user.cover_url && <img src={user.cover_url} className="w-full h-full object-cover" alt="" />}
        </div>
        <div className="px-4 -mt-12 relative">
          <Avatar url={user.avatar_url} name={user.prenom} size={96} className="border-4 border-white dark:border-black" />
          <div className="flex justify-end -mt-12 mb-4 gap-2">
            {isMe ? (
              <button onClick={() => navigate("settings")} className="px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 font-medium text-sm">Modifier</button>
            ) : (
              <>
                <button onClick={startConv} className="px-4 py-2 rounded-full bg-zinc-100 dark:bg-zinc-800 font-medium text-sm">Message</button>
                <button onClick={toggleFollow} className={cls("px-4 py-2 rounded-full font-medium text-sm", following ? "bg-zinc-100 dark:bg-zinc-800" : "bg-indigo-600 text-white")}>
                  {following ? "Suivi" : "Suivre"}
                </button>
              </>
            )}
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{user.prenom} {user.nom}</h1>
              {user.badge && <BadgeIcon code={user.badge} />}
            </div>
            <p className="text-zinc-500">{user.paroisse}</p>
            {user.bio && <p className="mt-2 whitespace-pre-wrap">{user.bio}</p>}
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <span><b>{stats.posts}</b> <span className="text-zinc-500">posts</span></span>
            <span><b>{stats.followers}</b> <span className="text-zinc-500">abonnés</span></span>
            <span><b>{stats.following}</b> <span className="text-zinc-500">abonnements</span></span>
          </div>
        </div>
      </div>
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mt-4">
        {["posts", isMe && "saved"].filter(Boolean).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cls("flex-1 py-3 text-sm font-semibold", tab === t ? "border-b-2 border-indigo-600 text-indigo-600" : "text-zinc-500")}>
            {t === "posts" ? "Posts" : "Sauvegardés"}
          </button>
        ))}
      </div>
      {tab === "posts" && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {posts.map(p => <PostCard key={p.id} post={p} onChange={load} />)}
        </div>
      )}
      {tab === "saved" && <SavedList />}
    </div>
  );
}

function SavedList() {
  const { profile } = useApp();
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    supabase.from("saved_posts").select("post_id, posts(*, profiles!posts_author_id_fkey(*))").eq("user_id", profile.id)
      .then(({ data }) => setPosts((data || []).map(d => d.posts).filter(Boolean)));
  }, [profile.id]);
  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
      {posts.length === 0 ? <EmptyState icon={Bookmark} text="Aucun post sauvegardé" /> :
        posts.map(p => <PostCard key={p.id} post={p} />)}
    </div>
  );
}

/* ============================================================
   SEARCH
============================================================ */
function SearchScreen() {
  const { navigate } = useApp();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    if (!q.trim()) { setUsers([]); setPosts([]); return; }
    const t = setTimeout(async () => {
      const [{ data: u }, { data: p }] = await Promise.all([
        supabase.from("profiles").select("*").or(`prenom.ilike.%${q}%,nom.ilike.%${q}%,paroisse.ilike.%${q}%`).limit(10),
        supabase.from("posts").select("*, profiles!posts_author_id_fkey(*)").ilike("text", `%${q}%`).order("created_at", { ascending: false }).limit(10),
      ]);
      setUsers(u || []); setPosts(p || []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-black/90 backdrop-blur-xl p-3 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
          <Search size={18} className="text-zinc-500" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher..." className="flex-1 bg-transparent outline-none text-sm" />
        </div>
      </header>
      {users.length > 0 && (
        <div className="border-b border-zinc-100 dark:border-zinc-900">
          <h2 className="px-4 pt-3 text-xs font-semibold text-zinc-500 uppercase">Personnes</h2>
          <ul>
            {users.map(u => (
              <li key={u.id} onClick={() => navigate("userProfile", u.id)} className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                <Avatar url={u.avatar_url} name={u.prenom} size={44} />
                <div>
                  <div className="flex items-center gap-1"><p className="font-semibold">{u.prenom} {u.nom}</p>{u.badge && <BadgeIcon code={u.badge} small />}</div>
                  <p className="text-xs text-zinc-500">{u.paroisse}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {posts.length > 0 && (
        <div>
          <h2 className="px-4 pt-3 text-xs font-semibold text-zinc-500 uppercase">Posts</h2>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900">{posts.map(p => <PostCard key={p.id} post={p} />)}</div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   POST DETAIL
============================================================ */
function PostDetailScreen({ postId }) {
  const { navigate } = useApp();
  const [post, setPost] = useState(null);
  useEffect(() => {
    supabase.from("posts").select("*, profiles!posts_author_id_fkey(*)").eq("id", postId).single()
      .then(({ data }) => setPost(data));
  }, [postId]);
  if (!post) return <LoadingScreen />;
  return (
    <div>
      <Header title="Post" back />
      <PostCard post={post} />
    </div>
  );
}

function SavedScreen() {
  return <div><Header title="Sauvegardés" back /><SavedList /></div>;
}

/* ============================================================
   SETTINGS
============================================================ */
function SettingsScreen() {
  const { profile, setProfile, theme, setTheme, navigate } = useApp();
  const [form, setForm] = useState({ prenom: profile.prenom, nom: profile.nom, bio: profile.bio || "", paroisse: profile.paroisse });
  const [saving, setSaving] = useState(false);
  const avRef = useRef(); const cvRef = useRef();

  const save = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ ...form, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setProfile({ ...profile, ...form }); setSaving(false);
  };

  const uploadAvatar = async (e, field) => {
    const file = e.target.files[0]; if (!file) return;
    const path = `${profile.id}/${field}-${Date.now()}`;
    await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ [field]: url }).eq("id", profile.id);
    setProfile({ ...profile, [field]: url });
  };

  return (
    <div>
      <Header title="Paramètres" back />
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-zinc-500 mb-2">Photo de profil</h3>
          <div className="flex gap-3 items-center">
            <Avatar url={profile.avatar_url} name={profile.prenom} size={64} />
            <button onClick={() => avRef.current.click()} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm">Changer</button>
            <input type="file" hidden ref={avRef} accept="image/*" onChange={e => uploadAvatar(e, "avatar_url")} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-500 mb-2">Couverture</h3>
          <button onClick={() => cvRef.current.click()} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm">Changer</button>
          <input type="file" hidden ref={cvRef} accept="image/*" onChange={e => uploadAvatar(e, "cover_url")} />
        </div>
        <div className="space-y-3">
          <input className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} placeholder="Prénom" />
          <input className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Nom" />
          <input className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800" value={form.paroisse} onChange={e => setForm({...form, paroisse: e.target.value})} placeholder="Paroisse" />
          <textarea className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800" rows={3} value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} placeholder="Bio" />
          <button onClick={save} disabled={saving} className="w-full p-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50">{saving ? "..." : "Enregistrer"}</button>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-500 mb-2">Thème</h3>
          <div className="flex gap-2">
            {["light", "dark", "auto"].map(t => (
              <button key={t} onClick={() => setTheme(t)} className={cls("flex-1 p-3 rounded-xl text-sm", theme === t ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-800")}>{t}</button>
            ))}
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="w-full p-3 rounded-xl bg-red-500/10 text-red-500 font-semibold flex items-center justify-center gap-2"><LogOut size={18}/>Déconnexion</button>
      </div>
    </div>
  );
}

/* ============================================================
   UI HELPERS
============================================================ */
function Avatar({ url, name, size = 40, className }) {
  return url ? (
    <img src={url} alt="" style={{ width: size, height: size }} className={cls("rounded-full object-cover bg-zinc-200", className)} />
  ) : (
    <div style={{ width: size, height: size, fontSize: size * 0.4 }} className={cls("rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center", className)}>
      {(name?.[0] || "?").toUpperCase()}
    </div>
  );
}

function BadgeIcon({ code, small }) {
  const map = { verified: { c: "#1d9bf0", e: "✔" }, early: { c: "#f59e0b", e: "⭐" }, creator: { c: "#a855f7", e: "🎨" }, top: { c: "#ef4444", e: "🔥" } };
  const b = map[code]; if (!b) return null;
  return <span style={{ color: b.c, fontSize: small ? 11 : 13 }}>{b.e}</span>;
}

function Header({ title, back }) {
  const { navigate } = useApp();
  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl px-4 py-3 flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-900">
      {back && <button onClick={() => navigate("feed")}><ArrowLeft /></button>}
      <h1 className="text-xl font-bold">{title}</h1>
    </header>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
      <Icon size={48} className="mb-3" />
      <p>{text}</p>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 w-full md:max-w-lg md:rounded-3xl rounded-t-3xl p-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
