/**
 * Céleste — Version Premium 9.0 (FUSION)
 * Design: Noir absolu · Gold vibrant · Glassmorphism · Animations cinématiques
 * Base: Céleste v3 (src_src_App_4.jsx) + nouvelles fonctionnalités App 9
 *
 * Nouveautés fusionnées depuis App (9).jsx :
 *  - Logique complète : comment_likes, comment_replies, saved_posts, blocks, badges
 *  - SavedPosts tab dans le profil
 *  - Notifications Supabase (table notifications)
 *  - Compteurs en temps réel (unread notifs, unread msgs)
 *  - CommentItem avec likes & réponses (threads)
 *  - StoriesBar enrichie
 *
 * Fonctionnalités PRÉSERVÉES de Céleste :
 *  - ErrorBoundary, InstallBanner, FlagSelector
 *  - Audio synthétique (playNotifSound)
 *  - Glassmorphism & animations CSS-in-JS (objet T)
 *  - MediaPlayer vidéo, vocal, fichiers
 *  - ChatScreen avec enregistrement audio
 *  - AdminPanel, OrgView, UserView, StatusViewer
 *  - Push notifications (subscribePush)
 */
import AdminSoundsPanel from "./components/AdminSoundsPanel";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  groupMessagesByDay, DayDivider,
  QUICK_REACTIONS, toggleReaction, ReactionPicker, ReactionBar,
  useDoubleTap, HeartBurst,
  ReplyComposerBar, MessageReplyQuote,
  useTypingIndicator, TypingIndicator,
  useTypingIndicatorForConvs,
  editMessage, EditedBadge,
  ChatSearchBar, filterMessagesByQuery,
  SwipeToReply, useLongPress, InlineReactionPicker,
  ConversationInfoScreen, ConvPinGateScreen, isConvLocked, removeConvLock,
  isConvMuted
} from "./ChatExtras";
import { enqueueMessage, getQueueForConv, getConvStatuses, subscribeQueue, processQueue, retryMessage, trackFileSend, updateFileSend, removeFileSend, getFileSendsForConv, subscribeFileSends } from "./lib/messageQueue";
import { processGroupQueue } from "./lib/groupMessageQueue";
import { CreateGroupModal, GroupPrivacySetting, useMyGroups, GroupRow, GroupChatScreen, usePendingGroupInvites, PendingGroupInviteCard, isGroupPinned, toggleGroupPin, isGroupFavorite, toggleGroupFavorite, isGroupHidden, hideGroupForMe } from "./Groups";

import {
  useState, useRef, useEffect, useCallback, useMemo, memo, createContext, useContext
} from "react";
import {
  Trash2, Mail, Mic, Camera, Image, Wrench,
  Edit2, Bell, Heart, MessageCircle,
  Send, X, Plus, Search, Settings,
  User, Users, ChevronLeft, ChevronRight, MoreVertical,
  Play, Pause, Volume2,  VolumeX, Maximize2, Minimize2, Zap, Star,
  Bookmark, Share2, MoreHorizontal, Pin,
  Reply, ArrowLeft, Check, CheckCheck, Copy, ChevronDown,
  Eye, Paperclip, LogOut, Sparkles, FileText, Video, EyeOff, Smartphone, ExternalLink, ShoppingBag, AlertTriangle, Wifi, WifiOff, MapPin, Languages, Flag, Lock, Ban, BellOff, XCircle, PartyPopper, Grid,  Music2, UserCheck, Calendar, Clock, UserPlus, BarChart3, CheckCircle2, Phone, MessageCircleOff,
  Globe

} from "lucide-react";

import { ProfileViewsCard, DiscoverPeopleSection, logProfileView, ProfileHeader } from "./ProfileDashboard";
import { DuoButton, DuoBadge, DuoPrivacySetting, saveDuoCollaborators } from "./Duo";
import DepositScreen from "./DepositScreen";
import { MarketplaceFields, ForSaleButton, ProductBuyModal } from "./Marketplace";
import TransactionsScreen from "./Transactions";
import { CallProvider, CallButton } from "./CallSystem";
import { createClient } from "@supabase/supabase-js";
import { subscribePush, sendPushToUser } from "./usePush";
import React from "react"; 
import emailjs from "@emailjs/browser";
import { uploadToR2 } from "./uploadMedia";
import { autoExtractAndAttachSound } from "./lib/soundExtraction";
import { PrivacyScreen } from '@capacitor-community/privacy-screen';
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Geolocation } from '@capacitor/geolocation';
import { App as CapApp } from '@capacitor/app';
import { SendIntent } from 'send-intent';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import EasyCrop from "react-easy-crop";
import { setNativeBackground } from "./nativeBackground";
import { confirmAction, resolveConfirmAction } from "./confirmAction";
import FeedViewer from "./FeedViewer";
import SearchExplorer from "./SearchExplorer";
import CameraStudioModal from "./CameraStudioModal";
import SharePostModal from "./SharePostModal";
import ContentQuizModal from "./components/ContentQuizModal";
import { pauseOtherVideos as __pauseOtherPostVideos, releaseActiveVideo as __releaseActivePostVideo } from "./videoRegistry";
import { fetchRankingData, rankPosts, fetchCommunityIds, fetchFrequentlyVisitedIds, buildReelSessionQueue, buildPhotoSessionQueue } from "./lib/recommendation/useFeedRanking";
import { createSessionAffinity } from "./lib/recommendation/sessionAffinity";
import CategoryPicker from "./components/CategoryPicker";
import SoundPickerButton from "./components/SoundPickerButton";
import SoundDetailModal from "./components/SoundDetailModal";
import StickerPicker from "./components/StickerPicker";

import VideoTrimModal from "./components/VideoTrimModal";
import StickerDetailModal from "./components/StickerDetailModal";
import { Sticker as StickerIcon } from "lucide-react";
import SoundDiscBadge from "./components/SoundDiscBadge";
import { saveDraft } from "./lib/draftsStore";
import DraftsGallery from "./components/DraftsGallery";
import AdminStickersPanel from "./components/AdminStickersPanel";
// Mémoïsation pour éviter les re-renders inutiles
const MemoFeed = React.memo(({children}) => children);

// ── Caches locaux scopés par compte ─────────────────────────
// Toutes les clés de cache "celeste_xxx_cache" ci-dessous sont désormais
// suffixées par l'ID du compte actif, pour qu'un appareil/navigateur partagé
// ne fasse jamais flasher les données (messages, statuts, posts…) d'un
// compte précédemment connecté avant que le nouveau fetch ne les écrase.
const CELESTE_CACHE_BASES=["celeste_posts_cache","celeste_convs_cache","celeste_mystatuts_cache","celeste_statuts_cache","celeste_seen_posts","celeste_favs","celeste_pins","celeste_ia_history"];
function celesteScopedKey(base){
  try{return `${base}_${localStorage.getItem("celeste_active_uid")||"anon"}`;}catch(e){return base;}
}
function purgeCelesteUserCaches(){
  try{
    Object.keys(localStorage).forEach(k=>{
      if(CELESTE_CACHE_BASES.some(b=>k===b||k.startsWith(b+"_")))localStorage.removeItem(k);
    });
  }catch(e){}
}
import previewDark from "./assets/preview.webp";
import previewLight from "./assets/preview-light.webp";

// ── SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;
if(!SUPABASE_URL||!SUPABASE_ANON)console.error("Variables Supabase manquantes !");
const memoryAuthStore={};
const safeAuthStorage={
  getItem:(k)=>{try{return localStorage.getItem(k);}catch(e){return memoryAuthStore[k]||null;}},
  setItem:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){memoryAuthStore[k]=v;}},
  removeItem:(k)=>{try{localStorage.removeItem(k);}catch(e){delete memoryAuthStore[k];}}
};
const sb = createClient(SUPABASE_URL||"",SUPABASE_ANON||"",{auth:{storage:safeAuthStorage}});
const haptic=async(style="light")=>{
  try{
    if(Capacitor.isNativePlatform()){
      const map={light:ImpactStyle.Light,medium:ImpactStyle.Medium,heavy:ImpactStyle.Heavy};
      await Haptics.impact({style:map[style]||ImpactStyle.Light});
    }else if(navigator.vibrate){
      const durations={light:10,medium:20,heavy:35};
      navigator.vibrate(durations[style]||10);
    }
  }catch(_){}
};

const playChatSound=(type)=>{
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator();const g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    if(type==="send"){o.frequency.setValueAtTime(880,ctx.currentTime);g.gain.setValueAtTime(0.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);}
    else{o.frequency.setValueAtTime(660,ctx.currentTime);o.frequency.setValueAtTime(880,ctx.currentTime+0.07);g.gain.setValueAtTime(0.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.18);}
    o.start(ctx.currentTime);o.stop(ctx.currentTime+0.2);
  }catch(_){}
};
const PAGE_SIZE=20;
const playLikeSound=()=>{try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.type="sine";o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(260,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(320,ctx.currentTime+0.12);g.gain.setValueAtTime(0.22,ctx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25);o.start(ctx.currentTime);o.stop(ctx.currentTime+0.26);}catch(_){}};
const isNative=Capacitor.isNativePlatform();
const enableScreenProtection=async()=>{if(!isNative)return;try{await PrivacyScreen.enable();}catch(e){}};
const disableScreenProtection=async()=>{if(!isNative)return;try{await PrivacyScreen.disable();}catch(e){}};

// ── CONTEXTE GLOBAL ───────────────────────────────────────
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// ── PALETTE PREMIUM ───────────────────────────────────────
const getThemePalette = (mode) => {
 
  // ─── FACEBOOK — Azur institutionnel ────────────────────────────────────────
  // Blanc pur · Bleu confiance · Netteté maximale · Ombres légères
  if (mode === "facebook") { return {
    bg:         "#FFFFFF",
    bg2:        "#F0F2F5",
    bg3:        "#E4E6EB",
    card:       "rgba(0,0,0,0.025)",
    cardSolid:  "#F0F2F5",
    glass:      "rgba(0,0,0,0.025)",
    glassMid:   "rgba(0,0,0,0.050)",
    border:     "rgba(0,0,0,0.10)",
    borderHi:   "rgba(0,0,0,0.17)",
    text:       "#050505",
    sub:        "#62656B",
    muted:      "#BCC0C4",
    gold:       "#1877F2",
    goldL:      "#45A0FF",
    goldD:      "#0558D4",
    goldBg:     "rgba(24,119,242,0.08)",
    goldBg2:    "rgba(24,119,242,0.16)",
    navy:       "#1877F2",
    navyBg:     "rgba(24,119,242,0.12)",
    err:        "#E23737",
    ok:         "#31A24C",
    warn:       "#F09400",
    gradGold:   "linear-gradient(135deg,#1877F2 0%,#45A0FF 50%,#0558D4 100%)",
    gradGoldV:  "linear-gradient(180deg,#1877F2 0%,#45A0FF 100%)",
    gradDark:   "linear-gradient(160deg,#F0F2F5 0%,#FFFFFF 100%)",
    glow:       "0 0 40px rgba(24,119,242,0.12)",
    glowGold:   "0 0 16px rgba(24,119,242,0.35)",
    shadowCard: "0 2px 8px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9)",
  }; }
 
  // ─── YOUTUBE — Écarlate maîtrisé ───────────────────────────────────────────
  // Blanc propre · Rouge affiné (pas trop agressif) · Impact clair
  if (mode === "youtube") { return {
    bg:         "#0F0F0F",
    bg2:        "#161616",
    bg3:        "#1F1F1F",
    card:       "rgba(255,255,255,0.04)",
    cardSolid:  "#181818",
    glass:      "rgba(255,255,255,0.04)",
    glassMid:   "rgba(255,255,255,0.08)",
    border:     "rgba(255,255,255,0.08)",
    borderHi:   "rgba(204,0,0,0.30)",
    text:       "#F1F1F1",
    sub:        "#AAAAAA",
    muted:      "#3A3A3A",
    gold:       "#CC0000",   // Rouge plus doux que #FF0000 — moins agressif
    goldL:      "#FF3333",
    goldD:      "#990000",
    goldBg:     "rgba(204,0,0,0.07)",
    goldBg2:    "rgba(204,0,0,0.14)",
    navy:       "#065FD4",
    navyBg:     "rgba(6,95,212,0.12)",
    err:        "#CC0000",
    ok:         "#297A3A",
    warn:       "#E68800",
    gradGold:   "linear-gradient(135deg,#CC0000 0%,#FF3333 50%,#990000 100%)",
    gradGoldV:  "linear-gradient(180deg,#CC0000 0%,#FF3333 100%)",
    gradDark:   "linear-gradient(160deg,#F9F9F9 0%,#FFFFFF 100%)",
    glow:       "0 0 40px rgba(204,0,0,0.12)",
    glowGold:   "0 0 16px rgba(204,0,0,0.35)",
    shadowCard: "0 2px 8px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9)",
  }; }
 
  // ─── WHATSAPP — Menthe digitale ─────────────────────────────────────────────
  // Blanc aéré · Vert digital affiné · Fraîcheur & confiance
  if (mode === "whatsapp") { return {
    bg:         "#0B141A",
    bg2:        "#111B21",
    bg3:        "#202C33",
    card:       "rgba(255,255,255,0.04)",
    cardSolid:  "#182229",
    glass:      "rgba(255,255,255,0.04)",
    glassMid:   "rgba(255,255,255,0.08)",
    border:     "rgba(255,255,255,0.08)",
    borderHi:   "rgba(0,168,120,0.25)",
    text:       "#E9EDEF",
    sub:        "#8696A0",
    muted:      "#3A4A50",
    gold:       "#00A878",   // Vert plus profond & moins saturé que #25D366
    goldL:      "#25C896",
    goldD:      "#007A58",
    goldBg:     "rgba(0,168,120,0.08)",
    goldBg2:    "rgba(0,168,120,0.16)",
    navy:       "#027EB5",
    navyBg:     "rgba(2,126,181,0.12)",
    err:        "#E23030",
    ok:         "#00A878",
    warn:       "#E89200",
    gradGold:   "linear-gradient(135deg,#00A878 0%,#25C896 50%,#007A58 100%)",
    gradGoldV:  "linear-gradient(180deg,#00A878 0%,#25C896 100%)",
    gradDark:   "linear-gradient(160deg,#F0F2F5 0%,#FFFFFF 100%)",
    glow:       "0 0 40px rgba(0,168,120,0.12)",
    glowGold:   "0 0 16px rgba(0,168,120,0.35)",
    shadowCard: "0 2px 8px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9)",
  }; }
 
  // ─── SNAPCHAT — Jaune incandescent ─────────────────────────────────────────
  // Jaune vif mais calibré · Noir pur · Contraste maximum
  if (mode === "snapchat") { return {
  bg:         "#000000",
  bg2:        "#0A0A0A",
  bg3:        "#1C1C1C",
  card:       "rgba(255,255,255,0.04)",
  cardSolid:  "#111111",
  glass:      "rgba(255,255,255,0.04)",
  glassMid:   "rgba(255,255,255,0.08)",
  border:     "rgba(255,255,255,0.08)",
  borderHi:   "rgba(255,252,0,0.30)",
  text:       "#F0F0F0",
  sub:        "#888888",
  muted:      "#3A3A3A",
  gold:       "#FFFC00",
  goldL:      "#FFFF55",
  goldD:      "#FFE500",
  goldBg:     "rgba(255,252,0,0.09)",
  goldBg2:    "rgba(255,252,0,0.18)",
  navy:       "#FFFC00",
  navyBg:     "rgba(255,252,0,0.10)",
  err:        "#E53935",
  ok:         "#2ECC71",
  warn:       "#FF9800",
  gradGold:   "linear-gradient(135deg,#FFFC00 0%,#FFFF55 50%,#FFE500 100%)",
  gradGoldV:  "linear-gradient(180deg,#FFFC00 0%,#FFE500 100%)",
  gradDark:   "linear-gradient(160deg,#0A0A0A 0%,#000000 100%)",
  glow:       "0 0 40px rgba(255,252,0,0.15)",
  glowGold:   "0 0 20px rgba(255,252,0,0.45)",
  shadowCard: "0 8px 40px rgba(0,0,0,0.80), 0 1px 0 rgba(255,255,255,0.03)",
}; }
 
  // ─── TIKTOK — Néon duel ────────────────────────────────────────────────────
  // Noir absolu · Rouge vif + Cyan · Énergie maximale · Identité forte
  if (mode === "tiktok") { return {
    bg:         "#000000",
    bg2:        "#0C0C0C",
    bg3:        "#141414",
    card:       "rgba(255,255,255,0.04)",
    cardSolid:  "#0C0C0C",
    glass:      "rgba(255,255,255,0.04)",
    glassMid:   "rgba(255,255,255,0.08)",
    border:     "rgba(255,255,255,0.09)",
    borderHi:   "rgba(255,255,255,0.16)",
    text:       "#FFFFFF",
    sub:        "#9A9A9A",
    muted:      "#404040",
    gold:       "#FF2645",   // Rouge affiné — plus lisible que #FE2C55
    goldL:      "#FF6B7A",
    goldD:      "#CC1030",
    goldBg:     "rgba(255,38,69,0.09)",
    goldBg2:    "rgba(255,38,69,0.17)",
    navy:       "#25F4EE",
    navyBg:     "rgba(37,244,238,0.12)",
    err:        "#FF2645",
    ok:         "#25F4EE",
    warn:       "#FFCC00",
    gradGold:   "linear-gradient(135deg,#FF2645 0%,#FF6B7A 35%,#25F4EE 100%)",
    gradGoldV:  "linear-gradient(180deg,#FF2645 0%,#25F4EE 100%)",
    gradDark:   "linear-gradient(160deg,#0C0C0C 0%,#000000 100%)",
    glow:       "0 0 40px rgba(255,38,69,0.15)",
    glowGold:   "0 0 20px rgba(255,38,69,0.45)",
    shadowCard: "0 8px 40px rgba(0,0,0,0.70), 0 1px 0 rgba(255,255,255,0.04)",
  }; }
 
  // ─── GOOGLE — Tetrachromie premium ─────────────────────────────────────────
  // Blanc immaculé · Palette 4 couleurs · Équilibre et clarté
  if (mode === "google") { return {
    bg:         "#FFFFFF",
    bg2:        "#F8F9FA",
    bg3:        "#F1F3F4",
    card:       "rgba(0,0,0,0.025)",
    cardSolid:  "#F8F9FA",
    glass:      "rgba(0,0,0,0.025)",
    glassMid:   "rgba(0,0,0,0.05)",
    border:     "rgba(0,0,0,0.08)",
    borderHi:   "rgba(66,133,244,0.30)",
    text:       "#202124",
    sub:        "#5F6368",
    muted:      "#9AA0A6",
    gold:       "#4285F4",
    goldL:      "#1A73E8",
    goldD:      "#1557B0",
    goldBg:     "rgba(66,133,244,0.08)",
    goldBg2:    "rgba(66,133,244,0.15)",
    navy:       "#34A853",
    navyBg:     "rgba(52,168,83,0.10)",
    err:        "#EA4335",
    ok:         "#34A853",
    warn:       "#FBBC04",
    gradGold:   "linear-gradient(135deg,#4285F4 0%,#EA4335 33%,#FBBC04 66%,#34A853 100%)",
    gradGoldV:  "linear-gradient(180deg,#4285F4 0%,#34A853 100%)",
    gradDark:   "linear-gradient(160deg,#F8F9FA 0%,#FFFFFF 100%)",
    glow:       "0 0 40px rgba(66,133,244,0.10)",
    glowGold:   "0 0 16px rgba(66,133,244,0.30)",
    shadowCard: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
  }; }
 
  // ─── LIGHT — Parchemin Or ───────────────────────────────────────────────────
  // Ivoire chaud · Or antiquaire · Élégance intemporelle · Haute lisibilité
  if (mode === "light") { return {
    bg:         "#FDFAF4",   // Ivoire très légèrement chaud — pas blanc froid
    bg2:        "#F5F1E8",
    bg3:        "#EDE8DA",
    card:       "rgba(0,0,0,0.025)",
    cardSolid:  "#F0EBE0",
    glass:      "rgba(0,0,0,0.030)",
    glassMid:   "rgba(0,0,0,0.055)",
    border:     "rgba(0,0,0,0.09)",
    borderHi:   "rgba(0,0,0,0.16)",
    text:       "#1A1714",   // Presque noir, teinté chaud
    sub:        "#6B6560",
    muted:      "#B8B2A8",
    gold:       "#B8820E",   // Or profond — plus élégant que #C9952A
    goldL:      "#D9A830",
    goldD:      "#8A6008",
    goldBg:     "rgba(184,130,14,0.09)",
    goldBg2:    "rgba(184,130,14,0.17)",
    navy:       "#2E619A",
    navyBg:     "rgba(46,97,154,0.12)",
    err:        "#C43838",
    ok:         "#2E9E5A",
    warn:       "#D48A10",
    gradGold:   "linear-gradient(135deg,#B8820E 0%,#D9A830 50%,#8A6008 100%)",
    gradGoldV:  "linear-gradient(180deg,#B8820E 0%,#D9A830 100%)",
    gradDark:   "linear-gradient(160deg,#F5F1E8 0%,#FDFAF4 100%)",
    glow:       "0 0 40px rgba(184,130,14,0.12), 0 0 80px rgba(184,130,14,0.04)",
    glowGold:   "0 0 18px rgba(184,130,14,0.38)",
    shadowCard: "0 4px 16px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.9)",
  }; }
 
  // ─── DARK GREEN — Équinoxe ──────────────────────────────────────────────────
  // Forêt profonde · Jade & émeraude · Chaleur organique · Nature premium
  if (mode === "dark_green") { return {
    bg:         "#060E0B",   // Noir teinté vert — beaucoup plus riche que #0B141A
    bg2:        "#0D1C16",
    bg3:        "#132720",
    card:       "rgba(255,255,255,0.04)",
    cardSolid:  "#0F1E18",
    glass:      "rgba(255,255,255,0.04)",
    glassMid:   "rgba(255,255,255,0.07)",
    border:     "rgba(255,255,255,0.07)",
    borderHi:   "rgba(0,210,140,0.20)",
    text:       "#E5EFEA",
    sub:        "#6E9080",
    muted:      "#253A30",
    gold:       "#00C896",   // Jade vif — plus lisible que #00A884
    goldL:      "#3DDFB8",
    goldD:      "#00966E",
    goldBg:     "rgba(0,200,150,0.09)",
    goldBg2:    "rgba(0,200,150,0.17)",
    navy:       "#60C8FF",
    navyBg:     "rgba(96,200,255,0.12)",
    err:        "#E86060",
    ok:         "#00C896",
    warn:       "#E8B840",
    gradGold:   "linear-gradient(135deg,#00C896 0%,#3DDFB8 50%,#00966E 100%)",
    gradGoldV:  "linear-gradient(180deg,#00C896 0%,#3DDFB8 100%)",
    gradDark:   "linear-gradient(160deg,#0D1C16 0%,#060E0B 100%)",
    glow:       "0 0 40px rgba(0,200,150,0.14), 0 0 80px rgba(0,200,150,0.05)",
    glowGold:   "0 0 20px rgba(0,200,150,0.42)",
    shadowCard: "0 8px 40px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.04)",
  }; }
 
  // ─── DARK BLUE — Cosmos ────────────────────────────────────────────────────
  // Nuit profonde · Bleu électrique & Cyan · Tech premium · Contraste intense
  if (mode === "dark_blue") { return {
    bg:         "#00080F",   // Bleu-noir absolu — plus immersif que #010A15
    bg2:        "#051525",
    bg3:        "#0A2035",
    card:       "rgba(255,255,255,0.04)",
    cardSolid:  "#071830",
    glass:      "rgba(255,255,255,0.04)",
    glassMid:   "rgba(255,255,255,0.08)",
    border:     "rgba(255,255,255,0.08)",
    borderHi:   "rgba(100,200,255,0.20)",
    text:       "#EEF4FF",
    sub:        "#7A92B2",
    muted:      "#2A3A52",
    gold:       "#3BA5F5",   // Bleu électrique vif — plus dynamique que #1DA1F2
    goldL:      "#72CFFF",
    goldD:      "#1A7FCC",
    goldBg:     "rgba(59,165,245,0.09)",
    goldBg2:    "rgba(59,165,245,0.18)",
    navy:       "#5EECD5",
    navyBg:     "rgba(94,236,213,0.12)",
    err:        "#F06060",
    ok:         "#42D9A0",
    warn:       "#F0C040",
    gradGold:   "linear-gradient(135deg,#3BA5F5 0%,#72CFFF 50%,#1A7FCC 100%)",
    gradGoldV:  "linear-gradient(180deg,#3BA5F5 0%,#72CFFF 100%)",
    gradDark:   "linear-gradient(160deg,#051525 0%,#00080F 100%)",
    glow:       "0 0 40px rgba(59,165,245,0.14), 0 0 80px rgba(59,165,245,0.05)",
    glowGold:   "0 0 20px rgba(59,165,245,0.42)",
    shadowCard: "0 8px 40px rgba(0,0,0,0.70), 0 1px 0 rgba(255,255,255,0.04)",
  }; }
 
  // ─── DARK (défaut) — Or impérial ──────────────────────────────────────────
  // Noir absolu · Or chaud · Lisibilité maximale · Prestige & exclusivité
  // C'est le mode identitaire de Céleste — à soigner particulièrement
  return {
    bg:         "#000000",   // Noir absolu — pas de compromise
    bg2:        "#0C0C0C",   // Légèrement relevé pour les surfaces
    bg3:        "#141414",   // Zones tertiaires (inputs, chips)
    card:       "rgba(255,255,255,0.04)",
    cardSolid:  "#111111",
    glass:      "rgba(255,255,255,0.05)",
    glassMid:   "rgba(255,255,255,0.09)",
    border:     "rgba(255,255,255,0.07)",   // Plus visible que 0.06 — meilleure lisibilité
    borderHi:   "rgba(255,255,255,0.14)",
    text:       "#F5F0E8",   // Blanc chaud — repose les yeux, plus premium
    sub:        "#9A9690",   // Gris légèrement chaud pour cohérence
    muted:      "#3D3D3A",   // Muet chaud — séparateurs, disabled
    gold:       "#D4A843",   // Or impérial — plus riche que #C9952A
    goldL:      "#F0C96A",   // Or clair — hover, highlights
    goldD:      "#A07C22",   // Or foncé — pressed, ombres colorées
    goldBg:     "rgba(212,168,67,0.09)",
    goldBg2:    "rgba(212,168,67,0.17)",
    navy:       "#4A7EC9",   // Bleu plus profond que #3A6A9A
    navyBg:     "rgba(74,126,201,0.13)",
    err:        "#E05252",   // Rouge moins agressif que #C84040
    ok:         "#3DB874",   // Vert plus vif — succès visible
    warn:       "#E8A930",   // Ambre — avertissements
    gradGold:   "linear-gradient(135deg,#D4A843 0%,#F0C96A 50%,#A07C22 100%)",
    gradGoldV:  "linear-gradient(180deg,#D4A843 0%,#F0C96A 100%)",
    gradDark:   "linear-gradient(160deg,#0C0C0C 0%,#000000 100%)",
    glow:       "0 0 40px rgba(212,168,67,0.14), 0 0 80px rgba(212,168,67,0.05)",
    glowGold:   "0 0 20px rgba(212,168,67,0.42)",
    shadowCard: "0 8px 40px rgba(0,0,0,0.70), 0 1px 0 rgba(255,255,255,0.04)",
  };
};
 


let _themeMode="dark";
try{_themeMode=localStorage.getItem("celeste_theme")||"dark";}catch(_){}
let T=getThemePalette(_themeMode);
const setAppTheme=(mode)=>{
  _themeMode=mode;
  T=getThemePalette(mode);
  localStorage.setItem("celeste_theme",mode);
  setNativeBackground(T.bg);
  window.dispatchEvent(new CustomEvent("celeste_theme_changed"));
};
function isLightBg(hex) {
  if (!hex || hex[0] !== "#") return false;
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170;
}

// ── UTILITAIRES ───────────────────────────────────────────
const distKm=(lat1,lon1,lat2,lon2)=>{
  if(!lat1||!lon1||!lat2||!lon2)return 99999;
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};
const ago   = ts => {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60000)    return "maintenant";
  if (d < 3600000)  return `${Math.floor(d/60000)}min`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h`;
  return `${Math.floor(d/86400000)}j`;
};
const fmtCount=n=>{if(!n&&n!==0)return"0";if(n>=1000000)return(n/1000000).toFixed(n>=10000000?0:1).replace(/\.0$/,"")+"M";if(n>=1000)return(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,"")+"K";return String(n);};
const hm = ts => new Date(ts).toLocaleTimeString("fr",{hour:"2-digit",minute:"2-digit"});
const initials = (p="",n="") => ((p[0]||"")+(n[0]||"")).toUpperCase()||"?";
const PALETTE = ["#C9952A","#C47890","#4A8AC4","#40A870","#8060C4","#C46040","#50A0A0","#A06090"];
const colorFor = id => PALETTE[(id?.charCodeAt(0)||0)%PALETTE.length];
const mediaReplyLabel=(type,fileName)=>{
  if(type==="photo"||type==="image")return"📷 Photo";
  if(type==="video")return"🎥 Vidéo";
  if(type==="voice")return"🎤 Message vocal";
  if(type==="sticker")return"🎨 Autocollant";
  if(type==="file")return"📎 "+(fileName||"Fichier");
  if(type==="post_share")return"🔗 Publication partagée";
  return null;
};
const renderTextWithMentions = (text, mentions=[]) => {
  if (!text) return "";
  // Les noms mentionnés peuvent contenir des espaces/points/tirets (ex: "M. D.", "Jean-Marc").
  // On construit donc le motif de découpage à partir des vrais noms enregistrés,
  // du plus long au plus court, pour ne jamais couper un nom au milieu.
  const knownNames=[...new Set((mentions||[]).map(m=>m?.name).filter(Boolean))].sort((a,b)=>b.length-a.length);
  const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const knownPattern=knownNames.length?knownNames.map(n=>"@"+escapeRe(n)).join("|"):null;
  const splitRe=knownPattern
    ?new RegExp(`(https?:\\/\\/[^\\s]+|${knownPattern}|@[a-zA-Z0-9_àâäéèêëîïôöùûüç_]+)`,"gi")
    :/(https?:\/\/[^\s]+|@[a-zA-Z0-9_àâäéèêëîïôöùûüç_]+)/gi;
  let mentionCursor=0;
  const parts = text.split(splitRe);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer"
          onClick={e=>e.stopPropagation()}
          style={{color:T.goldL,fontWeight:"600",wordBreak:"break-all",textDecoration:"underline"}}>
          {part}
        </a>
      );
    }
    if (part.startsWith("@")) {
      const username=part.substring(1).toLowerCase();
      let resolvedId=null;
      for(let j=mentionCursor;j<(mentions||[]).length;j++){
        if((mentions[j]?.name||"").toLowerCase()===username){resolvedId=mentions[j].id;mentionCursor=j+1;break;}
      }
      return (
        <span key={i}
          onClick={(e)=>{
            e.stopPropagation();
            e.preventDefault();
            if(resolvedId){window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:resolvedId}}));return;}
            const m=(window.__celesteMembers||[]).find(u=>
              u.prenom?.toLowerCase()===username||
              `${u.prenom||""} ${u.nom||""}`.toLowerCase().replace(/\s+/g,"").includes(username.replace(/\s+/g,""))||
              u.name?.toLowerCase().replace(/\s+/g,"").includes(username.replace(/\s+/g,""))
            );
            if(m?.id){window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:m.id}}));return;}
            sb.from("profiles").select("id,prenom,nom").ilike("prenom",`${username}%`).limit(5).then(({data})=>{
              if(data?.length){
                const match=data.find(u=>u.prenom?.toLowerCase()===username||(u.prenom?.toLowerCase()||"")+(u.nom?.toLowerCase()||"")===username);
                const uid=(match||data[0])?.id;
                if(uid)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid}}));
              }
            });
          }}
          style={{color:T.goldL,fontWeight:"600",cursor:"pointer"}}>
          {part}
        </span>
      );
    }
    return part;
  });
};

const extractMentions=(text,nameMap)=>{
  if(!text||!nameMap?.size)return[];
  const names=[...nameMap.keys()].sort((a,b)=>b.length-a.length);
  const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const re=new RegExp(`@(${names.map(escapeRe).join("|")})`,"gi");
  const found=[];
  let m;
  while((m=re.exec(text))){
    const entry=nameMap.get(m[1].toLowerCase());
    if(entry)found.push(entry);
  }
  return found;
};
const normProfile = p => ({
  isOnline:p.last_seen&&!p.hide_online?((Date.now()-new Date(p.last_seen).getTime())<5*60*1000):false,
country:p.country||null,
quiz_completed:p.quiz_completed||false,
  followersCount:p.followersCount||0,
joined_at:p.joined_at||null,
  latitude:p.latitude||null,
longitude:p.longitude||null,
  id:p.id, name:`${p.prenom||""} ${(p.nom||"")[0]||""}.`.trim(),
  fullName:`${p.prenom||""} ${p.nom||""}`.trim(),
  initials:initials(p.prenom,p.nom), color:colorFor(p.id),
  badge:p.badge||null, status:p.status||"pending",
  paroisse:p.paroisse||"—", age:p.age||null, online:false,
  joined:p.joined_at?.slice(0,10)||"", bio:p.bio||"",
  avatar_url:p.avatar_url||null, cover_url:p.cover_url||null,
  is_admin:p.is_admin||false,
  is_super_admin:p.is_super_admin||false,
  admin_scopes:p.admin_scopes||[],
  is_discoverable:p.is_discoverable!==false,
  whatsapp:p.whatsapp||p.raw_user_meta_data?.whatsapp||null,
  account_type:p.account_type||"membre",screenshot_protection:p.screenshot_protection||false,
  org_name:p.org_name||null, org_type:p.org_type||null,
  org_country:p.org_country||null, org_desc:p.org_desc||null,
  links:Array.isArray(p.links)?p.links.slice(0,5):[],
  celeste_id:p.celeste_id||null,
});

function mapDbPost(p, followedIds) {
  return {id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,eventDate:p.event_date||null,eventTime:p.event_time||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),participants:(p.event_participants||[]).map(x=>x.user_id),comments:(p.comments?.[0]?.count!==undefined?[]:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime(),repliesCount:(c.replies||[]).length}))),commentsCount:p.comments?.[0]?.count!==undefined?(p.comments[0].count||0):(p.comments||[]).reduce((a,c)=>a+1+(c.replies?.length||0),0),saved:[],savesCount:p.saved_posts?.[0]?.count||0,ts:new Date(p.created_at).getTime(),isFollowed:followedIds.has(p.author_id),pinned:p.pinned||false,profile_pinned:p.profile_pinned||false,post_phase:p.post_phase||1,text_background:p.text_background||null,text_font:p.text_font||null,is_for_sale:p.is_for_sale||false,is_ai_generated:p.is_ai_generated||false,is_private:p.is_private||false,comments_disabled:p.comments_disabled||false,whatsapp_contact:p.whatsapp_contact||null,contact_link:p.contact_link||null,expires_at:p.expires_at||null,phase_views:p.phase_views||0,poll_multiple:p.poll_multiple||false,poll_options:p.poll_options||[],poll_votes:p.poll_votes||[],price:p.price||null,stock:p.stock??null,deal_type:p.deal_type||null,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null};
}

// Recherche intelligente : insensible à la casse et aux accents, partout dans le texte
const normalizeSearch = s => (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const matchQuery = (text,query) => !query || normalizeSearch(text).includes(normalizeSearch(query));
const formatEventDate=iso=>{
  if(!iso)return null;
  const d=new Date(iso+"T00:00:00");
  if(isNaN(d))return null;
  const days=["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"];
  const months=["JANV.","FÉVR.","MARS","AVR.","MAI","JUIN","JUIL.","AOÛT","SEPT.","OCT.","NOV.","DÉC."];
  return{dayName:days[d.getDay()],dayNum:d.getDate(),month:months[d.getMonth()]};
};

const compressImage = file => new Promise(resolve=>{
  const img = new window.Image(), url = URL.createObjectURL(file);
  img.onload = ()=>{
    const canvas=document.createElement("canvas"); const MAX=1200;
    let w=img.width,h=img.height;
    if(w>MAX){h=h*MAX/w;w=MAX;} if(h>MAX){w=w*MAX/h;h=MAX;}
    canvas.width=w;canvas.height=h;
    canvas.getContext("2d").drawImage(img,0,0,w,h);
    canvas.toBlob(blob=>resolve(new File([blob],file.name,{type:"image/jpeg"})),"image/jpeg",0.78);
    URL.revokeObjectURL(url);
  }; img.src=url;
});

const playNotifSound=async()=>{
  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return;
    const ctx=new AudioContextClass();
    if(ctx.state==='suspended'){await ctx.resume();}
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1047,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(784,ctx.currentTime+0.15);
    gain.gain.setValueAtTime(0.18,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime+0.4);
  }catch(err){
    console.warn("Audio bloqué par les restrictions iOS:",err);
  }
};

const sendPushNotif=async(title,body)=>{
  if(Notification.permission==="granted"){
    if('serviceWorker' in navigator){
      try{
        const reg=await navigator.serviceWorker.ready;
        if(reg&&reg.showNotification){
          reg.showNotification(title,{body,icon:"/icon-192.png",badge:"/icon-192.png"});
          return;
        }
      }catch(_){}
    }
    new Notification(title,{body});
  }
};

// ── CSS GLOBAL PREMIUM ────────────────────────────────────
const getGS = () => `
 @import url('https://fonts.googleapis.com/css2?family=Sacramento&family=Pacifico&family=Grand+Hotel&family=Yellowtail&family=Permanent+Marker&family=Bangers&family=Creepster&family=Lobster&family=Caveat&family=Bebas+Neue&family=Fredoka&family=Rock+Salt&family=Special+Elite&family=Metal+Mania&family=Great+Vibes&family=Luckiest+Guy&family=Cormorant+Garamond:wght@300..700&family=Space+Grotesk:wght@300..700&display=swap');
@font-face{font-family:'DM Sans';src:url('/fonts/dmsans.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:block;}
@font-face{font-family:'Sora';src:url('/fonts/sora.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:block;}
@media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}

  :root{
    --fs-xs: clamp(9px, 2.6vw, 10px);
    --fs-sm: clamp(11px, 3vw, 12px);
    --fs-base: clamp(13px, 3.6vw, 14px);
    --fs-md: clamp(14px, 4vw, 16px);
    --fs-lg: clamp(17px, 5vw, 20px);
    --fs-xl: clamp(22px, 6.5vw, 28px);
    --gutter: clamp(10px, 4vw, 16px);
  }
  
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    touch-action: manipulation; /* Protège le comportement tactile natif */
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
  }

 html, body, #root {
    height: 100%;
    width: 100%;
    max-width: 100vw;
    overflow: hidden;
    background: ${T.bg};
    overscroll-behavior: contain;
  }

  input, textarea {
    font-size: 16px !important;
    -webkit-user-select: text;
    -moz-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
  }

  .selectable-text, .selectable-text * {
    -webkit-user-select: text;
    -moz-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
  }

  .keyboard-open-hide {
    display: none !important;
  }

  body {
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    font-family: 'Sora', sans-serif;
  }

  ::-webkit-scrollbar {
    width: 0px;
    display: none;
  }

  /* Masque le gros bouton play natif Android/Chromium sur <video> */
  video::-webkit-media-controls-start-playback-button {
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
    -webkit-appearance: none !important;
  }
  video::-webkit-media-controls {
    display: none !important;
  }
  video::-webkit-media-controls-panel {
    display: none !important;
  }

  /* Version corrigée pour le scroll fluide */
  .scroll-container {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* On supprime will-change et scroll-behavior: smooth ici */
  }
  input,textarea,select,button{font-family:'DM Sans',sans-serif;}
  input::placeholder,textarea::placeholder{color:${T.muted};}
  select option{background:#111;color:${T.text};}

  /* ── ANIMATIONS PREMIUM ── */
  @keyframes typingDot {
  0%,80%,100%{transform:scale(0.7);opacity:0.5;}
  40%{transform:scale(1.2);opacity:1;}
}
  @keyframes popIn { from{transform:scale(.7);opacity:0;} to{transform:scale(1);opacity:1;} }
@keyframes heartBurst {
  0%{transform:scale(0.3);opacity:0;}
  30%{transform:scale(1.2);opacity:1;}
  60%{transform:scale(1);opacity:1;}
  100%{transform:scale(1);opacity:0;}
}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
  @keyframes shimmer{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes slideUp{from{transform:translateY(100%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes slideIn{from{transform:translateX(100%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes slideDown{from{transform:translateY(-100%);opacity:0;}to{transform:none;opacity:1;}}
  @keyframes scaleIn{from{transform:scale(0.85);opacity:0;}to{transform:scale(1);opacity:1;}}
  @keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.12);}}
  @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,149,42,0.2);}50%{box-shadow:0 0 50px rgba(201,149,42,0.5);}}
  @keyframes glowPulse{0%,100%{opacity:0.4;}50%{opacity:1;}}
  @keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
  @keyframes starPulse{0%,100%{opacity:.3;transform:scale(0.8);}50%{opacity:1;transform:scale(1.2);filter:drop-shadow(0 0 30px #C9952A);}}
  @keyframes titleReveal{0%{opacity:0;transform:translateY(24px);}100%{opacity:1;transform:none;}}
  @keyframes writeIn{0%{clip-path:inset(0 100% 0 0);}100%{clip-path:inset(0 -10% 0 0);}}
  @keyframes penMove{0%{left:0%;opacity:1;}85%{opacity:1;}100%{left:100%;opacity:0;}}
  @keyframes notifIn{from{opacity:0;transform:translateY(-24px) scale(0.94);}to{opacity:1;transform:none;}}
  @keyframes ripple{0%{transform:scale(0);opacity:0.4;}100%{transform:scale(2.5);opacity:0;}}
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
  .action-icon-btn{transition:transform .18s cubic-bezier(.34,1.56,.64,1),opacity .12s ease;}
  .action-icon-btn:active{transform:scale(.8);opacity:.65;}
 @keyframes badgePulse {
  0%,100% { box-shadow: 0 0 0 2px rgba(29,161,242,0.3), 0 0 10px rgba(29,161,242,0.8), 0 0 20px rgba(29,161,242,0.4); }
  50% { box-shadow: 0 0 0 3px rgba(29,161,242,0.5), 0 0 16px rgba(29,161,242,1), 0 0 32px rgba(29,161,242,0.6); }
}
  @keyframes gradMove{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}
  @keyframes borderGlow{0%,100%{border-color:rgba(201,149,42,0.2);}50%{border-color:rgba(201,149,42,0.6);}}
  @keyframes sendBounce{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
  @keyframes waveform{0%,100%{height:4px;}50%{height:20px;}}
  @keyframes msgIn{from{opacity:0;transform:translateY(8px) scale(0.96);}to{opacity:1;transform:none;}}
  @keyframes statusRing{0%{stroke-dashoffset:251;}100%{stroke-dashoffset:0;}}
  @keyframes navWave{0%,100%{transform:translateX(0) scaleY(1);}50%{transform:translateX(4%) scaleY(1.15);}}
  @keyframes navFall{to{transform:translateY(140px);}}
  @keyframes navRise{0%{transform:translateY(0);opacity:1;}100%{transform:translateY(-90px) translateX(6px);opacity:0;}}
  @keyframes navDrift{0%{transform:translateX(-10%);}100%{transform:translateX(10%);}}
  @keyframes navTwinkle{0%,100%{opacity:.25;transform:scale(0.8);}50%{opacity:1;transform:scale(1.15);}}
  @keyframes navShoot{0%{transform:translate(0,0);opacity:0;}10%{opacity:1;}100%{transform:translate(-120px,70px);opacity:0;}}
  @keyframes navFlash{0%,92%,100%{opacity:0;}94%,97%{opacity:.8;}}
  @keyframes navFallRot{to{transform:translateY(140px) rotate(220deg);}}

  /* ── UTILS ── */
 .premium-card{
    background:${T.card};
    border:1px solid ${T.border};
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
    transition:all 0.3s cubic-bezier(0.4,0,0.2,1);
  }
  .premium-card:active{transform:scale(0.98);}
  .gold-shimmer{
    background:linear-gradient(90deg,${T.gold} 0%,${T.goldL} 50%,${T.gold} 100%);
    background-size:200% auto;
    animation:shimmer 3s linear infinite;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }
  .tap-highlight{transition:opacity 0.15s;} .tap-highlight:active{opacity:0.7;}
`;

// ── ERROR BOUNDARY ────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={hasError:false};}
  static getDerivedStateFromError(){return{hasError:true};}
  componentDidCatch(e,i){console.error("[Céleste]",e,i);}
  render(){
    if(this.state.hasError) return(
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:20,padding:24}}>
        <span style={{fontSize:56,animation:"starPulse 2s infinite"}}>✦</span>
        <p style={{color:T.muted,fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Une erreur est survenue.</p>
        <button onClick={()=>window.location.reload()} style={{background:T.gradGold,border:"none",borderRadius:14,padding:"13px 28px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14}}>Recharger</button>
      </div>
    );
    return this.props.children;
  }
}

// ── INSTALL BANNER PWA ────────────────────────────────────
function InstallBanner(){
  const [prompt,setPrompt]=useState(null);
  const [dismissed,setDismissed]=useState(()=>!!localStorage.getItem("pwa_dismissed"));
  useEffect(()=>{
    const h=e=>{e.preventDefault();setPrompt(e);};
    window.addEventListener("beforeinstallprompt",h);
    return()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);
  if(!prompt||dismissed)return null;
  return(
    <div style={{background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:16,margin:"12px 16px",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,animation:"fadeUp .4s ease"}}>
      <Smartphone size={24} color={T.goldL}/>
      <div style={{flex:1}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:T.goldL}}>Installer Céleste</p>
        <p style={{margin:0,fontSize:11,color:T.sub}}>Accès rapide depuis votre écran d'accueil</p>
      </div>
      <Btn onClick={async()=>{prompt.prompt();const{outcome}=await prompt.userChoice;if(outcome==="accepted")setPrompt(null);}} style={{background:T.gradGold,borderRadius:10,padding:"7px 14px",color:"#000",fontWeight:700,fontSize:12}}>Installer</Btn>
      <Btn onClick={()=>{setDismissed(true);localStorage.setItem("pwa_dismissed","1");}} style={{color:T.muted,padding:4}}><X size={16}/></Btn>
    </div>
  );
}

// ── FLAG SELECTOR ─────────────────────────────────────────
const COUNTRIES=[
  // Afrique Centrale
  {code:"CG",flag:"🇨🇬",name:"Congo-Brazzaville",dial:"+242"},
  {code:"CD",flag:"🇨🇩",name:"RD Congo",dial:"+243"},
  {code:"CM",flag:"🇨🇲",name:"Cameroun",dial:"+237"},
  {code:"GA",flag:"🇬🇦",name:"Gabon",dial:"+241"},
  {code:"CF",flag:"🇨🇫",name:"Centrafrique",dial:"+236"},
  {code:"TD",flag:"🇹🇩",name:"Tchad",dial:"+235"},
  {code:"GQ",flag:"🇬🇶",name:"Guinée Équatoriale",dial:"+240"},
  {code:"AO",flag:"🇦🇴",name:"Angola",dial:"+244"},
  // Afrique de l'Ouest
  {code:"CI",flag:"🇨🇮",name:"Côte d'Ivoire",dial:"+225"},
  {code:"SN",flag:"🇸🇳",name:"Sénégal",dial:"+221"},
  {code:"ML",flag:"🇲🇱",name:"Mali",dial:"+223"},
  {code:"BF",flag:"🇧🇫",name:"Burkina Faso",dial:"+226"},
  {code:"NE",flag:"🇳🇪",name:"Niger",dial:"+227"},
  {code:"BJ",flag:"🇧🇯",name:"Bénin",dial:"+229"},
  {code:"TG",flag:"🇹🇬",name:"Togo",dial:"+228"},
  {code:"GN",flag:"🇬🇳",name:"Guinée",dial:"+224"},
  {code:"MR",flag:"🇲🇷",name:"Mauritanie",dial:"+222"},
  {code:"SL",flag:"🇸🇱",name:"Sierra Leone",dial:"+232"},
  {code:"GH",flag:"🇬🇭",name:"Ghana",dial:"+233"},
  // Afrique du Nord
  {code:"MA",flag:"🇲🇦",name:"Maroc",dial:"+212"},
  {code:"DZ",flag:"🇩🇿",name:"Algérie",dial:"+213"},
  {code:"TN",flag:"🇹🇳",name:"Tunisie",dial:"+216"},
  {code:"LY",flag:"🇱🇾",name:"Libye",dial:"+218"},
  // Afrique de l'Est et Sud
  {code:"MG",flag:"🇲🇬",name:"Madagascar",dial:"+261"},
  {code:"DJ",flag:"🇩🇯",name:"Djibouti",dial:"+253"},
  {code:"KM",flag:"🇰🇲",name:"Comores",dial:"+269"},
  {code:"RW",flag:"🇷🇼",name:"Rwanda",dial:"+250"},
  {code:"BI",flag:"🇧🇮",name:"Burundi",dial:"+257"},
  {code:"MZ",flag:"🇲🇿",name:"Mozambique",dial:"+258"},
  // Îles et Océan Indien
  {code:"MU",flag:"🇲🇺",name:"Maurice",dial:"+230"},
  {code:"SC",flag:"🇸🇨",name:"Seychelles",dial:"+248"},
  {code:"CV",flag:"🇨🇻",name:"Cap-Vert",dial:"+238"},
  {code:"ST",flag:"🇸🇹",name:"São Tomé-et-Príncipe",dial:"+239"},
  // Europe
  {code:"FR",flag:"🇫🇷",name:"France",dial:"+33"},
  {code:"BE",flag:"🇧🇪",name:"Belgique",dial:"+32"},
  {code:"CH",flag:"🇨🇭",name:"Suisse",dial:"+41"},
  {code:"LU",flag:"🇱🇺",name:"Luxembourg",dial:"+352"},
  {code:"MC",flag:"🇲🇨",name:"Monaco",dial:"+377"},
  // Amérique
  {code:"CA",flag:"🇨🇦",name:"Canada",dial:"+1"},
  {code:"HT",flag:"🇭🇹",name:"Haïti",dial:"+509"},
  {code:"GF",flag:"🇬🇫",name:"Guyane française",dial:"+594"},
  {code:"MQ",flag:"🇲🇶",name:"Martinique",dial:"+596"},
  {code:"GP",flag:"🇬🇵",name:"Guadeloupe",dial:"+590"},
  // Océanie
  {code:"NC",flag:"🇳🇨",name:"Nouvelle-Calédonie",dial:"+687"},
  {code:"PF",flag:"🇵🇫",name:"Polynésie Française",dial:"+689"},
  // Autre
  {code:"OTHER",flag:"🌍",name:"Autre",dial:"+"},
];
function FlagSelector({selected,onChange}){
  const [open,setOpen]=useState(false);
  const cur=COUNTRIES.find(c=>c.code===selected)||COUNTRIES[0];
  return(
    <div style={{position:"relative"}}>
      <Btn onClick={()=>setOpen(o=>!o)} style={{padding:"11px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,fontSize:18,display:"flex",alignItems:"center",gap:4,color:T.text}}>
        {cur.flag}<span style={{fontSize:11,color:T.muted}}>▾</span>
      </Btn>
      {open&&(
        <div style={{position:"absolute",top:"110%",left:0,zIndex:99,background:"#111",border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",minWidth:180,boxShadow:"0 20px 40px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"}}>
          {COUNTRIES.map(c=>(
            <Btn key={c.code} onClick={()=>{onChange(c.code);setOpen(false);}} style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,fontSize:13,color:T.text,background:c.code===selected?T.goldBg:"transparent",textAlign:"left"}}>
              <span style={{fontSize:18}}>{c.flag}</span>{c.name}
            </Btn>
          ))}
        </div>
      )}
    </div>
  );
}

// ── COMPOSANTS ATOMIQUES ──────────────────────────────────

let _unseenStatusMap=new Map();
const _statusListeners=new Set();
function _setUnseenStatusMap(m){_unseenStatusMap=m;_statusListeners.forEach(fn=>fn());}
const Av = memo(function Av({u,size=40,online=false,ring=false,onClick,noStatus=false}){
  const [,_forceTick]=useState(0);
  useEffect(()=>{const fn=()=>_forceTick(t=>t+1);_statusListeners.add(fn);return()=>_statusListeners.delete(fn);},[]);
  const _statusId=(!noStatus&&u?.id)?_unseenStatusMap.get(u.id):null;
  const showRing=ring||!!_statusId;
  const handleStatusCapture=e=>{
    if(noStatus||!showRing||!_statusId)return;
    e.stopPropagation();
    const originTab=window.__celesteGetTab?.();
    if(originTab&&originTab!=="statuses")window.__celesteStatusReturnTab=originTab;
    // Referme toute conversation (privée ou groupe) encore montée avant de
    // basculer sur l'onglet Statuts, sinon le chat continue de tourner
    // (et sa vidéo/audio en cours) derrière le lecteur de statut.
    window.dispatchEvent(new CustomEvent("celeste_close_conv"));
    window.__celesteSetTab?.("statuses",()=>window.dispatchEvent(new CustomEvent("celeste_open_status",{detail:{statusId:_statusId}})));
  };
  return(
    <div onClick={onClick} onClickCapture={handleStatusCapture} style={{position:"relative",flexShrink:0,width:size,height:size,cursor:onClick?"pointer":"default"}}>
      {showRing && (
        <svg style={{position:"absolute",inset:-3,width:size+6,height:size+6,zIndex:1,animation:"statusRing 2s ease forwards"}} viewBox={`0 0 ${size+6} ${size+6}`}>
          <circle cx={(size+6)/2} cy={(size+6)/2} r={(size+6)/2-2}
            fill="none" stroke={T.gold} strokeWidth="2"
            strokeDasharray="251" strokeDashoffset="251"
            style={{animation:"statusRing 1.5s ease forwards",transformOrigin:"center",transform:"rotate(-90deg)"}}/>
        </svg>
      )}
      {u?.avatar_url
        ? <img src={u.avatar_url} loading="lazy"
            style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",border:`1.5px solid ${showRing?T.gold:T.border}`,cursor:"pointer"}}
            alt=""
            onClick={e=>{if(onClick)return;e.stopPropagation();window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url:u.avatar_url}}));}}/>
        : <div style={{width:size,height:size,borderRadius:"50%",
            background:`radial-gradient(circle at 35% 35%, ${u?.color||"#666"}cc, ${u?.color||"#444"}44)`,
            border:`1.5px solid ${showRing?T.gold:u?.color||"#888"}44`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:Math.round(size*.36),fontWeight:700,color:u?.color||"#fff",
            fontFamily:"'Cormorant Garamond',serif",
            boxShadow:showRing?`0 0 12px ${u?.color||T.gold}44`:"none"}}>
            {u?.initials||"?"}
          </div>
      }
      {online && <div style={{position:"absolute",bottom:1,right:1,width:Math.round(size*.26),height:Math.round(size*.26),borderRadius:"50%",background:T.ok,border:`2px solid ${T.bg}`,boxShadow:"0 0 8px rgba(64,168,96,0.6)"}}/>}
    </div>
  );
});

function NoteComposerModal({sb,userId,existingText,onClose,onSaved,onDeleted,notify}){
  const[text,setText]=useState(existingText||"");
  const[saving,setSaving]=useState(false);
  const[duration,setDuration]=useState(24);
  const DURATIONS=[{label:"1h",h:1},{label:"6h",h:6},{label:"24h",h:24},{label:"3j",h:72},{label:"7j",h:168}];
  const save=async()=>{
    const trimmed=text.trim();
    if(!trimmed){notify("Écris quelque chose");return;}
    setSaving(true);
    const{error}=await sb.from("notes").upsert({user_id:userId,text:trimmed,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+duration*3600*1000).toISOString()},{onConflict:"user_id"});
    setSaving(false);
    if(error){notify("Erreur · "+error.message);return;}
    onSaved(trimmed);onClose();
  };
  const del=async()=>{
    setSaving(true);
    const{error}=await sb.from("notes").delete().eq("user_id",userId);
    setSaving(false);
    if(error){notify("Erreur · "+error.message);return;}
    onDeleted();onClose();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.bg,width:"100%",borderRadius:"20px 20px 0 0",padding:20,border:`1px solid ${T.border}`,borderBottom:"none",marginBottom:"var(--kb-height,0px)"}}>
       <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Ta note</p>
          <Btn onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:T.muted}}><X size={14}/></Btn>
        </div>
        <textarea value={text} maxLength={60} onChange={e=>setText(e.target.value)} placeholder="Partage une pensée..." autoFocus
          style={{width:"100%",minHeight:70,resize:"none",background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:14,padding:12,color:T.text,fontSize:14,fontFamily:"inherit",outline:"none"}}/>
        <p style={{textAlign:"right",fontSize:11,color:T.muted,margin:"4px 0 10px"}}>{text.length}/60</p>
        <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto"}}>
          {DURATIONS.map(d=>(
            <Btn key={d.h} onClick={()=>setDuration(d.h)} style={{padding:"6px 12px",borderRadius:12,fontSize:12,fontWeight:600,flexShrink:0,background:duration===d.h?T.gradGold:"rgba(255,255,255,0.06)",color:duration===d.h?"#000":T.text,border:`1px solid ${duration===d.h?"transparent":T.border}`}}>{d.label}</Btn>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          {existingText&&<Btn onClick={del} disabled={saving} style={{flex:1,padding:"12px",borderRadius:14,background:"rgba(255,80,80,0.12)",color:"#ff6b6b",fontWeight:600,textAlign:"center"}}>Supprimer</Btn>}
          <Btn onClick={save} disabled={saving||!text.trim()} style={{flex:2,padding:"12px",borderRadius:14,background:T.gradGold,color:"#000",fontWeight:700,textAlign:"center"}}>{saving?"...":"Publier"}</Btn>
        </div>
      </div>
    </div>
  );
}

function NoteReplyModal({sb,session,note,onClose,notify}){
  const[text,setText]=useState("");
  const[sending,setSending]=useState(false);
  const send=async()=>{
    const trimmed=text.trim();
    if(!trimmed||sending)return;
    setSending(true);
    try{
      const{data:convRes}=await sb.from("conversations").select("id")
        .or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${note.user_id}),and(user1_id.eq.${note.user_id},user2_id.eq.${session?.user?.id})`)
        .maybeSingle();
      let convId=convRes?.id;
      if(!convId){
        const{data:created}=await sb.from("conversations").insert({user1_id:session?.user?.id,user2_id:note.user_id}).select().single();
        convId=created?.id;
      }
      await sb.from("messages").insert({
        conv_id:convId,sender_id:session?.user?.id,type:"note_reply",text:trimmed,
        reply_metadata:{isReplyToNote:true,noteId:note.id,noteText:note.text}
      });
      notify("Réponse envoyée ✦");
      onClose();
      setTimeout(()=>{window.dispatchEvent(new CustomEvent("celeste_open_conv",{detail:{convId}}));},200);
    }catch(err){notify("Erreur · "+(err?.message||"réessaie"));}
    finally{setSending(false);}
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.bg,width:"100%",borderRadius:"20px 20px 0 0",padding:20,border:`1px solid ${T.border}`,borderBottom:"none",marginBottom:"var(--kb-height,0px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <Av u={note.author} size={36} noStatus/>
          <div style={{background:"rgba(255,255,255,0.06)",borderRadius:14,padding:"8px 12px",fontSize:13,color:T.text,flex:1}}>{renderTextWithMentions(note.text)}</div>
          <Btn onClick={onClose} style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:T.muted}}><X size={14}/></Btn>
        </div>
        <div style={{display:"flex",gap:10}}>
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Répondre..." autoFocus
            style={{flex:1,background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:20,padding:"12px 16px",color:T.text,fontSize:14,outline:"none"}}/>
          <Btn onClick={send} disabled={sending||!text.trim()} style={{width:44,height:44,borderRadius:"50%",background:T.gradGold,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Send size={18} color="#000"/></Btn>
        </div>
      </div>
    </div>
  );
}

function NotesBar({sb,session,myProfile,myConnections,myFollowers,notify,pushNav,popNav}){
  const[myNote,setMyNote]=useState(null);
  const[notes,setNotes]=useState([]);
  const[showComposer,setShowComposer]=useState(false);
  const[replyNote,setReplyNote]=useState(null);
  const load=useCallback(()=>{
    if(!session?.user?.id)return;
    sb.from("notes").select("*").eq("user_id",session.user.id).gt("expires_at",new Date().toISOString()).maybeSingle().then(({data})=>setMyNote(data||null));
    if((myConnections||[]).length){
      sb.from("notes").select("*,author:profiles(id,prenom,nom,avatar_url)").in("user_id",myConnections).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false})
        .then(({data})=>setNotes((data||[]).map(n=>({...n,author:normProfile(n.author||{})}))));
    }else setNotes([]);
  },[session?.user?.id,myConnections,sb]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    let t=null;
    const debouncedLoad=()=>{clearTimeout(t);t=setTimeout(load,400);};
    const ch=sb.channel("notes_bar_"+(session?.user?.id||"anon")).on("postgres_changes",{event:"*",schema:"public",table:"notes"},debouncedLoad).subscribe();
    return()=>{clearTimeout(t);try{sb.removeChannel(ch);}catch(_){}};
  },[load,sb,session?.user?.id]);

  const bubbleStyle={position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",marginBottom:6,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:14,padding:"6px 10px",fontSize:11,color:T.text,whiteSpace:"nowrap",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",backdropFilter:"blur(10px)",zIndex:1,boxShadow:"0 2px 8px rgba(0,0,0,0.25)"};

  return(
    <>
    <div style={{display:"flex",gap:10,overflowX:"auto",padding:"48px 16px 6px",scrollbarWidth:"none"}}>
      <div onClick={()=>setShowComposer(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0,cursor:"pointer"}}>
        <div style={{position:"relative"}}>
          {myNote&&<div style={bubbleStyle}>{renderTextWithMentions(myNote.text)}</div>}
          <Av u={myProfile} size={40} noStatus/>
          <div style={{position:"absolute",bottom:-2,right:-2,width:15,height:15,borderRadius:"50%",background:T.gradGold,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${T.bg}`}}>
            {myNote?<Edit2 size={8} color="#000"/>:<Plus size={9} color="#000"/>}
          </div>
        </div>
        <p style={{margin:0,fontSize:10,color:T.muted}}>Ta note</p>
      </div>
      {notes.map(n=>(
        <div key={n.id} onClick={()=>{pushNav(()=>setReplyNote(null));setReplyNote(n);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0,cursor:"pointer"}}>
          <div style={{position:"relative"}}>
            <div style={bubbleStyle}>{renderTextWithMentions(n.text)}</div>
            <Av u={n.author} size={40} noStatus/>
          </div>
          <p style={{margin:0,fontSize:10,color:T.muted,maxWidth:52,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.author?.name||"?"}</p>
        </div>
      ))}
    </div>
    {showComposer&&<NoteComposerModal sb={sb} userId={session.user.id} existingText={myNote?.text} notify={notify}
      onClose={()=>setShowComposer(false)}
      onSaved={t=>{
        const isNewNote=!myNote;
        setMyNote(p=>({...(p||{user_id:session.user.id}),text:t}));
        if(isNewNote){
          (myConnections||[]).forEach(async connectionId=>{
            await sb.from("notifications").insert({user_id:connectionId,from_id:session.user.id,type:"new_note",text:t,read:false});
            sb.functions.invoke('send-push',{body:{targetUserId:connectionId,title:"✦ Nouvelle note",body:`${myProfile?.prenom||"Quelqu'un"} a partagé une nouvelle note`}});
          });
        }
      }}
      onDeleted={()=>setMyNote(null)}/>}
    {replyNote&&<NoteReplyModal sb={sb} session={session} note={replyNote} notify={notify} onClose={()=>{popNav();setReplyNote(null);}}/>}
    </>
  );
}

const NAV_PARTICLE_CFG={
  pluie:{bg:"linear-gradient(180deg,#0b1220 0%,#05070d 100%)",n:18,w:1,h:16,color:"linear-gradient(180deg,transparent,rgba(150,190,255,0.55))",anim:"navFall",durMin:0.6,durMax:1.2},
  braises:{bg:"linear-gradient(180deg,#1a0700 0%,#0a0300 100%)",n:14,size:3,color:"#ff8a3d",glow:"0 0 6px 2px rgba(255,120,40,0.7)",anim:"navRise",durMin:2,durMax:4},
  neige:{bg:"linear-gradient(180deg,#0c1420 0%,#060a10 100%)",n:20,size:3,color:"rgba(255,255,255,0.85)",glow:"0 0 4px rgba(255,255,255,0.5)",anim:"navFall",durMin:2.5,durMax:4.5},
  bulles:{bg:"linear-gradient(180deg,#00131a 0%,#000a0d 100%)",n:12,size:6,color:"transparent",border:"1px solid rgba(140,220,255,0.5)",glow:"0 0 6px rgba(140,220,255,0.35)",anim:"navRise",durMin:3,durMax:5},
  feuilles:{bg:"linear-gradient(180deg,#241206 0%,#120a03 100%)",n:12,size:5,color:"#c9762f",anim:"navFallRot",durMin:2.5,durMax:4},
  petales:{bg:"linear-gradient(180deg,#22101a 0%,#12080d 100%)",n:12,size:5,color:"#f2a6c9",anim:"navFallRot",durMin:3,durMax:5},
  lucioles:{bg:"linear-gradient(180deg,#0a1408 0%,#050a04 100%)",n:10,size:3,color:"#d9f26b",glow:"0 0 8px 3px rgba(217,242,107,0.8)",anim:"navTwinkle",durMin:1.5,durMax:3},
  galaxie:{bg:"radial-gradient(ellipse at 30% 20%,rgba(90,40,140,0.35),transparent 60%),linear-gradient(180deg,#05040d 0%,#020106 100%)",n:22,size:2,color:"rgba(255,255,255,0.9)",anim:"navTwinkle",durMin:1.5,durMax:3.5},
};

function NavScenery({theme}){
  if(!theme||theme==="aucun")return null;
  if(theme==="etoiles_filantes")return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",background:"radial-gradient(ellipse at 70% 10%,rgba(40,30,80,0.4),transparent 60%),linear-gradient(180deg,#04040c 0%,#020103 100%)"}}>
      {Array.from({length:8}).map((_,i)=>(
        <div key={i} style={{position:"absolute",top:`${Math.random()*60}%`,left:`${60+Math.random()*40}%`,width:2,height:2,borderRadius:"50%",background:"#fff",boxShadow:"0 0 6px 2px rgba(255,255,255,0.8)",animation:`navShoot ${1.5+Math.random()*2}s linear infinite`,animationDelay:`${Math.random()*4}s`}}/>
      ))}
    </div>
  );
  if(theme==="aurore")return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",background:"linear-gradient(180deg,#020a08 0%,#01050a 100%)"}}>
      <div style={{position:"absolute",inset:"-20% -10%",background:"linear-gradient(100deg,transparent,rgba(60,220,160,0.25),transparent 60%)",animation:"navDrift 7s ease-in-out infinite alternate"}}/>
      <div style={{position:"absolute",inset:"-20% -10%",background:"linear-gradient(100deg,transparent,rgba(140,90,220,0.2),transparent 55%)",animation:"navDrift 9s ease-in-out infinite alternate-reverse"}}/>
    </div>
  );
  if(theme==="brouillard")return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",background:"linear-gradient(180deg,#1a1a1a 0%,#0a0a0a 100%)"}}>
      <div style={{position:"absolute",top:10,left:"-30%",width:"160%",height:40,borderRadius:"50%",background:"rgba(255,255,255,0.06)",filter:"blur(6px)",animation:"navDrift 10s ease-in-out infinite alternate"}}/>
      <div style={{position:"absolute",bottom:6,left:"-30%",width:"160%",height:30,borderRadius:"50%",background:"rgba(255,255,255,0.05)",filter:"blur(6px)",animation:"navDrift 13s ease-in-out infinite alternate-reverse"}}/>
    </div>
  );
  if(theme==="plage")return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",background:"linear-gradient(180deg,#3a2a12 0%,#1a1206 100%)"}}>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:26,background:"radial-gradient(ellipse at center,rgba(255,200,110,0.35),transparent 75%)"}}/>
      {Array.from({length:14}).map((_,i)=>(
        <div key={i} style={{position:"absolute",bottom:0,left:`${Math.random()*100}%`,width:2,height:2,borderRadius:"50%",background:"#e8c789",animation:`navRise ${3+Math.random()*2}s linear infinite`,animationDelay:`${Math.random()*3}s`}}/>
      ))}
    </div>
  );
  if(theme==="orage")return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",background:"linear-gradient(180deg,#10131a 0%,#05060a 100%)"}}>
      <div style={{position:"absolute",inset:0,background:"#fff",animation:"navFlash 5s linear infinite"}}/>
      {Array.from({length:16}).map((_,i)=>(
        <div key={i} style={{position:"absolute",top:-20,left:`${Math.random()*100}%`,width:1,height:16,background:"linear-gradient(180deg,transparent,rgba(180,200,255,0.5))",animation:`navFall ${0.5+Math.random()*0.5}s linear infinite`,animationDelay:`${Math.random()}s`}}/>
      ))}
    </div>
  );
  const cfg=NAV_PARTICLE_CFG[theme];
  if(!cfg)return null;
  const falling=cfg.anim==="navFall"||cfg.anim==="navFallRot";
  const items=Array.from({length:cfg.n},()=>({left:Math.random()*100,dur:cfg.durMin+Math.random()*(cfg.durMax-cfg.durMin),delay:Math.random()*cfg.durMax}));
  return(
    <div style={{position:"absolute",inset:0,overflow:"hidden",background:cfg.bg}}>
      {items.map((p,i)=>(
        <div key={i} style={{position:"absolute",top:falling?-20:undefined,bottom:falling?undefined:0,left:`${p.left}%`,width:cfg.w||cfg.size,height:cfg.h||cfg.size,borderRadius:cfg.w?0:"50%",background:cfg.color,border:cfg.border,boxShadow:cfg.glow,animation:`${cfg.anim} ${p.dur}s linear infinite`,animationDelay:`${p.delay}s`}}/>
      ))}
    </div>
  );
}
// Forme "sceau" festonnée (8 pétales arrondis), façon nuage
const BADGE_CLIP="path('M 14.93 10.87 C 13.57 10.73, 10.73 13.57, 10.87 14.93 C 10.01 13.87, 5.99 13.87, 5.13 14.93 C 5.27 13.57, 2.43 10.73, 1.07 10.87 C 2.13 10.01, 2.13 5.99, 1.07 5.13 C 2.43 5.27, 5.27 2.43, 5.13 1.07 C 5.99 2.13, 10.01 2.13, 10.87 1.07 C 10.73 2.43, 13.57 5.27, 14.93 5.13 C 13.87 5.99, 13.87 10.01, 14.93 10.87 Z')";

const Badge = memo(function Badge({type}){
  if(!type) return null;
  const isConfirmed = type==="confirmed";
  return isConfirmed ? (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,clipPath:BADGE_CLIP,WebkitClipPath:BADGE_CLIP,
      background:"linear-gradient(135deg,#1DA1F2,#0a85d9)",
      flexShrink:0,position:"relative",}}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  ) : (
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,clipPath:BADGE_CLIP,WebkitClipPath:BADGE_CLIP,
      background:"linear-gradient(135deg,#FFD700,#FF8C00)",
      flexShrink:0,}}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
  <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
    </span>
  );
});

const Btn = ({children,onClick,style={},disabled=false,type="button",...rest})=>(
  <button type={type} onClick={disabled?undefined:onClick} disabled={disabled} {...rest}
    style={{cursor:disabled?"not-allowed":"pointer",border:"none",background:"none",outline:"none",touchAction:"manipulation",WebkitTapHighlightColor:"transparent",...style}}>
    {children}
  </button>
);

function GlobalConfirmModal(){
  const [req,setReq]=useState(null);
  useEffect(()=>{
    const h=e=>setReq(e.detail);
    window.addEventListener("celeste_confirm_open",h);
    return()=>window.removeEventListener("celeste_confirm_open",h);
  },[]);
  const close=result=>{
    resolveConfirmAction(req.id,result);
    setReq(null);
  };
  if(!req)return null;
  const danger=req.danger!==false;
  return(
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end"}} onClick={()=>close(false)}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,margin:"0 auto",background:"rgba(16,16,16,0.98)",borderRadius:"22px 22px 0 0",paddingBottom:"env(safe-area-inset-bottom,12px)",animation:"slideUp .2s ease"}}>
        <div style={{padding:"20px 20px 14px",textAlign:"center"}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>{req.message}</p>
          {req.detail&&<p style={{margin:"6px 0 0",fontSize:12,color:T.muted}}>{req.detail}</p>}
        </div>
        <Btn onClick={()=>close(true)} style={{width:"100%",padding:"15px 20px",fontSize:15,color:danger?T.err:T.goldL,textAlign:"center",fontWeight:600,borderTop:`1px solid ${T.border}`}}>{req.confirmLabel||"Confirmer"}</Btn>
        <Btn onClick={()=>close(false)} style={{width:"100%",padding:"14px 20px",fontSize:14,color:T.muted,textAlign:"center"}}>Annuler</Btn>
      </div>
    </div>
  );
}

// Déclaré HORS de AuthScreen pour éviter la recréation à chaque frappe (fermeture clavier mobile)
const AuthField=memo(function AuthField({val,set,placeholder,type="text",showPw,setShowPw}){
  return(
    <div style={{position:"relative"}}>
      <input type={type==="password"?(showPw?"text":"password"):type} value={val} onChange={e=>set(e.target.value)}
        placeholder={placeholder} autoComplete={type==="password"?"current-password":"on"}
        autoCapitalize="none" autoCorrect="off" spellCheck="false"
        style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.text,fontSize:13,outline:"none",transition:"border .2s"}}/>
      {type==="password"&&<Btn onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:11}}>{showPw?<EyeOff size={14}/>:<Eye size={14}/>}</Btn>}
    </div>
  );
});

// ── MEDIA PLAYER ─────────────────────────────────────────
// Volume partagé entre toutes les vidéos du feed : une seule "source de vérité"
// (au lieu d'un useState local par vidéo, qui obligeait à débloquer le son à chaque poste).
let __globalVideoMuted = (() => { try { return localStorage.getItem("celeste_video_muted") !== "0"; } catch (_) { return true; } })();
const __videoMutedListeners = new Set();
function setGlobalVideoMuted(v) {
  __globalVideoMuted = v;
  try { localStorage.setItem("celeste_video_muted", v ? "1" : "0"); } catch (_) {}
  __videoMutedListeners.forEach(fn => fn(v));
}
function useGlobalVideoMuted() {
  const [m, setM] = useState(__globalVideoMuted);
  useEffect(() => {
    __videoMutedListeners.add(setM);
    return () => __videoMutedListeners.delete(setM);
  }, []);
  return [m, setGlobalVideoMuted];
}
const PostVideoPlayer = memo(function PostVideoPlayer({ url, style = {}, onVideoClick }) {
  const ref = useRef(null);
  const [muted, setMuted] = useGlobalVideoMuted();
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimer = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const seekDuration = useRef(0);
  const seekingRef = useRef(false);
  const pendingSeekRef = useRef(null);
  const progressBarRef = useRef(null);
  const progressTimeRef = useRef(null);
  const pausedRef = useRef(false);
  const fullscreenRef = useRef(false);
  const isIntersectingRef = useRef(false);

  const triggerControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 2000);
  };

  // Auto-play/pause selon visibilité
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isMounted = true;
    let playTimer = null;

    const obs = new IntersectionObserver(([entry]) => {
      if (!isMounted || fullscreenRef.current) return;
      clearTimeout(playTimer);
      isIntersectingRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      if (isIntersectingRef.current) {
        playTimer = setTimeout(() => {
          if (!isMounted || fullscreenRef.current) return;
          if (!pausedRef.current) {
            __pauseOtherPostVideos(el);
            el.play().then(() => {
              // Sécurité anti-son-fantôme : si la vidéo n'est plus visible
              // au moment où le play() se résout (WebView lente), on coupe.
              if (!isIntersectingRef.current) el.pause();
            }).catch(() => {});
            setPlaying(true);
          }
        }, 180);
      } else {
        el.pause(); setPlaying(false); __releaseActivePostVideo(el);
      }
    }, { threshold: 0.5 });

    obs.observe(el);

    return () => {
      isMounted = false;
      clearTimeout(playTimer);
      obs.unobserve(el);
      obs.disconnect();
      __releaseActivePostVideo(el);
    };
  }, []);

  // ✅ closeFullscreen déclarée au niveau du composant
  const closeFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    fullscreenRef.current = false;
    setFullscreen(false);
    // Pas de manipulation des styles React — on laisse React re-render proprement
    setTimeout(() => {
      if (ref.current && !pausedRef.current) {
        __pauseOtherPostVideos(ref.current);
        ref.current.play().catch(() => {});
        setPlaying(true);
      }
    }, 150);
  }, []);

  const togglePlayPause = (e) => {
    e.stopPropagation();
    const el = ref.current; if (!el) return;
    if (el.paused) { __pauseOtherPostVideos(el); el.play().catch(() => {}); pausedRef.current = false; setPaused(false); setPlaying(true); }
    else { el.pause(); pausedRef.current = true; setPaused(true); setPlaying(false); __releaseActivePostVideo(el); }
  };

  // ✅ openFullscreen correctement fermée
  const openFullscreen=(e)=>{
  e.stopPropagation();
  const el=ref.current;
  if(!el)return;
  if(el.webkitEnterFullscreen){
    el.addEventListener("webkitendfullscreen",()=>{
      fullscreenRef.current=false;
      setFullscreen(false);
      setPaused(false);
      setPlaying(true);
      setTimeout(()=>{if(ref.current){__pauseOtherPostVideos(ref.current);ref.current.play().catch(()=>{});}},300);
    },{once:true});
    el.webkitEnterFullscreen();
    return;
  }
  fullscreenRef.current=true;
  setFullscreen(true);
  if(el.requestFullscreen){el.requestFullscreen().catch(()=>{});}
  else if(el.webkitRequestFullscreen){el.webkitRequestFullscreen();}
  const onFsChange=()=>{if(!document.fullscreenElement){closeFullscreen();document.removeEventListener("fullscreenchange",onFsChange);}};
  document.addEventListener("fullscreenchange",onFsChange);
};

  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 80) closeFullscreen();
    touchStartY.current = null;
  };

  const controls = (
    <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", alignItems: "center", gap: 8, zIndex: 3 }}>
      <Btn onClick={togglePlayPause} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
        {playing && !paused ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 2 }} />}
      </Btn>
      <div style={{ flex: 1 }} />
      <Btn onClick={e => { e.stopPropagation(); setMuted(!muted); }} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </Btn>
      {onVideoClick && (
        <Btn onClick={e=>{e.stopPropagation();onVideoClick();}} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
          <Maximize2 size={15} />
        </Btn>
      )}
    </div>
  );

  // ✅ Mode fullscreen : rendu distinct et propre, aucun style inline sur la vidéo inline
  if (fullscreen) return (
    <div
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video
        ref={ref} src={url} playsInline webkit-playsinline="true"
        muted={muted} loop autoPlay
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      <Btn onClick={e => { e.stopPropagation(); closeFullscreen(); }} style={{ position: "absolute", top: "env(safe-area-inset-top,20px)", right: 20, background: "rgba(0,0,0,0.6)", borderRadius: "50%", width: 40, height: 40, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
        <Minimize2 size={18} />
      </Btn>
      {controls}
    </div>
  );

  // ✅ Mode inline : balise <video> unique, jamais de styles forcés en sortie de fullscreen
  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onClick={triggerControls}
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; seekDuration.current = ref.current?.duration || 0; }}
      onTouchMove={e => {
        if (touchStartX.current === null || !ref.current) return;
        const diff = (e.touches[0].clientX - touchStartX.current) / window.innerWidth * (seekDuration.current * 0.5);
        const target = Math.max(0, Math.min(seekDuration.current, ref.current.currentTime + diff));
        touchStartX.current = e.touches[0].clientX;
        if (seekingRef.current) { pendingSeekRef.current = target; return; }
        seekingRef.current = true;
        ref.current.currentTime = target;
      }}
      onTouchEnd={() => { touchStartX.current = null; }}
    >
      <video
        ref={ref} src={url} playsInline webkit-playsinline="true"
        muted={muted} loop preload="metadata"
        style={{ width: "100%", borderRadius: 14, display: "block", background: "#000", height: 360, objectFit: "cover", ...style }}
        onLoadedData={() => setHasFrame(true)}
        onSeeked={e => {
          seekingRef.current = false;
          if (pendingSeekRef.current !== null) {
            const next = pendingSeekRef.current;
            pendingSeekRef.current = null;
            seekingRef.current = true;
            e.target.currentTime = next;
          }
        }}
        onTimeUpdate={e => {
          const el = e.target; if (!el.duration) return;
          const pct = (el.currentTime / el.duration) * 100;
          if (progressBarRef.current) progressBarRef.current.style.width = pct + "%";
          if (progressTimeRef.current) {
            const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
            progressTimeRef.current.textContent = `${fmt(el.currentTime)} / ${fmt(el.duration)}`;
          }
        }}
      />
      {/* Barre de progression */}
      <div style={{ position: "absolute", bottom: 50, left: 10, right: 10, zIndex: 4, opacity: showControls ? 1 : 0, transition: "opacity 0.3s ease", pointerEvents: showControls ? "all" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span ref={progressTimeRef} style={{ color: "#fff", fontSize: 11, fontWeight: 600, minWidth: 70, textAlign: "center", background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "2px 6px" }}>0:00 / 0:00</span>
        </div>
        <div
          style={{ position: "relative", height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2, cursor: "pointer" }}
          onClick={e => { if (!ref.current) return; const rect = e.currentTarget.getBoundingClientRect(); ref.current.currentTime = ((e.clientX - rect.left) / rect.width) * ref.current.duration; }}
          onTouchStart={e => { if (!ref.current) return; const rect = e.currentTarget.getBoundingClientRect(); ref.current.currentTime = ((e.touches[0].clientX - rect.left) / rect.width) * ref.current.duration; }}>
          <div ref={progressBarRef} style={{ height: "100%", width: "0%", background: T.gradGold, borderRadius: 2, transition: "width 0.1s linear", position: "relative" }}>
            <div style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, borderRadius: "50%", background: T.gold, boxShadow: "0 0 6px rgba(201,149,42,0.8)" }} />
          </div>
        </div>
      </div>
      {!hasFrame && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "linear-gradient(100deg, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 70%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite", pointerEvents: "none" }} />
      )}
      {hasFrame && paused && (
        <div onClick={togglePlayPause} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 1, borderRadius: 14 }}>
          <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={20} color="#fff" style={{ marginLeft: 3 }} />
          </div>
        </div>
      )}
      {controls}
    </div>
  );
});



const MediaPlayer = memo(function MediaPlayer({url,style={},onImageClick,onVideoClick}){
  const [loaded,setLoaded]=useState(false);
  if(!url) return null;
  const isVideo=/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url)||url.includes("video");
  if(isVideo) return <PostVideoPlayer url={url} style={style} onVideoClick={onVideoClick}/>;
  return(
    <img src={url} loading="lazy" alt="" onClick={()=>onImageClick?.(url)} onLoad={()=>setLoaded(true)}
      style={{width:"100%",borderRadius:14,display:"block",objectFit:"cover",maxHeight:500,cursor:onImageClick?"pointer":"default",background:"rgba(255,255,255,0.06)",opacity:loaded?1:0,transition:"opacity .25s ease",...style}}/>
  );
});

// Média vue-unique : jamais de lecteur natif (pas de <video controls>, pas de menu "Enregistrer l'image" au appui long, pas d'ouverture plein écran)
function ProtectedImage({url,style={}}){
  if(!url)return null;
  return(
    <img src={url} alt="" draggable={false} onContextMenu={e=>e.preventDefault()}
      style={{width:"100%",borderRadius:10,display:"block",objectFit:"cover",maxHeight:200,WebkitTouchCallout:"none",WebkitUserSelect:"none",userSelect:"none",...style}}/>
  );
}
function ProtectedVideo({url,style={}}){
  const ref=useRef(null);
  const [playing,setPlaying]=useState(false);
  const toggle=e=>{
    e.stopPropagation();
    const v=ref.current;if(!v)return;
    if(v.paused){v.play().catch(()=>{});setPlaying(true);}else{v.pause();setPlaying(false);}
  };
  return(
    <div onClick={toggle} onContextMenu={e=>e.preventDefault()} style={{position:"relative",cursor:"pointer",borderRadius:10,overflow:"hidden",WebkitTouchCallout:"none",...style}}>
      <video ref={ref} src={url} playsInline disablePictureInPicture controlsList="nodownload noremoteplayback noplaybackrate"
        style={{width:"100%",display:"block",maxHeight:220,background:"#000",pointerEvents:"none"}}/>
      {!playing&&
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.15)"}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
      }
    </div>
  );
}

function ViewOnceViewer({type,url,onClose}){
  const videoRef=useRef(null);
  useEffect(()=>{
    const onBack=()=>{onClose();return false;};
    window.addEventListener("celeste_hw_back",onBack);
    return()=>{
      window.removeEventListener("celeste_hw_back",onBack);
      if(videoRef.current){try{videoRef.current.pause();videoRef.current.removeAttribute("src");videoRef.current.load();}catch(_){}}
    };
  },[onClose]);
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:3000,background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {type==="video"
        ? <video ref={videoRef} src={url} autoPlay playsInline disablePictureInPicture controlsList="nodownload noremoteplayback noplaybackrate"
            style={{width:"100%",height:"100%",objectFit:"contain",pointerEvents:"none"}}/>
        : <img src={url} alt="" draggable={false} onContextMenu={e=>e.preventDefault()}
            style={{width:"100%",height:"100%",objectFit:"contain",WebkitTouchCallout:"none",WebkitUserSelect:"none",userSelect:"none"}}/>
      }
      <Btn onClick={onClose} style={{position:"absolute",top:"calc(16px + env(safe-area-inset-top,0px))",right:16,color:"#fff",background:"rgba(255,255,255,0.15)",borderRadius:"50%",width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <X size={20}/>
      </Btn>
    </div>
  );
}

// ── IMAGE CROP MODAL ──────────────────────────────────────
function ImageCropModal({imageSrc,onClose,onDone}){
  const [crop,setCrop]=useState({x:0,y:0});
  const [zoom,setZoom]=useState(1);
  const [rotation,setRotation]=useState(0);
  const [croppedAreaPixels,setCroppedAreaPixels]=useState(null);
  const [processing,setProcessing]=useState(false);

  const onCropComplete=useCallback((_,cap)=>setCroppedAreaPixels(cap),[]);

  const handleDone=async()=>{
    if(!croppedAreaPixels)return;
    setProcessing(true);
    try{
      const image=await new Promise((res,rej)=>{const img=new window.Image();img.crossOrigin="anonymous";img.onload=()=>res(img);img.onerror=rej;img.src=imageSrc;});
      const canvas=document.createElement("canvas");
      const ctx=canvas.getContext("2d");
      const maxSize=Math.max(croppedAreaPixels.width,croppedAreaPixels.height);
      const safeArea=2*((maxSize/2)*Math.sqrt(2));
      canvas.width=safeArea;canvas.height=safeArea;
      ctx.translate(safeArea/2,safeArea/2);
      ctx.rotate((rotation*Math.PI)/180);
      ctx.translate(-safeArea/2,-safeArea/2);
      ctx.drawImage(image,safeArea/2-image.naturalWidth/2,safeArea/2-image.naturalHeight/2);
      const data=ctx.getImageData(0,0,safeArea,safeArea);
      canvas.width=croppedAreaPixels.width;canvas.height=croppedAreaPixels.height;
      ctx.putImageData(data,Math.round(0-safeArea/2+image.naturalWidth*0.5-croppedAreaPixels.x),Math.round(0-safeArea/2+image.naturalHeight*0.5-croppedAreaPixels.y));
      canvas.toBlob(blob=>{
        setProcessing(false);
        onDone(new File([blob],"cropped.jpg",{type:"image/jpeg"}));
      },"image/jpeg",0.92);
    }catch(e){
      setProcessing(false);
      // fallback : retourner l'image originale
      if(imageSrc.startsWith("blob:")){
        const res=await fetch(imageSrc);
        const blob=await res.blob();
        onDone(new File([blob],"photo.jpg",{type:"image/jpeg"}));
      } else {
        onDone(null);
      }
    }
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:1500,background:"#000",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"12px 16px",paddingTop:"calc(12px + max(env(safe-area-inset-top,0px), 24px))",background:"rgba(0,0,0,0.95)",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:15,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>
          <X size={18}/>Garder l'originale
        </button>
        <p style={{margin:0,fontSize:15,fontWeight:600,color:"#fff"}}>Recadrer</p>
        <button onClick={handleDone} disabled={processing} style={{background:"none",border:"none",color:processing?"rgba(201,149,42,0.4)":"#C9952A",fontSize:15,fontWeight:700,cursor:processing?"default":"pointer",padding:"4px 0"}}>
          {processing?"…":"Valider ✦"}
        </button>
      </div>

      {/* Zone de recadrage */}
      <div style={{flex:1,position:"relative",background:"#111"}}>
        <EasyCrop
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={true}
          style={{
            containerStyle:{background:"#111"},
            cropAreaStyle:{border:"2px solid rgba(201,149,42,0.8)",boxShadow:"0 0 0 9999px rgba(0,0,0,0.6)"},
          }}
        />
      </div>

      {/* Contrôles bas */}
      <div style={{background:"rgba(0,0,0,0.95)",padding:"14px 20px calc(14px + env(safe-area-inset-bottom,0px))",display:"flex",flexDirection:"column",gap:12,flexShrink:0}}>
        {/* Zoom */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",minWidth:36}}>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={e=>setZoom(Number(e.target.value))}
            style={{flex:1,accentColor:"#C9952A"}}/>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",minWidth:28,textAlign:"right"}}>{zoom.toFixed(1)}×</span>
        </div>
        {/* Rotation */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",minWidth:36}}>Rotation</span>
          <input type="range" min={-180} max={180} step={1} value={rotation}
            onChange={e=>setRotation(Number(e.target.value))}
            style={{flex:1,accentColor:"#C9952A"}}/>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",minWidth:28,textAlign:"right"}}>{rotation}°</span>
        </div>
        {/* Reset */}
        <button onClick={()=>{setZoom(1);setRotation(0);setCrop({x:0,y:0});}}
          style={{alignSelf:"center",background:"none",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"6px 16px",color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer"}}>
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

// ── IMAGE VIEWER ─────────────────────────────────────────
function ImageViewer({url,onClose}){
  const [scale,setScale]=useState(1);
  const [pos,setPos]=useState({x:0,y:0});
  const dragRef=useRef(null);
  const handleWheel=e=>{e.preventDefault();setScale(s=>Math.min(4,Math.max(1,s-e.deltaY*0.01)));};
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .2s ease",overflow:"hidden"}}
      onClick={()=>{if(scale===1)onClose();}}>
      <Btn onClick={onClose} style={{position:"absolute",top:20,right:20,color:"#fff",background:"rgba(255,255,255,0.1)",borderRadius:"50%",width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}><X size={20}/></Btn>
      <img src={url} alt="" onWheel={handleWheel}
        style={{maxWidth:"100vw",maxHeight:"100vh",objectFit:"contain",borderRadius:0,transform:`scale(${scale}) translate(${pos.x}px,${pos.y}px)`,transition:scale===1?"transform .2s":"none",cursor:scale>1?"grab":"zoom-in",touchAction:"none"}}
        onClick={e=>e.stopPropagation()}/>
    </div>
  );
}

// ── TOAST ─────────────────────────────────────────────────
function Toast({msg}){
  return(
    <div style={{position:"fixed",top:72,left:"50%",transform:"translateX(-50%)",zIndex:9999999,background:T.bg2,border:`1px solid ${T.border}`,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:20,padding:"10px 20px",color:T.text,fontSize:13,fontWeight:500,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"notifIn .3s ease"}}>
      {msg}
    </div>
  );
}

// ── NOTIF BANNER ──────────────────────────────────────────
function NotifBanner({notifs,onDismiss,onTap}){
  return(
    <div style={{position:"fixed",top:"env(safe-area-inset-top,0px)",left:0,right:0,zIndex:990,display:"flex",flexDirection:"column",gap:8,padding:"8px 12px",pointerEvents:"none"}}>
      {(notifs||[]).slice(0,3).map(n=>(
        <div key={n.id} style={{background:"rgba(10,10,10,0.97)",border:`1px solid ${T.gold}33`,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderRadius:18,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 12px 40px rgba(0,0,0,0.7)",animation:"notifIn .4s cubic-bezier(0.34,1.2,0.64,1)",pointerEvents:"all",cursor:n.action?"pointer":"default"}}
          onClick={()=>n.action&&onTap(n)}>
          <span style={{fontSize:22,flexShrink:0}}>{n.icon}</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</p>
            <p style={{margin:0,fontSize:12,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.body}</p>
          </div>
          <Btn onClick={e=>{e.stopPropagation();onDismiss(n.id);}} style={{color:T.muted,flexShrink:0,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",borderRadius:"50%"}}><X size={14}/></Btn>
        </div>
      ))}
    </div>
  );
}

// ── REPORT MODAL ──────────────────────────────────────────
function ReportModal({onClose,onSubmit,reasons,title}){
  reasons=reasons||["Contenu inapproprié","Spam","Harcèlement","Fausse identité","Autre"];
  const [showDetails,setShowDetails]=useState(false);
  const [details,setDetails]=useState("");
  const [pendingReason,setPendingReason]=useState(null);
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:560,padding:"20px 18px calc(24px + env(safe-area-inset-bottom,0px))",animation:"slideUp .2s ease",marginBottom:"var(--kb-height,0px)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>{title||"Signaler"}</h3>
          <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:"50%",width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted}}><X size={16}/></Btn>
        </div>
        {!showDetails?(
          <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:"55vh",overflowY:"auto"}}>
            {reasons.map(r=>(
              <Btn key={r} onClick={()=>onSubmit(r,"")} style={{padding:"13px 16px",borderRadius:12,border:`1px solid ${T.border}`,color:T.text,fontSize:13.5,textAlign:"left"}}>{r}</Btn>
            ))}
            <Btn onClick={()=>setShowDetails(true)} style={{padding:"10px 16px",color:T.goldL,fontSize:12,textAlign:"left"}}>+ Ajouter des précisions avant d'envoyer</Btn>
          </div>
        ):(
          <>
            <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:12,maxHeight:"40vh",overflowY:"auto"}}>
              {reasons.map(r=>(
                <Btn key={r} onClick={()=>setPendingReason(r)} style={{padding:"11px 16px",borderRadius:12,border:`1px solid ${pendingReason===r?T.gold:T.border}`,background:pendingReason===r?T.goldBg:"transparent",color:pendingReason===r?T.goldL:T.sub,fontSize:13,textAlign:"left"}}>{r}</Btn>
              ))}
            </div>
            <textarea value={details} onChange={e=>setDetails(e.target.value)} placeholder="Détails" rows={2} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",resize:"none",marginBottom:12}}/>
            <Btn onClick={()=>pendingReason&&onSubmit(pendingReason,details)} disabled={!pendingReason} style={{width:"100%",padding:14,background:pendingReason?T.gradGold:"rgba(255,255,255,0.04)",color:pendingReason?"#000":T.muted,borderRadius:14,fontSize:14,fontWeight:700}}>Envoyer le signalement</Btn>
          </>
        )}
      </div>
    </div>
  );
}

function DialSelector({selected,onChange}){
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const cur=COUNTRIES.find(c=>c.code===selected)||COUNTRIES[0];
  const filtered=COUNTRIES.filter(c=>
    c.name.toLowerCase().includes(search.toLowerCase())||
    c.dial.includes(search)
  );
  return(
    <div style={{position:"relative"}}>
      <Btn onClick={()=>{setOpen(o=>!o);setSearch("");}} style={{padding:"11px 12px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,color:T.text,whiteSpace:"nowrap"}}>
        {cur.flag} {cur.dial} <span style={{fontSize:11,color:T.muted}}>▾</span>
      </Btn>
      {open&&(
        <div style={{position:"absolute",top:"110%",left:0,zIndex:99,background:"#111",border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",minWidth:240,boxShadow:"0 20px 40px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"}}>
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border}`}}>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un pays..." style={{width:"100%",background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px",color:T.text,fontSize:13,outline:"none"}}/>
          </div>
          <div style={{maxHeight:240,overflowY:"auto"}}>
            {filtered.map(c=>(
              <Btn key={c.code} onClick={()=>{onChange(c.code,c.dial);setOpen(false);setSearch("");}} style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,fontSize:13,color:T.text,background:c.code===selected?T.goldBg:"transparent",textAlign:"left"}}>
                <span style={{fontSize:16}}>{c.flag}</span>
                <span style={{flex:1}}>{c.name}</span>
                <span style={{color:T.muted,fontSize:12}}>{c.dial}</span>
              </Btn>
            ))}
            {filtered.length===0&&<p style={{padding:"12px 14px",color:T.muted,fontSize:13}}>Aucun résultat</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const LOGO_FONTS=["'Sacramento',cursive","'Pacifico',cursive","'Grand Hotel',cursive","'Yellowtail',cursive"];
const TEXT_FONTS=["Space Grotesk","Cormorant Garamond","Permanent Marker","Bangers","Creepster","Lobster","Caveat","Bebas Neue","Fredoka","Rock Salt","Special Elite","Metal Mania","Great Vibes","Luckiest Guy"];
const pickLogoFont=()=>LOGO_FONTS[Math.floor(Math.random()*LOGO_FONTS.length)];

const ORG_TYPES=[
  {v:"restaurant",l:"🍽️ Restaurant / Bar"},{v:"hotel",l:"🏨 Hôtel / Hébergement"},
  {v:"musique",l:"🎵 Musique / Artiste"},{v:"entreprise",l:"💼 Entreprise / Commerce"},
  {v:"association",l:"🤝 Association / ONG"},{v:"ecole",l:"🎓 École / Université"},
  {v:"sante",l:"🩺 Santé / Clinique"},{v:"beaute",l:"💇 Beauté / Coiffure"},
  {v:"mode",l:"👗 Mode / Boutique"},{v:"tech",l:"💻 Tech / Services numériques"},
  {v:"transport",l:"🚖 Transport / Livraison"},{v:"immobilier",l:"🏠 Immobilier"},
  {v:"evenementiel",l:"🎉 Événementiel"},{v:"media",l:"🎬 Média / Production"},
  {v:"ong",l:"⛪ Église / Communauté religieuse"},{v:"ong2",l:"🌱 ONG / Humanitaire"},
  {v:"sport",l:"⚽ Sport / Fitness"},{v:"alimentation",l:"🥘 Alimentation / Traiteur"},
  {v:"autre",l:"📌 Autre"},
];
// ── AUTH SCREEN ───────────────────────────────────────────
function AuthScreen({mode,setMode,onSuccess,pushNav,popNav}){
  const [logoFont]=useState(pickLogoFont);
  const [accountType,setAccountType]=useState("membre");
  const [prenom,setPrenom]=useState(""); const [nom,setNom]=useState("");
  const [paroisse,setParoisse]=useState(""); const [phone,setPhone]=useState("");
  const [whatsapp,setWhatsapp]=useState(""); const [country,setCountry]=useState("CG");
  const [orgName,setOrgName]=useState(""); const [orgType,setOrgType]=useState("");
  const [showOrgTypePicker,setShowOrgTypePicker]=useState(false);
  const [orgCountry,setOrgCountry]=useState(""); const [orgDesc,setOrgDesc]=useState("");
  const [email,setEmail]=useState(""); const [pw,setPw]=useState("");
  const [showPw,setShowPw]=useState(false); const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");

  const reset=()=>{setPrenom("");setNom("");setParoisse("");setPhone("");setWhatsapp("");setOrgName("");setOrgType("");setOrgCountry("");setOrgDesc("");setEmail("");setPw("");setErr("");};



  const submit=async()=>{
    setErr(""); if(busy)return;
    if(mode==="register"){
      if(accountType==="membre"&&(!prenom.trim()||!nom.trim()||!paroisse.trim()||!phone.trim())){setErr("Champs obligatoires manquants");return;}
      if(accountType==="organisation"&&(!orgName.trim()||!orgType||!orgCountry.trim()||!phone.trim())){setErr("Champs obligatoires manquants");return;}
    }
    if(!email.trim()||!pw.trim()){setErr("Email et mot de passe requis");return;}
    setBusy(true);
    try{
      if(mode==="login"){
        let loginEmail=email.trim();
        if(/^\d{8}$/.test(loginEmail)){
          const{data,error:resolveErr}=await sb.functions.invoke("resolve-celeste-login",{body:{celeste_id:loginEmail}});
          if(resolveErr||!data?.email)throw new Error("Identifiant ou mot de passe incorrect");
          loginEmail=data.email;
        }else{
          loginEmail=loginEmail.toLowerCase();
        }
        const{error}=await sb.auth.signInWithPassword({email:loginEmail,password:pw});
        if(error)throw error;
      }else{
        const metadata=accountType==="membre"
  ?{prenom,nom,paroisse,phone,whatsapp:whatsapp||phone,country,account_type:"membre"}
  :{prenom:orgName,nom:"",paroisse:orgCountry,phone,whatsapp:whatsapp||phone,country:orgCountry,account_type:"organisation",org_name:orgName,org_type:orgType,org_country:orgCountry,org_desc:orgDesc};
const{data,error}=await sb.auth.signUp({email,password:pw,options:{data:metadata}});
if(error)throw error;
if(data.user){onSuccess?.("pending");}
      }
    }catch(e){setErr(e.message||"Erreur de connexion");}
    finally{setBusy(false);}
  };

  return(
    <div style={{minHeight:"calc(var(--app-vh, 1vh) * 100)",background:T.bg,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 20px env(safe-area-inset-bottom,20px)",position:"relative",overflow:"auto"}}>
      <div style={{position:"absolute",top:"-30%",left:"-20%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,149,42,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-30%",right:"-20%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(58,106,154,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${T.border} 1px,transparent 1px)`,backgroundSize:"40px 40px",opacity:.3,pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:400,animation:"titleReveal .6s ease"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:76,height:76,borderRadius:"50%",background:"rgba(201,149,42,0.08)",border:`1px solid ${T.gold}33`,marginBottom:22,animation:"glow 3s ease infinite",boxShadow:`0 0 40px rgba(201,149,42,0.15)`}}>
            <span style={{fontSize:34,fontFamily:logoFont,color:T.gold}}>✦</span>
          </div>
          <h1 style={{fontFamily:logoFont,fontSize:44,fontWeight:400,color:T.text,letterSpacing:0,marginBottom:6}}>Céleste</h1>
          <p style={{color:T.muted,fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>Exprime ta vraie personnalitée</p>
        </div>

        <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${T.border}`,borderRadius:24,overflow:"hidden",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)"}}>
          <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,position:"relative"}}>
            {["login","register"].map(m=>(
              <Btn key={m} onClick={()=>{setMode(m);reset();}} style={{flex:1,padding:"16px",fontSize:13,fontWeight:600,color:mode===m?T.goldL:T.sub,transition:"all .3s",letterSpacing:.5,position:"relative"}}>
                {m==="login"?"Connexion":"Inscription"}
                {mode===m&&<div style={{position:"absolute",bottom:0,left:"15%",right:"15%",height:2,background:T.gradGold,borderRadius:2}}/>}
              </Btn>
            ))}
          </div>

          <div style={{padding:"24px 20px 28px",display:"flex",flexDirection:"column",gap:10}}>
            {mode==="register"&&(
              <>
                <div style={{display:"flex",gap:8,marginBottom:4}}>
                  {[{val:"membre",label:"👤 Membre"},{val:"organisation",label:"🏛️ Organisation"}].map(t=>(
                    <Btn key={t.val} onClick={()=>setAccountType(t.val)} style={{flex:1,padding:"10px",borderRadius:12,fontSize:12,fontWeight:700,border:`1px solid ${accountType===t.val?T.gold:T.border}`,background:accountType===t.val?T.goldBg:"transparent",color:accountType===t.val?T.goldL:T.muted,transition:"all .25s"}}>
                      {t.label}
                    </Btn>
                  ))}
                </div>
                {accountType==="membre"?(
                  <>
                    <div style={{display:"flex",gap:10}}>
                      <div style={{flex:1}}><AuthField val={prenom} set={setPrenom} placeholder="Prénom *"/></div>
                      <div style={{flex:1}}><AuthField val={nom} set={setNom} placeholder="Nom *"/></div>
                    </div>
                    <AuthField val={paroisse} set={setParoisse} placeholder="Quartier / Ville *"/>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
  <DialSelector selected={country} onChange={(code,dial)=>{setCountry(code);setPhone(p=>p.replace(/^\+\d+\s*/,"")&&p||dial+" ");}}/>
  <div style={{flex:1}}><AuthField val={phone} set={setPhone} placeholder="Numéro *" type="tel"/></div>
</div>
                    <div style={{display:"flex",gap:8,alignItems:"center",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"4px 8px"}}>
  <select value={country} onChange={e=>setCountry(e.target.value)} style={{background:"transparent",border:"none",color:T.goldL,fontSize:13,fontWeight:700,outline:"none",flexShrink:0}}>
    {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
  </select>
  <input type="tel" inputMode="numeric" value={whatsapp} onChange={e=>setWhatsapp(e.target.value.replace(/\D/g,""))} placeholder="WhatsApp (si différent)" style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:14,outline:"none",padding:"8px 4px"}}/>
</div>
                  </>
                ):(
                  <>
                    <AuthField val={orgName} set={setOrgName} placeholder="Nom de l'organisation *"/>
<Btn onClick={()=>{pushNav(()=>setShowOrgTypePicker(false));setShowOrgTypePicker(true);}} style={{width:"100%",textAlign:"left",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:orgType?T.text:T.sub,fontSize:13}}>
  {ORG_TYPES.find(t=>t.v===orgType)?.l||"Type *"}
</Btn>
                    <AuthField val={orgCountry} set={setOrgCountry} placeholder="Ville / Quartier *"/>
                    <AuthField val={orgDesc} set={setOrgDesc} placeholder="Description (optionnel)"/>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
  <DialSelector selected={country} onChange={(code,dial)=>{setCountry(code);setPhone(dial+" ");}}/>
  <div style={{flex:1}}><AuthField val={phone} set={setPhone} placeholder="Numéro *" type="tel"/></div>
</div>
<div style={{display:"flex",gap:8,alignItems:"center",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"4px 8px"}}>
  <select value={country} onChange={e=>setCountry(e.target.value)} style={{background:"transparent",border:"none",color:T.goldL,fontSize:13,fontWeight:700,outline:"none",flexShrink:0}}>
    {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
  </select>
  <input type="tel" inputMode="numeric" value={whatsapp} onChange={e=>setWhatsapp(e.target.value.replace(/\D/g,""))} placeholder="WhatsApp (si différent)" style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:14,outline:"none",padding:"8px 4px"}}/>
</div>
                  </>
                )}
              </>
            )}
            <AuthField val={email} set={setEmail} placeholder={mode==="login"?"Email ou identifiant Céleste *":"Email *"} type={mode==="login"?"text":"email"}/>
            <AuthField val={pw} set={setPw} placeholder="Mot de passe *" type="password" showPw={showPw} setShowPw={setShowPw}/>
            {err&&<div style={{background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:12,padding:"10px 14px",color:T.err,fontSize:12,display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={14}/> {err}</div>}
            <Btn onClick={submit} disabled={busy} style={{padding:"16px",background:busy?T.goldBg:T.gradGold,color:"#000",borderRadius:14,fontSize:14,fontWeight:700,boxShadow:busy?"none":"0 8px 32px rgba(201,149,42,0.3), 0 0 0 1px rgba(201,149,42,0.1)",opacity:busy?.6:1,transition:"all .25s",marginTop:4,letterSpacing:.3}}>
              {busy?"⏳ Chargement…":mode==="login"?"Se connecter ✦":"Créer mon compte ✦"}
            </Btn>
            
          </div>
        </div>
      </div>
      
    {showOrgTypePicker&&(
        <div style={{position:"fixed",inset:0,zIndex:1300,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-end"}} onClick={()=>{popNav();setShowOrgTypePicker(false);}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxHeight:"70vh",overflowY:"auto",background:T.bg,borderTopLeftRadius:24,borderTopRightRadius:24,padding:"16px 16px calc(env(safe-area-inset-bottom,0px) + 16px)"}}>
            <p style={{textAlign:"center",color:T.text,fontWeight:700,margin:"4px 0 14px"}}>Type d'organisation</p>
            {ORG_TYPES.map(t=>(
              <Btn key={t.v} onClick={()=>{setOrgType(t.v);popNav();setShowOrgTypePicker(false);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"14px 12px",borderRadius:12,color:orgType===t.v?T.goldL:T.text,background:orgType===t.v?T.goldBg2:"transparent",fontSize:14,marginBottom:4}}>
                {t.l}
              </Btn>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ── NOTIFICATIONS SCREEN (NOUVEAU depuis App 9) ───────────
function NotifsScreen({myProfile,session,members}){
  const {setTab}=useApp();
  const [notifs,setNotifs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("tous");

  const load=useCallback(async()=>{
    setLoading(true);
    const{data}=await sb.from("notifications")
      .select("*, from:profiles!notifications_from_id_fkey(*), post:posts(id,text)")
      .eq("user_id",session?.user?.id)
      .order("created_at",{ascending:false})
      .limit(100);
    setNotifs(data||[]);
    setLoading(false);
  },[session?.user?.id]);

  useEffect(()=>{load();},[load]);

  // Marque comme lu seulement à la fermeture du panneau — pas à l'ouverture,
  // pour que le petit point reste visible pendant que tu consultes
  useEffect(()=>{
    return()=>{
      sb.from("notifications").update({read:true}).eq("user_id",session?.user?.id).eq("read",false);
    };
  },[session?.user?.id]);

  useEffect(()=>{
    const ch=sb.channel(`notifs-${session?.user?.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${session?.user?.id}`},load)
      .subscribe();
    return()=>sb.removeChannel(ch);
  },[session?.user?.id,load]);

  const label=n=>({
    like:"a aimé ta publication",
    comment:"a commenté ta publication",
    reply:"a répondu à ton commentaire",
    comment_like:"a aimé ton commentaire",
    follow:"a commencé à te suivre",
    mention:"t'a mentionné",
    new_post_favorite:"a publié du nouveau contenu",
    new_note:"a partagé une nouvelle note",
    status_like:"a aimé ton statut",
    status_view:"a vu ton statut",
    group_invite:`t'a invité${n.text?` dans "${n.text}"`:" dans un groupe"}`,
    group_invite_declined:`a refusé de rejoindre${n.text?` "${n.text}"`:" ton groupe"}`,
    post_deleted:n.text||"Une de tes publications a été supprimée",
    warning:n.text||"Avertissement de l'équipe Céleste",
    approved:"Ton compte a été validé ✦",
    earning:n.text||"Nouveau gain",
    poll_ended:n.text||"Ton sondage est terminé",
    broadcast:n.text||"Message de l'équipe Céleste",
    withdrawal_request:n.text||"Nouvelle demande de retrait",
  }[n.type]||n.text||n.type);

  const icon=n=>({
    like:"♥",
    comment:"✦",
    reply:"↩️",
    comment_like:"💛",
    follow:"✦",
    mention:"@",
    status_like:"♥",
    status_view:"◉",
    post_deleted:"🗑️",
    warning:"⚠️",
    approved:"✅",
    earning:"💰",
    poll_ended:"📊",
    broadcast:"📢",
    withdrawal_request:"💸",
    new_post_favorite:"✦",
    new_note:"📝",
    friend_online:"🟢",
    group_invite:"👥",
    group_invite_declined:"🚫",
  }[n.type]||"🔔");

  const SYSTEM_TYPES=["post_deleted","warning","approved","earning","poll_ended","broadcast","withdrawal_request"];
  const GROUPABLE_TYPES=["like","comment","comment_like","reply","mention"];
  const PERSON_GROUPABLE_TYPES=["friend_online"];
  const groupTypeMeta={
    like:{icon:"❤",label:"aimé ta publication"},
    comment:{icon:"💬",label:"commenté ta publication"},
    comment_like:{icon:"💛",label:"aimé un commentaire"},
    reply:{icon:"↩️",label:"répondu à un commentaire"},
    mention:{icon:"@",label:"mentionné dans une publication"},
    new_post_favorite:{icon:"✦",label:"a publié du nouveau contenu"},
    friend_online:{icon:"🟢",label:"vient de se connecter"},
  };
  const [expandedGroups,setExpandedGroups]=useState({});

  const filtered=notifs.filter(n=>{
    if(filter==="tous")return true;
    if(filter==="mentions")return n.type==="mention";
    if(filter==="likes")return n.type==="like"||n.type==="comment_like"||n.type==="status_like";
    if(filter==="commentaires")return n.type==="comment"||n.type==="reply";
    if(filter==="abonnements")return n.type==="follow";
    if(filter==="systeme")return SYSTEM_TYPES.includes(n.type);
    return true;
  });

  const tabs=[
    {id:"systeme",l:"Système"},
    {id:"tous",l:"Tous"},
    {id:"mentions",l:"Mentions"},
    {id:"likes",l:"Likes"},
    {id:"commentaires",l:"Commentaires"},
    {id:"abonnements",l:"Abonnements"},
  ];
// Regroupe likes/commentaires/mentions/réponses par publication,
  // pour éviter une liste de centaines de lignes identiques
  const feedItems=useMemo(()=>{
    const postGroups={};
    const personGroups={};
    const standalone=[];
    filtered.forEach(n=>{
      if(n.post_id&&GROUPABLE_TYPES.includes(n.type)){
        if(!postGroups[n.post_id]){
          postGroups[n.post_id]={key:`post-${n.post_id}`,isGroup:true,kind:"post",post_id:n.post_id,post:n.post||null,items:[],latest:n.created_at};
        }
        postGroups[n.post_id].items.push(n);
        if(n.created_at>postGroups[n.post_id].latest)postGroups[n.post_id].latest=n.created_at;
      }else if(n.from_id&&PERSON_GROUPABLE_TYPES.includes(n.type)){
        if(!personGroups[n.from_id]){
          personGroups[n.from_id]={key:`person-${n.type}-${n.from_id}`,isGroup:true,kind:"person",from_id:n.from_id,from:n.from||null,type:n.type,items:[],latest:n.created_at};
        }
        personGroups[n.from_id].items.push(n);
        if(n.created_at>personGroups[n.from_id].latest)personGroups[n.from_id].latest=n.created_at;
      }else{
        standalone.push({key:n.id,isGroup:false,n,latest:n.created_at});
      }
    });
    const groupList=[...Object.values(postGroups),...Object.values(personGroups)].map(g=>({...g,items:g.items.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}));
    return [...groupList,...standalone].sort((a,b)=>new Date(b.latest)-new Date(a.latest));
  },[filtered]);

  if(loading)return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    </div>
  );

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:T.bg,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`}}>
        <div style={{padding:"14px 16px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>Activité</h2>
          {notifs.some(n=>!n.read)&&(
            <span style={{background:T.gradGold,color:"#000",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
              {notifs.filter(n=>!n.read).length} nouvelles
            </span>
          )}
        </div>
        {/* Onglets */}
        <div style={{display:"flex",gap:0,overflowX:"auto",padding:"8px 16px 0"}}>
          {tabs.map(t=>(
            <Btn key={t.id} onClick={()=>setFilter(t.id)} style={{padding:"8px 14px",fontSize:12,fontWeight:filter===t.id?700:400,color:filter===t.id?T.text:T.muted,whiteSpace:"nowrap",flexShrink:0,borderBottom:filter===t.id?`2px solid ${T.gold}`:"2px solid transparent",borderRadius:0,transition:"all .2s"}}>
              {t.l}
            </Btn>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
          <div style={{fontSize:40,marginBottom:12,opacity:.3,animation:"float 3s ease infinite"}}>🔔</div>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Aucune notification</p>
        </div>
      ):(
       <div style={{maxWidth:640,margin:"0 auto"}}>
          {feedItems.map(item=>{
            if(!item.isGroup){
              const n=item.n;
              const from=n.from?normProfile(n.from):null;
              return(
                <div key={item.key} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:n.read?"transparent":"rgba(201,149,42,0.03)",cursor:"pointer",transition:"background .2s",animation:"fadeUp .3s ease"}}
                  onClick={async()=>{
                    if(n.type==="follow"){
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      setTimeout(()=>{if(from?.id)window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:from.id}}));},350);
                      return;
                    }
                    if(n.type==="group_invite"){
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      window.__celesteSetTab?.("messages",()=>window.dispatchEvent(new CustomEvent("celeste_open_groups_tab",{})));
                      return;
                    }
                    if(n.type==="new_note"){
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      window.__celesteSetTab?.("messages");
                      return;
                    }
                    if(n.type==="status_like"||n.type==="status_view"){
                      if(!n.status_id){alert("Ce statut n'existe plus.");return;}
                      const{data}=await sb.from("statuses").select("id").eq("id",n.status_id).maybeSingle();
                      if(!data){alert("Ce statut n'existe plus.");return;}
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      window.__celesteSetTab?.("statuses",()=>window.dispatchEvent(new CustomEvent("celeste_open_status",{detail:{statusId:n.status_id}})));
                      return;
                    }
                    if(n.type==="withdrawal_request"){
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      window.__celesteSetTab?.("admin",()=>window.dispatchEvent(new CustomEvent("celeste_open_admin_withdrawals",{})));
                      return;
                    }
                    if(n.post_id){
                      const{data}=await sb.from("posts").select("id,author_id").eq("id",n.post_id).maybeSingle();
                      if(!data){alert("Cette publication n'existe plus.");return;}
                      setTab("home");
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      setTimeout(()=>{window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:n.post_id,commentId:n.comment_id||null,replyId:n.reply_id||null}}));},600);
                      return;
                    }
                  }}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <Av u={from||{initials:"?",color:"#888"}} size={46} onClick={e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:from?.id}}));}}/>
                    <div style={{position:"absolute",bottom:-2,right:-2,width:20,height:20,borderRadius:"50%",background:T.bg3,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>
                      {icon(n)}
                    </div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:"0 0 2px",fontSize:13,color:T.text,lineHeight:1.5}}>
                      <strong style={{color:T.text}}>{from?.name||"Quelqu'un"}</strong>
                      {" "}<span style={{color:T.sub}}>{label(n)}</span>
                    </p>
                    <p style={{margin:0,fontSize:11,color:T.muted}}>{ago(n.created_at)}</p>
                  </div>
                  {n.type==="post_deleted"&&n.snapshot_img&&(
                    <div style={{width:44,height:44,borderRadius:8,overflow:"hidden",flexShrink:0,border:`1px solid ${T.border}`}}>
                      <SmartImage src={n.snapshot_img} alt=""/>
                    </div>
                  )}
                  {!n.read&&(<div style={{width:8,height:8,borderRadius:"50%",background:T.gold,flexShrink:0,boxShadow:T.glowGold}}/>)}
                </div>
              );
            }

            // ── Carte groupée par publication ou par personne ──────────────
            const g=item;
            const isExpanded=!!expandedGroups[g.key];
            const hasUnread=g.items.some(n=>!n.read);
            const counts={};
            g.items.forEach(n=>{counts[n.type]=(counts[n.type]||0)+1;});
            const uniqueFroms=[];
            const seenIds=new Set();
            g.items.forEach(n=>{
              const f=n.from?normProfile(n.from):null;
              if(f?.id&&!seenIds.has(f.id)){seenIds.add(f.id);uniqueFroms.push(f);}
            });
            const preview=(g.post?.text||"").trim();
            const personFrom=g.kind==="person"?(g.from?normProfile(g.from):null):null;

            return(
              <div key={g.key} style={{borderBottom:`1px solid ${T.border}`,background:hasUnread?"rgba(201,149,42,0.03)":"transparent",animation:"fadeUp .3s ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}
                  onClick={async()=>{
                    if(g.kind==="person"){
                      setExpandedGroups(p=>({...p,[g.key]:!p[g.key]}));
                      return;
                    }
                    const{data}=await sb.from("posts").select("id,author_id").eq("id",g.post_id).maybeSingle();
                    if(!data){alert("Cette publication n'existe plus.");return;}
                    setTab("home");
                    window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                    setTimeout(()=>{window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:g.post_id}}));},600);
                  }}>
                  <div style={{display:"flex",flexShrink:0}}>
                    {g.kind==="person"?(
                      <Av u={personFrom||{initials:"?",color:"#888"}} size={40} onClick={e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:personFrom?.id}}));}}/>
                    ):uniqueFroms.slice(0,3).map((f,i)=>(
                      <div key={f.id} style={{marginLeft:i===0?0:-14,border:`2px solid ${T.bg}`,borderRadius:"50%"}}>
                        <Av u={f} size={40}/>
                      </div>
                    ))}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:"0 0 2px",fontSize:13,color:T.text,lineHeight:1.5}}>
                      {g.kind==="person"?(
                        <><strong style={{color:T.text}}>{personFrom?.name||"Quelqu'un"}</strong>{" "}<span style={{color:T.sub}}>{groupTypeMeta[g.type]?.label||"s'est connecté"} · {g.items.length} fois</span></>
                      ):(
                        <><strong>{uniqueFroms[0]?.name||"Quelqu'un"}</strong>
                        {uniqueFroms.length>1&&<span style={{color:T.sub}}> et {g.items.length-1} autre{g.items.length>2?"s":""}</span>}
                        {" "}<span style={{color:T.sub}}>ont interagi avec ta publication</span></>
                      )}
                    </p>
                    {preview&&(
                      <p style={{margin:"0 0 3px",fontSize:11,color:T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>« {preview} »</p>
                    )}
                    <p style={{margin:0,fontSize:11,color:T.muted}}>{ago(g.latest)}</p>
                  </div>
                  {hasUnread&&(<div style={{width:8,height:8,borderRadius:"50%",background:T.gold,flexShrink:0,boxShadow:T.glowGold}}/>)}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 16px 12px 16px"}}>
                  {Object.entries(counts).map(([type,count])=>(
                    <span key={type} style={{fontSize:11,color:T.sub,background:T.bg3,borderRadius:10,padding:"3px 8px",display:"flex",alignItems:"center",gap:4}}>
                      <span>{groupTypeMeta[type]?.icon||"🔔"}</span>{count}
                    </span>
                  ))}
                  <Btn onClick={()=>setExpandedGroups(p=>({...p,[g.key]:!p[g.key]}))} style={{marginLeft:"auto",fontSize:11,color:T.goldL,fontWeight:600}}>
                    {isExpanded?"Réduire ▲":"Détails ▼"}
                  </Btn>
                </div>
                {isExpanded&&(
                  <div style={{padding:"0 16px 12px 68px",display:"flex",flexDirection:"column",gap:8}}>
                    {g.items.map(n=>{
                      const from=n.from?normProfile(n.from):null;
                      return(
                        <div key={n.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                          <Av u={from||{initials:"?",color:"#888"}} size={24} onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:from?.id}}))}/>
                          <span style={{color:T.text,fontWeight:600}}>{from?.name||"Quelqu'un"}</span>
                          <span style={{color:T.muted}}>{groupTypeMeta[n.type]?.label||label(n)} · {ago(n.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{height:80}}/>
    </div>
  );
}
function MentionInput({value,onChange,onSubmit,placeholder,style={},rows=1,members=[],onFocus,onBlur}){
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [suggestions,setSuggestions]=useState([]);
  const [mentionQuery,setMentionQuery]=useState("");
  const [cursorPos,setCursorPos]=useState(0);
  const [anchorRect,setAnchorRect]=useState(null);
  const ref=useRef();

  const handleChange=e=>{
    const val=e.target.value;
    const cursor=e.target.selectionStart;
    onChange(val);
    setCursorPos(cursor);

    // Détecter @
    const textBeforeCursor=val.slice(0,cursor);
    const match=textBeforeCursor.match(/@([\w\u00C0-\u017F]*)$/);
    if(match){
      const query=match[1];
setMentionQuery(query);
const filtered=(members||[]).filter(m=>matchQuery(m.fullName,query)).slice(0,8);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length>0);
      if(filtered.length===0&&(members||[]).length===0){
        setShowSuggestions(true);
        setSuggestions([{id:"__loading__",name:"Chargement…",prenom:"",fullName:"",paroisse:""}]);
      }
      if(ref.current)setAnchorRect(ref.current.getBoundingClientRect());
    }else{
      setShowSuggestions(false);
    }

    // Auto-resize
    if(ref.current){
      ref.current.style.height="auto";
      ref.current.style.height=Math.min(ref.current.scrollHeight,140)+"px";
    }
  };

  const insertMention=member=>{
    if(member.id==="__loading__")return;
    const textBeforeCursor=value.slice(0,cursorPos);
    const textAfterCursor=value.slice(cursorPos);
    const mentionName=member.prenom||member.name||member.fullName||"";
    const newText=textBeforeCursor.replace(/@[\w\u00C0-\u017F]*$/,"@"+mentionName+" ")+textAfterCursor;
    onChange(newText,member.id,mentionName);
    setShowSuggestions(false);
    ref.current?.focus();
  };

  return(
    <div style={{position:"relative",flex:1}}>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{width:"100%",background:"transparent",border:"none",padding:"6px 4px",color:T.text,fontSize:14,outline:"none",resize:"none",maxHeight:140,lineHeight:"1.4",fontFamily:"inherit",display:"block",...style}}onFocus={onFocus} onBlur={()=>{setTimeout(()=>{setShowSuggestions(false);if(onBlur)onBlur();},200);}}
      />
      {showSuggestions&&suggestions.length>0&&(
  <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,right:0,maxHeight:200,overflowY:"auto",background:"rgba(10,10,10,0.98)",border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"scaleIn .15s ease"}}>
          {/* Barre de recherche */}
          <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
            <Search size={13} color={T.muted}/>
            <span style={{fontSize:12,color:T.muted}}>Mentionner · <strong style={{color:T.goldL}}>@{mentionQuery}</strong></span>
          </div>
          {suggestions.map(m=>(
            <div key={m.id} onMouseDown={e=>{e.preventDefault();insertMention(m);}} onTouchEnd={e=>{e.preventDefault();insertMention(m);}}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(201,149,42,0.06)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <Av u={m} size={32}/>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>{m.fullName||m.name}</p>
                <p style={{margin:0,fontSize:11,color:T.muted,display:"flex",alignItems:"center",gap:3}}><MapPin size={11}/>{m.paroisse}</p>
              </div>
              {m.badge&&<Badge type={m.badge}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ── COMMENTS SECTION ─────────────────────────────────────
// ── Hub temps réel partagé pour les commentaires ──
// Évite qu'ouvrir le même post dans plusieurs endroits (feed + reels préchargés, etc.)
// crée un canal Supabase distinct à chaque montage. Un seul canal par postId, compteur
// de références, fermé automatiquement quand plus personne ne l'écoute.
const MAX_MOUNTED_COMMENTS=150; // ~5 pages — borne la taille du DOM sur les posts très viraux
const MAX_MOUNTED_REPLIES=100;  // ~10 pages de réponses par commentaire
const _commentsRealtimeHub=new Map();
function subscribeCommentsRealtime(postId,onInsert,onDelete,onUpdate){
  let entry=_commentsRealtimeHub.get(postId);
  if(!entry){
    const listeners=new Set();
    const channel=sb.channel(`comments-${postId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},payload=>{
        listeners.forEach(l=>l.onInsert?.(payload));
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},payload=>{
        listeners.forEach(l=>l.onDelete?.(payload));
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},payload=>{
        listeners.forEach(l=>l.onUpdate?.(payload));
      })
      .subscribe();
    entry={channel,listeners,refCount:0};
    _commentsRealtimeHub.set(postId,entry);
  }
  const self={onInsert,onDelete,onUpdate};
  entry.listeners.add(self);
  entry.refCount++;
  return()=>{
    entry.listeners.delete(self);
    entry.refCount--;
    if(entry.refCount<=0){
      sb.removeChannel(entry.channel);
      _commentsRealtimeHub.delete(postId);
    }
  };
}

const _repliesRealtimeHub=new Map();
function subscribeRepliesRealtime(commentId,onInsert,onDelete,onUpdate){
  let entry=_repliesRealtimeHub.get(commentId);
  if(!entry){
    const listeners=new Set();
    const channel=sb.channel(`replies-${commentId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comment_replies",filter:`parent_comment_id=eq.${commentId}`},payload=>{
        listeners.forEach(l=>l.onInsert?.(payload));
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"comment_replies",filter:`parent_comment_id=eq.${commentId}`},payload=>{
        listeners.forEach(l=>l.onDelete?.(payload));
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"comment_replies",filter:`parent_comment_id=eq.${commentId}`},payload=>{
        listeners.forEach(l=>l.onUpdate?.(payload));
      })
      .subscribe();
    entry={channel,listeners,refCount:0};
    _repliesRealtimeHub.set(commentId,entry);
  }
  const self={onInsert,onDelete,onUpdate};
  entry.listeners.add(self);
  entry.refCount++;
  return()=>{
    entry.listeners.delete(self);
    entry.refCount--;
    if(entry.refCount<=0){
      sb.removeChannel(entry.channel);
      _repliesRealtimeHub.delete(commentId);
    }
  };
}

function CommentsSection({postId,sessionUserId,getM,onCountChange,targetCommentId,targetReplyId=null,standalone=false,notify,commentsDisabled=false,postAuthorId=null}){
 const {setHideNav,members}=useApp();
 const [comments,setComments]=useState([]);
 const [likedCommentIds,setLikedCommentIds]=useState(new Set());
 const [authorLikedCommentIds,setAuthorLikedCommentIds]=useState(new Set());
  const [loadingCmts,setLoadingCmts]=useState(true);
  const [hasMoreCmts,setHasMoreCmts]=useState(false);
  const [cmtPage,setCmtPage]=useState(1);
  const [text,setText]=useState("");
  const [posting,setPosting]=useState(false);
  const [mediaFile,setMediaFile]=useState(null);
  const [mediaPreview,setMediaPreview]=useState(null);
  const [pendingSticker,setPendingSticker]=useState(null);
  const [showStickerPicker,setShowStickerPicker]=useState(false);
  const [openStickerDetail,setOpenStickerDetail]=useState(null);
const mentionedIdsRef=useRef([]);
const mentionNameMapRef=useRef(new Map());
  const textareaRef=useRef(null);
  const imgRef=useRef(null);
  const visibleCountRef=useRef(0);
  useEffect(()=>{visibleCountRef.current=comments.length;},[comments]);

  useEffect(()=>{
    const ta=textareaRef.current;
    if(ta){ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,140)+"px";}
  },[text]);

 const load=useCallback(async(page=1,minCount=0)=>{
    setLoadingCmts(true);
   const from=(page-1)*30;
   const to=Math.max(from+29,minCount-1);
    const{data}=await sb.from("comments")
      .select("id,post_id,author_id,text,mentions,media_url,sticker_id,created_at,likes_count,replies_count,author:profiles!comments_author_id_fkey(id,prenom,nom,avatar_url,badge)")
      .eq("post_id",postId)
      .order("likes_count",{ascending:false})
      .order("created_at",{ascending:true})
      .range(from,to);
    let rows=data||[];
    const ids=rows.map(c=>c.id);
    let likedSet=new Set();
    if(ids.length&&sessionUserId){
      const{data:myLikes}=await sb.from("comment_likes").select("comment_id").eq("user_id",sessionUserId).in("comment_id",ids);
      likedSet=new Set((myLikes||[]).map(l=>l.comment_id));
    }
    let authorLikedSet=new Set();
    if(ids.length&&postAuthorId){
      const{data:authorLikes}=await sb.from("comment_likes").select("comment_id").eq("user_id",postAuthorId).in("comment_id",ids);
      authorLikedSet=new Set((authorLikes||[]).map(l=>l.comment_id));
    }
    if(postAuthorId&&(authorLikedSet.size||rows.some(c=>c.author_id===postAuthorId))){
      // Épingle en tête (dans la page chargée) les commentaires touchés par l'auteur du post
      rows=[...rows].sort((a,b)=>{
        const pa=(authorLikedSet.has(a.id)||a.author_id===postAuthorId)?1:0;
        const pb=(authorLikedSet.has(b.id)||b.author_id===postAuthorId)?1:0;
        return pb-pa;
      });
    }
    if(page===1){setComments(rows);setLikedCommentIds(likedSet);setAuthorLikedCommentIds(authorLikedSet);}
    else{setComments(prev=>{const seen=new Set(prev.map(c=>c.id));const merged=[...prev,...rows.filter(c=>!seen.has(c.id))];return merged.length>MAX_MOUNTED_COMMENTS?merged.slice(merged.length-MAX_MOUNTED_COMMENTS):merged;});setLikedCommentIds(prev=>new Set([...prev,...likedSet]));setAuthorLikedCommentIds(prev=>new Set([...prev,...authorLikedSet]));}
    onCountChange?.(page===1?rows.length:visibleCountRef.current+rows.length);
    setLoadingCmts(false);
    setHasMoreCmts(rows.length===(to-from+1));
  },[postId,onCountChange,sessionUserId,postAuthorId]);

  useEffect(()=>{
    (async()=>{
      if(targetCommentId){
        const{data:tc}=await sb.from("comments").select("created_at,likes_count").eq("id",targetCommentId).maybeSingle();
        if(tc){
          const{count:plusLikes}=await sb.from("comments").select("*",{count:"exact",head:true}).eq("post_id",postId).gt("likes_count",tc.likes_count);
          const{count:memeLikesAvant}=await sb.from("comments").select("*",{count:"exact",head:true}).eq("post_id",postId).eq("likes_count",tc.likes_count).lte("created_at",tc.created_at);
          const rang=(plusLikes||0)+(memeLikesAvant||0);
          setCmtPage(1);
          load(1,rang||30);
          return;
        }
      }
      setCmtPage(1);
      load(1);
    })();
  },[load,targetCommentId,postId]);
  const bottomRef=useRef();
  const cmtObserver=useRef();
  const loadMore=useCallback(()=>{
    if(loadingCmts||!hasMoreCmts)return;
    const next=cmtPage+1;setCmtPage(next);load(next);
  },[loadingCmts,hasMoreCmts,cmtPage,load]);
  useEffect(()=>{
    if(!bottomRef.current||!hasMoreCmts)return;
    cmtObserver.current=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)loadMore();},{threshold:.3});
    cmtObserver.current.observe(bottomRef.current);
    return()=>cmtObserver.current?.disconnect();
  },[hasMoreCmts,loadMore]);
  const targetRef=useRef(null);
useEffect(()=>{
  if(targetRef.current){
    setTimeout(()=>{
      targetRef.current?.scrollIntoView({behavior:"smooth",block:"center"});
    },400);
  }
},[comments]);

  useEffect(()=>{
    const unsubscribe=subscribeCommentsRealtime(postId,
      payload=>{
        const newId=payload.new.id;
        sb.from("comments").select("id,post_id,author_id,text,mentions,media_url,sticker_id,created_at,likes_count,replies_count,author:profiles!comments_author_id_fkey(id,prenom,nom,avatar_url,badge)")
          .eq("id",newId).maybeSingle().then(({data})=>{
            if(!data)return;
            setComments(prev=>{
              if(prev.some(c=>c.id===data.id))return prev;
              const merged=[...prev,data].sort((a,b)=>{
                const pa=postAuthorId&&a.author_id===postAuthorId?1:0;
                const pb=postAuthorId&&b.author_id===postAuthorId?1:0;
                if(pa!==pb)return pb-pa;
                if((b.likes_count||0)!==(a.likes_count||0))return (b.likes_count||0)-(a.likes_count||0);
                return new Date(a.created_at)-new Date(b.created_at);
              });
              return merged;
            });
            onCountChange?.(c=>(c||0)+1);
            if(data.author_id===sessionUserId){
              requestAnimationFrame(()=>{
                document.getElementById("cmt-"+data.id)?.scrollIntoView({behavior:"smooth",block:"center"});
              });
            }
          });
      },
      payload=>{
        const delId=payload.old.id;
        setComments(prev=>prev.some(c=>c.id===delId)?prev.filter(c=>c.id!==delId):prev);
        onCountChange?.(c=>Math.max((c||1)-1,0));
      },
      payload=>{
        const updated=payload.new;
        setComments(prev=>prev.map(c=>c.id===updated.id?{...c,likes_count:updated.likes_count,text:updated.text,media_url:updated.media_url}:c));
      }
    );
    return unsubscribe;
  },[postId,onCountChange]);
const handleCommentChange=useCallback(()=>{load(1,visibleCountRef.current-1);},[load]);
  const submit=async()=>{

    if(commentsDisabled||(!text.trim()&&!mediaFile&&!pendingSticker)||posting)return;
    setPosting(true);
    const trimmed=text.trim();
    let mediaUrl=null;
    let stickerId=null;
    if(pendingSticker){
      mediaUrl=pendingSticker.url;
      stickerId=pendingSticker.id;
    }else if(mediaFile){
     try {
  mediaUrl = await uploadToR2(mediaFile, "comments");
} catch(e) {
  console.error("Erreur upload commentaire:", e);
}
    }
   const uid=(await sb.auth.getUser())?.data?.user?.id;
const{error}=await sb.from("comments").insert({post_id:postId,author_id:uid,text:trimmed,media_url:mediaUrl,sticker_id:stickerId,mentions:extractMentions(trimmed,mentionNameMapRef.current)});
    if(!error){
      await sb.rpc("increment_phase_interactions",{post_id:postId});
      if(stickerId)Promise.resolve(sb.rpc("increment_sticker_usage",{sticker_id:stickerId})).catch(()=>{});
      setText("");
      setMediaFile(null);
      setMediaPreview(null);
      setPendingSticker(null);
      // Le commentaire s'ajoute localement via l'événement realtime INSERT — plus de rechargement complet
      // Notifier l'auteur du post
const{data:postData}=await sb.from("posts").select("author_id").eq("id",postId).single();
if(postData?.author_id&&postData.author_id!==uid){
  await sb.from("notifications").insert({
    user_id:postData.author_id,
    from_id:uid,
    type:"comment",
    post_id:postId,
    read:false
  });
}
      
      const uniqueIds=[...new Set(mentionedIdsRef.current)].filter(id=>id!==uid);
const myPrenom=getM?.(uid)?.prenom||"Quelqu'un";
for(const mentionedId of uniqueIds){
  try{
    await sb.from("notifications").insert({user_id:mentionedId,from_id:uid,type:"mention",post_id:postId,read:false});
    sb.functions.invoke('send-push',{body:{targetUserId:mentionedId,title:"✦ Mention",body:`${myPrenom} t'a mentionné dans un commentaire`}});
  }catch(e){
    console.error("Erreur notification mention:",e);
  }
}
mentionedIdsRef.current=[];
mentionNameMapRef.current=new Map();
    }
    setPosting(false);
  };
 const selectSticker=(sticker)=>{
  setShowStickerPicker(false);
  setMediaFile(null);setMediaPreview(null);
  setPendingSticker(sticker);
};

  return(
    <>
    {openStickerDetail&&(
      <StickerDetailModal
        sb={sb}
        stickerId={openStickerDetail}
        userId={sessionUserId}
        notify={notify}
        onClose={()=>setOpenStickerDetail(null)}
      />
    )}
    {(()=>{
    const listContent=(
      <>
      {loadingCmts&&<div style={{display:"flex",justifyContent:"center",padding:"16px 0"}}><div style={{width:20,height:20,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>}
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {comments.map(c=>(
  <div key={c.id} id={"cmt-"+c.id} ref={targetCommentId===c.id?targetRef:null}
    style={{borderRadius:12,transition:"background .5s",
      background:targetCommentId===c.id?"rgba(201,149,42,0.12)":"transparent"}}>
    <CommentItem comment={c} sessionUserId={sessionUserId} getM={getM} onChange={()=>load(1,visibleCountRef.current-1)} members={members} onOpenSticker={setOpenStickerDetail} notify={notify} initialLiked={likedCommentIds.has(c.id)} postAuthorId={postAuthorId} authorLiked={authorLikedCommentIds.has(c.id)} targetReplyId={targetReplyId}/>
  </div>
))}
    
      </div>
     {mediaPreview&&(
        <div style={{position:"relative",marginBottom:6}}>
          <img src={mediaPreview} alt="" style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:14}}/>
          <Btn onClick={()=>{setMediaPreview(null);setMediaFile(null);}} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:26,height:26,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={12}/></Btn>
        </div>
      )}
      {pendingSticker&&(
        <div style={{position:"relative",marginBottom:6,display:"inline-flex"}}>
          <img src={pendingSticker.url} alt="" style={{width:70,height:70,objectFit:"contain"}}/>
          <Btn onClick={()=>setPendingSticker(null)} style={{position:"absolute",top:-6,right:-6,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:22,height:22,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={11}/></Btn>
        </div>
      )}
      {hasMoreCmts&&<div ref={bottomRef} style={{display:"flex",justifyContent:"center",padding:"10px 0"}}>{cmtPage>1&&loadingCmts&&<div style={{width:16,height:16,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>}</div>}
      </>
    );

    const composerBar=(active)=>commentsDisabled?(
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",color:T.muted,fontSize:12,flexShrink:0,marginTop:active==="sticky"?0:8}}>
        <MessageCircleOff size={14}/> Les commentaires sont désactivés pour cette publication
      </div>
    ):(
      <div style={{display:"flex",alignItems:"flex-end",gap:8,padding:"8px 12px",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:24,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:active==="sticky"?"0 4px 20px rgba(0,0,0,0.2)":"0 -4px 20px rgba(0,0,0,0.25)",position:active==="sticky"?"sticky":"relative",bottom:active==="sticky"?"var(--kb-height,0px)":"auto",zIndex:active==="sticky"?10:"auto",flexShrink:0,marginTop:active==="sticky"?0:8}}>
        <input ref={imgRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
          const f=e.target.files[0];if(!f)return;
          const compressed=await compressImage(f);
          const r=new FileReader();r.onload=ev=>setMediaPreview(ev.target.result);r.readAsDataURL(compressed);
          setMediaFile(compressed);
          e.target.value="";
        }}/>
        <Btn onClick={()=>imgRef.current.click()} style={{color:mediaFile?T.goldL:T.muted,padding:"4px",display:"flex",alignItems:"center",flexShrink:0,transition:"color .2s"}}>
          <Camera size={18}/>
        </Btn>
        <div style={{position:"relative",display:"flex",flexShrink:0}}>
          <Btn onClick={()=>setShowStickerPicker(v=>!v)} style={{color:showStickerPicker?T.goldL:T.muted,padding:"4px",display:"flex",alignItems:"center"}}>
            <StickerIcon size={18}/>
          </Btn>
          {showStickerPicker&&(
            <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,width:280,maxWidth:"85vw",zIndex:20}}>
              <StickerPicker sb={sb} userId={sessionUserId} T={T} onClose={()=>setShowStickerPicker(false)} onSelect={selectSticker}/>
            </div>
          )}
        </div>
        <MentionInput
          value={text}
          onChange={(val,mentionedId,mentionedName)=>{setText(val);if(mentionedId&&mentionedName){if(!mentionedIdsRef.current.includes(mentionedId))mentionedIdsRef.current=[...mentionedIdsRef.current,mentionedId];mentionNameMapRef.current.set(mentionedName.toLowerCase(),{id:mentionedId,name:mentionedName});}}}
          placeholder="Ajouter un commentaire..."
          members={members||[]}
          onFocus={()=>setHideNav(true)}
          onBlur={()=>setTimeout(()=>setHideNav(false),150)}
        />
        <Btn onClick={submit} disabled={posting||(!text.trim()&&!mediaFile&&!pendingSticker)} style={{background:(text.trim()||mediaFile||pendingSticker)?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:34,height:34,color:(text.trim()||mediaFile||pendingSticker)?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",flexShrink:0,marginBottom:2}}>
          <Send size={13} style={{transform:"translateX(0.5px)"}}/>
        </Btn>
      </div>
    );

    if(standalone){
      return(
        <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
          <div style={{flex:1,minHeight:0,overflowY:"auto",display:"flex",flexDirection:"column",gap:14,padding:"4px 0"}}>
            {listContent}
          </div>
          {composerBar("fixed")}
        </div>
      );
    }
    
    return(
      <div style={{display:"flex",flexDirection:"column",gap:14,padding:"4px 0"}}>
        {listContent}
        {composerBar("sticky")}
      </div>
    );
    })()}
    </>
  );
}

// ── COMMENT ITEM (NOUVEAU - likes + réponses depuis App 9) ─
const CommentItem=React.memo(function CommentItem({comment,sessionUserId,getM,onChange,members,onOpenSticker,notify,initialLiked=false,postAuthorId=null,authorLiked=false,targetReplyId=null}){
  const [likes,setLikes]=useState(comment.likes_count||0);
  const [liked,setLiked]=useState(initialLiked);
  const [repliesCount,setRepliesCount]=useState(comment.replies_count||0);
  const [replies,setReplies]=useState([]);
  const [repliesLoaded,setRepliesLoaded]=useState(false);
  const [repliesPage,setRepliesPage]=useState(1);
  const [hasMoreReplies,setHasMoreReplies]=useState(false);
  const [loadingReplies,setLoadingReplies]=useState(false);
  const [likedReplyIds,setLikedReplyIds]=useState(new Set());
  const [authorLikedReplyIds,setAuthorLikedReplyIds]=useState(new Set());
  const [showReplies,setShowReplies]=useState(false);
  const [replyText,setReplyText]=useState("");
  const [replying,setReplying]=useState(false);
  const [replyToTarget,setReplyToTarget]=useState(null); // {id,name} ou null = réponse au commentaire
  const [replyMediaFile,setReplyMediaFile]=useState(null);
  const [replyMediaPreview,setReplyMediaPreview]=useState(null);
  const [replyPendingSticker,setReplyPendingSticker]=useState(null);
  const [showReplyStickerPicker,setShowReplyStickerPicker]=useState(false);
  const replyImgRef=useRef(null);
  const isMine=comment.author_id===sessionUserId;
  const isAuthorComment=!!postAuthorId&&comment.author_id===postAuthorId;
  const author=comment.author?normProfile(comment.author):getM(comment.author_id);

  const REPLIES_PAGE_SIZE=10;

  useEffect(()=>{setLikes(comment.likes_count||0);},[comment.likes_count]);
  useEffect(()=>{setRepliesCount(comment.replies_count||0);},[comment.replies_count]);
  useEffect(()=>{setLiked(initialLiked);},[initialLiked]);

  const targetReplyRef=useRef(null);
  useEffect(()=>{
    if(!targetReplyId)return;
    if(!showReplies)setShowReplies(true);
    if(!repliesLoaded&&!loadingReplies)loadReplies(1);
  },[targetReplyId,repliesLoaded,loadingReplies]);
  useEffect(()=>{
    if(!targetReplyId||loadingReplies)return;
    const found=replies.some(r=>r.id===targetReplyId);
    if(!found&&hasMoreReplies)loadMoreReplies();
  },[targetReplyId,replies,hasMoreReplies,loadingReplies]);
  useEffect(()=>{
    if(targetReplyId&&targetReplyRef.current){
      setTimeout(()=>{targetReplyRef.current?.scrollIntoView({behavior:"smooth",block:"center"});},300);
    }
  },[targetReplyId,replies]);

  useEffect(()=>{
    if(!showReplies)return;
    const unsubscribe=subscribeRepliesRealtime(comment.id,
      payload=>{
        const newId=payload.new.id;
        sb.from("comment_replies").select("id,parent_comment_id,author_id,text,media_url,sticker_id,reply_to_id,likes_count,created_at,author:profiles(id,prenom,nom,avatar_url,badge)")
          .eq("id",newId).maybeSingle().then(({data})=>{
            if(!data)return;
            setReplies(prev=>prev.some(r=>r.id===data.id)?prev:[...prev,data]);
            setRepliesCount(c=>c+1);
          });
      },
      payload=>{
        const delId=payload.old.id;
        setReplies(prev=>prev.some(r=>r.id===delId)?prev.filter(r=>r.id!==delId):prev);
        setRepliesCount(c=>Math.max((c||1)-1,0));
      },
      payload=>{
        const updated=payload.new;
        setReplies(prev=>prev.map(r=>r.id===updated.id?{...r,likes_count:updated.likes_count,text:updated.text,media_url:updated.media_url}:r));
      }
    );
    return unsubscribe;
  },[showReplies,comment.id]);

  const loadReplies=useCallback(async(page=1)=>{
    setLoadingReplies(true);
    const from=(page-1)*REPLIES_PAGE_SIZE;
    const to=from+REPLIES_PAGE_SIZE-1;
    const{data}=await sb.from("comment_replies")
      .select("id,parent_comment_id,author_id,text,media_url,sticker_id,reply_to_id,likes_count,created_at,author:profiles(id,prenom,nom,avatar_url,badge)")
      .eq("parent_comment_id",comment.id)
      .order("created_at",{ascending:true})
      .range(from,to);
    const rows=data||[];
    const ids=rows.map(r=>r.id);
    let likedSet=new Set();
    if(ids.length){
      const{data:myLikes}=await sb.from("reply_likes").select("reply_id").eq("user_id",sessionUserId).in("reply_id",ids);
      likedSet=new Set((myLikes||[]).map(l=>l.reply_id));
    }
    let authorLikedSet=new Set();
    if(ids.length&&postAuthorId){
      const{data:authorLikes}=await sb.from("reply_likes").select("reply_id").eq("user_id",postAuthorId).in("reply_id",ids);
      authorLikedSet=new Set((authorLikes||[]).map(l=>l.reply_id));
    }
    setReplies(prev=>{
      if(page===1)return rows;
      const seen=new Set(prev.map(r=>r.id));
      const merged=[...prev,...rows.filter(r=>!seen.has(r.id))];
      return merged.length>MAX_MOUNTED_REPLIES?merged.slice(merged.length-MAX_MOUNTED_REPLIES):merged;
    });
    setLikedReplyIds(prev=>page===1?likedSet:new Set([...prev,...likedSet]));
    setAuthorLikedReplyIds(prev=>page===1?authorLikedSet:new Set([...prev,...authorLikedSet]));
    setHasMoreReplies(rows.length===REPLIES_PAGE_SIZE);
    setRepliesLoaded(true);
    setLoadingReplies(false);
  },[comment.id,sessionUserId,postAuthorId]);

  const toggleShowReplies=()=>{
    const next=!showReplies;
    setShowReplies(next);
    if(next&&!repliesLoaded)loadReplies(1);
  };

  const loadMoreReplies=()=>{
    if(loadingReplies||!hasMoreReplies)return;
    const next=repliesPage+1;setRepliesPage(next);loadReplies(next);
  };

  const toggleLike=async()=>{
    if(liked){
      setLiked(false);setLikes(l=>Math.max(l-1,0));
      const{error}=await sb.from("comment_likes").delete().eq("comment_id",comment.id).eq("user_id",sessionUserId);
      if(error){setLiked(true);setLikes(l=>l+1);notify?.("Erreur, réessaie");}
    } else {
      setLiked(true);setLikes(l=>l+1);
      const{error}=await sb.from("comment_likes").insert({comment_id:comment.id,user_id:sessionUserId});
      if(error){setLiked(false);setLikes(l=>Math.max(l-1,0));notify?.("Erreur, réessaie");return;}
      if(comment.author_id&&comment.author_id!==sessionUserId){
        await sb.from("notifications").insert({
          user_id:comment.author_id,
          from_id:sessionUserId,
          type:"comment_like",
          post_id:comment.post_id||null,
          comment_id:comment.id,
          read:false
        });
      }
    }
  };

  const toggleReplyLike=async(reply)=>{
    const isLiked=likedReplyIds.has(reply.id);
    if(isLiked){
      setLikedReplyIds(prev=>{const s=new Set(prev);s.delete(reply.id);return s;});
      setReplies(prev=>prev.map(r=>r.id===reply.id?{...r,likes_count:Math.max((r.likes_count||1)-1,0)}:r));
      const{error}=await sb.from("reply_likes").delete().eq("reply_id",reply.id).eq("user_id",sessionUserId);
      if(error){
        setLikedReplyIds(prev=>new Set([...prev,reply.id]));
        setReplies(prev=>prev.map(r=>r.id===reply.id?{...r,likes_count:(r.likes_count||0)+1}:r));
        notify?.("Erreur, réessaie");
      }
    } else {
      setLikedReplyIds(prev=>new Set([...prev,reply.id]));
      setReplies(prev=>prev.map(r=>r.id===reply.id?{...r,likes_count:(r.likes_count||0)+1}:r));
      const{error}=await sb.from("reply_likes").insert({reply_id:reply.id,user_id:sessionUserId});
      if(error){
        setLikedReplyIds(prev=>{const s=new Set(prev);s.delete(reply.id);return s;});
        setReplies(prev=>prev.map(r=>r.id===reply.id?{...r,likes_count:Math.max((r.likes_count||1)-1,0)}:r));
        notify?.("Erreur, réessaie");
        return;
      }
      if(reply.author_id&&reply.author_id!==sessionUserId){
        await sb.from("notifications").insert({
          user_id:reply.author_id,
          from_id:sessionUserId,
          type:"reply_like",
          post_id:comment.post_id||null,
          comment_id:comment.id,
          reply_id:reply.id,
          read:false
        });
      }
    }
  };

  const submitReply=async()=>{
    if(!replyText.trim()&&!replyMediaFile&&!replyPendingSticker)return;
    const text=replyText.trim();
    const target=replyToTarget;
    let mediaUrl=null;
    let stickerId=null;
    if(replyPendingSticker){
      mediaUrl=replyPendingSticker.url;
      stickerId=replyPendingSticker.id;
    }else if(replyMediaFile){
      try{
        mediaUrl=await uploadToR2(replyMediaFile,"comments");
      }catch(e){
        console.error("Erreur upload réponse:",e);
      }
    }
    setReplyText("");setReplying(false);setReplyToTarget(null);
    setReplyMediaFile(null);setReplyMediaPreview(null);setReplyPendingSticker(null);
    const{data:newReply,error}=await sb.from("comment_replies").insert({parent_comment_id:comment.id,author_id:sessionUserId,text,media_url:mediaUrl,sticker_id:stickerId,reply_to_id:target?.id||null}).select("id").single();
    if(error){notify?.("Erreur, réessaie");return;}
    if(stickerId)Promise.resolve(sb.rpc("increment_sticker_usage",{sticker_id:stickerId})).catch(()=>{});
    const notifyTargetId=target?
      (replies.find(r=>r.id===target.id)?.author_id)
      :comment.author_id;
    if(notifyTargetId&&notifyTargetId!==sessionUserId){
      await sb.from("notifications").insert({
        user_id:notifyTargetId,
        from_id:sessionUserId,
        type:"reply",
        post_id:comment.post_id||null,
        comment_id:comment.id,
        reply_id:newReply?.id||null,
        read:false
      });
    }
    setRepliesCount(c=>c+1);
    setRepliesPage(1);
    loadReplies(1);
    setShowReplies(true);
  };

  const startReplyTo=(target)=>{
    setReplyToTarget(target);
    setReplying(true);
  };

  const [showCmtMenu,setShowCmtMenu]=useState(false);
  const del=async()=>{
    setShowCmtMenu(false);
    if(!(await confirmAction("Supprimer ce commentaire ?",{confirmLabel:"Supprimer"})))return;
    const{data:replyRows}=await sb.from("comment_replies").select("id").eq("parent_comment_id",comment.id);
    const replyIds=(replyRows||[]).map(r=>r.id);
    if(replyIds.length)await sb.from("reply_likes").delete().in("reply_id",replyIds);
    await sb.from("comment_likes").delete().eq("comment_id",comment.id);
    await sb.from("comment_replies").delete().eq("parent_comment_id",comment.id);
    const{error}=await sb.from("comments").delete().eq("id",comment.id);
    if(error){notify?.("Erreur, réessaie");return;}
    onChange?.("delete");
  };
  const copy=()=>{
    navigator.clipboard?.writeText(comment.text||"");
    setShowCmtMenu(false);
  };

  const replyAuthorName=(replyToId)=>{
    const target=replies.find(r=>r.id===replyToId);
    return target?.author?normProfile(target.author).name:null;
  };

  return(
    <div style={{display:"flex",gap:10,paddingBottom:4}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
        <Av u={author} size={36} onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:author?.id}}))}/>
        {(repliesCount>0||replying)&&(
          <div style={{width:2,flex:1,minHeight:16,background:"rgba(255,255,255,0.1)",borderRadius:2,marginTop:4}}/>
        )}
      </div>

      <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
          <span style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,fontWeight:600,color:T.muted}}>{author?.name||"?"}</span>
            {isAuthorComment&&(
              <span style={{fontSize:9,fontWeight:700,color:T.goldL,background:"transparent",border:`1px solid ${T.goldL}55`,padding:"1px 5px",borderRadius:6,letterSpacing:.2}}>Auteur</span>
            )}
          </span>
          {(isMine||comment.text)&&(
            <div style={{position:"relative"}}>
              <Btn onClick={()=>setShowCmtMenu(m=>!m)} style={{color:T.muted,padding:4,display:"flex",alignItems:"center"}}><MoreHorizontal size={16}/></Btn>
              {showCmtMenu&&(
                <div style={{position:"absolute",right:0,top:24,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:14,padding:6,zIndex:50,minWidth:140,boxShadow:"0 8px 30px rgba(0,0,0,0.4)"}}>
                  {comment.text&&<Btn onClick={copy} style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,color:T.text,fontSize:13,textAlign:"left"}}>📋 Copier</Btn>}
                  {isMine&&<Btn onClick={del} style={{width:"100%",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,color:T.err,fontSize:13,textAlign:"left"}}>🗑 Supprimer</Btn>}
                </div>
              )}
            </div>
          )}
        </div>

        {(comment.text||comment.media_url)&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
            {comment.text&&(
              <div style={{minWidth:0}}>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",overflowWrap:"break-word",textAlign:"left"}}>{renderTextWithMentions(comment.text,comment.mentions)}</p>
                <TranslateBtn text={comment.text}/>
              </div>
            )}
            {comment.media_url&&(
              comment.sticker_id
                ?<img src={comment.media_url} alt="" onClick={()=>onOpenSticker?.(comment.sticker_id)} style={{width:84,height:84,objectFit:"contain",flexShrink:0,cursor:"pointer"}}/>
                :<div style={{borderRadius:10,overflow:"hidden",width:64,height:64,flexShrink:0}}>
                    <MediaPlayer url={comment.media_url} style={{width:"100%",height:"100%",maxHeight:"none",objectFit:"cover"}} onImageClick={url=>window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url}}))}/>
                  </div>
            )}
          </div>
        )}

        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
          <span style={{fontSize:11,color:T.muted}}>{ago(comment.created_at)}</span>
          <Btn onClick={()=>startReplyTo(null)} style={{color:T.muted,fontSize:12,fontWeight:700}}>Répondre</Btn>
          {authorLiked&&(
            <span style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:T.goldL,fontWeight:600}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              aimé par l'auteur
            </span>
          )}
          <Btn onClick={toggleLike} style={{display:"flex",alignItems:"center",gap:5,color:liked?T.err:T.muted,fontSize:12,marginLeft:"auto"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {likes>0&&<span>{likes}</span>}
          </Btn>
        </div>

        {replying&&(
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {replyToTarget&&(
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.muted}}>
                <span>En réponse à @{replyToTarget.name}</span>
                <Btn onClick={()=>setReplyToTarget(null)} style={{color:T.muted,display:"flex"}}><X size={11}/></Btn>
              </div>
            )}
            {replyMediaPreview&&(
              <div style={{position:"relative",display:"inline-flex"}}>
                <img src={replyMediaPreview} alt="" style={{width:70,height:70,objectFit:"cover",borderRadius:12}}/>
                <Btn onClick={()=>{setReplyMediaPreview(null);setReplyMediaFile(null);}} style={{position:"absolute",top:-6,right:-6,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:20,height:20,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={10}/></Btn>
              </div>
            )}
            {replyPendingSticker&&(
              <div style={{position:"relative",display:"inline-flex"}}>
                <img src={replyPendingSticker.url} alt="" style={{width:60,height:60,objectFit:"contain"}}/>
                <Btn onClick={()=>setReplyPendingSticker(null)} style={{position:"absolute",top:-6,right:-6,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:20,height:20,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={10}/></Btn>
              </div>
            )}
            <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
              <input ref={replyImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                const f=e.target.files[0];if(!f)return;
                const compressed=await compressImage(f);
                const r=new FileReader();r.onload=ev=>setReplyMediaPreview(ev.target.result);r.readAsDataURL(compressed);
                setReplyMediaFile(compressed);
                setReplyPendingSticker(null);
                e.target.value="";
              }}/>
              <Btn onClick={()=>replyImgRef.current.click()} style={{color:replyMediaFile?T.goldL:T.muted,padding:"4px",display:"flex",alignItems:"center",flexShrink:0}}>
                <Camera size={16}/>
              </Btn>
              <div style={{position:"relative",display:"flex",flexShrink:0}}>
                <Btn onClick={()=>setShowReplyStickerPicker(v=>!v)} style={{color:showReplyStickerPicker?T.goldL:T.muted,padding:"4px",display:"flex",alignItems:"center"}}>
                  <StickerIcon size={16}/>
                </Btn>
                {showReplyStickerPicker&&(
                  <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,width:260,maxWidth:"80vw",zIndex:20}}>
                    <StickerPicker sb={sb} userId={sessionUserId} T={T} onClose={()=>setShowReplyStickerPicker(false)} onSelect={(s)=>{setShowReplyStickerPicker(false);setReplyMediaFile(null);setReplyMediaPreview(null);setReplyPendingSticker(s);}}/>
                  </div>
                )}
              </div>
              <textarea autoFocus rows={1} value={replyText}
                onChange={e=>{setReplyText(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
                placeholder={replyToTarget?`Répondre à ${replyToTarget.name}…`:`Répondre à ${author?.name||""}…`}
                style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:16,padding:"8px 14px",color:T.text,fontSize:13,outline:"none",resize:"none",lineHeight:1.4,maxHeight:100,fontFamily:"inherit"}}/>
              <Btn onClick={submitReply} disabled={!replyText.trim()&&!replyMediaFile&&!replyPendingSticker} style={{background:(replyText.trim()||replyMediaFile||replyPendingSticker)?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:32,height:32,color:(replyText.trim()||replyMediaFile||replyPendingSticker)?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Send size={13}/>
              </Btn>
            </div>
          </div>
        )}

        {repliesCount>0&&(
          <Btn onClick={toggleShowReplies} style={{fontSize:12,color:T.muted,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:16,height:1,background:T.muted,borderRadius:1}}/>
            {showReplies?`Masquer les réponses`:`Afficher ${repliesCount} réponse${repliesCount>1?"s":""}`}
            <ChevronDown size={13} style={{transform:showReplies?"rotate(180deg)":"none",transition:"transform .2s"}}/>
          </Btn>
        )}

        {showReplies&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:8}}>
            {loadingReplies&&replies.length===0&&(
              <div style={{display:"flex",justifyContent:"center",padding:"8px 0"}}><div style={{width:16,height:16,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .7s linear infinite"}}/></div>
            )}
            {replies.map(r=>(
              <div key={r.id} ref={targetReplyId===r.id?targetReplyRef:null}
                style={{borderRadius:12,transition:"background .5s",
                  background:targetReplyId===r.id?"rgba(201,149,42,0.12)":"transparent"}}>
              <ReplyItem
                reply={r}
                sessionUserId={sessionUserId}
                liked={likedReplyIds.has(r.id)}
                onToggleLike={()=>toggleReplyLike(r)}
                onReplyTo={()=>startReplyTo({id:r.id,name:r.author?normProfile(r.author).name:"?"})}
                onDeleted={()=>{setReplies(prev=>prev.filter(x=>x.id!==r.id));setRepliesCount(c=>Math.max(c-1,0));}}
                replyToName={r.reply_to_id?replyAuthorName(r.reply_to_id):null}
                onOpenSticker={onOpenSticker}
                notify={notify}
                postAuthorId={postAuthorId}
                authorLiked={authorLikedReplyIds.has(r.id)}
              />
              </div>
            ))}
            {hasMoreReplies&&(
              <Btn onClick={loadMoreReplies} disabled={loadingReplies} style={{fontSize:12,color:T.goldL,fontWeight:700,alignSelf:"flex-start"}}>
                {loadingReplies?"Chargement…":"Voir plus de réponses"}
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ── REPLY ITEM (likes + vrai lien de threading) ─
const ReplyItem=React.memo(function ReplyItem({reply,sessionUserId,liked,onToggleLike,onReplyTo,onDeleted,replyToName,onOpenSticker,notify,postAuthorId=null,authorLiked=false}){
  const ra=reply.author?normProfile(reply.author):{initials:"?",color:"#888",name:"?"};
  const isMyReply=reply.author_id===sessionUserId;
  const isAuthorReply=!!postAuthorId&&reply.author_id===postAuthorId;
  const [showMenu,setShowMenu]=useState(false);

  const del=async()=>{
    setShowMenu(false);
    if(!(await confirmAction("Supprimer cette réponse ?",{confirmLabel:"Supprimer"})))return;
    const{error}=await sb.from("comment_replies").delete().eq("id",reply.id);
    if(error){notify?.("Erreur, réessaie");return;}
    onDeleted?.();
  };
  const copy=()=>{
    navigator.clipboard?.writeText(reply.text||"");
    setShowMenu(false);
  };

  return(
    <div style={{display:"flex",gap:10}}>
      <Av u={ra} size={28}/>
      <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <span style={{fontSize:12,fontWeight:600,color:T.muted}}>{ra.name}</span>
          {isAuthorReply&&(
            <span style={{fontSize:9,fontWeight:800,color:"#000",background:T.gradGold,padding:"2px 7px",borderRadius:8,letterSpacing:.3}}>Auteur</span>
          )}
          {(isMyReply||reply.text)&&(
            <div style={{position:"relative",marginLeft:"auto"}}>
              <Btn onClick={()=>setShowMenu(m=>!m)} style={{color:T.muted,padding:2,display:"flex"}}><MoreHorizontal size={14}/></Btn>
              {showMenu&&(
                <div style={{position:"absolute",right:0,top:20,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:12,padding:6,zIndex:50,minWidth:130,boxShadow:"0 8px 30px rgba(0,0,0,0.4)"}}>
                  {reply.text&&<Btn onClick={copy} style={{width:"100%",padding:"8px 12px",display:"flex",alignItems:"center",gap:8,color:T.text,fontSize:12,textAlign:"left"}}>📋 Copier</Btn>}
                  {isMyReply&&<Btn onClick={del} style={{width:"100%",padding:"8px 12px",display:"flex",alignItems:"center",gap:8,color:T.err,fontSize:12,textAlign:"left"}}>🗑 Supprimer</Btn>}
                </div>
              )}
            </div>
          )}
        </div>
        {replyToName&&(
          <div style={{fontSize:11,color:T.goldL,marginBottom:2}}>↳ en réponse à @{replyToName}</div>
        )}
        {reply.text&&(
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:T.text,lineHeight:1.6,wordBreak:"break-word",overflowWrap:"break-word",textAlign:"left"}}>{reply.text}</p>
        )}
        {reply.media_url&&(
          reply.sticker_id
            ?<img src={reply.media_url} alt="" onClick={()=>onOpenSticker?.(reply.sticker_id)} style={{width:70,height:70,objectFit:"contain",cursor:"pointer",marginBottom:4}}/>
            :<div style={{borderRadius:10,overflow:"hidden",width:56,height:56,marginBottom:4}}>
                <MediaPlayer url={reply.media_url} style={{width:"100%",height:"100%",maxHeight:"none",objectFit:"cover"}} onImageClick={url=>window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url}}))}/>
              </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:11,color:T.muted}}>{ago(reply.created_at)}</span>
          <Btn onClick={onReplyTo} style={{color:T.muted,fontSize:11,fontWeight:700}}>Répondre</Btn>
          <TranslateBtn text={reply.text}/>
          {authorLiked&&(
            <span style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:T.goldL,fontWeight:600}}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              aimé par l'auteur
            </span>
          )}
          <Btn onClick={onToggleLike} style={{display:"flex",alignItems:"center",gap:4,color:liked?T.err:T.muted,fontSize:11,marginLeft:"auto"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={liked?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {(reply.likes_count||0)>0&&<span>{reply.likes_count}</span>}
          </Btn>
        </div>
      </div>
    </div>
  );
});

// ── POST DETAIL MODAL (ENRICHI) ───────────────────────────
function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onParticipate,onComment,notify,zIndex=800,fromReel=false,onPhotoView,saved=false,onSave}){
  
const {members,convs}=useApp();
useEffect(()=>{
  let active=true;
  const check=()=>sb.rpc("is_post_protected",{p_post_id:post?.id}).then(({data})=>{if(active)(data?enableScreenProtection():disableScreenProtection());});
  check();
  const ch=sb.channel(`privacy_post_${post?.by}-${Math.random()}`)
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${post?.by}`},check)
    .subscribe();
  return()=>{active=false;sb.removeChannel(ch);disableScreenProtection();};
},[post?.id,post?.by]);
const [viewImg,setViewImg]=useState(null);
const [openCeleste,setOpenCeleste]=useState(false);
const [celesteMsgs,setCelesteMsgs]=useState([]);
const [cmtCount,setCmtCount]=useState((post.comments||[]).length);
const [views,setViews]=useState(0);
const [slideIdx,setSlideIdx]=useState(0);
const [shareCount,setShareCount]=useState(0);
const [showShareModal,setShowShareModal]=useState(false);

useEffect(()=>{
  if(!post?.id||!session?.user?.id)return;
  sb.from("post_views").upsert(
    {post_id:post.id,viewer_id:session.user.id},
    {onConflict:"post_id,viewer_id",ignoreDuplicates:true}
  ).then(()=>{
    sb.from("post_views").select("*",{count:"exact",head:true}).eq("post_id",post.id)
      .then(({count})=>setViews(count||0));
  });
},[post?.id,session?.user?.id]);

useEffect(()=>{
  if(!post?.id)return;
  sb.from("post_shares").select("*",{count:"exact",head:true}).eq("post_id",post.id)
    .then(({count})=>setShareCount(count||0));
},[post?.id]);
useEffect(()=>{
    const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
    [slideIdx-1,slideIdx,slideIdx+1].forEach(i=>{
      const url=allMedia[i];
      if(url&&!/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url)){const img=new window.Image();img.src=url;}
    });
  },[slideIdx,post.media_urls,post.img]);

  const swipeStartRef=useRef(null);
  const bottomRef=useRef();
  const auth=post.author||getM(post.by);
  const liked=(post.likes||[]).includes(session?.user?.id);
  const participating=(post.participants||[]).includes(session?.user?.id);
  const participantsCount=(post.participants||[]).length;
  const evDateParts=formatEventDate(post.eventDate);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[]);
  if(post?.is_private&&!isNative&&post?.by!==session?.user?.id){
    return(
      <div style={{position:"fixed",inset:0,zIndex:zIndex,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,padding:"28px 20px calc(28px + env(safe-area-inset-bottom,0px))",display:"flex",flexDirection:"column",alignItems:"center",gap:12,textAlign:"center"}}>
          <Lock size={30} color={T.goldL}/>
          <p style={{margin:0,fontSize:16,fontWeight:700,color:T.text}}>Publication privée</p>
          <p style={{margin:0,fontSize:13,color:T.muted,lineHeight:1.6,maxWidth:300}}>Cette publication n'est visible que dans l'application Céleste sur Android — pas sur le web.</p>
          <Btn onClick={onClose} style={{marginTop:8,padding:"10px 24px",borderRadius:20,background:T.gradGold,color:"#000",fontWeight:700,fontSize:13}}>Fermer</Btn>
        </div>
      </div>
    );
  }

  return(

    <>
      {viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}
      <div style={{position:"fixed",inset:0,zIndex:zIndex,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>e.target===e.currentTarget&&onClose()}>
        <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)",boxShadow:"0 -20px 60px rgba(0,0,0,0.8)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Av u={auth} size={38}/>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{auth?.name}</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>{ago(post.ts)}</p>
              </div>
            </div>
            <Btn onMouseDown={e=>e.preventDefault()} onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
          </div>
          <div style={{overflowY:"auto",flex:1,padding:"0 16px 16px"}}>
            {post.type==="poll"
              ?<div style={{margin:"12px 0"}}><PollCard post={post} session={session}/></div>
              :post.type==="event"
              ?<div style={{margin:"12px 0",borderRadius:18,overflow:"hidden",border:`1px solid ${T.gold}22`,background:T.goldBg}}>
                {post.img&&(
                  <div style={{position:"relative",width:"100%",height:200}}>
                    <SmartImage src={post.img} alt=""/>
                    <div style={{position:"absolute",top:10,left:10,display:"flex",alignItems:"center",gap:5,background:"linear-gradient(90deg,#ff3d6e,#ff8a3d)",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#fff",letterSpacing:.5}}>
                      <Calendar size={13}/> ÉVÉNEMENT
                    </div>
                  </div>
                )}
                <div style={{padding:16}}>
                  <div style={{display:"flex",gap:12,marginBottom:14}}>
                    {evDateParts&&(
                      <div style={{flexShrink:0,width:64,textAlign:"center",border:`1px solid ${T.gold}55`,borderRadius:12,padding:"9px 4px",background:"rgba(255,255,255,0.02)"}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.gold,letterSpacing:.5}}>{evDateParts.dayName}</div>
                        <div style={{fontSize:23,fontWeight:800,color:T.text,lineHeight:1.1}}>{evDateParts.dayNum}</div>
                        <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:.5}}>{evDateParts.month}</div>
                      </div>
                    )}
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:"0 0 6px",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:T.text,lineHeight:1.25}}>{post.title}</p>
                      {post.text&&<p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.7}}>{post.text}</p>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                    {post.eventLoc&&(
                      <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",borderRadius:20,padding:"6px 10px",fontSize:12,color:T.sub}}>
                        <MapPin size={12}/> {post.eventLoc}
                      </div>
                    )}
                    {post.eventTime&&(
                      <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",borderRadius:20,padding:"6px 10px",fontSize:12,color:T.sub}}>
                        <Clock size={12}/> {post.eventTime}
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",borderRadius:20,padding:"6px 10px",fontSize:12,color:T.sub}}>
                      <Users size={12}/> {participantsCount} participant{participantsCount>1?"s":""}
                    </div>
                  </div>
                  <button onClick={()=>onParticipate(post.id)} style={{width:"100%",borderRadius:14,padding:"13px",fontSize:14,fontWeight:700,color:participating?T.gold:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:participating?"rgba(255,255,255,0.06)":"linear-gradient(90deg,#ff3d6e,#ff8a3d)",border:participating?`1px solid ${T.gold}55`:"none"}}>
                    {participating?<><Check size={16}/> Vous participez</>:<><UserPlus size={16}/> Participer</>}
                  </button>
                </div>
              </div>
              :<>
              {post.text&&<p style={{margin:"12px 0 8px",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-line"}}>{renderTextWithMentions(post.text,post.mentions)}</p>}
  {(()=>{
  const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
  if(allMedia.length===0)return null;
  return(
    <div style={{marginBottom:10}}>
      <div
        onScroll={e=>{
          const el=e.currentTarget;
          const cardWidth=el.scrollWidth/allMedia.length;
          const idx=Math.round(el.scrollLeft/cardWidth);
          if(idx!==slideIdx)setSlideIdx(Math.max(0,Math.min(allMedia.length-1,idx)));
        }}
        style={{display:"flex",gap:8,overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}
      >
        {allMedia.map((url,i)=>(
          <div key={i} onClick={e=>{e.stopPropagation();if(url.match(/\.(mp4|mov|webm)/i))window.dispatchEvent(new CustomEvent("celeste_open_reel",{detail:{post,url}}));}}
            style={{flex:allMedia.length>1?"0 0 88%":"0 0 100%",scrollSnapAlign:"center",aspectRatio:"4/5",borderRadius:16,overflow:"hidden",position:"relative",background:T.card}}>
            <MediaPlayer url={url} style={{width:"100%",height:"100%",maxHeight:"none",objectFit:"cover"}} onImageClick={()=>{if(onPhotoView){onPhotoView(post,url);}else{window.dispatchEvent(new CustomEvent("celeste_open_photo_viewer",{detail:{post,url}}));}}} onVideoClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_reel",{detail:{post,url}}))}/>
          </div>
        ))}
      </div>
      {allMedia.length>1&&(
        <div style={{display:"flex",justifyContent:"center",gap:4,marginTop:8}}>
          {allMedia.map((_,i)=><div key={i} style={{width:i===slideIdx?16:6,height:6,borderRadius:3,background:i===slideIdx?T.gold:T.border,transition:"width .2s"}}/>)}
        </div>
      )}
    </div>
  );
})()}
              </>
            }
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"10px 0",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,margin:"10px 0"}}>
              <Btn onClick={()=>onLike(post.id)} style={{display:"flex",alignItems:"center",gap:6,color:liked?T.gold:T.sub,fontSize:13,fontWeight:600,transition:"all .2s"}}>
  <Heart size={18} fill={liked?"currentColor":"none"} style={{color:liked?T.gold:T.muted,animation:liked?"pulse .3s ease":"none"}}/>
  {fmtCount((post.likes||[]).length)}
</Btn>
<span style={{color:T.sub,fontSize:13}}>💬 {fmtCount(cmtCount)}</span>{(
  <span style={{color:T.sub,fontSize:13,display:"flex",alignItems:"center",gap:4}}>
    <Eye size={14}/>{views}
  </span>
)}
              <div style={{flex:1}}/>
              <Btn onClick={()=>setShowShareModal(true)} style={{display:"flex",alignItems:"center",gap:6,color:T.sub,fontSize:13,fontWeight:600}}>
                <Share2 size={18}/>
                {shareCount>0&&<span>{shareCount}</span>}
              </Btn>
              {onSave&&(
                <Btn onClick={()=>onSave(post.id)} style={{display:"flex",alignItems:"center",color:saved?T.gold:T.sub}}>
                  <Bookmark size={18} fill={saved?"currentColor":"none"}/>
                </Btn>
              )}
            </div>
            <CommentsSection
  postId={post.id}
  sessionUserId={session?.user?.id}
  getM={getM}
  onCountChange={setCmtCount}
  targetCommentId={post._targetCommentId||null}
  targetReplyId={post._targetReplyId||null}
  notify={notify}
  commentsDisabled={!!post.comments_disabled}
  postAuthorId={post.by}
/>
            <div ref={bottomRef}/>
          </div>
        </div>
      </div>
      {showShareModal&&(
        <SharePostModal
          post={post}
          sb={sb}
          session={session}
          T={T}
          Av={Av}
          members={members}
          convs={convs}
          notify={notify}
          onClose={()=>setShowShareModal(false)}
          onShared={()=>{setShowShareModal(false);setShareCount(c=>c+1);notify("Partagé ✦");}}
        />
      )}
    </>
  );
}
function CommentsOnlyModal({post,session,getM,onClose,zIndex=1300,notify,onCountChange}){
  const [cmtCount,setCmtCount]=useState(0);
  return(
    <div style={{position:"fixed",inset:0,zIndex,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onMouseDown={e=>{if(e.target===e.currentTarget)e.preventDefault();}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,height:"85vh",display:"flex",flexDirection:"column",animation:"slideUp .3s cubic-bezier(0.34,1.1,0.64,1)",marginBottom:"var(--kb-height,0px)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
         <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>{cmtCount>0?`${fmtCount(cmtCount)} commentaire${cmtCount>1?"s":""}`:"Commentaires"}</p>          <Btn onMouseDown={e=>e.preventDefault()} onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
        </div>
        <div style={{flex:1,minHeight:0,overflow:"visible",display:"flex",flexDirection:"column",padding:"0 16px 16px"}}>
          <CommentsSection postId={post.id} sessionUserId={session?.user?.id} getM={getM} onCountChange={c=>{setCmtCount(c);onCountChange?.(c);}} targetCommentId={post._targetCommentId||null} targetReplyId={post._targetReplyId||null} standalone notify={notify} commentsDisabled={!!post.comments_disabled} postAuthorId={post.by}/>
        </div>
      </div>
    </div>
  );
}
// ── Pastille de publication en arrière-plan (même principe que dans CameraStudioModal) ──
// Créée en DOM natif pour rester visible même après la fermeture du modal Nouveau Post.
// Réutilise le keyframe "spin" déjà défini globalement plus haut dans App.jsx.
function showPostProgress(label){
  const pill=document.createElement("div");
  pill.style.cssText=`
    position:fixed;bottom:26px;left:50%;transform:translateX(-50%);
    z-index:99999;display:flex;align-items:center;gap:10px;
    background:rgba(10,10,10,0.94);border:1px solid rgba(255,255,255,0.12);
    border-radius:30px;padding:10px 18px;backdrop-filter:blur(20px);
    box-shadow:0 8px 30px rgba(0,0,0,0.5);
  `;
  const spinner=document.createElement("div");
  spinner.style.cssText=`
    width:16px;height:16px;border-radius:50%;flex-shrink:0;
    border:2px solid rgba(201,149,42,0.25);border-top-color:#C9952A;
    animation:spin .8s linear infinite;
  `;
  const labelEl=document.createElement("span");
  labelEl.style.cssText="color:#fff;font-size:13px;font-weight:600;white-space:nowrap;";
  labelEl.textContent=label||"Publication en cours…";
  pill.appendChild(spinner);
  pill.appendChild(labelEl);
  document.body.appendChild(pill);
  return{
    update:(msg)=>{labelEl.textContent=msg;},
    done:(msg)=>{spinner.remove();labelEl.textContent=msg||"Publié ✦";setTimeout(()=>pill.remove(),1800);},
    fail:(msg)=>{spinner.remove();labelEl.textContent=msg||"Échec de la publication";setTimeout(()=>pill.remove(),2500);},
  };
}

// ── Publication réelle du post ────────────────────────────────────
// Fonction volontairement en dehors du composant NewPostModal : elle ne lit
// aucun state ni ref React, seulement les valeurs qu'on lui passe dans "payload".
// Comme ça, même si le modal est démonté (fermé) juste après l'appel, cette
// fonction continue de tourner jusqu'au bout — c'est ce qui permet une vraie
// publication en arrière-plan, fiable, plutôt qu'un effet de bord accidentel.
async function runPublish(payload,{onProgress}={}){
  const{
    uid,type,text,mediaUrls,evImgUrl,evTitle,evDate,evTime,evLoc,textBg,textFont,
    isForSale,isAiGenerated,isPrivate,commentsDisabled,
    contactType,whatsappIndicatif,whatsappNum,contactLink,saleExpiry,
    price,stock,dealType,
    pollExpiresAt,pollMultiple,pollOptions,
    selectedCategories,duoCollaborators,selectedSound,lastVideoFile,
    mentions,mentionedIds,authorName,
  }=payload;

  const{data:insertedPost,error}=await sb.from("posts").insert({
    author_id:uid,type,
    visibility:"testing",
    text:text.trim()||"",
    img_url:type==="event"?(evImgUrl||null):(mediaUrls.length===1?(mediaUrls[0]||null):null),
    media_urls:mediaUrls.length>1?mediaUrls:null,
    event_title:type==="event"?evTitle.trim():null,
    event_date:type==="event"?evDate:null,
    event_time:type==="event"?(evTime||null):null,
    event_loc:type==="event"?evLoc:null,
     text_background:textBg||null,
    text_font:textFont||null,
    is_for_sale:isForSale||false,
    is_ai_generated:type==="photo"?(isAiGenerated||false):false,
    is_private:isPrivate||false,
    comments_disabled:commentsDisabled||false,
    whatsapp_contact:isForSale&&contactType==="whatsapp"?(whatsappNum.trim()?`${whatsappIndicatif}${whatsappNum.trim()}`:null):null,
    contact_link:isForSale&&contactType==="link"?(contactLink.trim()||null):null,
    price:isForSale?(Number(price)||null):null,
    stock:isForSale?(Number(stock)||null):null,
    deal_type:isForSale?(dealType||"sale"):null,
    expires_at:type==="poll"?pollExpiresAt:(isForSale&&saleExpiry!=="0"?(new Date(Date.now()+parseInt(saleExpiry)*24*60*60*1000).toISOString()):null),
    poll_multiple:type==="poll"?pollMultiple:false,
    mentions
  }).select("id").single();

  if(error) throw error;
  const postId=insertedPost?.id;
  if(!postId) return;

  onProgress?.("Finalisation…");

  if(type==="poll"){
    const optsToInsert=pollOptions.map(o=>o.trim()).filter(Boolean).map((label,position)=>({post_id:postId,label,position}));
    if(optsToInsert.length>=2)await sb.from("poll_options").insert(optsToInsert);
  }
  if(selectedCategories.length>0){
    await sb.from("post_categories").delete().eq("post_id",postId).eq("source","inferred");
    await sb.from("post_categories").insert(selectedCategories.map(category=>({post_id:postId,category,source:"manual"})));
  }
  if(duoCollaborators.length>0){
    await saveDuoCollaborators(sb,postId,uid,duoCollaborators);
  }
  if(!selectedSound&&lastVideoFile){
    autoExtractAndAttachSound({sb,uploadToR2,videoFile:lastVideoFile,postId,uid,authorName});
  }
  if(selectedSound){
    if(selectedSound.isNew&&selectedSound.blob){
      const soundMime=selectedSound.blob.type||"audio/webm";
      const soundExt=soundMime.includes("mp4")?"m4a":soundMime.includes("mpeg")?"mp3":soundMime.includes("wav")?"wav":soundMime.includes("ogg")?"ogg":"webm";
      const soundFile=new File([selectedSound.blob],`son-${postId}.${soundExt}`,{type:soundMime});
      const soundUrl=await uploadToR2(soundFile,"sounds");
      const{data:newSound}=await sb.from("sounds").insert({title:selectedSound.title,url:soundUrl,source_post_id:postId,usage_count:1,created_by:uid}).select("id").single();
      if(newSound?.id) await sb.from("posts").update({sound_id:newSound.id}).eq("id",postId);
    } else if(selectedSound.id){
      await sb.from("posts").update({sound_id:selectedSound.id}).eq("id",postId);
      await sb.rpc("increment_sound_usage",{target_sound_id:selectedSound.id});
    }
  }

  // Notifications de mentions + viewers fréquents : volontairement non attendues,
  // elles continuent en tâche de fond sans retarder la fin de la publication.
  const uniqueIds=[...new Set(mentionedIds)].filter(id=>id!==uid);
  if(uniqueIds.length){
    Promise.all(uniqueIds.map(mentionedId=>
      sb.from("notifications").insert({user_id:mentionedId,from_id:uid,type:"mention",post_id:postId,read:false})
        .then(()=>sb.functions.invoke('send-push',{body:{targetUserId:mentionedId,title:"✦ Mention",body:`${authorName||"Quelqu'un"} t'a mentionné dans un post`}}))
    )).catch(e=>console.error("Erreur notifications mentions:",e));
  }
  sb.from("profile_views").select("viewer_id").eq("viewed_id",uid).gte("created_at",new Date(Date.now()-30*86400000).toISOString()).limit(500)
    .then(({data:frequentViewers})=>{
      const viewCounts=new Map();
      (frequentViewers||[]).forEach(r=>viewCounts.set(r.viewer_id,(viewCounts.get(r.viewer_id)||0)+1));
      const favIds=[...viewCounts.entries()].filter(([id,c])=>c>=3&&id!==uid).map(([id])=>id);
      Promise.all(favIds.map(targetId=>
        sb.from("notifications").insert({user_id:targetId,from_id:uid,type:"new_post_favorite",post_id:postId,read:false})
          .then(()=>sb.functions.invoke('send-push',{body:{targetUserId:targetId,title:"✦ Nouvelle publication",body:`${authorName||"Quelqu'un"} vient de publier`}}))
      )).catch(e=>console.error("Erreur notifications favoris:",e));
    });
}
function NewPostModal({myProfile,session,onClose,onPost,notify,initialSound=null}){

const [type,setType]=useState("text"); const [text,setText]=useState("");
const [previews,setPreviews]=useState([]); const [mediaUrls,setMediaUrls]=useState([]);
const [carouselIdx,setCarouselIdx]=useState(0);
const [uploading,setUploading]=useState(false);
const [uploadPct,setUploadPct]=useState(0);
const [cropSrc,setCropSrc]=useState(null);
const [cropResolve,setCropResolve]=useState(null);
const [videoTrimSrc,setVideoTrimSrc]=useState(null);

const [showCameraStudio,setShowCameraStudio]=useState(false);
const [evTitle,setEvTitle]=useState("");
const [evDate,setEvDate]=useState(""); const [evLoc,setEvLoc]=useState("");
const [evTime,setEvTime]=useState("");
const [evImgPreview,setEvImgPreview]=useState(null);
const [evImgUrl,setEvImgUrl]=useState(null);
const [evImgUploading,setEvImgUploading]=useState(false);
const evImgRef=useRef();
const handleEventImagePick=async e=>{
  const f=e.target.files[0];
  if(!f)return;
  const src=await new Promise((res,rej)=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.onerror=()=>rej(new Error("Lecture du fichier vidéo impossible"));r.readAsDataURL(f);});
  const croppedFile=await cropImage(src);
  const file=croppedFile||await compressImage(f);
  setEvImgUploading(true);
  try{
    const publicUrl=await uploadToR2(file,"posts",()=>{});
    setEvImgUrl(publicUrl);
    const previewSrc=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(file);});
    setEvImgPreview(previewSrc);
  }catch(err){console.error(err);}
  finally{setEvImgUploading(false);}
  e.target.value="";
};
const [busy,setBusy]=useState(false);
const [finalizing,setFinalizing]=useState(false);
const [textBg,setTextBg]=useState(null);
const [textFont,setTextFont]=useState("Space Grotesk");
const [pollOptions,setPollOptions]=useState(["",""]);
const [pollMultiple,setPollMultiple]=useState(false);
const [pollDuration,setPollDuration]=useState("2");
const updatePollOption=(i,val)=>setPollOptions(prev=>prev.map((o,idx)=>idx===i?val:o));
const addPollOption=()=>setPollOptions(prev=>prev.length<6?[...prev,""]:prev);
const removePollOption=i=>setPollOptions(prev=>prev.length>2?prev.filter((_,idx)=>idx!==i):prev);
const [selectedCategories,setSelectedCategories]=useState([]);
const [selectedSound,setSelectedSound]=useState(initialSound);
const [duoCollaborators,setDuoCollaborators]=useState([]);
const [showDrafts, setShowDrafts] = useState(false);
const [resumeDraft, setResumeDraft] = useState(null);
const [isForSale,setIsForSale]=useState(false);
const [isAiGenerated,setIsAiGenerated]=useState(false);
const [isPrivate,setIsPrivate]=useState(false);
const [commentsDisabled,setCommentsDisabled]=useState(false);
const [contactType,setContactType]=useState("whatsapp");
const [contactLink,setContactLink]=useState("");
const [whatsappNum,setWhatsappNum]=useState("");
const [whatsappIndicatif,setWhatsappIndicatif]=useState("242");
const fRef=useRef();
useEffect(()=>{
  if(window.__celesteSharedFile){
    handlePick({target:{files:[window.__celesteSharedFile]}});
    delete window.__celesteSharedFile;
  }
},[]);
const vRef=useRef();
const mentionedIdsRef=useRef([]);
const mentionNameMapRef=useRef(new Map());
const lastVideoFileRef=useRef(null);
const {members}=useApp();

  const cropImage=src=>new Promise(resolve=>{
    setCropSrc(src);
    setCropResolve({fn:resolve});
  });

const handlePick=async e=>{
    try{
    const files=Array.from(e.target.files).slice(0,10-previews.length);
    if(!files.length)return;
    for(const f of files){
      let file=f;
      if(f.type.startsWith("image/")&&f.size>20*1024*1024){notify?.("Image trop volumineuse (max 20MB)");continue;}
      if(f.type.startsWith("image/")){
        const reader=new FileReader();
        const src=await new Promise((res,rej)=>{reader.onload=ev=>res(ev.target.result);reader.onerror=rej;reader.readAsDataURL(f);});
        const croppedFile=await cropImage(src);
        file=croppedFile||await compressImage(f);
      }
      if(f.type.startsWith("video/")&&f.size>50*1024*1024){notify?.("Vidéo trop volumineuse (max 50MB)");continue;}
      if(f.type.startsWith("video/")&&f._fromCamera){
        const src=URL.createObjectURL(f);
        setPreviews(p=>[...p,{url:src,type:"video"}]);
        setType("photo");
        setUploading(true);setUploadPct(0);
lastVideoFileRef.current=f;
try{const publicUrl=await uploadToR2(f,"posts",pct=>setUploadPct(pct));setMediaUrls(p=>[...p,publicUrl]);}
catch(err){console.error(err);notify?.("Échec upload vidéo : "+(err?.message||String(err)));}
finally{setUploading(false);setUploadPct(0);}
continue;
      }
      if(f.type.startsWith("video/")){
        const src=await new Promise((res,rej)=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.onerror=()=>rej(new Error("Lecture du fichier vidéo impossible"));r.readAsDataURL(f);});
        const trimData=await new Promise(resolve=>setVideoTrimSrc({src,resolve}));
        setVideoTrimSrc(null);
        if(!trimData)continue;
        setPreviews(p=>[...p,{url:trimData.src,type:"video"}]);
        setType("photo");
        setUploading(true);setUploadPct(0);
try{const fileToUpload=trimData.file||f;lastVideoFileRef.current=fileToUpload;const publicUrl=await uploadToR2(fileToUpload,"posts",pct=>setUploadPct(pct));setMediaUrls(p=>[...p,publicUrl]);}
catch(err){console.error(err);}
finally{setUploading(false);setUploadPct(0);}
continue;
      }
      const r=new FileReader();
      r.onload=ev=>setPreviews(p=>[...p,{url:ev.target.result,type:f.type.startsWith("video/")?"video":"image"}]);setType("photo");
      r.readAsDataURL(file);
     setUploading(true);setUploadPct(0);
try {
  const publicUrl = await uploadToR2(file,"posts",pct=>setUploadPct(pct));
  setMediaUrls(p=>[...p,publicUrl]);
} catch(e) {
  console.error("Erreur upload post:", e);
  notify?.("Échec upload : "+(e?.message||String(e)));
} finally {
  setUploading(false);setUploadPct(0);
}
    }
    e.target.value="";
    }catch(err){
      console.error("handlePick error:",err);
      notify?.("Erreur média : "+(err?.message||String(err)));
      e.target.value="";
    }
  };

  const removeMedia=idx=>{
    setPreviews(p=>p.filter((_,i)=>i!==idx));
    setMediaUrls(p=>p.filter((_,i)=>i!==idx));
    setCarouselIdx(i=>Math.max(0,i-1));
  };

  const submit=async()=>{
    if(busy)return;
    setBusy(true);
    const uid=session?.user?.id;
    const pollExpiresAt=type==="poll"&&pollDuration!=="0"?new Date(Date.now()+parseFloat(pollDuration)*24*60*60*1000).toISOString():null;
     const payload={
      uid,type,text,mediaUrls,evImgUrl,evTitle,evDate,evTime,evLoc,textBg,textFont,
      isForSale,isAiGenerated,isPrivate,commentsDisabled,
      contactType,whatsappIndicatif,whatsappNum,contactLink,saleExpiry,
      price,stock,dealType,
      pollExpiresAt,pollMultiple,pollOptions,
      selectedCategories,duoCollaborators,selectedSound,
      lastVideoFile:lastVideoFileRef.current,
      mentions:extractMentions(text.trim(),mentionNameMapRef.current),
      mentionedIds:[...mentionedIdsRef.current],
      authorName:myProfile?.prenom||myProfile?.fullName,
    };
    mentionedIdsRef.current=[];
    mentionNameMapRef.current=new Map();
    // On ferme le modal tout de suite et on publie réellement en arrière-plan :
    // runPublish() ne dépend d'aucun state/ref de ce composant, elle continue
    // de s'exécuter jusqu'au bout même après le démontage du modal.
    const progress=showPostProgress("Publication…");
    onClose();
    runPublish(payload,{onProgress:msg=>progress.update(msg)})
      .then(()=>{progress.done("Publié ✦");onPost();})
      .catch(err=>{console.error("Erreur publication:",err);progress.fail("Échec de la publication");});
  };

  const canSell=true;
const [saleExpiry,setSaleExpiry]=useState("30");
const [price,setPrice]=useState("");
const [stock,setStock]=useState("");
const [dealType,setDealType]=useState("sale");
const ok=type==="text"?text.trim().length>0:type==="photo"?mediaUrls.length>0:type==="poll"?(text.trim().length>0&&pollOptions.filter(o=>o.trim()).length>=2):evTitle.trim().length>0;

  return(
    <>
{videoTrimSrc&&<VideoTrimModal
  videoSrc={videoTrimSrc.src}
  maxDuration={600}
  onClose={()=>{setVideoTrimSrc(null);videoTrimSrc.resolve(null);}}
  onDone={data=>{videoTrimSrc.resolve(data);}}
/>}


{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}
    {showCameraStudio&&<CameraStudioModal
  sb={sb}
  userId={session?.user?.id}
  T={T}
  initialDraft={resumeDraft}
  onSaveDraft={async(d)=>{await saveDraft(d);notify("Brouillon enregistré ✦");}}
  onOpenDrafts={()=>{setShowCameraStudio(false);setShowDrafts(true);}}
  onClose={()=>{setShowCameraStudio(false);setResumeDraft(null);}}
  onDone={({file,type:mtype,sound})=>{
    setShowCameraStudio(false);setResumeDraft(null);
    file._fromCamera=true;
    if(sound) setSelectedSound(sound);
    const fakeEvent={target:{files:[file]}};
    handlePick(fakeEvent);
  }}
/>}
{showDrafts&&<DraftsGallery T={T} onClose={()=>setShowDrafts(false)}
  onResume={(d)=>{setShowDrafts(false);setResumeDraft(d);setShowCameraStudio(true);}}
  onPublishAsIs={(d)=>{
    setShowDrafts(false);
    const file=new File([d.blob],(d.type==="video"?"draft.mp4":"draft.jpg"),{type:d.blob.type});
    const fakeEvent={target:{files:[file]}};
    handlePick(fakeEvent);
  }}
/>}<div style={{position:"fixed",inset:0,zIndex:1400,background:T.bg,display:"flex",flexDirection:"column"}}>

      <input ref={fRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handlePick}/>
      <input ref={evImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleEventImagePick}/>
<input ref={vRef} type="file" accept="video/*" multiple style={{display:"none"}} onChange={handlePick}/>

      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"52px 20px 16px",borderBottom:`1px solid ${T.border}`}}>
        <button onClick={onClose} disabled={uploading} style={{background:"none",border:"none",color:uploading?T.muted:T.text,fontSize:15,fontWeight:500,cursor:uploading?"default":"pointer",padding:"8px 4px",letterSpacing:.2,opacity:uploading?.5:1}}>
          {uploading?"Envoi…":"Annuler"}
        </button>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:T.text,letterSpacing:2,fontWeight:600}}>
          Nouveau post
        </span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
  <button onClick={()=>setShowDrafts(true)} style={{background:"none",border:"none",color:T.muted,fontSize:13,fontWeight:500,cursor:"pointer"}}>
    Brouillons
  </button>
  <button onClick={submit} disabled={!ok||busy||uploading}
    style={{background:ok&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.08)",border:"none",borderRadius:20,padding:"8px 18px",color:ok&&!busy&&!uploading?"#000":T.muted,fontSize:13,fontWeight:700,cursor:ok&&!busy&&!uploading?"pointer":"default",transition:"all .2s",boxShadow:ok&&!busy&&!uploading?"0 4px 16px rgba(201,149,42,0.3)":"none",whiteSpace:"nowrap"}}>
    {finalizing?"Finalisation…":busy?"Publication…":uploading?"↑ Envoi…":"Publier"}
  </button>
</div>
      </div>

      {/* ── Corps scrollable ── */}
      <div style={{flex:1,overflowY:"auto",padding:"20px 20px 0"}}>

        {/* Avatar + ligne + texte */}
        <div style={{display:"flex",gap:14}}>
          {/* Colonne gauche : avatar + ligne */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
            <Av u={myProfile} size={42}/>
            <div style={{width:2,flex:1,background:`linear-gradient(180deg,${T.border} 0%,transparent 100%)`,marginTop:8,minHeight:40}}/>
          </div>
          {/* Colonne droite : nom + texte + médias */}
          <div style={{flex:1,minWidth:0,paddingBottom:20}}>
            <p style={{margin:"0 0 6px",fontSize:15,fontWeight:700,color:T.text}}>{myProfile?.fullName}</p>

            {/* Zone texte */}
           <MentionInput
  value={text}
  onChange={(val,mentionedId,mentionedName)=>{setText(val);if(mentionedId&&mentionedName){if(!mentionedIdsRef.current.includes(mentionedId))mentionedIdsRef.current=[...mentionedIdsRef.current,mentionedId];mentionNameMapRef.current.set(mentionedName.toLowerCase(),{id:mentionedId,name:mentionedName});}}}
  placeholder={type==="poll"?"Pose ta question…":"Quoi de neuf ?"}
  rows={4}
  members={members||[]}
  style={{width:"100%",background:"transparent",border:"none",color:T.text,fontSize:16,outline:"none",resize:"none",lineHeight:1.7,fontFamily:`'${textFont}',sans-serif`,padding:0,
    ...(textBg?{background:{bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[textBg],borderRadius:14,padding:"12px",color:"#fff",fontSize:18,fontWeight:700,textAlign:"center"}:{})
  }}
/>

            <div style={{ margin: "10px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              <CategoryPicker selected={selectedCategories} onChange={setSelectedCategories} T={T}/>
              <SoundPickerButton sb={sb} value={selectedSound} onChange={setSelectedSound} userId={session?.user?.id} T={T}/>
              <DuoButton sb={sb} T={T} Av={Av} Btn={Btn} Badge={Badge} session={session} value={duoCollaborators} onChange={setDuoCollaborators}/>
            </div>

            {/* Option vente (badge doré + Congo uniquement) */}
            {canSell&&(
              <div onClick={()=>setIsForSale(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
                <ShoppingBag size={14} color={isForSale?T.goldL:T.muted}/>
                <span style={{fontSize:12,color:isForSale?T.goldL:T.muted,flex:1}}>Article à vendre</span>
                <div style={{width:28,height:16,borderRadius:8,background:isForSale?T.gold:(isLightBg(T.bg)?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.1)"),position:"relative",transition:"background .3s",flexShrink:0}}>
                  <div style={{position:"absolute",top:2,left:isForSale?12:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left .3s",boxShadow:"0 1px 3px rgba(0,0,0,0.35)"}}/>
                </div>
              </div>
            )}
            {isForSale&&<MarketplaceFields T={T} myProfile={myProfile} price={price} setPrice={setPrice} stock={stock} setStock={setStock} dealType={dealType} setDealType={setDealType}/>}
            {/* Option contenu généré par IA (photo/vidéo uniquement) */}
            {type==="photo"&&(
              <div onClick={()=>setIsAiGenerated(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
                <Sparkles size={14} color={isAiGenerated?T.goldL:T.muted}/>
                <span style={{fontSize:12,color:isAiGenerated?T.goldL:T.muted,flex:1}}>Contenu généré par IA</span>
                <div style={{width:28,height:16,borderRadius:8,background:isAiGenerated?T.gold:(isLightBg(T.bg)?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.1)"),position:"relative",transition:"background .3s",flexShrink:0}}>
                  <div style={{position:"absolute",top:2,left:isAiGenerated?12:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left .3s",boxShadow:"0 1px 3px rgba(0,0,0,0.35)"}}/>
                </div>
              </div>
            )}
            <div onClick={()=>setIsPrivate(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
              <Lock size={14} color={isPrivate?T.goldL:T.muted}/>
              <span style={{fontSize:12,color:isPrivate?T.goldL:T.muted,flex:1}}>Publication privée (visible uniquement dans l'app)</span>
              <div style={{width:28,height:16,borderRadius:8,background:isPrivate?T.gold:(isLightBg(T.bg)?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.1)"),position:"relative",transition:"background .3s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:isPrivate?12:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left .3s",boxShadow:"0 1px 3px rgba(0,0,0,0.35)"}}/>
              </div>
            </div>
            <div onClick={()=>setCommentsDisabled(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
              <MessageCircleOff size={14} color={commentsDisabled?T.goldL:T.muted}/>
              <span style={{fontSize:12,color:commentsDisabled?T.goldL:T.muted,flex:1}}>Désactiver les commentaires</span>
              <div style={{width:28,height:16,borderRadius:8,background:commentsDisabled?T.gold:(isLightBg(T.bg)?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.1)"),position:"relative",transition:"background .3s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:commentsDisabled?12:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left .3s",boxShadow:"0 1px 3px rgba(0,0,0,0.35)"}}/>
              </div>
            </div>
            
            {isForSale&&(
              <div style={{marginBottom:8,display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",gap:8}}>
                  <Btn onClick={()=>setContactType("whatsapp")} style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${contactType==="whatsapp"?T.gold:T.border}`,background:contactType==="whatsapp"?T.goldBg:"transparent",color:contactType==="whatsapp"?T.goldL:T.muted,fontSize:12,fontWeight:600}}>
                    WhatsApp
                  </Btn>
                  <Btn onClick={()=>setContactType("link")} style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${contactType==="link"?T.gold:T.border}`,background:contactType==="link"?T.goldBg:"transparent",color:contactType==="link"?T.goldL:T.muted,fontSize:12,fontWeight:600}}>
                    Lien
                  </Btn>
                </div>
                {contactType==="whatsapp"?(
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:12,border:`1px solid ${T.border}`,background:"rgba(255,255,255,0.02)"}}>
                    <select value={whatsappIndicatif} onChange={e=>setWhatsappIndicatif(e.target.value)} style={{background:"transparent",border:"none",color:T.goldL,fontSize:13,fontWeight:700,flexShrink:0,outline:"none"}}>
                      <option value="242">🇨🇬 +242</option>
                      <option value="237">🇨🇲 +237</option>
                      <option value="241">🇬🇦 +241</option>
                      <option value="235">🇹🇩 +235</option>
                      <option value="236">🇨🇫 +236</option>
                      <option value="240">🇬🇶 +240</option>
                    </select>
                    <input type="tel" inputMode="numeric" value={whatsappNum} onChange={e=>setWhatsappNum(e.target.value.replace(/\D/g,""))} placeholder="Numéro WhatsApp" maxLength={9} style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:13,outline:"none"}}/>
                  </div>
                ):(
                  <input value={contactLink} onChange={e=>setContactLink(e.target.value)} placeholder="https://… (lien vers ta boutique)" style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${T.border}`,background:"rgba(255,255,255,0.02)",color:T.text,fontSize:13,outline:"none",width:"100%"}}/>
                  
                )}
                <div style={{display:"flex",gap:6}}>
                  {[{v:"7",l:"7j"},{v:"15",l:"15j"},{v:"30",l:"30j"},{v:"0",l:"Jamais"}].map(opt=>(
                    <Btn key={opt.v} onClick={()=>setSaleExpiry(opt.v)}
                      style={{flex:1,padding:"6px 4px",borderRadius:8,border:`1px solid ${saleExpiry===opt.v?T.gold:T.border}`,background:saleExpiry===opt.v?T.goldBg:"transparent",color:saleExpiry===opt.v?T.goldL:T.muted,fontSize:11,fontWeight:600}}>
                      {opt.l}
                    </Btn>
                  ))}
                </div>
              </div>
            )}
            {/* Sélecteur fond (texte) */}
            {type==="text"&&(
              <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                <span style={{fontSize:10,color:T.muted,letterSpacing:1}}>FOND</span>
                {[
                  {id:null,bg:"transparent",border:T.border},
                  {id:"bg_noir",bg:"#000000"},{id:"bg_bleu",bg:"#1565C0"},
                  {id:"bg_vert",bg:"#1B5E20"},{id:"bg_rouge",bg:"#B71C1C"},
                  {id:"bg_or",bg:"#7B5A00"},{id:"bg_violet",bg:"#4A148C"},
                ].map(c=>(
                  <div key={c.id||"none"} onClick={()=>setTextBg(c.id)}
                    style={{width:24,height:24,borderRadius:"50%",background:c.bg||"transparent",border:`2px solid ${textBg===c.id?T.goldL:(c.border||"rgba(255,255,255,0.2)")}`,cursor:"pointer",transition:"border .2s"}}/>
                ))}
              </div>
            )}
            {type==="text"&&(
              <div style={{display:"flex",gap:7,marginTop:8,overflowX:"auto",scrollbarWidth:"none"}}>
                {TEXT_FONTS.map(f=>{
                  const on=textFont===f;
                  return(
                    <div key={f} onClick={()=>setTextFont(f)}
                      style={{flexShrink:0,padding:"6px 12px",borderRadius:20,cursor:"pointer",
                        border:`1px solid ${on?T.gold:T.border}`,background:on?"rgba(201,149,42,0.15)":"rgba(255,255,255,0.03)",
                        color:on?T.goldL:T.muted,fontSize:12,fontFamily:`'${f}',sans-serif`,fontWeight:on?700:400}}>
                      {f.split(" ")[0]}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Zone média carousel */}
            {type==="photo"&&previews.length>0&&(
              <div style={{position:"relative",marginTop:12}}>
                <div style={{position:"relative",borderRadius:16,overflow:"hidden",background:"#000"}}>
                  {previews[carouselIdx]?.type==="video"
                    ?<video src={previews[carouselIdx].url} controls playsInline style={{width:"100%",maxHeight:300,objectFit:"contain",display:"block"}}/>
                    :<img src={previews[carouselIdx].url} alt="" style={{width:"100%",maxHeight:300,objectFit:"cover",display:"block",borderRadius:16}}/>
                  }
                  {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
  <div style={{width:120,height:6,background:"rgba(255,255,255,0.15)",borderRadius:3,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${uploadPct}%`,background:T.gradGold,borderRadius:3,transition:"width 0.2s ease"}}/>
  </div>
  <span style={{color:"#fff",fontSize:12,fontWeight:700}}>{uploadPct}%</span>
</div>}
                  <button onClick={()=>removeMedia(carouselIdx)} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:28,height:28,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",border:"none",cursor:"pointer"}}><X size={13}/></button>
                  {previews.length>1&&carouselIdx>0&&(
                    <button onClick={()=>setCarouselIdx(i=>i-1)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:30,height:30,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",border:"none",cursor:"pointer"}}><ChevronLeft size={15}/></button>
                  )}
                  {previews.length>1&&carouselIdx<previews.length-1&&(
                    <button onClick={()=>setCarouselIdx(i=>i+1)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:30,height:30,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",border:"none",cursor:"pointer"}}><ChevronRight size={15}/></button>
                  )}
                  {previews.length>1&&(
                    <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4}}>
                      {previews.map((_,i)=>(
                        <div key={i} onClick={()=>setCarouselIdx(i)} style={{width:i===carouselIdx?14:5,height:5,borderRadius:3,background:i===carouselIdx?"#fff":"rgba(255,255,255,0.4)",transition:"width .2s",cursor:"pointer"}}/>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:6,marginTop:8,overflowX:"auto",paddingBottom:4}}>
                  {previews.map((p,i)=>(
                    <div key={i} onClick={()=>setCarouselIdx(i)} style={{flexShrink:0,width:48,height:48,borderRadius:10,overflow:"hidden",border:`2px solid ${i===carouselIdx?T.gold:T.border}`,cursor:"pointer"}}>
                      {p.type==="video"?<div style={{width:"100%",height:"100%",background:"#111",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎬</div>
                        :<img src={p.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                    </div>
                  ))}
                  {previews.length<10&&(
                    <button onClick={()=>fRef.current.click()} style={{flexShrink:0,width:48,height:48,borderRadius:10,border:`2px dashed ${T.gold}44`,background:T.goldBg,color:T.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer"}}>+</button>
                  )}
                </div>
              </div>
            )}

            {/* Événement */}
            {type==="event"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
                <input value={evTitle} onChange={e=>setEvTitle(e.target.value)} placeholder="Titre de l'événement *" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none"}}/>
                <div style={{display:"flex",gap:8}}>
                  <input type="date" value={evDate} onChange={e=>setEvDate(e.target.value)} style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",colorScheme:isLightBg(T.bg)?"light":"dark"}}/>
                  <input type="time" value={evTime} onChange={e=>setEvTime(e.target.value)} style={{width:110,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",colorScheme:isLightBg(T.bg)?"light":"dark"}}/>
                </div>
                <input value={evLoc} onChange={e=>setEvLoc(e.target.value)} placeholder="📍 Lieu" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none"}}/>
                {evImgPreview?(
                  <div style={{position:"relative",width:"100%",height:150,borderRadius:14,overflow:"hidden"}}>
                    <img src={evImgPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button onClick={()=>{setEvImgPreview(null);setEvImgUrl(null);}} style={{position:"absolute",top:8,right:8,width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={14}/></button>
                    {evImgUploading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.4)",color:"#fff",fontSize:12}}>Envoi...</div>}
                  </div>
                ):(
                  <button onClick={()=>evImgRef.current.click()} style={{width:"100%",height:72,borderRadius:14,border:`2px dashed ${T.gold}44`,background:T.goldBg,color:T.gold,fontSize:12.5,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
                    <Image size={17}/> Ajouter une image de couverture (optionnel)
                  </button>
                )}
              </div>
            )}
            {/* Sondage */}
            {type==="poll"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10,animation:"fadeUp .3s ease"}}>
                {pollOptions.map((opt,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,animation:"popIn .3s cubic-bezier(0.34,1.56,0.64,1) both",animationDelay:`${i*40}ms`}}>
                    <span style={{width:22,height:22,flexShrink:0,borderRadius:"50%",background:`${POLL_COLORS[i%POLL_COLORS.length]}22`,color:POLL_COLORS[i%POLL_COLORS.length],fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</span>
                    <input value={opt} onChange={e=>updatePollOption(i,e.target.value)} placeholder={`Option ${i+1}`} maxLength={60} style={{flex:1,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 14px",color:T.text,fontSize:13,outline:"none",transition:"border-color .2s"}}/>
                    {pollOptions.length>2&&(
                      <button onClick={()=>removePollOption(i)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",padding:4,display:"flex"}}><X size={15}/></button>
                    )}
                  </div>
                ))}
                {pollOptions.length<6&&(
                  <button onClick={addPollOption} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:`1px dashed ${T.gold}44`,borderRadius:12,padding:"9px 14px",color:T.gold,fontSize:12.5,fontWeight:600,cursor:"pointer",justifyContent:"center",transition:"transform .15s ease"}}>
                    <Plus size={14}/> Ajouter une option
                  </button>
                )}

                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6,padding:"10px 14px",borderRadius:12,background:"rgba(255,255,255,0.03)"}}>
                  <span style={{fontSize:12.5,color:T.sub}}>Choix multiple</span>
                  <button onClick={()=>setPollMultiple(m=>!m)} style={{width:38,height:22,borderRadius:20,border:"none",cursor:"pointer",background:pollMultiple?T.gradGold:(isLightBg(T.bg)?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.12)"),position:"relative",transition:"background .25s ease",padding:0}}>
                    <span style={{position:"absolute",top:2,left:pollMultiple?18:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .22s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}}/>
                  </button>
                </div>

                <div style={{display:"flex",gap:6,marginTop:2}}>
                  {[{v:"1",l:"24h"},{v:"2",l:"2j"},{v:"7",l:"7j"},{v:"0",l:"Illimité"}].map(d=>(
                    <button key={d.v} onClick={()=>setPollDuration(d.v)} style={{flex:1,padding:"9px 4px",borderRadius:11,background:pollDuration===d.v?T.goldBg:"rgba(255,255,255,0.03)",color:pollDuration===d.v?T.goldL:T.muted,fontSize:12,fontWeight:pollDuration===d.v?700:500,border:pollDuration===d.v?`1px solid ${T.gold}44`:"1px solid transparent",cursor:"pointer",transition:"all .2s ease"}}>{d.l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Barre d'outils en bas ── */}
      <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 20px 36px",display:"flex",alignItems:"center",gap:20}}>
        <button onClick={()=>{setType("photo");setTextBg(null);fRef.current.click();}} style={{background:"none",border:"none",cursor:"pointer",color:type==="photo"?T.goldL:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
          <Image size={22}/>
          <span style={{fontSize:9,letterSpacing:.5}}>Photo</span>
        </button>
        <button onClick={()=>{setType("photo");setTextBg(null);vRef.current.click();}} style={{background:"none",border:"none",cursor:"pointer",color:type==="photo"?T.goldL:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
  <Play size={22}/>
  <span style={{fontSize:9,letterSpacing:.5}}>Vidéo</span>
</button>
        <button onClick={()=>{setType("event");setTextBg(null);}} style={{background:"none",border:"none",cursor:"pointer",color:type==="event"?T.goldL:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span style={{fontSize:9,letterSpacing:.5}}>Événement</span>
        </button>
        <button onClick={()=>{setType("poll");setTextBg(null);}} style={{background:"none",border:"none",cursor:"pointer",color:type==="poll"?T.goldL:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
          <BarChart3 size={20}/>
          <span style={{fontSize:9,letterSpacing:.5}}>Sondage</span>
        </button>
        <button onClick={()=>setShowCameraStudio(true)} style={{background:"none",border:"none",cursor:"pointer",color:showCameraStudio?T.goldL:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
          <Wrench size={22}/>
          <span style={{fontSize:9,letterSpacing:.5}}>Studio</span>
        </button>
        <button onClick={()=>setType("text")} style={{background:"none",border:"none",cursor:"pointer",color:type==="text"?T.goldL:T.muted,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:0,transition:"color .2s"}}>
          <span style={{fontSize:18}}>✍</span>
          <span style={{fontSize:9,letterSpacing:.5}}>Texte</span>
        </button>
      </div>
    </div>
  </>
  );
}


// ── STATUS CREATOR ────────────────────────────────────────
function StatusCreatorModal({myProfile,session,myStatuses,onClose,onDone}){
  const [type,setType]=useState("text"); const [text,setText]=useState("");
  const [preview,setPreview]=useState(null); const [mediaUrl,setMediaUrl]=useState(null); const [trimmedFile,setTrimmedFile]=useState(null);
 const [uploading,setUploading]=useState(false); const [busy,setBusy]=useState(false);
const [uploadPct,setUploadPct]=useState(0);

const [textBg,setTextBg]=useState(null);
const [textFont,setTextFont]=useState("Space Grotesk");
const [cropSrc,setCropSrc]=useState(null);const [cropResolve,setCropResolve]=useState(null);
const [statusTrimSrc,setStatusTrimSrc]=useState(null);
const [statusTrimFile,setStatusTrimFile]=useState(null);
const fRef=useRef();
const [showStatusCamera,setShowStatusCamera]=useState(false);
const [selectedSound,setSelectedSound]=useState(null);
useEffect(()=>{
  if(window.__celesteStatusFile){
    handlePick({target:{files:[window.__celesteStatusFile]}});
    delete window.__celesteStatusFile;
  }
},[]);
const vRef=useRef();
  const canAdd=(myStatuses||[]).length<10;

  const cropImage=src=>new Promise(resolve=>{
    setCropSrc(src);
    setCropResolve({fn:resolve});
  });

const handlePick=async e=>{
    let f=e.target.files[0]; if(!f)return;
    if(f.type.startsWith("image/")){
      const reader=new FileReader();
      const src=await new Promise(res=>{reader.onload=ev=>res(ev.target.result);reader.readAsDataURL(f);});
      const croppedFile=await cropImage(src);
      f=croppedFile||await compressImage(f);
    }
    if(f.type.startsWith("video/")){
      if(f.size>50*1024*1024){alert("Vidéo max 50MB");return;}
      const src=URL.createObjectURL(f);
      const trimData=await new Promise(resolve=>setStatusTrimSrc({src,resolve}));
      setStatusTrimSrc(null);
      if(!trimData)return;
      setPreview(trimData.src);
      setTrimmedFile(trimData.file||f);
      setUploading(true);
      try{
  const publicUrl=await uploadToR2(trimData.file||f,"statuses",pct=>setUploadPct(pct));
  setMediaUrl(publicUrl);
}catch(e){
  console.error("Upload statut vidéo échoué:",e);
  setPreview(null);
}
setUploading(false);setUploadPct(0);
return;
    }
    const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f);
    setUploading(true);
    try {
  const publicUrl=await uploadToR2(f,"statuses",pct=>setUploadPct(pct));
  setMediaUrl(publicUrl);
} catch(e) {
  console.error("Upload statut échoué:",e);
  setPreview(null);
}
setUploading(false);setUploadPct(0);
  };

  const submit=async()=>{
    if(busy||!canAdd)return;
    if(type==="text"&&!text.trim())return;
    if(type!=="text"&&!mediaUrl)return;
    setBusy(true);
   const{error}=await sb.from("statuses").insert({user_id:session?.user?.id,type,text:text.trim()||null,media_url:mediaUrl||null,text_background:textBg||null,text_font:textFont||null,sound_id:selectedSound?.id||null});
    setBusy(false);
    if(error){console.error("Erreur publication statut:",error);return;}
    onDone();
  };

  return(
    <>
{statusTrimSrc&&<VideoTrimModal videoSrc={statusTrimSrc.src} maxDuration={90} onClose={()=>{const r=statusTrimSrc.resolve;setStatusTrimSrc(null);r(null);}} onDone={data=>{statusTrimSrc.resolve(data);}}/>}
{cropSrc&&(
  <ImageCropModal
    imageSrc={cropSrc}
    onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
    onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
  />
)}
{showStatusCamera&&(
  <CameraStudioModal
    sb={sb}
    userId={session?.user?.id}
    onClose={()=>setShowStatusCamera(false)}
    onDone={({file,sound})=>{setShowStatusCamera(false);if(sound?.id)setSelectedSound(sound);handlePick({target:{files:[file]}});}}
  />
)}
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.9)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,padding:"22px 20px 44px",maxHeight:"92vh",overflowY:"auto",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)",marginBottom:"var(--kb-height,0px)"}}>
        <input ref={fRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={handlePick}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text}}>Nouveau statut</h3>
          <Btn onClick={onClose} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:"50%",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted}}><X size={16}/></Btn>
        </div>
        {!canAdd&&<div style={{background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:12,padding:"10px 14px",color:T.err,fontSize:13,marginBottom:14,display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={14}/> Limite de 10 statuts atteinte.</div>}
        <div style={{display:"flex",gap:6,marginBottom:16,background:"rgba(255,255,255,0.03)",borderRadius:14,padding:4}}>
          {[{id:"text",l:"✍ Texte"},{id:"photo",l:"📷 Photo/Vidéo"}].map(t=>(
            <Btn key={t.id} onClick={()=>setType(t.id)} style={{flex:1,padding:"9px",borderRadius:11,background:type===t.id?T.goldBg:"none",color:type===t.id?T.goldL:T.muted,fontSize:12,fontWeight:type===t.id?700:400,border:type===t.id?`1px solid ${T.gold}44`:"1px solid transparent",transition:"all .2s"}}>{t.l}</Btn>
          ))}
        </div>
        {type==="photo"&&(preview
          ?<div style={{position:"relative",marginBottom:12}}>
            {preview&&preview.startsWith("blob:")
  ?<video src={preview} controls playsInline style={{width:"100%",borderRadius:16,maxHeight:280,objectFit:"contain",background:"#000"}}/>
  :<MediaPlayer url={preview} style={{borderRadius:16,maxHeight:280}}/>
}
            {uploading&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
  <div style={{width:120,height:5,background:"rgba(255,255,255,0.15)",borderRadius:3,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${uploadPct}%`,background:T.gradGold,borderRadius:3,transition:"width 0.2s ease"}}/>
  </div>
  <span style={{color:"#fff",fontSize:12,fontWeight:700}}>{uploadPct}%</span>
</div>}
            <Btn onClick={()=>{setPreview(null);setMediaUrl(null);setSelectedSound(null);}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:30,height:30,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></Btn>
            {selectedSound&&(
              <div style={{position:"absolute",bottom:8,left:8,display:"flex",alignItems:"center",gap:6,background:"rgba(0,0,0,0.6)",borderRadius:14,padding:"5px 10px"}}>
                <Music2 size={12} color="#e0b84a"/>
                <span style={{color:"#fff",fontSize:11,fontWeight:600,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedSound.title}</span>
                <X size={11} color="#fff" style={{cursor:"pointer"}} onClick={()=>setSelectedSound(null)}/>
              </div>
            )}
          </div>
          :<div style={{display:"flex",gap:8,marginBottom:12}}>
            <Btn onClick={()=>fRef.current.click()} style={{flex:1,height:140,borderRadius:16,border:`2px dashed ${T.gold}33`,background:T.goldBg,color:T.gold,fontSize:13,fontWeight:600,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
              <Camera size={32}/><span>Depuis la galerie</span>
            </Btn>
            <Btn onClick={()=>setShowStatusCamera(true)} style={{flex:1,height:140,borderRadius:16,border:`2px dashed ${T.gold}33`,background:T.goldBg,color:T.gold,fontSize:13,fontWeight:600,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,transition:"all .2s"}}>
              <Music2 size={32}/><span>Caméra Céleste</span>
            </Btn>
          </div>
        )}
       {type==="text"&&(
  <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
    <span style={{fontSize:11,color:T.muted}}>Fond :</span>
    {[
      {id:null,bg:"transparent",border:T.border},
      {id:"bg_noir",bg:"#000000"},
      {id:"bg_bleu",bg:"#1565C0"},
      {id:"bg_vert",bg:"#1B5E20"},
      {id:"bg_rouge",bg:"#B71C1C"},
      {id:"bg_or",bg:"#7B5A00"},
      {id:"bg_violet",bg:"#4A148C"},
    ].map(c=>(
      <div key={c.id||"none"} onClick={()=>setTextBg(c.id)}
        style={{width:28,height:28,borderRadius:"50%",background:c.bg,border:`2px solid ${textBg===c.id?T.goldL:T.border}`,cursor:"pointer",transition:"border .2s"}}/>
    ))}
  </div>
)}
{type==="text"&&(
  <div style={{display:"flex",gap:7,marginBottom:10,overflowX:"auto",scrollbarWidth:"none"}}>
    {TEXT_FONTS.map(f=>{
      const on=textFont===f;
      return(
        <div key={f} onClick={()=>setTextFont(f)}
          style={{flexShrink:0,padding:"6px 12px",borderRadius:20,cursor:"pointer",
            border:`1px solid ${on?T.gold:T.border}`,background:on?"rgba(201,149,42,0.15)":"rgba(255,255,255,0.03)",
            color:on?T.goldL:T.muted,fontSize:12,fontFamily:`'${f}',sans-serif`,fontWeight:on?700:400}}>
          {f.split(" ")[0]}
        </div>
      );
    })}
  </div>
)}
{type==="text"
  ?<>
    <textarea value={text} onChange={e=>{const v=e.target.value;const wc=v.trim()?v.trim().split(/\s+/).length:0;if(wc<=40||v.length<text.length)setText(v);}} placeholder="Partagez votre statut… (40 mots max)" maxLength={280} rows={4}
       style={{width:"100%",background:textBg?({bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[textBg]||"rgba(255,255,255,0.04)"):"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px",color:textBg?"#fff":T.text,fontSize:textBg?22:14,fontWeight:textBg?700:400,textAlign:textBg?"center":"left",outline:"none",resize:"none",lineHeight:1.7,marginBottom:2,transition:"all .3s",fontFamily:`'${textFont}',sans-serif`}}/>
    <p style={{margin:"0 0 8px",fontSize:11,color:T.muted,textAlign:"right"}}>{text.trim()?text.trim().split(/\s+/).length:0}/40 mots</p>
  </>
  :<>
    <input value={text} onChange={e=>{const v=e.target.value;const wc=v.trim()?v.trim().split(/\s+/).length:0;if(wc<=20||v.length<text.length)setText(v);}} placeholder="Légende (optionnel, 20 mots max)" maxLength={150} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",marginBottom:2}}/>
    <p style={{margin:"0 0 10px",fontSize:11,color:T.muted,textAlign:"right"}}>{text.trim()?text.trim().split(/\s+/).length:0}/20 mots</p>
  </>}
        <div style={{display:"flex",gap:8,marginTop:8}}>
         
          <Btn onClick={onClose} style={{flex:1,padding:"14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.sub,fontSize:14,fontWeight:600}}>Annuler</Btn>
          <Btn onClick={submit} disabled={!canAdd||busy||uploading} style={{flex:2,padding:"14px",background:canAdd&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.04)",color:canAdd&&!busy&&!uploading?"#000":T.muted,borderRadius:14,fontSize:14,fontWeight:700,transition:"all .25s",boxShadow:canAdd&&!busy&&!uploading?"0 8px 24px rgba(201,149,42,0.3)":"none"}}>
            {busy?"Publication…":uploading?"Upload…":`Publier ✦ (${(myStatuses||[]).length}/10)`}
          </Btn>
        </div>
      </div>
    </div>
  </>
  );
}

// ── STATUS VIEWER ─────────────────────────────────────────
function StatusViewer({statuses,author,isMe,onDelete,onClose,onNextGroup,onPrevGroup,session,onOpenUser}){
  const [idx,setIdx]=useState(0);
  const [openSoundId,setOpenSoundId]=useState(null);
  const soundAudioRef=useRef(null);
  const [soundMuted,setSoundMuted]=useState(false);
  const [likes,setLikes]=useState({});
  const [views,setViews]=useState({});
  const [showInfo,setShowInfo]=useState(false);
  const [progress,setProgress]=useState(0);
  const [paused,setPaused]=useState(false);
  const [hideUI,setHideUI]=useState(false);
  const [mediaReady,setMediaReady]=useState(false);
  const [soundDuration,setSoundDuration]=useState(null);
  const [soundBlocked,setSoundBlocked]=useState(false);
  const viewed=useRef(new Set());
  useEffect(()=>{viewed.current=new Set();},[author?.id]);
  const closingRef=useRef(false);
  const lastTapRef=useRef({time:0,x:0});
  const tapTimerRef=useRef(null);
  const [showHeartBurst,setShowHeartBurst]=useState(false);
  const [burstPos,setBurstPos]=useState({x:0,y:0});
  useEffect(()=>()=>{if(tapTimerRef.current)clearTimeout(tapTimerRef.current);},[]);
  const [textExpanded,setTextExpanded]=useState(false);
  const progressRef=useRef(null);
  const videoRef=useRef(null);
  const current=(statuses||[])[idx];
  const isVideo=current?.mediaUrl&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(current.mediaUrl)||current.mediaUrl.includes("video"));
  useEffect(()=>{setTextExpanded(false);},[current?.id]);
  useEffect(()=>{setIdx(0);closingRef.current=false;},[author?.id]);

  useEffect(()=>{
    setMediaReady(!isVideo);
    const fallback=setTimeout(()=>setMediaReady(true),8000);
    return()=>clearTimeout(fallback);
  },[current?.id,isVideo]);

  useEffect(()=>{
    if(soundAudioRef.current){soundAudioRef.current.pause();soundAudioRef.current=null;}
    setSoundDuration(null);
    setSoundBlocked(false);
    let fallbackTimer=null;
    if(current?.sound?.url&&!isVideo){
      const a=new Audio(current.sound.url);
      a.loop=false;
      a.muted=soundMuted;
      a.addEventListener("loadedmetadata",()=>{
        if(a.duration&&isFinite(a.duration)){setSoundDuration(Math.min(a.duration,60)*1000);if(fallbackTimer)clearTimeout(fallbackTimer);}
      });
      a.play().catch(()=>setSoundBlocked(true));
      soundAudioRef.current=a;
      fallbackTimer=setTimeout(()=>setSoundDuration(d=>d===null?10000:d),4000);
    }
    return()=>{if(soundAudioRef.current){soundAudioRef.current.pause();soundAudioRef.current=null;}if(fallbackTimer)clearTimeout(fallbackTimer);};
  },[current?.id,isVideo]);

  useEffect(()=>{
    if(author?.screenshot_protection)enableScreenProtection();
    const ch=sb.channel(`privacy_status_${author?.id}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${author?.id}`},payload=>{
        if(payload.new?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
      })
      .subscribe();
    return()=>{sb.removeChannel(ch);disableScreenProtection();};
  },[author?.id]);

  // Temps réel : likes/vues du statut affiché mis à jour en direct (sans ça
  // il fallait fermer/rouvrir le statut pour voir un nouveau like ou une
  // nouvelle vue apparaître).
  useEffect(()=>{
    if(!current?.id)return;
    const sid=current.id;
    const ch=sb.channel(`status_likes_views_${sid}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"status_likes",filter:`status_id=eq.${sid}`},payload=>{
        setLikes(l=>{
          const cur=l[sid]||[];
          if(payload.eventType==="INSERT"&&payload.new?.user_id&&!cur.includes(payload.new.user_id))
            return{...l,[sid]:[...cur,payload.new.user_id]};
          if(payload.eventType==="DELETE"&&payload.old?.user_id)
            return{...l,[sid]:cur.filter(u=>u!==payload.old.user_id)};
          return l;
        });
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"status_views",filter:`status_id=eq.${sid}`},async payload=>{
        if(!isMe||!payload.new?.viewer_id)return;
        const{data:profile}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge").eq("id",payload.new.viewer_id).maybeSingle();
        setViews(v=>{
          const cur=v[sid]||[];
          if(cur.some(x=>x.viewer_id===payload.new.viewer_id))return v;
          return{...v,[sid]:[...cur,{viewer_id:payload.new.viewer_id,profiles:profile||null}]};
        });
      })
      .subscribe();
    return()=>{sb.removeChannel(ch);};
  },[current?.id,isMe]);

  useEffect(()=>{
    if(!current)return;
    sb.from("status_likes").select("user_id").eq("status_id",current.id).then(({data})=>setLikes(l=>({...l,[current.id]:(data||[]).map(d=>d.user_id)})));
   

if(isMe){
  sb.from("status_views").select("viewer_id").eq("status_id",current.id).then(async({data})=>{
    if(!data||data.length===0){setViews(v=>({...v,[current.id]:[]}));return;}
    const ids=data.map(d=>d.viewer_id);
    const{data:profiles}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge").in("id",ids);
    const merged=data.map(d=>({viewer_id:d.viewer_id,profiles:(profiles||[]).find(p=>p.id===d.viewer_id)||null}));
    setViews(v=>({...v,[current.id]:merged}));
  });
}
    if(!isMe&&session?.user?.id&&!viewed.current.has(current.id)){
  viewed.current.add(current.id);
  sb.from("status_views").upsert({status_id:current.id,viewer_id:session.user.id},{onConflict:"status_id,viewer_id",ignoreDuplicates:true})
    .then(({error})=>console.log("insert view error:",error));
}
    setPaused(false);setProgress(0);
    if(isVideo&&(!videoRef.current||videoRef.current.readyState<1))return;
    if(!mediaReady)return;
    const hasSound=!!(current?.sound?.url&&!isVideo);
    if(hasSound&&soundDuration===null){
      const step=100/(10000/50);
      progressRef.current=setInterval(()=>{setProgress(p=>Math.min(p+step,100));},50);
      return()=>clearInterval(progressRef.current);
    }
    const duration=isVideo&&videoRef.current?.duration?Math.min(videoRef.current.duration,90)*1000:(hasSound?soundDuration:(current.type==="text"?5000:10000));
    const step=100/(duration/50);
    progressRef.current=setInterval(()=>{
      setProgress(p=>Math.min(p+step,100));
    },50);
    return()=>clearInterval(progressRef.current);
  },[current?.id,isMe,session?.user?.id,idx,mediaReady,soundDuration]);

  useEffect(()=>{
    if(progress<100)return;
    clearInterval(progressRef.current);
    if(idx<(statuses||[]).length-1){setIdx(i=>i+1);}
    else if(!closingRef.current){closingRef.current=true;if(onNextGroup)onNextGroup();else onClose();}
  },[progress]);

  const togglePause=()=>{
    if(paused){
      setPaused(false);
      if(videoRef.current)videoRef.current.play().catch(()=>{});
      if(soundAudioRef.current)soundAudioRef.current.play().catch(()=>{});
      const hasSound=!!(current?.sound?.url&&!isVideo);
      const duration=isVideo&&videoRef.current?.duration?Math.min(videoRef.current.duration,90)*1000:(hasSound&&soundDuration?soundDuration:(current?.type==="text"?5000:10000));
      const step=100/(duration/50);
      progressRef.current=setInterval(()=>{
        setProgress(p=>Math.min(p+step,100));
      },50);
    }else{
      setPaused(true);
      clearInterval(progressRef.current);
      if(videoRef.current)videoRef.current.pause();
      if(soundAudioRef.current)soundAudioRef.current.pause();
    }
  };

  const toggleLike=async()=>{
    if(!session?.user?.id||isMe)return;
    const sid=current.id,uid=session.user.id;
    const cl=likes[sid]||[]; const liked=cl.includes(uid);
    if(liked){setLikes(l=>({...l,[sid]:cl.filter(i=>i!==uid)}));await sb.from("status_likes").delete().eq("status_id",sid).eq("user_id",uid);}
    else{setLikes(l=>({...l,[sid]:[...cl,uid]}));const{error}=await sb.from("status_likes").insert({status_id:sid,user_id:uid});if(error&&error.code!=="23505")console.error("Erreur like statut:",error);}
  };

  if(!current) return null;
  const currentLikes=likes[current.id]||[];
  const currentViews=views[current.id]||[];
  const liked=currentLikes.includes(session?.user?.id);

  return(
    <div style={{position:"fixed",inset:0,zIndex:600,background:"#000",display:"flex",flexDirection:"column",animation:"fadeIn .2s ease"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:2,display:"flex",gap:3,padding:"env(safe-area-inset-top,16px) 12px 0",opacity:hideUI?0:1,transition:"opacity .2s",pointerEvents:hideUI?"none":"all"}}>
        {(statuses||[]).map((_,i)=>(
          <div key={i} style={{flex:1,height:2.5,borderRadius:2,background:"rgba(255,255,255,0.2)",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:2,background:"#fff",width:i<idx?"100%":i===idx?`${progress}%`:"0%"}}/>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:"calc(env(safe-area-inset-top,16px) + 12px)",left:16,right:16,zIndex:2,display:"flex",alignItems:"center",gap:10,marginTop:8,opacity:hideUI?0:1,transition:"opacity .2s",pointerEvents:hideUI?"none":"all"}}>
        <div onClick={e=>{if(isMe)return;e.stopPropagation();onOpenUser?.(author?.id);}} style={{display:"flex",alignItems:"center",gap:10,flex:1,cursor:isMe?"default":"pointer"}}>
          <Av u={author} size={38} ring/>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{author?.prenom} {author?.nom?.[0]?author.nom[0]+".":""}</p>
            <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.5)"}}>{ago(current.ts)}{paused&&" · ⏸ Pause"}</p>
          </div>
        </div>
        {isMe&&<Btn onClick={async()=>{if(await confirmAction("Voulez-vous vraiment supprimer ce statut ?",{confirmLabel:"Supprimer"})){onDelete(current.id);idx>0?setIdx(idx-1):onClose();}}} style={{background:"rgba(200,64,64,0.2)",border:`1px solid rgba(200,64,64,0.3)`,borderRadius:8,padding:"5px 10px",color:"#ff6060",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Trash2 size={12}/>Suppr.</Btn>}
        <Btn onClick={onClose} style={{color:"rgba(255,255,255,0.6)",display:"flex",alignItems:"center"}}><X size={22}/></Btn>
      </div>

      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}
        onClick={e=>{
          if(soundBlocked&&soundAudioRef.current){soundAudioRef.current.play().then(()=>setSoundBlocked(false)).catch(()=>{});}
          const{left,width}=e.currentTarget.getBoundingClientRect();
          const relX=e.clientX-left;
          const inCenterZone=relX>=width*0.25&&relX<=width*0.75;
          if(inCenterZone){
            const now=Date.now();
            const dx=Math.abs(e.clientX-lastTapRef.current.x);
            const isDoubleTap=(now-lastTapRef.current.time)<300&&dx<40;
            lastTapRef.current={time:isDoubleTap?0:now,x:e.clientX};
            if(isDoubleTap){
              if(tapTimerRef.current){clearTimeout(tapTimerRef.current);tapTimerRef.current=null;}
              if(!isMe&&!liked)toggleLike();
              setBurstPos({x:e.clientX,y:e.clientY});
              setShowHeartBurst(true);
              setTimeout(()=>setShowHeartBurst(false),700);
              return;
            }
            tapTimerRef.current=setTimeout(()=>{
              tapTimerRef.current=null;
              togglePause();setHideUI(h=>!h);
            },280);
            return;
          }
          lastTapRef.current={time:0,x:0};
          if(relX<width*0.25){if(!paused){if(idx>0){setIdx(idx-1);setProgress(0);}else{if(onPrevGroup)onPrevGroup();else onClose();}}else togglePause();return;}
          if(relX>width*0.75){if(!paused){if(idx<(statuses||[]).length-1){setIdx(idx+1);setProgress(0);}else{if(onNextGroup)onNextGroup();else onClose();}}else togglePause();return;}
        }}>
        {current.mediaUrl
          ?<div style={{position:"absolute",inset:0}}>
           {isVideo
  ?<video ref={videoRef} src={current.mediaUrl} autoPlay playsInline muted={false} loop={false} preload="auto" onLoadedData={()=>setMediaReady(true)} onCanPlay={()=>setMediaReady(true)} onError={()=>setMediaReady(true)} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",background:"#000"}}/>
  :<img src={current.mediaUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",objectPosition:"center",background:"#000"}}/>
}
            {isVideo&&!mediaReady&&(
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
                <div style={{width:34,height:34,border:"3px solid rgba(255,255,255,0.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
              </div>
            )}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 60%,rgba(0,0,0,0.6))"}}/>
          </div>
          :<div style={{width:"100%",height:"100%",position:"absolute",inset:0,background:`radial-gradient(circle at 30% 40%,${author?.color||T.goldD}22,transparent 60%),radial-gradient(circle at 70% 60%,${T.navy}22,transparent 60%)`}}/>
        }
        {paused&&<div style={{position:"absolute",zIndex:3,width:6,height:6,borderRadius:"50%",background:"rgba(255,255,255,0.5)"}}/>}
        {current.sound&&!isVideo&&(
          <button onClick={e=>{e.stopPropagation();setSoundMuted(m=>{const nm=!m;if(soundAudioRef.current)soundAudioRef.current.muted=nm;return nm;});}}
            style={{position:"absolute",top:56,right:14,zIndex:3,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            {soundMuted?<VolumeX size={16} color="#fff"/>:<Volume2 size={16} color="#fff"/>}
          </button>
        )}
        {current.sound&&!isVideo&&soundBlocked&&(
          <div style={{position:"absolute",top:56,right:56,zIndex:3,background:"rgba(0,0,0,0.6)",borderRadius:20,padding:"7px 12px",color:"#fff",fontSize:11,fontWeight:600}}>
            🔇 Touche l'écran pour activer le son
          </div>
        )}
        {current.text&&(
  (current.text_background||!current.mediaUrl)?(
    <div style={{
      position:"absolute",inset:0,zIndex:1,
      background:current.text_background?({bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[current.text_background]||"transparent"):"transparent",
      display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 32px",overflow:"hidden"
    }}>
       <p style={{margin:0,maxWidth:"100%",maxHeight:"100%",overflow:"hidden",fontSize:current.text?.length>140?20:(current.text?.length>70?24:28),fontWeight:800,color:T.text,lineHeight:1.5,fontFamily:`'${current.text_font||"Space Grotesk"}',sans-serif`,textAlign:"center",whiteSpace:"pre-wrap",wordBreak:"break-word",overflowWrap:"anywhere"}}>{current.text}</p>
    </div>
  ):(
    <div style={{position:"absolute",bottom:160,left:16,right:16,zIndex:1,opacity:hideUI?0:1,transition:"opacity .2s",pointerEvents:hideUI?"none":"all"}}>
      <p style={{margin:"0 0 4px",fontSize:18,color:"#fff",lineHeight:1.6,fontFamily:"'Cormorant Garamond',serif",fontWeight:400,textShadow:"0 1px 8px rgba(0,0,0,0.8)",whiteSpace:"pre-wrap",wordBreak:"break-word",display:textExpanded?"block":"-webkit-box",WebkitLineClamp:textExpanded?"unset":3,WebkitBoxOrient:"vertical",overflow:textExpanded?"visible":"hidden"}}>{renderTextWithMentions(current.text)}</p>
      {current.text?.length>90&&<button onClick={e=>{e.stopPropagation();setTextExpanded(x=>!x);}} style={{background:"none",border:"none",padding:0,color:"#fff",fontSize:13,fontWeight:700,textShadow:"0 1px 8px rgba(0,0,0,0.8)",cursor:"pointer"}}>{textExpanded?"Voir moins ▲":"Voir plus ▼"}</button>}
    </div>
  )
)}
      </div>

  <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:2,padding:"16px 24px",paddingBottom:"calc(16px + env(safe-area-inset-bottom,0px))",display:"flex",flexDirection:"column",gap:12,opacity:hideUI?0:1,transition:"opacity .2s",pointerEvents:hideUI?"none":"all"}}>
        <div style={{display:"flex",justifyContent:"center",gap:28}}>    
          {!isMe&&(
            <Btn onClick={e=>{e.stopPropagation();toggleLike();}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <div style={{width:48,height:48,borderRadius:"50%",background:liked?"rgba(201,149,42,0.25)":"rgba(255,255,255,0.1)",border:`1px solid ${liked?T.gold:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,transition:"all .2s",boxShadow:liked?T.glowGold:"none"}}>
                <Heart size={22} fill={liked?"currentColor":"none"} style={{color:liked?T.goldL:"rgba(255,255,255,0.7)",filter:liked?`drop-shadow(0 0 8px ${T.gold})`:"none",transition:"all .2s"}}/>
              </div>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{currentLikes.length}</span>
            </Btn>
          )}
          {isMe&&(
            <>
              <Btn onClick={e=>{e.stopPropagation();setShowInfo(!showInfo);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✦</div>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{currentLikes.length}</span>
              </Btn>
              <Btn onClick={e=>{e.stopPropagation();setShowInfo(!showInfo);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><Eye size={20} color="rgba(255,255,255,0.8)"/></div>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{currentViews.length}</span>
              </Btn>
            </>
          )}
       </div>
      {!isMe&&(
  <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 0",paddingBottom:"calc(4px + env(safe-area-inset-bottom,0px))"}}
    onFocus={()=>{if(!paused)togglePause();}}
    onBlur={()=>{if(paused)togglePause();}}>
    <Btn onClick={e=>{e.stopPropagation();toggleLike();}} style={{flexShrink:0,width:48,height:48,borderRadius:"50%",background:liked?"rgba(201,149,42,0.25)":"rgba(255,255,255,0.1)",border:`1px solid ${liked?T.gold:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:liked?T.glowGold:"none"}}>
      <Heart size={22} fill={liked?"currentColor":"none"} style={{color:liked?T.goldL:"rgba(255,255,255,0.7)"}}/>
    </Btn>
    <div style={{flex:1}}>
      <StatusReplyInput statusOwnerId={author?.id} statusId={current?.id} current={current} onClose={onClose} session={session}/>
    </div>
  </div>
)}
      </div>

      {isMe&&showInfo&&(
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(8,8,8,0.98)",borderRadius:"20px 20px 0 0",border:`1px solid ${T.border}`,padding:"20px 16px 40px",maxHeight:"50vh",overflowY:"auto",zIndex:3,animation:"slideUp .3s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <p style={{color:T.goldL,fontWeight:700,fontSize:13,margin:0}}>👁 {fmtCount(currentViews.length)} vue{currentViews.length!==1?"s":""} · ❤️ {fmtCount(currentLikes.length)} like{currentLikes.length!==1?"s":""}</p>
            <Btn onClick={e=>{e.stopPropagation();setShowInfo(false);}} style={{color:"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",padding:4}}><X size={18}/></Btn>
          </div>
          {currentViews.map((v,i)=>{const prf=v.profiles;const name=prf?`${prf.prenom||""} ${(prf.nom||"")[0]||""}.`.trim():"?";return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,cursor:prf?.id?"pointer":"default"}}
              onClick={()=>{if(prf?.id){setShowInfo(false);onClose();window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:prf.id}}));}}}>
              <div style={{width:36,height:36,borderRadius:"50%",overflow:"hidden",background:T.goldBg2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:T.gold,flexShrink:0}}>
                {prf?.avatar_url?<img src={prf.avatar_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span>{name[0]}</span>}
              </div>
              <span style={{color:T.text,fontSize:13,flex:1}}>{name}</span>
              {prf?.badge&&<Badge type={prf.badge}/>}
              {currentLikes.includes(v.viewer_id)&&<Heart size={14} fill="currentColor" style={{color:T.gold,marginLeft:4}}/>}
            </div>
          );})}
        </div>
      )}
      {openSoundId&&<SoundDetailModal sb={sb} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)}/>}
      {showHeartBurst&&(
        <div style={{position:"absolute",left:burstPos.x-40,top:burstPos.y-40,width:80,height:80,zIndex:5,pointerEvents:"none",animation:"heartBurst .7s ease"}}>
          <Heart size={80} fill="#fff" style={{color:"#fff",filter:`drop-shadow(0 0 20px ${T.gold})`}}/>
        </div>
      )}
    </div>
  );
}
function StatusReplyInput({ statusOwnerId, statusId, current, onClose, session }) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const isVideo = current?.mediaUrl && (/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(current.mediaUrl) || current.mediaUrl.includes("video"));

  const sendStatusReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const convRes = await sb.from("conversations")
        .select("id")
        .or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${statusOwnerId}),and(user1_id.eq.${statusOwnerId},user2_id.eq.${session?.user?.id})`)
        .maybeSingle();
      let convId = convRes?.data?.id;
      if (!convId) {
        const { data: newConv } = await sb.from("conversations").insert({ user1_id: session?.user?.id, user2_id: statusOwnerId }).select().single();
        convId = newConv?.id;
      }
      const replyContext = {
        isReplyToStatus: true,
        statusId,
        mediaUrl: current?.mediaUrl || null,
        type: isVideo ? "video" : current?.mediaUrl ? "image" : "text",
        previewText: current?.text ? current.text.slice(0, 60) : ""
      };
      const { error } = await sb.from("messages").insert({
        conv_id: convId,
        sender_id: session?.user?.id,
        type: "status_reply",
        text: replyText.trim(),
        reply_metadata: replyContext
      });
      if (!error) { setReplyText(""); onClose(); }
    } catch(err) { console.error(err); }
    finally { setSending(false); }
  };

  return (
    <div style={{display:"flex",gap:8,alignItems:"center",padding:"8px 12px",background:"rgba(16,20,24,0.75)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderRadius:32,border:"1px solid rgba(255,255,255,0.08)"}}>
      <input type="text" value={replyText} onChange={e=>setReplyText(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&replyText.trim())sendStatusReply();}}
        placeholder="Répondre au statut…" disabled={sending}
        style={{flex:1,padding:"10px 4px",background:"transparent",border:"none",color:"#fff",outline:"none",fontSize:14}}/>
      <Btn onClick={sendStatusReply} disabled={!replyText.trim()||sending}
        style={{background:replyText.trim()&&!sending?T.gradGold:"rgba(255,255,255,0.08)",borderRadius:"50%",width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:!replyText.trim()||sending?0.4:1,transition:"all .2s"}}>
        <Send size={16} color={replyText.trim()&&!sending?"#000":"#fff"}/>
      </Btn>
    </div>
  );
}

// ── STATUSES TAB ──────────────────────────────────────────
function StatusesTab({myProfile,session,members,myConnections,myFollowers,notify,blockedUserIds=[],pushNav,popNav}){
  const {setHideNav}=useApp();
  const [myStatuses,setMyStatuses]=useState(()=>{try{const c=localStorage.getItem(celesteScopedKey("celeste_mystatuts_cache"));return c?JSON.parse(c):[];}catch(e){return[];}});
  const [groups,setGroups]=useState(()=>{try{const c=localStorage.getItem(celesteScopedKey("celeste_statuts_cache"));return c?JSON.parse(c):[];}catch(e){return[];}});
  const [viewing,setViewing]=useState(null);
  const [viewingIdx,setViewingIdx]=useState(-1);
  const [creating,setCreating]=useState(false);
useEffect(()=>{
  if(window.__celesteOpenStatus&&window.__celesteSharedFile){
    const file=window.__celesteSharedFile;
    delete window.__celesteSharedFile;
    delete window.__celesteOpenStatus;
    pushNav(()=>setCreating(false));
    setCreating(true);
    window.__celesteStatusFile=file;
  }
},[]);
 const load=useCallback(async()=>{

  const relevantIds=[session?.user?.id,...(myConnections||[])].filter(Boolean);
  if(!relevantIds.length)return;
  const{data}=await sb.from("statuses")
    .select("id,user_id,type,text,media_url,text_background,text_font,expires_at,created_at,sound_id,sound:sounds!statuses_sound_id_fkey(id,title,url),author:profiles!statuses_user_id_fkey(id,prenom,nom,avatar_url,badge,paroisse)")
    .gt("expires_at",new Date().toISOString())
    .in("user_id",relevantIds)
    .order("created_at",{ascending:false});
    const me=(data||[]).filter(s=>s.user_id===session?.user?.id);
    setMyStatuses(me);
    try{localStorage.setItem(celesteScopedKey("celeste_mystatuts_cache"),JSON.stringify(me));}catch(e){}
   const blockedSet=new Set(blockedUserIds);
    const followingSet=new Set((myConnections||[]));
    const map=new Map();
    const otherStatuses=(data||[]).filter(s=>s.user_id!==session?.user?.id&&!blockedSet.has(s.user_id)&&followingSet.has(s.user_id));
    otherStatuses.forEach(s=>{
      const key=s.user_id;
      if(!map.has(key))map.set(key,{author:s.author?normProfile(s.author):null,statuses:[]});
     const mapped={id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime(),text_background:s.text_background||null,text_font:s.text_font||null,sound:s.sound||null};
      map.get(key).statuses.push(mapped);
    });
    const freshGroups=Array.from(map.values());
    // Statuts déjà vus en entier : anneau retiré et groupe relégué en bas de
    // liste, comme sur WhatsApp — le tri stable préserve l'ordre par
    // récence à l'intérieur de chaque bloc (non-vus / vus).
    let viewedIds=new Set();
    const otherIds=otherStatuses.map(s=>s.id);
    if(otherIds.length&&session?.user?.id){
      const{data:views}=await sb.from("status_views").select("status_id").eq("viewer_id",session.user.id).in("status_id",otherIds);
      viewedIds=new Set((views||[]).map(v=>v.status_id));
    }
    freshGroups.forEach(g=>{g.allViewed=g.statuses.every(s=>viewedIds.has(s.id));});
    freshGroups.sort((a,b)=>(a.allViewed?1:0)-(b.allViewed?1:0));
    setGroups(prev=>freshGroups.length>0?freshGroups:prev);
    try{localStorage.setItem(celesteScopedKey("celeste_statuts_cache"),JSON.stringify(freshGroups));}catch(e){}
    return{me,groups:freshGroups};
  },[session?.user?.id,myConnections,blockedUserIds]);

  const goToGroupOffset=useCallback(offset=>{
    const ni=viewingIdx+offset;
    if(ni>=0&&ni<groups.length){setViewing(groups[ni]);setViewingIdx(ni);}
    else{popNav();setViewing(null);setViewingIdx(-1);load();setHideNav(false);}
  },[viewingIdx,groups,popNav,load]);

  useEffect(()=>{load();},[load]);
  // Filet de sécurité en cas de coupure/désynchro du canal realtime — le
  // canal ci-dessous couvre le cas normal, ce polling reste en secours.
  useEffect(()=>{const iv=setInterval(()=>{load();},60000);return()=>clearInterval(iv);},[load]);
  useEffect(()=>{if(!viewing&&!creating)setHideNav(false);},[viewing,creating]);

  // Temps réel : nouveau statut publié / supprimé par moi ou un contact que
  // je suis → rafraîchit la liste immédiatement au lieu d'attendre le
  // polling 60s.
  useEffect(()=>{
    const relevantIds=new Set([session?.user?.id,...(myConnections||[])].filter(Boolean));
    if(!relevantIds.size)return;
    const ch=sb.channel(`statuses_rt_${session?.user?.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"statuses"},payload=>{
        const uid=payload.new?.user_id||payload.old?.user_id;
        if(uid&&relevantIds.has(uid))load();
      })
      .subscribe();
    return()=>{sb.removeChannel(ch);};
  },[session?.user?.id,myConnections,load]);

useEffect(()=>{
  const handler=async e=>{
    const{statusId,userId}=e.detail;
    const result=await load();
    if(!result)return;
    const{me,groups:freshGroups}=result;
    if(userId&&!statusId){
      const g=freshGroups.find(gr=>gr.author?.id===userId);
      if(g){
        pushNav(()=>{setViewing(null);setHideNav(false);});
        setViewing(g);
        setHideNav(true);
      }
      return;
    }
    const foundMine=me.find(s=>s.id===statusId);
    if(foundMine){
      const myMappedNow=me.map(s=>({id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime(),text_background:s.text_background||null,text_font:s.text_font||null,sound:s.sound||null}));
      pushNav(()=>{setViewing(null);setHideNav(false);});
      setViewing({author:myProfile,statuses:myMappedNow});
      setHideNav(true);
      return;
    }
    for(const g of freshGroups){
      const found=g.statuses.find(s=>s.id===statusId);
      if(found){
        pushNav(()=>{setViewing(null);setHideNav(false);});
        setViewing(g);
        setHideNav(true);
        break;
      }
    }
  };
  window.addEventListener("celeste_open_status",handler);
  return()=>window.removeEventListener("celeste_open_status",handler);
},[load]);

  const delStatus=async id=>{
    await sb.from("statuses").delete().eq("id",id);
    setViewing(v=>{
      if(!v)return v;
      const remaining=v.statuses.filter(s=>s.id!==id);
      return remaining.length?{...v,statuses:remaining}:null;
    });
    load();notify("Statut supprimé");
  };

 const myMapped=myStatuses.map(s=>({id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime(),text_background:s.text_background||null,sound:s.sound||null}));

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {viewing&&(
        <StatusViewer
          statuses={viewing.statuses}
          author={viewing.author}
          isMe={viewing.author?.id===session?.user?.id}
          onDelete={delStatus}
          onClose={()=>{popNav();setViewing(null);setViewingIdx(-1);load();setHideNav(false);if(window.__celesteStatusReturnTab){const rt=window.__celesteStatusReturnTab;window.__celesteStatusReturnTab=null;window.__celesteSetTab?.(rt);}}}
          onNextGroup={viewingIdx>=0?()=>goToGroupOffset(1):undefined}
          onPrevGroup={viewingIdx>=0?()=>goToGroupOffset(-1):undefined}
          session={session}
          onOpenUser={uid=>{setViewing(null);setViewingIdx(-1);setHideNav(false);window.dispatchEvent(new CustomEvent("celeste_open_user_main",{detail:{uid}}));}}
        />
      )}
      {creating&&(
        <StatusCreatorModal myProfile={myProfile} session={session} myStatuses={myStatuses}
          onClose={()=>{popNav();setCreating(false);setHideNav(false);}} onDone={()=>{popNav();setCreating(false);load();notify("Statut publié ✦");setHideNav(false);}}/>
      )}
      <div style={{position:"sticky",top:0,zIndex:10,background:T.bg,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px"}}>
        <h2 style={{margin:0,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",fontSize:34,fontWeight:800,letterSpacing:-0.5,color:T.text}}>Statuts</h2>
      </div>
      <div style={{maxWidth:640,margin:"0 auto",padding:"16px"}}>
        {/* Mon statut */}
        <div style={{marginBottom:24}}>
          <p style={{fontSize:11,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>Mon statut ({myMapped.length}/10)</p>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{position:"relative",cursor:"pointer"}} onClick={myMapped.length>0?()=>{pushNav(()=>{setViewing(null);setHideNav(false);});setViewing({author:myProfile,statuses:myMapped});setHideNav(true);}:()=>{pushNav(()=>setCreating(false));setCreating(true);}}>
              <Av u={myProfile} size={60} ring={myMapped.length>0}/>
              {myMapped.length===0&&(
                <div style={{position:"absolute",bottom:-2,right:-2,width:22,height:22,borderRadius:"50%",background:T.gradGold,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontSize:14,fontWeight:900}}>+</div>
              )}
            </div>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>{myMapped.length>0?"Voir mon statut":"Ajouter un statut"}</p>
              <p style={{margin:0,fontSize:11,color:T.muted}}>{myMapped.length>0?ago(myMapped[0].ts):"Partagez votre moment"}</p>
            </div>
            <Btn onClick={()=>{pushNav(()=>setCreating(false));setCreating(true);setHideNav(true);}} style={{marginLeft:"auto",background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:12,padding:"8px 14px",color:T.goldL,fontSize:12,fontWeight:600}}>+ Ajouter</Btn>
          </div>
        </div>

        {/* Statuts des autres */}
        {groups.length>0&&(
          <>
            <p style={{fontSize:11,color:T.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>Récents</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {groups.map((g,i)=>(
                <div key={g.author?.id||i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:T.card,borderRadius:18,border:`1px solid ${T.border}`,cursor:"pointer",animation:`fadeUp .3s ease ${i*.04}s both`,transition:"all .2s"}}
                  onClick={()=>{pushNav(()=>{setViewing(null);setViewingIdx(-1);setHideNav(false);});setViewing(g);setViewingIdx(i);setHideNav(true);}}>
                  <Av u={g.author} size={52} ring={!g.allViewed}/>
                  <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                    <p style={{margin:"0 0 3px",fontSize:13,fontWeight:600,color:T.text}}>{g.author?.name}</p>
                    <p style={{margin:0,fontSize:11,color:T.muted}}><MapPin size={11}/> {g.author?.paroisse} · {ago(g.statuses[0]?.ts)}</p>
                  </div>
                  <span style={{fontSize:11,color:T.gold,fontWeight:700}}>{g.statuses.length}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {groups.length===0&&myMapped.length===0&&(
          <div style={{textAlign:"center",padding:"60px 0",color:T.muted}}>
            <div style={{fontSize:40,marginBottom:12,animation:"float 3s ease infinite",opacity:.3}}>✦</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Aucun statut récent</p>
          </div>
        )}
        <div style={{height:80}}/>
      </div>
    </div>
  );
}

// ── CÉLESTE MATCH — Algorithme de compatibilité ───────────
const MATCH_QUESTIONS=[
  {id:"gender",label:"Tu es…",type:"single",emoji:"🪞",options:[{v:"homme",l:"Un homme"},{v:"femme",l:"Une femme"}]},
  {id:"seeking_type",label:"Tu cherches…",type:"single",emoji:"✨",options:[{v:"amour",l:"L'amour"},{v:"amitie",l:"Une amitié"},{v:"les_deux",l:"Les deux"}]},
  {id:"seeking_gender",label:"Tu cherches quelqu'un de quel genre ?",type:"single",emoji:"💫",options:[{v:"homme",l:"Un homme"},{v:"femme",l:"Une femme"},{v:"peu_importe",l:"Peu importe"}]},
  {id:"seeking_age",label:"Tranche d'âge recherchée",type:"age_range",emoji:"🎂",options:[{v:"16-20",l:"16 – 20 ans"},{v:"20-25",l:"20 – 25 ans"},{v:"25-30",l:"25 – 30 ans"},{v:"30+",l:"30 ans et +"}]},
  {id:"intimacy",label:"L'intimité physique dans une relation, c'est…",type:"single",emoji:"🔥",options:[{v:"central",l:"Très important, c'est une vraie priorité"},{v:"important",l:"Important mais pas le plus essentiel"},{v:"secondaire",l:"Secondaire, le reste prime"},{v:"attente",l:"Je préfère attendre le bon moment"}]},
  {id:"faith",label:"La foi occupe quelle place dans ta vie ?",type:"single",emoji:"🙏",options:[{v:"centrale",l:"Elle est centrale, tout part de là"},{v:"importante",l:"Importante mais pas absolue"},{v:"secondaire",l:"Secondaire"},{v:"aucune",l:"Aucune place"}]},
  {id:"marriage_vision",label:"Ta vision du mariage ?",type:"single",emoji:"💍",options:[{v:"oui",l:"Je veux me marier"},{v:"peut_etre",l:"Peut-être un jour"},{v:"non",l:"Ce n'est pas pour moi"}]},
  {id:"children",label:"Les enfants dans ta vie ?",type:"single",emoji:"👶",options:[{v:"en_veux",l:"J'en veux"},{v:"deja",l:"J'en ai déjà"},{v:"pas_sur",l:"Pas encore sûr·e"},{v:"non",l:"Non"}]},
  {id:"life_vision",label:"Dans 5 ans tu te vois…",type:"single",emoji:"🌅",options:[{v:"stabilite",l:"Stable, posé·e, avec un foyer"},{v:"voyages",l:"Explorer, voyager, découvrir"},{v:"carriere",l:"Construire ma carrière"},{v:"incertain",l:"Je ne sais pas encore"}]},
  {id:"family_vs_freedom",label:"Ce qui prime pour toi ?",type:"single",emoji:"⚖️",options:[{v:"famille",l:"La famille avant tout"},{v:"liberte",l:"Ma liberté individuelle"},{v:"equilibre",l:"Un équilibre entre les deux"}]},
  {id:"conflict_style",label:"Quand il y a un conflit, tu…",type:"single",emoji:"🌊",options:[{v:"parle",l:"En parles immédiatement"},{v:"digere",l:"Prends du recul d'abord"},{v:"reagis",l:"Réagis fortement puis tu passes"}]},
  {id:"expression_level",label:"Émotionnellement, tu es…",type:"single",emoji:"🎭",options:[{v:"expressif",l:"Très expressif·ve, tu montres tout"},{v:"reserve",l:"Réservé·e, tu gardes pour toi"},{v:"milieu",l:"Entre les deux"}]},
  {id:"life_rhythm",label:"Ton rythme de vie idéal ?",type:"single",emoji:"🌙",options:[{v:"calme",l:"Calme, intimité, tranquillité"},{v:"social",l:"Sorties, monde, énergie"},{v:"melange",l:"Un mélange selon les jours"}]},
  {id:"relationship_priority",label:"Ce qui compte le plus dans une relation ?",type:"single",emoji:"💎",options:[{v:"confiance",l:"La confiance absolue"},{v:"passion",l:"La passion & l'intensité"},{v:"complicite",l:"La complicité & le rire"},{v:"respect",l:"Le respect mutuel"}]},
  {id:"communication_style",label:"Comment tu communiques ?",type:"single",emoji:"💬",options:[{v:"direct",l:"Direct·e et franc·he"},{v:"doux",l:"Doux·ce et diplomate"},{v:"ecoute",l:"Tu écoutes plus que tu parles"}]},
  {id:"money_vision",label:"L'argent et la stabilité financière dans une relation, c'est…",type:"single",emoji:"💰",options:[{v:"essentiel",l:"Essentiel — mon partenaire doit être stable financièrement"},{v:"important",l:"Important mais pas une condition"},{v:"secondaire",l:"Secondaire, l'amour prime sur tout"},{v:"peu_importe",l:"Peu importe, on construit ensemble"}]},
  {id:"skin_color",label:"Ta couleur de peau ?",type:"single",emoji:"🎨",options:[{v:"noire",l:"Noire"},{v:"metisse",l:"Métisse"},{v:"blanche",l:"Blanche"},{v:"jaune",l:"Jaune (asiatique)"},{v:"autre",l:"Autre"}]},
{id:"seeking_skin_color",label:"Tu recherches quelqu'un de quelle couleur de peau ?",type:"single",emoji:"💫",options:[{v:"noire",l:"Noire"},{v:"metisse",l:"Métisse"},{v:"blanche",l:"Blanche"},{v:"jaune",l:"Jaune"},{v:"peu_importe",l:"Peu importe"}]},
{id:"hobbies",label:"Tes films/séries préférés ?",type:"single",emoji:"🎬",options:[{v:"romantique",l:"Romantique & émotionnel"},{v:"action",l:"Action & aventure"},{v:"comedie",l:"Comédie & légèreté"},{v:"docs",l:"Séries & documentaires"},{v:"peu",l:"Je regarde peu la télé"}]},
{id:"ambition",label:"Ton grand rêve dans la vie ?",type:"single",emoji:"🌟",options:[{v:"entrepreneur",l:"Devenir entrepreneur·e"},{v:"carriere",l:"Avoir une carrière stable"},{v:"famille",l:"Fonder une grande famille"},{v:"voyager",l:"Voyager et découvrir le monde"},{v:"servir",l:"Servir Dieu et ma communauté"}]},
{id:"distance_ok",label:"Tu es ouvert·e à une relation à distance ?",type:"single",emoji:"📍",options:[{v:"sur_place",l:"Non, je préfère quelqu'un près de moi"},{v:"distance",l:"Oui, la distance ne me fait pas peur"},{v:"les_deux",l:"Les deux selon la personne"}]},
  {id:"app_expectation",label:"Tu attends quoi de Céleste ?",type:"single",emoji:"🌟",options:[{v:"serieux",l:"Quelque chose de sérieux"},{v:"amis",l:"Me faire de vrais amis"},{v:"decouverte",l:"Découvrir, voir ce qui arrive"},{v:"verra",l:"Je verrai bien"}]},
];

// Questions où la SIMILARITÉ = compatibilité
const SIMILAR_KEYS=["faith","marriage_vision","children","life_vision","app_expectation","seeking_type","intimacy"];
// Questions où la COMPLÉMENTARITÉ = compatibilité
const COMPLEMENT_KEYS=["conflict_style","expression_level","life_rhythm","family_vs_freedom"];
// Poids par question
const Q_WEIGHT={faith:18,marriage_vision:16,children:15,intimacy:14,life_vision:12,seeking_type:10,money_vision:13,app_expectation:8,conflict_style:10,expression_level:8,life_rhythm:7,family_vs_freedom:7,communication_style:5,relationship_priority:4,hobbies:6,ambition:8,distance_ok:9};
// Paires complémentaires optimales
const COMPLEMENT_PAIRS={
  conflict_style:{parle:"digere",digere:"parle",reagis:"milieu"},
  expression_level:{expressif:"reserve",reserve:"expressif",milieu:"milieu"},
  life_rhythm:{calme:"social",social:"calme",melange:"melange"},
  family_vs_freedom:{famille:"liberte",liberte:"famille",equilibre:"equilibre"},
};

function computeMatchScore(a,b){
  if(!a||!b)return 0;
  // Éliminatoires absolus
  const genderOk=a.seeking_gender==="peu_importe"||b.seeking_gender==="peu_importe"||(a.seeking_gender===b.gender&&b.seeking_gender===a.gender);
  if(!genderOk)return 0;
  const typeOk=(a.seeking_type==="les_deux"||b.seeking_type==="les_deux")||(a.seeking_type===b.seeking_type);
  if(!typeOk)return 0;
  const bAge=b.age||null;
  const ageOk=!bAge||!a.seeking_age_min||!a.seeking_age_max||(bAge>=a.seeking_age_min&&bAge<=a.seeking_age_max);
  if(!ageOk)return 0;
  // Pénalités critiques -50%
  let penalty=0;
  // Mariage : l'un veut, l'autre dit non
  if((a.marriage_vision==="oui"&&b.marriage_vision==="non")||(a.marriage_vision==="non"&&b.marriage_vision==="oui"))penalty+=50;
  // Intimité : l'un dit attente, l'autre dit central
  if((a.intimacy==="attente"&&b.intimacy==="central")||(a.intimacy==="central"&&b.intimacy==="attente"))penalty+=50;
  // Argent : l'un dit essentiel, l'autre dit secondaire ou peu_importe
  if((a.money_vision==="essentiel"&&(b.money_vision==="secondaire"||b.money_vision==="peu_importe"))||(b.money_vision==="essentiel"&&(a.money_vision==="secondaire"||a.money_vision==="peu_importe")))penalty+=50;
  // Couleur de peau : préférence incompatible = -50%
  if(a.seeking_skin_color&&a.seeking_skin_color!=="peu_importe"&&b.skin_color&&a.seeking_skin_color!==b.skin_color)penalty+=50;
  if(b.seeking_skin_color&&b.seeking_skin_color!=="peu_importe"&&a.skin_color&&b.seeking_skin_color!==a.skin_color)penalty+=50;
  // Distance : les deux veulent sur place mais positions trop éloignées
  if(a.distance_ok==="sur_place"&&b.distance_ok==="sur_place"&&a.latitude&&b.latitude){
    const dx=a.latitude-b.latitude,dy=a.longitude-b.longitude;
    const km=Math.sqrt(dx*dx+dy*dy)*111;
    if(km>25)penalty+=50;
  }
  let score=0,maxScore=0;
  if(penalty>=100)return 0;
  for(const key of Object.keys(Q_WEIGHT)){
    const w=Q_WEIGHT[key];
    maxScore+=w;
    if(!a[key]||!b[key])continue;
    if(SIMILAR_KEYS.includes(key)){
      if(a[key]===b[key])score+=w;
      else score+=Math.round(w*0.2);
    } else if(COMPLEMENT_KEYS.includes(key)){
      const ideal=COMPLEMENT_PAIRS[key]?.[a[key]];
      if(ideal===b[key])score+=w;
      else if(a[key]===b[key])score+=Math.round(w*0.4);
      else score+=Math.round(w*0.2);
    } else {
      if(a[key]===b[key])score+=w;
    }
  }
  const raw=maxScore>0?Math.round((score/maxScore)*100):0;
  return Math.max(0,raw-penalty);
}


function MatchOnboardingModal({myProfile,session,onClose,onDone,notify,initialData=null}){
  const [step,setStep]=useState(0);
  const ageReverseMap={[JSON.stringify([16,20])]:"16-20",[JSON.stringify([20,25])]:"20-25",[JSON.stringify([25,30])]:"25-30",[JSON.stringify([30,99])]:"30+"};
  const initialAnswers=initialData?{...initialData,seeking_age:ageReverseMap[JSON.stringify([initialData.seeking_age_min,initialData.seeking_age_max])]||undefined}:{};
  const [answers,setAnswers]=useState(initialAnswers);
  const [saving,setSaving]=useState(false);
  const total=MATCH_QUESTIONS.length;
  const q=MATCH_QUESTIONS[step];
  const progress=((step)/total)*100;
  const isEdit=!!initialData;

  const select=async v=>{
    const next={...answers,[q.id]:v};
    setAnswers(next);
    if(step<total-1){
      setTimeout(()=>setStep(s=>s+1),280);
    } else {
      setSaving(true);
      const ageMap={"16-20":[16,20],"20-25":[20,25],"25-30":[25,30],"30+":[30,99]};
      const [ageMin,ageMax]=ageMap[next.seeking_age]||[16,30];
      const{seeking_age:_,...rest}=next;
      let lat=myProfile?.latitude||null,lng=myProfile?.longitude||null;
if(next.distance_ok==="sur_place"&&!lat){
  try{
    const perm=await Geolocation.checkPermissions();
    if(perm.location!=="granted"){const req=await Geolocation.requestPermissions();if(req.location!=="granted")throw new Error("permission refusée");}
    const pos=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:8000});lat=pos.coords.latitude;lng=pos.coords.longitude;await sb.from("profiles").update({latitude:lat,longitude:lng}).eq("id",session?.user?.id);
  }
  catch(e){notify("GPS non disponible — tu verras tout le monde");}
}
const payload={user_id:session?.user?.id,...rest,seeking_age_min:ageMin,seeking_age_max:ageMax,is_active:true,updated_at:new Date().toISOString(),age:myProfile?.age||null,latitude:lat,longitude:lng};
      const{error}=await sb.from("match_profiles").upsert (payload,{onConflict:"user_id"}); 
      setSaving(false); 
      if(!error){notify("✦ Profil Céleste Match enregistré !");onDone(next);}
      else notify("Erreur — réessaie"); 
    }
  };

  const chosen=answers[q.id];

  return(
    <div style={{position:"fixed",inset:0,zIndex:1200,background:T.bg,display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif"}}>
      {/* Header barre progression */}
      <div style={{padding:"calc(max(env(safe-area-inset-top,0px), 24px) + 16px) 20px 0",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          {step>0&&<Btn onClick={()=>setStep(s=>s-1)} style={{color:T.muted,display:"flex"}}><ChevronLeft size={22}/></Btn>}
          <div style={{flex:1,height:3,background:"rgba(255,255,255,0.08)",borderRadius:2}}>
            <div style={{height:"100%",width:`${progress}%`,background:T.gradGold,borderRadius:2,transition:"width .4s ease"}}/>
          </div>
          <span style={{fontSize:11,color:T.muted,minWidth:32,textAlign:"right"}}>{step+1}/{total}</span>
          <Btn onClick={onClose} style={{color:T.muted,display:"flex",marginLeft:4}}><X size={20}/></Btn>
        </div>
      </div>

      {/* Corps */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",padding:"0 24px 40px"}}>
        {/* Emoji + Question */}
        <div style={{textAlign:"center",padding:"32px 0 28px",animation:"fadeUp .3s ease"}}>
          <div style={{fontSize:52,marginBottom:16,filter:`drop-shadow(0 0 20px ${T.gold}55)`}}>{q.emoji}</div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text,margin:0,lineHeight:1.4}}>{q.label}</h2>
          {!isEdit&&step===0&&(
            <p style={{fontSize:13,color:T.muted,marginTop:10,lineHeight:1.7}}>
              Réponds honnêtement — plus tu es authentique, plus les suggestions seront justes ✦
            </p>
          )}
        </div>

        {/* Options */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {q.options.map((opt,i)=>{
            const selected=chosen===opt.v;
            return(
              <button key={opt.v} onClick={()=>select(opt.v)}
                style={{
                  width:"100%",padding:"16px 20px",
                  background:selected?T.goldBg2:"rgba(255,255,255,0.04)",
                  border:`1.5px solid ${selected?T.gold:"rgba(255,255,255,0.08)"}`,
                  borderRadius:18,color:selected?T.goldL:T.text,
                  fontSize:15,fontWeight:selected?700:400,
                  cursor:"pointer",textAlign:"left",
                  display:"flex",alignItems:"center",gap:14,
                  transition:"all .2s",
                  animation:`fadeUp .3s ease ${i*0.06}s both`,
                  boxShadow:selected?`0 0 0 1px ${T.gold}44, 0 8px 24px rgba(201,149,42,0.15)`:"none",
                  transform:selected?"scale(1.02)":"scale(1)",
                }}>
                <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${selected?T.gold:"rgba(255,255,255,0.15)"}`,background:selected?T.gold:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
                  {selected&&<div style={{width:8,height:8,borderRadius:"50%",background:"#000"}}/>}
                </div>
                <span>{opt.l}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loader sauvegarde */}
      {saving&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,zIndex:10}}>
          <div style={{width:48,height:48,borderRadius:"50%",border:`3px solid ${T.goldBg2}`,borderTopColor:T.gold,animation:"spin .8s linear infinite"}}/>
          <p style={{color:T.goldL,fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Enregistrement ✦</p>
        </div>
      )}
    </div>
  );
}
function getCompatibilityPoints(a,b,score){
  const points=[];
  const labels={
    faith:{centrale:"Foi centrale",importante:"Foi importante",secondaire:"Foi secondaire",aucune:"Sans religion"},
    marriage_vision:{oui:"Veut se marier",peut_etre:"Ouvert au mariage",non:"Pas de mariage"},
    children:{en_veux:"Veut des enfants",deja:"A déjà des enfants",pas_sur:"Incertain sur les enfants",non:"Pas d'enfants"},
    life_vision:{stabilite:"Cherche la stabilité",voyages:"Aime voyager",carriere:"Axé carrière",incertain:"Ouvert à tout"},
    intimacy:{central:"Intimité prioritaire",important:"Intimité importante",secondaire:"Intimité secondaire",attente:"Préfère attendre"},
    seeking_type:{amour:"Cherche l'amour",amitie:"Cherche l'amitié",les_deux:"Ouvert à tout"},
    conflict_style:{parle:"Communication directe",digere:"Prend du recul",reagis:"Réactif mais passe vite"},
    expression_level:{expressif:"Très expressif",reserve:"Réservé",milieu:"Équilibré"},
    life_rhythm:{calme:"Rythme calme",social:"Vie sociale active",melange:"Rythme varié"},
    family_vs_freedom:{famille:"Famille avant tout",liberte:"Liberté individuelle",equilibre:"Équilibre famille/liberté"},
    app_expectation:{serieux:"Cherche du sérieux",amis:"Cherche des amis",decouverte:"Ouvert à la découverte",verra:"Verra ce qui arrive"},
  };
  const complementPairs=COMPLEMENT_PAIRS;
  for(const key of Object.keys(Q_WEIGHT)){
    if(!a[key]||!b[key])continue;
    let match=false;
    if(SIMILAR_KEYS.includes(key)&&a[key]===b[key])match=true;
    if(COMPLEMENT_KEYS.includes(key)&&complementPairs[key]?.[a[key]]===b[key])match=true;
    if(match&&labels[key]?.[a[key]]){
      points.push({emoji:key==="faith"?"🙏":key==="marriage_vision"?"💍":key==="children"?"👶":key==="life_vision"?"🌅":key==="intimacy"?"🔥":key==="seeking_type"?"✨":key==="conflict_style"?"🌊":key==="expression_level"?"🎭":key==="life_rhythm"?"🌙":key==="family_vs_freedom"?"⚖️":"💎",label:labels[key][a[key]]});
    }
  }
  const maxPoints=score>=100?points.length:score>=90?5:score>=80?4:score>=65?3:2;
  return points.slice(0,maxPoints);
}

function MatchWriteBtn({u,score,onChat,notify,onWriteOpen}){
  const [open,setOpen]=useState(false);
  const [msg,setMsg]=useState(`Salut ${u.name?.split(" ")[0]} ✦ Céleste nous affiche à ${score}% de compatibilité — j'aimerais qu'on discute, si tu es partant·e !`);
  const [sending,setSending]=useState(false);

  // Filet de sécurité : si cette carte disparaît (suggestions mises à jour en
  // temps réel) pendant que le formulaire est ouvert, on prévient quand même
  // le parent pour ne pas bloquer DiscoverTab en display:none indéfiniment
  useEffect(()=>{
    if(!open)return;
    return()=>{onWriteOpen?.(false);};
  },[open]);

  if(!open) return(
    <button onClick={()=>{setOpen(true);onWriteOpen?.(true);}} style={{flexShrink:0,padding:"8px 14px",background:T.gradGold,border:"none",borderRadius:12,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 3px 12px rgba(201,149,42,0.3)"}}>
      Écrire ✦
    </button>
  );
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:99999,background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 16px",paddingTop:"calc(60px + max(env(safe-area-inset-top,0px), 24px))",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <Btn onClick={()=>{setOpen(false);onWriteOpen?.(false);}} style={{color:T.text,display:"flex",alignItems:"center",gap:6}}>
          <ChevronLeft size={22}/><span style={{fontSize:15,fontWeight:600}}>Retour</span>
        </Btn>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:14,fontWeight:700,color:T.text}}>{u.name}</p>
          <p style={{margin:0,fontSize:11,color:T.goldL}}>Compatibilité {score}% ✦</p>
        </div>
        <Av u={u} size={34}/>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"20px 16px",gap:12}}>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)}
          rows={6}
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:14,padding:"12px",color:T.text,fontSize:14,lineHeight:1.6,resize:"none",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
        <button disabled={sending||!msg.trim()} onClick={async()=>{
          setSending(true);
          try{
            await onChat(u.id,msg.trim());
            notify(`Message envoyé à ${u.name?.split(" ")[0]} ✦`);
            setOpen(false);onWriteOpen?.(false);
          }catch(e){
            notify("Erreur — réessaie");
            setSending(false);
          }
        }} style={{width:"100%",padding:"14px",background:sending?"rgba(201,149,42,0.4)":T.gradGold,border:"none",borderRadius:14,color:"#000",fontSize:14,fontWeight:700,cursor:sending?"default":"pointer"}}>
          {sending?"Envoi…":"Envoyer ✦"}
        </button>
      </div>
    </div>
  );
}

function MatchSuggestions({myProfile,session,members,onUser,onChat,notify,onWriteOpen,blockedUserIds=[]}){
  const [matchProfile,setMatchProfile]=useState(null);
  const [suggestions,setSuggestions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showOnboarding,setShowOnboarding]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [autoPopup,setAutoPopup]=useState(false);

  useEffect(()=>{
    if(!session?.user?.id)return;
    (async()=>{
      setLoading(true);
      const{data}=await sb.from("match_profiles").select("*").eq("user_id",session.user.id).maybeSingle();
      setMatchProfile(data);
      if(!data||!data.is_active){
        const shown=localStorage.getItem("celeste_match_popup_shown");
        if(!shown&&!data){localStorage.setItem("celeste_match_popup_shown","1");setAutoPopup(true);}
      }
      if(data?.is_active&&members?.length>0){
        // Charger les profils des autres membres (hors utilisateurs bloqués)
        const blockedSet=new Set(blockedUserIds||[]);
        const otherIds=members.filter(m=>m.id!==session.user.id&&!blockedSet.has(m.id)).map(m=>m.id);
        const{data:otherProfiles}=await sb.from("match_profiles").select("*").in("user_id",otherIds).eq("is_active",true);
        if(otherProfiles){
          const scored=(otherProfiles||[]).map(op=>{
            const score=computeMatchScore(data,op);
            const member=members.find(m=>m.id===op.user_id);
            return{...op,score,member};
          }).filter(s=>s.score>=50&&s.member).sort((a,b)=>b.score-a.score).slice(0,20);
          setSuggestions(scored);
        }
      }
      setLoading(false);
    })();
  },[session?.user?.id,members?.length,blockedUserIds]);

  useEffect(()=>{
    // Anti-capture : activer si au moins une suggestion visible a screenshot_protection
    const hasProtected=suggestions.some(s=>s.member?.screenshot_protection);
    if(hasProtected)enableScreenProtection();else disableScreenProtection();
    return()=>disableScreenProtection();
  },[suggestions]);

  useEffect(()=>{
    if(!session?.user?.id)return;
    const sub=sb.channel("match_realtime").on("postgres_changes",{event:"*",schema:"public",table:"match_profiles"},()=>{
      sb.from("match_profiles").select("*").eq("user_id",session.user.id).maybeSingle().then(({data:myData})=>{
        if(!myData?.is_active||!members?.length)return;
        const blockedSet=new Set(blockedUserIds||[]);
        const otherIds=members.filter(m=>m.id!==session.user.id&&!blockedSet.has(m.id)).map(m=>m.id);
        sb.from("match_profiles").select("*").in("user_id",otherIds).eq("is_active",true).then(({data:others})=>{
          if(!others)return;
          const scored=others.map(op=>{const score=computeMatchScore(myData,op);const member=members.find(m=>m.id===op.user_id);return{...op,score,member};}).filter(s=>s.score>=50&&s.member).sort((a,b)=>b.score-a.score).slice(0,20);
          setSuggestions(scored);
        });
      });
    }).subscribe();
    return()=>sb.removeChannel(sub);
  },[session?.user?.id,members?.length,blockedUserIds]);

  const scoreColor=s=>s>=80?T.ok:s>=65?T.goldL:T.gold;
  const scoreLabel=s=>s>=90?"Connexion rare ✦":s>=80?"Très compatible":s>=65?"Bonne affinité":s>=50?"Affinité modérée":"";

  if(loading)return(
    <div style={{padding:"20px 16px 8px"}}>
      <div style={{height:160,background:"rgba(255,255,255,0.03)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${T.border}`,borderTopColor:T.gold,animation:"spin .7s linear infinite"}}/>
      </div>
    </div>
  );

  // Pas encore de profil match
  if(!matchProfile||!matchProfile.is_active) return(
    <div style={{padding:"16px 16px 8px"}}>
      <div style={{background:`linear-gradient(135deg,${T.goldBg} 0%,rgba(201,149,42,0.04) 100%)`,border:`1px solid ${T.gold}33`,borderRadius:22,padding:"22px 20px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,fontSize:80,opacity:.06}}>✦</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <span style={{fontSize:24}}>💫</span>
          <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text}}>Céleste Match</h3>
          <span style={{fontSize:10,color:T.goldL,fontWeight:700,background:T.goldBg2,padding:"2px 8px",borderRadius:20,border:`1px solid ${T.gold}33`}}>NOUVEAU</span>
        </div>
        <p style={{margin:"0 0 16px",fontSize:13,color:T.sub,lineHeight:1.7}}>
          Découvre des personnes qui te ressemblent vraiment — pas au hasard, mais selon tes valeurs, ta vision de la vie et ta façon d'être.
        </p>
        <button onClick={()=>setShowOnboarding(true)}
          style={{width:"100%",padding:"14px",background:T.gradGold,borderRadius:14,border:"none",color:"#000",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px rgba(201,149,42,0.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span>✦</span> {matchProfile?"Réactiver Céleste Match":"Créer mon profil Match"}
        </button>
      </div>
      {(showOnboarding||autoPopup)&&<MatchOnboardingModal myProfile={myProfile} session={session} notify={notify}
        onClose={()=>{setShowOnboarding(false);setAutoPopup(false);}}
        onDone={data=>{setMatchProfile({...data,is_active:true});setShowOnboarding(false);setAutoPopup(false);}}/>}
    </div>
  );

  // Pas de suggestions
  if(suggestions.length===0) return(
    <div style={{padding:"16px 16px 8px"}}>
      <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:22,padding:"20px",textAlign:"center"}}>
        <span style={{fontSize:36,display:"block",marginBottom:8}}>💫</span>
        <p style={{margin:"0 0 4px",fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.text}}>Céleste Match</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:T.muted}}>Pas encore de suggestions — la communauté grandit ✦</p>
        <button onClick={()=>setShowOnboarding(true)} style={{fontSize:12,color:T.goldL,background:"none",border:`1px solid ${T.gold}33`,borderRadius:10,padding:"6px 14px",cursor:"pointer"}}>
          Modifier mon profil
        </button>
      </div>
      {showOnboarding&&<MatchOnboardingModal myProfile={myProfile} session={session} notify={notify} initialData={matchProfile}
        onClose={()=>setShowOnboarding(false)} onDone={data=>{setMatchProfile({...data,is_active:true});setShowOnboarding(false);}}/>}
    </div>
  );

  const visible=suggestions;

  return(
    <div style={{padding:"16px 16px 4px"}}>
      {/* Titre section */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>💫</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.text,fontWeight:400}}>Céleste Match</span>
          <span style={{fontSize:10,color:T.goldL,fontWeight:700,background:T.goldBg2,padding:"2px 8px",borderRadius:20,border:`1px solid ${T.gold}33`}}>{suggestions.length}</span>
        </div>
        <button onClick={()=>setShowOnboarding(true)} style={{fontSize:11,color:T.muted,background:"none",border:"none",cursor:"pointer",padding:"4px 8px"}}>
          Modifier ✏️
        </button>
      </div>

      {/* Cartes scroll horizontal */}
      <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8,scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none"}}>
        {visible.map((s,i)=>{
          const u=s.member;
          const col=scoreColor(s.score);
          return(
            <div key={u.id} style={{background:s.score===100?"rgba(201,149,42,0.06)":"rgba(255,255,255,0.03)",border:`1.5px solid ${s.score===100?T.gold:T.border}`,borderRadius:20,overflow:"hidden",boxShadow:s.score===100?"0 0 24px rgba(201,149,42,0.2)":"none",flexShrink:0,width:260,scrollSnapAlign:"start"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 14px 10px"}}>
                {/* Avatar */}
                <div style={{position:"relative",flexShrink:0}} onClick={()=>onUser(u.id)}>
                  <Av u={u} size={54} ring/>
                  {u.isOnline&&<div style={{position:"absolute",bottom:1,right:1,width:11,height:11,borderRadius:"50%",background:T.ok,border:"2px solid "+T.bg,boxShadow:"0 0 6px rgba(34,197,94,0.6)"}}/>}
                </div>
                {/* Infos */}
                <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onUser(u.id)}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:14,fontWeight:700,color:T.text}}>{u.name}</span>
                    <Badge type={u.badge}/>
                  </div>
                  <span style={{fontSize:11,color:T.muted}}><MapPin size={10} style={{display:"inline",marginRight:3}}/>{u.paroisse||"Congo"}</span>
                </div>
                {/* Score */}
                <div style={{flexShrink:0,textAlign:"center"}}>
                  <div style={{width:52,height:52,borderRadius:"50%",border:`2.5px solid ${col}`,display:"flex",alignItems:"center",justifyContent:"center",background:`${col}11`,position:"relative"}}>
                    <span style={{fontSize:15,fontWeight:900,color:col}}>{s.score}%</span>
                  </div>
                  <span style={{fontSize:9,color:col,fontWeight:600,display:"block",marginTop:3}}>{scoreLabel(s.score)}</span>
                </div>
              </div>
              {/* Points de compatibilité */}
              {(()=>{
                const pts=getCompatibilityPoints(matchProfile,s,s.score);
                return pts.length>0&&(
                  <div style={{padding:"0 14px 10px",display:"flex",flexWrap:"wrap",gap:6}}>
                    {s.score===100&&<div style={{width:"100%",marginBottom:4,fontSize:11,color:T.goldL,fontWeight:700,fontStyle:"italic"}}>✦ Connexion parfaite — cela n'arrive presque jamais</div>}
                    {pts.map((pt,pi)=>(
                      <span key={pi} style={{fontSize:11,padding:"4px 10px",borderRadius:20,background:"rgba(201,149,42,0.1)",border:`1px solid ${T.gold}33`,color:T.goldL,display:"flex",alignItems:"center",gap:4}}>
                        {pt.emoji} {pt.label}
                      </span>
                    ))}
                  </div>
                );
              })()}
              {/* Message pré-rédigé */}
              <div style={{borderTop:`1px solid ${T.border}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:T.muted,flex:1,fontStyle:"italic",lineHeight:1.5}}>
                  "{u.name?.split(" ")[0]} et moi, {s.score}% — ça mérite qu'on discute ✦"
                </span>
                <MatchWriteBtn u={u} score={s.score} onChat={onChat} notify={notify} onWriteOpen={onWriteOpen}/>
              </div>
            </div>
          );
        })}
      </div>

      

      {showOnboarding&&<MatchOnboardingModal myProfile={myProfile} session={session} notify={notify} initialData={matchProfile}
        onClose={()=>setShowOnboarding(false)} onDone={data=>{setMatchProfile({...data,is_active:true});setShowOnboarding(false);}}/>}
    </div>
  );
}

function DiscoverTab({members,myProfile,session,onUser,notify,myConnections,myFollowers,onConnectionChange,openChat,blockedUserIds=[]}){
  const [q,setQ]=useState("");
  const [filter,setFilter]=useState("tous");
  const [matchWriting,setMatchWriting]=useState(false);

  const toggle=async id=>{
    if((myConnections||[]).includes(id)){
      const{error}=await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",id);
      if(error){notify("Erreur — réessaie");return;}
      notify("Connexion retirée");
    } else {
      const{error}=await sb.from("connections").insert({from_id:session?.user?.id,to_id:id});
      if(error){notify("Erreur — réessaie");return;}
      notify("Connecté ✦");
    }
    onConnectionChange();
  };

  const blockedSet=new Set(blockedUserIds||[]);
  const base=(members||[]).filter(m=>m.id!==session?.user?.id&&!blockedSet.has(m.id));
  const searchMatch=m=>matchQuery(m.fullName,q)||matchQuery(m.paroisse,q);
  const active=base.filter(m=>m.is_discoverable!==false&&searchMatch(m));

  let filtered;
if(filter==="populaires") filtered=[...active].sort((a,b)=>(b.followersCount||0)-(a.followersCount||0));
else if(filter==="recents") filtered=[...active].sort((a,b)=>new Date(b.joined_at||0)-new Date(a.joined_at||0));
else if(filter==="proximite"){
  if(!myProfile?.latitude) filtered=[];
  else filtered=[...active].filter(m=>m.latitude&&m.longitude&&distKm(myProfile.latitude,myProfile.longitude,m.latitude,m.longitude)<50).sort((a,b)=>distKm(myProfile.latitude,myProfile.longitude,a.latitude,a.longitude)-distKm(myProfile.latitude,myProfile.longitude,b.latitude,b.longitude));
}
else if(filter==="abonnes") filtered=(myFollowers||[]).length===0?[]:base.filter(m=>(myFollowers||[]).includes(m.id)&&searchMatch(m));
else if(filter==="abonnements") filtered=(myConnections||[]).length===0?[]:base.filter(m=>(myConnections||[]).includes(m.id)&&searchMatch(m));
else filtered=active;

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {myProfile?.account_type!=="organisation"&&(
        <MatchSuggestions myProfile={myProfile} session={session} members={members} onUser={onUser} notify={notify} onWriteOpen={setMatchWriting} blockedUserIds={blockedUserIds}
          onChat={async(uid,msg)=>{
            const{data:existing}=await sb.from("conversations").select("id").or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${uid}),and(user1_id.eq.${uid},user2_id.eq.${session?.user?.id})`).maybeSingle();
            let convId=existing?.id;
            if(!convId){const{data:created}=await sb.from("conversations").insert({user1_id:session?.user?.id,user2_id:uid}).select().single();convId=created?.id;}
            if(convId){
              await sb.from("messages").insert({conv_id:convId,sender_id:session?.user?.id,type:"text",text:msg});
              if(openChat)openChat(uid);
            }
          }}
        />
      )}
      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:T.bg,display:matchWriting?"none":"block",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text}}>Découvrir</h2>
          <div style={{flex:1,background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:20,padding:"9px 14px",display:"flex",gap:8,alignItems:"center"}}>
            <Search size={14} color={T.muted}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher…" style={{flex:1,background:"none",border:"none",color:T.text,fontSize:13,outline:"none"}}/>
            {q&&<Btn onClick={()=>setQ("")} style={{color:T.muted,display:"flex",alignItems:"center"}}><X size={14}/></Btn>}
          </div>
          <div style={{width:38,height:38,borderRadius:12,background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          </div>
        </div>
        {/* Filtres */}
        <div style={{display:"flex",gap:8,paddingBottom:12,overflowX:"auto"}}>
          {[{k:"tous",l:"Tous"},{k:"populaires",l:"Populaires"},{k:"recents",l:"Récents"},{k:"proximite",l:"À proximité"},{k:"abonnes",l:"Abonnés"},{k:"abonnements",l:"Abonnements"}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{flexShrink:0,padding:"7px 18px",borderRadius:20,border:`1px solid ${filter===f.k?T.gold:T.border}`,background:filter===f.k?"transparent":"transparent",color:filter===f.k?T.goldL:T.muted,fontSize:13,fontWeight:filter===f.k?700:400,cursor:"pointer",transition:"all .2s"}}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Grille */}
      <div style={{padding:"12px 12px 80px",display:matchWriting?"none":"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {filtered.length===0&&(
          <div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:T.muted}}>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>{filter==="proximite"&&!myProfile?.latitude?"Localisation non disponible — active le GPS":"Aucun résultat"}</p>
          </div>
        )}
        {filtered.map((u,i)=>{
          const conn=(myConnections||[]).includes(u.id);
          return(
            <div key={u.id} style={{position:"relative",borderRadius:18,overflow:"hidden",aspectRatio:"3/4",cursor:"pointer",animation:`fadeUp .4s ease ${i*.04}s both`}}
              onClick={()=>onUser(u.id)}>
              {/* Photo de fond */}
              {u.avatar_url
                ?<img src={u.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/>
                :<div style={{position:"absolute",inset:0,background:`linear-gradient(135deg,${u.color||T.goldD}44,${T.navy}88)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,color:T.gold,opacity:.5}}>✦</span>
                </div>
              }
              {/* Gradient bas */}
              <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 40%,rgba(0,0,0,0.85))"}}/>
              {/* Point online */}
              <div style={{position:"absolute",top:8,right:8,width:10,height:10,borderRadius:"50%",background:u.isOnline?"#22c55e":"rgba(255,255,255,0.2)",border:"2px solid #000",boxShadow:u.isOnline?"0 0 6px rgba(34,197,94,0.6)":"none"}}/>
              {/* Infos bas */}
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 10px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"nowrap"}}>
                    <p style={{margin:0,fontSize:12,fontWeight:700,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</p>
                    <Badge type={u.badge}/>
                  </div>
                  <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.6)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><MapPin size={10} style={{display:"inline",marginRight:3}}/>{u.paroisse||"Congo"}</p>
                </div>
                <Btn onClick={e=>{e.stopPropagation();toggle(u.id);}} style={{width:30,height:30,borderRadius:"50%",background:conn?T.goldBg2:T.gradGold,color:conn?T.goldL:"#000",fontSize:conn?11:18,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:conn?`1px solid ${T.gold}44`:"none",boxShadow:conn?"none":"0 4px 12px rgba(201,149,42,0.4)",transition:"all .25s"}}>
                  {conn?"✦":"+"}
                </Btn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkeletonPost(){
  return(
    <div style={{background:"rgba(255,255,255,0.03)",borderRadius:20,padding:16,marginBottom:12,border:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.07)",animation:"shimmer 1.5s infinite"}}/>
        <div style={{flex:1}}>
          <div style={{height:10,width:"40%",borderRadius:6,background:"rgba(255,255,255,0.07)",animation:"shimmer 1.5s infinite",marginBottom:6}}/>
          <div style={{height:8,width:"25%",borderRadius:6,background:"rgba(255,255,255,0.04)",animation:"shimmer 1.5s infinite"}}/>
        </div>
      </div>
      <div style={{height:8,width:"90%",borderRadius:6,background:"rgba(255,255,255,0.07)",animation:"shimmer 1.5s infinite",marginBottom:8}}/>
      <div style={{height:8,width:"70%",borderRadius:6,background:"rgba(255,255,255,0.05)",animation:"shimmer 1.5s infinite",marginBottom:12}}/>
      <div style={{height:180,borderRadius:14,background:"rgba(255,255,255,0.05)",animation:"shimmer 1.5s infinite"}}/>
    </div>
  );
}

function StarFieldLoader({size=56}){
  const stars=[{x:20,y:30,d:0},{x:50,y:15,d:.3},{x:80,y:40,d:.6}];
  return(
    <div style={{position:"relative",width:size,height:size*0.6}}>
      {stars.map((s,i)=>(
        <span key={i} style={{position:"absolute",left:`${s.x}%`,top:`${s.y}%`,fontSize:size*0.14,color:T.gold,animation:`starPulse 1.6s ease-in-out ${s.d}s infinite`}}>✦</span>
      ))}
    </div>
  );
}
const SmartImage = memo(function SmartImage({ src, alt = "", style = {}, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  useEffect(() => { setLoaded(false); setErrored(false); }, [src]);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0a0a0a", overflow: "hidden" }} onClick={onClick}>
      {!loaded && !errored && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <StarFieldLoader size={32} />
        </div>
      )}
      {errored && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 11 }}>Image indisponible</div>
      )}
      {src && !errored && (
        <img src={src} alt={alt} loading="lazy"
          onLoad={() => setLoaded(true)} onError={() => setErrored(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity .35s ease", display: "block", ...style }} />
      )}
    </div>
  );
});
const VideoThumb = memo(function VideoThumb({ src }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0a0a0a" }}>
      <video src={src} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Play size={16} color="#fff" fill="#fff" />
        </div>
      </div>
    </div>
  );
});
function TypewriterText({text,style}){
  const [shown,setShown]=useState(0);
  const seenRef=useRef(false);
  useEffect(()=>{
    if(seenRef.current||!text)return;
    seenRef.current=true;
    let i=0;
    const id=setInterval(()=>{
      i++;setShown(i);
      if(i>=text.length)clearInterval(id);
    },18);
    return()=>clearInterval(id);
  },[text]);
  return <p style={style}>{text.slice(0,shown)}</p>;
}

function HomeTab({posts,setPosts,myProfile,session,getM,onNewPost,onUseSoundForPost,onUser,notify,reload,loadMore,hasMore,loadingMore,refreshPost,onImageView,myConnections,onConnect,initialScroll,onScrollChange,pushNav,popNav,onMuteAuthor,viewedPostIdsRef,refreshing,onFeedNavVisibility,sessionAffinity,isVisible=true}){

const [detailPost,setDetailPost]=useState(null);
const [modalIndex,setModalIndex]=useState(null);
const [modalIsReel,setModalIsReel]=useState(false);
const [modalCommentPost,setModalCommentPost]=useState(null);
const [modalCloseCallback,setModalCloseCallback]=useState(null);
const [modalLiveCmtCount,setModalLiveCmtCount]=useState(0);
const closeCommentsRef=useRef(null);
const videoPosts=useMemo(()=>posts.filter(p=>(p.img||"").match(/\.(mp4|mov|webm)/i)||(p.media_urls||[]).some(u=>(u||"").match(/\.(mp4|mov|webm)/i))),[posts]);
// Tant qu'une session Reel est ouverte, on garde son pool de vidéos à jour
// quand loadMore() ramène de nouvelles vidéos — sans ré-ordonner ici, c'est
// FeedViewer qui décide de l'ordre (il connaît les intérêts récents).
useEffect(()=>{
  if(!modalPosts||!modalIsReel)return;
  const byId=new Map(videoPosts.map(p=>[p.id,p]));
  const existingIds=new Set(modalPosts.map(p=>p.id));
  const fresh=videoPosts.filter(p=>!existingIds.has(p.id));
  setModalPosts(prev=>{
    // Rafraîchit likes/commentaires/sauvegardes des posts déjà présents SANS
    // changer leur position — sinon un like posé dans le Reel n'est jamais vu.
    const refreshed=prev.map(p=>{const latest=byId.get(p.id);return latest?{...p,likes:latest.likes,comments:latest.comments,saved:latest.saved,savesCount:latest.savesCount}:p;});
    return fresh.length?[...refreshed,...fresh]:refreshed;
  });
},[videoPosts,modalIsReel]);
const [modalStartMedia,setModalStartMedia]=useState(0);
const [modalPosts,setModalPosts]=useState(null);
const [openSoundId,setOpenSoundId]=useState(null);


const photoPosts=useMemo(()=>posts.filter(p=>{
  const allMedia=p.media_urls?.length>0?p.media_urls:(p.img?[p.img]:[]);
  return allMedia.some(u=>!/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u||""));
}),[posts]);

// ── Abonnés : uniquement les gens qu'on suit, tri principalement
// chronologique avec un léger coup de pouce pour les posts qui ont
// déjà des likes (1 like = l'équivalent d'environ 1h de fraîcheur en plus) ──
const abonnesPosts=useMemo(()=>{
  const followingSet=new Set(myConnections||[]);
  return posts
    .filter(p=>followingSet.has(p.by))
    .slice()
    .sort((a,b)=>{
      const scoreA=a.ts+(a.likes?.length||0)*3600000;
      const scoreB=b.ts+(b.likes?.length||0)*3600000;
      return scoreB-scoreA;
    });
},[posts,myConnections]);

// ── Tendances : posts des dernières 24h, triés par engagement
// (likes + commentaires) sur cette même fenêtre ──
const tendancesPosts=useMemo(()=>{
  const dayAgo=Date.now()-24*60*60*1000;
  return posts
    .filter(p=>p.ts>=dayAgo)
    .slice()
    .sort((a,b)=>{
      const scoreA=(a.likes?.length||0)+(a.comments?.length||0);
      const scoreB=(b.likes?.length||0)+(b.comments?.length||0);
      if(scoreB!==scoreA)return scoreB-scoreA;
      return b.ts-a.ts;
    });
},[posts]);
useEffect(()=>{
  if(!modalPosts||modalIsReel)return;
  const existingIds=new Set(modalPosts.map(p=>p.id));
  const fresh=photoPosts.filter(p=>!existingIds.has(p.id));
  if(fresh.length)setModalPosts(prev=>[...(prev||[]),...fresh]);
},[photoPosts,modalIsReel]);
const openPhotoViewer=(post,url)=>{
  let idx=photoPosts.findIndex(p=>p.id===post.id);
  setModalIsReel(false);
  if(idx<0){
    // Post hors de la page Actuellement chargée (profil, recherche, admin, notification…)
    // → on ouvre quand même le viewer avec juste ce post
    setModalPosts([post]);
    idx=0;
  }else{
    // Mode session : la file se réordonne autour de la photo tapée
    // (catégories + son partagé, voir useFeedRanking.js)
    setModalPosts(buildPhotoSessionQueue(post,photoPosts));
    idx=0;
  }
  const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
  const photosOnly=allMedia.filter(u=>!/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u||""));
  const mIdx=Math.max(0,photosOnly.indexOf(url));
  setModalStartMedia(mIdx);
  if(detailPost){popNav();setDetailPost(null);} // ferme le post modal sous-jacent ET nettoie sa trace dans la pile de nav
  pushNav(()=>{setModalIndex(null);setModalPosts(null);});
  setModalIndex(idx);
};

const isMediaVideo=u=>/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u||"")||(u||"").includes("video");

const openPost=useCallback((p,tappedUrl)=>{
  const allMedia=p.media_urls?.length>0?p.media_urls:(p.img?[p.img]:[]);
  const tappedIsVideo=tappedUrl?isMediaVideo(tappedUrl):((p.img||"").match(/\.(mp4|mov|webm)/i)||allMedia.some(isMediaVideo));
  if(tappedIsVideo&&!p._forceComments){
    // Mode session : la file du Reel se réordonne autour de la vidéo tapée
    // plutôt que de reprendre l'ordre brut du feed (voir useFeedRanking.js)
    let postForReel=p;
    if(tappedUrl&&allMedia.length>1){
      // Fait passer la vidéo réellement tapée en tête du carrousel pour cette ouverture
      postForReel={...p,media_urls:[tappedUrl,...allMedia.filter(u=>u!==tappedUrl)]};
    }
    const sessionQueue=buildReelSessionQueue(postForReel,videoPosts).map(v=>v.id===p.id?postForReel:v);
    setModalIsReel(true);
    setModalPosts(sessionQueue);
    pushNav(()=>{setModalIndex(null);setModalPosts(null);});
    const realIdx=sessionQueue.findIndex(v=>v.id===p.id);
    setModalIndex(realIdx>=0?realIdx:0);
  }else if(p._forceComments){
    setDetailPost(p);
  }else if(p.type==="poll"||p.type==="event"){
    const idx=photoPosts.findIndex(q=>q.id===p.id);
    setModalIsReel(false);
    if(idx<0)setModalPosts([p]);else setModalPosts(null);
    setModalStartMedia(0);
    if(detailPost){popNav();setDetailPost(null);}
    pushNav(()=>setModalIndex(null));
    setModalIndex(idx>=0?idx:0);
  }else{
    const firstPhoto=tappedUrl&&!isMediaVideo(tappedUrl)?tappedUrl:allMedia.find(u=>!isMediaVideo(u));
    if(firstPhoto)openPhotoViewer(p,firstPhoto);else setDetailPost(p);
  }
},[videoPosts,photoPosts,detailPost]);

const openPostFromSound=(post,soundPosts)=>{
  const isVideoFn=p=>(p.img||"").match(/\.(mp4|mov|webm|ogg|avi)/i)||(p.media_urls||[]).some(u=>(u||"").match(/\.(mp4|mov|webm|ogg|avi)/i));
  const hasVisual=p=>isVideoFn(p)||p.type==="poll"||p.type==="event"||p.img||(p.media_urls&&p.media_urls.length>0);
  const list=(soundPosts||[post]).filter(hasVisual);
  const idx=list.findIndex(v=>v.id===post.id);
  setModalIsReel(isVideoFn(post));
  setModalPosts(list);
  setModalStartMedia(0);
  if(detailPost){popNav();setDetailPost(null);}
  if(modalIndex===null)pushNav(()=>{setModalIndex(null);setModalPosts(null);});
  setModalIndex(idx>=0?idx:0);
};

useEffect(()=>{
  const handler=(e)=>{
    const{post,url}=e.detail||{};
    if(post)openPhotoViewer(post,url);
  };
  window.addEventListener("celeste_open_photo_viewer",handler);
  return()=>window.removeEventListener("celeste_open_photo_viewer",handler);
},[photoPosts,detailPost]);
useEffect(()=>{
  const handler=(e)=>{
    const{post,url}=e.detail||{};
    if(post)openPost(post,url);
  };
  window.addEventListener("celeste_open_reel",handler);
  return()=>window.removeEventListener("celeste_open_reel",handler);
},[videoPosts,photoPosts,detailPost]);
const [searchOpen,setSearchOpen]=useState(false);
const scrollerRef=useRef(null);
const prefetchedUrlsRef=useRef(new Set());
const scrollInitialized=useRef(false);
const localViewedPostIdsRef=useRef(new Set());
const viewedPostIds=viewedPostIdsRef||localViewedPostIdsRef;
const postsRef=useRef(posts);
useEffect(()=>{postsRef.current=posts;},[posts]);
useEffect(()=>{
  if(!posts||posts.length===0)return;
  const timer=setTimeout(()=>{
    posts.slice(0,8).forEach(p=>{
      const allMedia=p.media_urls?.length>0?p.media_urls:(p.img?[p.img]:[]);
      allMedia.forEach(url=>{
        if(!url||prefetchedUrlsRef.current.has(url))return;
        prefetchedUrlsRef.current.add(url);
        const isVideo=/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url)||url.includes("video");
        const link=document.createElement("link");
        link.rel="prefetch";
        link.href=url;
        link.as=isVideo?"video":"image";
        document.head.appendChild(link);
      });
    });
  },1000);
  return()=>clearTimeout(timer);
},[posts?.length]);

const postSeenTimerRef=useRef(null);
const handlePostSeen=useCallback((post)=>{
  if(!post?.id)return;
  clearTimeout(postSeenTimerRef.current);
  postSeenTimerRef.current=setTimeout(()=>{
    if(viewedPostIds.current.has(post.id))return;
    viewedPostIds.current.add(post.id);
    const prev=JSON.parse(localStorage.getItem(celesteScopedKey("celeste_seen_posts"))||"[]");
    const updated=[...new Set([...prev,post.id])].slice(-500);
    localStorage.setItem(celesteScopedKey("celeste_seen_posts"),JSON.stringify(updated));
    sb.rpc("increment_phase_views",{post_id:post.id});
  },600);
},[]);

  const toggleLike=useCallback(async pid=>{
    const post=(postsRef.current||[]).find(p=>p.id===pid);
    if(!post)return;
    const uid=session?.user?.id;
    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);
    setPosts(prev=>(prev||[]).map(p=>p.id!==pid?p:{...p,likes:liked?(p.likes||[]).filter(l=>(l.user_id||l)!==uid):[...(p.likes||[]),uid]}));
    if(!liked)playLikeSound();
    try{
      if(liked){
        await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);
      }else{
        await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
        await sb.rpc("increment_phase_interactions",{post_id:pid});
        // La récompense (1 like = 1 FCFA, plafonnée par post) est calculée
        // et créditée côté serveur par un trigger — plus rien à faire ici.
      }
      // Push notif au propriétaire du post
      if(!liked&&post.by!==uid){
        sb.functions.invoke('send-push',{body:{
          targetUserId:post.by,
          title:"✦ Nouveau like",
          body:`${myProfile?.prenom||"Quelqu'un"} a aimé ton post`
        }});
      }
    }catch(e){console.warn("toggleLike error:",e);}
  },[session?.user?.id,myProfile?.prenom]);
const toggleParticipate=useCallback(async pid=>{
    const post=(postsRef.current||[]).find(p=>p.id===pid);
    if(!post)return;
    const uid=session?.user?.id;
    const participating=(post.participants||[]).some(x=>(x.user_id||x)===uid);
    setPosts(prev=>(prev||[]).map(p=>p.id!==pid?p:{...p,participants:participating?(p.participants||[]).filter(x=>(x.user_id||x)!==uid):[...(p.participants||[]),uid]}));
    try{
      if(participating){
        await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
      }else{
        await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
        if(post.by!==uid){
          sb.functions.invoke('send-push',{body:{targetUserId:post.by,title:"✦ Nouveau participant",body:`${myProfile?.prenom||"Quelqu'un"} participe à ton événement`}});
        }
      }
    }catch(e){console.warn("toggleParticipate error:",e);}
  },[session?.user?.id,myProfile?.prenom]);
  const toggleSave=useCallback(async pid=>{
    const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();
    if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);
    else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});
    notify(ex?"Retiré des sauvegardes":"Sauvegardé ✦");
  },[session?.user?.id,notify]);
const [feedTab,setFeedTab]=useState("pourtoi"); // pourtoi | abonnes | tendances
const [feedCommentPost,setFeedCommentPost]=useState(null);
const [feedCloseCallback,setFeedCloseCallback]=useState(null);
const [feedLiveCmtCount,setFeedLiveCmtCount]=useState(0);
closeCommentsRef.current=()=>{
  setModalCommentPost(null);
  setFeedCommentPost(null);
  if(modalCloseCallback){modalCloseCallback(modalLiveCmtCount);setModalCloseCallback(null);}
  if(feedCloseCallback){feedCloseCallback(feedLiveCmtCount);setFeedCloseCallback(null);}
};
const feedTabPosts=feedTab==="abonnes"?abonnesPosts:feedTab==="tendances"?tendancesPosts:posts;
  return(
    <>
{modalIndex!==null&&<FeedViewer
  posts={modalPosts||photoPosts}
  sb={sb} T={T} Av={Av}
  startIndex={modalIndex}
  startMediaIndex={modalStartMedia}
  onClose={()=>{popNav();setModalIndex(null);setModalPosts(null);}}
  toggleLike={toggleLike}
  toggleSave={toggleSave}
  onParticipate={toggleParticipate}
  session={session}
  myProfile={myProfile}
  notify={notify}
  onUser={onUser}
  onOpenComments={(p,cb)=>{pushNav(()=>closeCommentsRef.current());setModalCommentPost(p);setModalCloseCallback(()=>cb);}}
  myConnections={myConnections}
  onConnect={onConnect}
  onOpenSound={setOpenSoundId}
  onNeedMore={loadMore}
  hasMore={hasMore}
  loadingMore={loadingMore}
  sessionAffinity={sessionAffinity}
  pauseForOverlay={searchOpen}
/>}
{openSoundId&&<SoundDetailModal sb={sb} T={T} Av={Av} soundId={openSoundId} onClose={()=>setOpenSoundId(null)}
  onUseSound={(sound)=>{setOpenSoundId(null); onUseSoundForPost?.(sound);}}
  onOpenPost={openPostFromSound}
/>}
{(modalCommentPost||feedCommentPost)&&(
  <CommentsOnlyModal
    post={modalCommentPost||feedCommentPost}
    session={session}
    getM={getM}
    onCountChange={modalCommentPost?setModalLiveCmtCount:setFeedLiveCmtCount}
    onClose={()=>{
      popNav();
      setModalCommentPost(null);
      setFeedCommentPost(null);
      if(modalCloseCallback){modalCloseCallback(modalLiveCmtCount);setModalCloseCallback(null);}
      if(feedCloseCallback){feedCloseCallback(feedLiveCmtCount);setFeedCloseCallback(null);}
    }}
  />
)}
      
    <div style={{position:"relative",flex:1,overflow:"hidden",background:"#000"}}>
<div style={{display:searchOpen?"none":"contents"}}>
{/* Barre flottante transparente façon TikTok : onglets Tout/Photos/Reels + recherche + publier */}
<div style={{position:"absolute",top:0,left:0,right:0,zIndex:1300,paddingTop:"env(safe-area-inset-top,0px)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"calc(max(env(safe-area-inset-top,0px), 24px) + 14px) 14px 10px",background:"linear-gradient(180deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.25) 60%,rgba(0,0,0,0) 100%)",pointerEvents:"none"}}>
  <Btn onClick={onNewPost} style={{pointerEvents:"auto",width:40,height:40,borderRadius:"50%",background:T.gradGold,border:"none",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",flexShrink:0,boxShadow:"0 4px 14px rgba(201,149,42,0.55)"}}>
    <Plus size={18}/>
  </Btn>
  <div style={{display:"flex",gap:22,pointerEvents:"auto"}}>
    {[{k:"pourtoi",lb:"Pour toi"},{k:"abonnes",lb:"Abonnés"},{k:"tendances",lb:"Tendances"}].map(t=>(
      <Btn key={t.k} onClick={()=>setFeedTab(t.k)} style={{padding:"4px 0",background:"none",color:feedTab===t.k?"#fff":"rgba(255,255,255,0.6)",fontSize:15,fontWeight:feedTab===t.k?700:500,borderBottom:feedTab===t.k?"2px solid #fff":"2px solid transparent"}}>
        {t.lb}
      </Btn>
    ))}
  </div>
  <Btn onClick={()=>{pushNav(()=>setSearchOpen(false));setSearchOpen(true);}} style={{pointerEvents:"auto",width:36,height:36,borderRadius:"50%",background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",flexShrink:0}}>
    <Search size={16}/>
  </Btn>
</div>

{refreshing&&(
  <div style={{position:"absolute",top:"calc(70px + env(safe-area-inset-top,0px))",left:"50%",transform:"translateX(-50%)",zIndex:1300,display:"flex",alignItems:"center",gap:8,background:"rgba(10,10,10,0.9)",border:`1px solid ${T.gold}44`,borderRadius:20,padding:"6px 14px",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:"0 8px 24px rgba(0,0,0,0.4)",animation:"notifIn .3s ease"}}>
    <span style={{fontSize:14,color:T.gold,display:"inline-block",animation:"spin 1s linear infinite"}}>✦</span>
    <span style={{fontSize:12,color:T.text,fontWeight:600}}>Actualisation…</span>
  </div>
)}
  {feedTabPosts.length===0?(
    <div style={{textAlign:"center",padding:"140px 20px",color:"rgba(255,255,255,0.5)"}}>
      <div style={{fontSize:40,marginBottom:12,opacity:.3,animation:"float 3s ease infinite"}}>✦</div>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"#fff"}}>Aucune publication</p>
      <p style={{fontSize:13,marginTop:8}}>{feedTab==="abonnes"?"Aucune publication de tes abonnements pour l'instant":feedTab==="tendances"?"Rien ne tend dans les dernières 24h":"Soyez le premier à partager"}</p>    </div>
  ):(
    <FeedViewer
      embedded
      posts={feedTabPosts}
      sb={sb} T={T} Av={Av}
      startIndex={0}
      toggleLike={toggleLike}
      toggleSave={toggleSave}
      onParticipate={toggleParticipate}
      session={session}
      myProfile={myProfile}
      notify={notify}
      onUser={onUser}

      onOpenComments={(p,cb)=>{pushNav(()=>closeCommentsRef.current());setFeedCommentPost(p);setFeedCloseCallback(()=>cb);}}
      myConnections={myConnections}
      onConnect={onConnect}
      onOpenSound={setOpenSoundId}
      onNeedMore={loadMore}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onActivePost={handlePostSeen}
      onNavVisibilityChange={onFeedNavVisibility}
      sessionAffinity={sessionAffinity}
      pauseForOverlay={searchOpen}
      feedActive={isVisible}
    
    />
  )}
</div>
{searchOpen&&<SearchExplorer sb={sb} T={T} Av={Av} myProfile={myProfile} mapDbPost={mapDbPost} normProfile={normProfile}
  onClose={()=>{popNav();setSearchOpen(false);}}
  onOpenPost={openPostFromSound}
  onUseSound={onUseSoundForPost}
/>}
</div>
{detailPost&&(
        <PostDetailModal
          post={detailPost}
          myProfile={myProfile}
          session={session}
          getM={getM}
          onClose={()=>{popNav();setDetailPost(null);}}
          onLike={async pid=>{
            await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});
            const u=await refreshPost(pid);
            if(u){setDetailPost(u);setPosts(prev=>prev.map(x=>x.id===pid?u:x));}
          }}
          onParticipate={async pid=>{
            const uid=session?.user?.id;
            const participating=(detailPost.participants||[]).some(x=>(x.user_id||x)===uid);
            if(participating)await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
            else await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
            const u=await refreshPost(pid);
            if(u){setDetailPost(u);setPosts(prev=>prev.map(x=>x.id===pid?u:x));}
          }}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          notify={notify}
          onPhotoView={(post,url)=>openPhotoViewer(post,url)}
        />
      )}
    </>
  );
}

function TranslateBtn({text,dark=false}){
  const T=useApp()?.T||getThemePalette("default");
  const [translated,setTranslated]=useState(null);
  const [loading,setLoading]=useState(false);
  if(!text||text.length<10)return null;
  const translate=async()=>{
    if(translated){setTranslated(null);return;}
    setLoading(true);
    try{
      const res=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${navigator.language?.slice(0,2)||"en"}&dt=t&q=${encodeURIComponent(text)}`);
      const data=await res.json();
      const result=(data[0]||[]).map(s=>s[0]).join("");
      setTranslated(result);
    }catch(_){setTranslated("Traduction indisponible");}
    setLoading(false);
  };
  return(
    <div style={{marginBottom:8}}>
      {translated&&<p style={{margin:"0 0 4px",fontSize:13,color:T.muted,lineHeight:1.7,whiteSpace:"pre-line",wordBreak:"break-word",overflowWrap:"break-word",fontStyle:"italic"}}>{translated}</p>}
      <button onClick={e=>{e.stopPropagation();translate();}} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontSize:11,color:dark?"rgba(0,0,0,0.45)":T.muted,opacity:0.6,display:"flex",alignItems:"center",gap:4}}>
        {loading?"…":translated?<><X size={10}/> Masquer</>:<><Languages size={11}/> Traduire</>}
      </button>
    </div>
  );
}
// ── SONDAGES ───────────────────────────────────────────────
const POLL_COLORS=["#8b5cf6","#22c55e","#f97316","#3b82f6","#ec4899","#eab308","#14b8a6","#f43f5e"];
function formatPollTimeLeft(expiresAt){
  if(!expiresAt)return"Illimité";
  const diff=new Date(expiresAt).getTime()-Date.now();
  if(diff<=0)return"Terminé";
  const days=Math.floor(diff/86400000);
  if(days>=1)return`${days}j restant${days>1?"s":""}`;
  const hours=Math.floor(diff/3600000);
  if(hours>=1)return`${hours}h restante${hours>1?"s":""}`;
  const mins=Math.max(1,Math.floor(diff/60000));
  return`${mins}min restante${mins>1?"s":""}`;
}
const PollCard=React.memo(function PollCard({post,session}){
  const uid=session?.user?.id;
  const[options,setOptions]=useState([]);
  const[votes,setVotes]=useState([]);
  const[loading,setLoading]=useState(true);
  const[pending,setPending]=useState(false);
  const[justVoted,setJustVoted]=useState(null);
  const expired=post.expires_at?new Date(post.expires_at).getTime()<=Date.now():false;

  useEffect(()=>{
    let cancelled=false;
    const hasInitialData=Array.isArray(post.poll_options);
    if(hasInitialData){
      setOptions(post.poll_options||[]);setVotes(post.poll_votes||[]);setLoading(false);
    }else{
      (async()=>{
        const[{data:opts},{data:v}]=await Promise.all([
          sb.from("poll_options").select("id,label,position").eq("post_id",post.id).order("position",{ascending:true}),
          sb.from("poll_votes").select("option_id,voter_id").eq("post_id",post.id)
        ]);
        if(cancelled)return;
        setOptions(opts||[]);setVotes(v||[]);setLoading(false);
      })();
    }
    const channel=sb.channel(`poll_votes_${post.id}_${Math.random()}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"poll_votes",filter:`post_id=eq.${post.id}`},payload=>{
        setVotes(prev=>{
          if(payload.eventType==="INSERT")return[...prev,{option_id:payload.new.option_id,voter_id:payload.new.voter_id}];
          if(payload.eventType==="DELETE")return prev.filter(x=>!(x.option_id===payload.old.option_id&&x.voter_id===payload.old.voter_id));
          return prev;
        });
      }).subscribe();
    return()=>{cancelled=true;sb.removeChannel(channel);};
  },[post.id]);

  const totalVotes=useMemo(()=>new Set(votes.map(v=>v.voter_id)).size,[votes]);
  const countsByOption=useMemo(()=>{
    const m={};options.forEach(o=>m[o.id]=0);
    votes.forEach(v=>{m[v.option_id]=(m[v.option_id]||0)+1;});
    return m;
  },[votes,options]);
  const myOptionIds=useMemo(()=>new Set(votes.filter(v=>v.voter_id===uid).map(v=>v.option_id)),[votes,uid]);

  const handleVote=async optId=>{
    if(!uid||pending||expired)return;
    setPending(true);setJustVoted(optId);
    setTimeout(()=>setJustVoted(null),450);
    const alreadyMine=myOptionIds.has(optId);
    if(alreadyMine){
      setVotes(prev=>prev.filter(v=>!(v.option_id===optId&&v.voter_id===uid)));
      await sb.from("poll_votes").delete().eq("post_id",post.id).eq("option_id",optId).eq("voter_id",uid);
    }else if(!post.poll_multiple&&myOptionIds.size>0){
      setVotes(prev=>[...prev.filter(v=>v.voter_id!==uid),{option_id:optId,voter_id:uid}]);
      await sb.from("poll_votes").delete().eq("post_id",post.id).eq("voter_id",uid);
      await sb.from("poll_votes").insert({post_id:post.id,option_id:optId,voter_id:uid});
    }else{
      setVotes(prev=>[...prev,{option_id:optId,voter_id:uid}]);
      await sb.from("poll_votes").insert({post_id:post.id,option_id:optId,voter_id:uid});
    }
    setPending(false);
  };

  if(loading)return<div style={{padding:"20px 0",textAlign:"center"}}><div style={{width:20,height:20,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",margin:"0 auto",animation:"spin .7s linear infinite"}}/></div>;

  return(
    <div style={{marginBottom:10}}>
      {post.text&&<p style={{margin:"0 0 4px",fontSize:15,fontWeight:700,color:T.text,lineHeight:1.4}}>{post.text}</p>}
      <p style={{margin:"0 0 12px",fontSize:12,color:T.muted}}>{expired?"Sondage terminé":(post.poll_multiple?"Vous pouvez choisir plusieurs options":"Vous pouvez choisir une option")}</p>
      {options.map((opt,i)=>{
        const count=countsByOption[opt.id]||0;
        const pct=totalVotes>0?Math.round((count/totalVotes)*100):0;
        const mine=myOptionIds.has(opt.id);
        const color=POLL_COLORS[i%POLL_COLORS.length];
        return(
          <button key={opt.id} disabled={expired||pending} onClick={e=>{e.stopPropagation();handleVote(opt.id);}}
            style={{display:"block",width:"100%",position:"relative",overflow:"hidden",border:`1px solid ${mine?color+"77":T.border}`,borderRadius:14,padding:"12px 14px",marginBottom:8,background:"rgba(255,255,255,0.03)",cursor:expired?"default":"pointer",textAlign:"left",transition:"transform .18s cubic-bezier(0.34,1.56,0.64,1), border-color .3s ease",transform:justVoted===opt.id?"scale(0.96)":"scale(1)",animation:"popIn .35s cubic-bezier(0.34,1.56,0.64,1) both",animationDelay:`${i*55}ms`}}>
            <div style={{position:"absolute",inset:0,width:`${pct}%`,background:`linear-gradient(90deg,${color}35,${color}15)`,transition:"width .7s cubic-bezier(0.22,1,0.36,1)"}}/>
            <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
                {mine
                  ?<CheckCircle2 size={16} color={color} style={{flexShrink:0,animation:"popIn .3s cubic-bezier(0.34,1.56,0.64,1)"}}/>
                  :<span style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${color}77`,flexShrink:0,transition:"border-color .3s ease"}}/>
                }
                <span style={{fontSize:13.5,color:T.text,fontWeight:mine?700:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{opt.label}</span>
              </div>
              <span style={{fontSize:13,fontWeight:800,color:mine?color:T.sub,flexShrink:0,transition:"color .3s ease"}}>{pct}%</span>
            </div>
          </button>
        );
      })}
      <p style={{margin:"2px 0 0",fontSize:11.5,color:T.muted}}>{totalVotes} vote{totalVotes>1?"s":""} · {formatPollTimeLeft(post.expires_at)}</p>
    </div>
  );
});

// ── POST CARD (ENRICHI depuis App 9) ─────────────────────
const POST_REPORT_REASONS=["Contenu inapproprié ou choquant","Nudité ou contenu sexuel","Violence ou contenu dangereux","Discours haineux ou discrimination","Harcèlement ou intimidation","Fausses informations","Spam ou publicité non désirée","Contenu protégé (droits d'auteur)","Autre"];
const ADMIN_DELETE_REASONS=["Contenu inapproprié ou choquant","Nudité ou contenu sexuel","Violence ou contenu dangereux","Discours haineux ou discrimination","Harcèlement ou intimidation","Fausses informations","Spam ou publicité non désirée","Contenu protégé (droits d'auteur)","Contenu réutilisé d'une autre plateforme (filigrane visible)","Signalement non fondé mais retiré pour une autre raison","Autre"];
const PostCard=React.memo(function PostCard({post,myProfile,session,getM,onDetail,onLike,onParticipate,onSave,onUser,onImageView,notify,refresh,setPosts,animDelay=0,myConnections,onConnect,onMuteAuthor}){
  const{members,convs}=useApp();
  const [savesCount,setSavesCount]=useState(post.savesCount||0);
  const [expanded,setExpanded]=useState(false);
  const [showMenu,setShowMenu]=useState(false);
const [saved,setSaved]=useState(false);
  const [slideIdx,setSlideIdx]=useState(0);
  const [showShareModal,setShowShareModal]=useState(false);
  const [shareCount,setShareCount]=useState(0);
  const swipeStartRef=useRef(null);
  const lastTapRef=useRef(0);
  const dtTimeoutRef=useRef(null);
  const cardRef=useRef(null);
  const [isVisible,setIsVisible]=useState(false);
  const hasFetchedStatsRef=useRef(false);
  const [reactOpen,setReactOpen]=useState(false);
  const [reactDir,setReactDir]=useState(null);
  const reactStartRef=useRef(null);
  const longPressTimerRef=useRef(null);
  const suppressClickRef=useRef(false);
  const quickReactions=[
    {key:"up",dx:0,dy:-1,emoji:"👏",text:"👏 Bravo, superbe !"},
    {key:"down",dx:0,dy:1,emoji:"🙏",text:"🙏 Merci pour ce partage"},
    {key:"left",dx:-1,dy:0,emoji:"✨",text:"✨ J'ai adoré !"},
    {key:"right",dx:1,dy:0,emoji:"😲",text:"😲 Waouh, incroyable !"}
  ];
  const haptic=pattern=>{try{navigator.vibrate&&navigator.vibrate(pattern);}catch(_){}};
  const lastReactDirRef=useRef(null);
  const sendQuickComment=async text=>{
    const uid=session?.user?.id;
    if(!uid)return;
    const{data,error}=await sb.from("comments").insert({post_id:post.id,author_id:uid,text}).select("id,text,created_at,author:profiles(id,prenom,nom,avatar_url)").single();
    if(!error&&data){
      setPosts?.(prev=>prev.map(p=>p.id===post.id?{...p,comments:[...(p.comments||[]),{...data,repliesCount:0}],commentsCount:(p.commentsCount??(p.comments||[]).reduce((a,c)=>a+1+(c.repliesCount||0),0))+1}:p));
    }
  };
  const startLongPress=e=>{
    reactStartRef.current={x:e.clientX,y:e.clientY};
    lastReactDirRef.current=null;
    longPressTimerRef.current=setTimeout(()=>{setReactOpen(true);setReactDir(null);haptic("light");},380);
  };
  const moveLongPress=e=>{
    if(!reactOpen||!reactStartRef.current)return;
    const dx=e.clientX-reactStartRef.current.x;
    const dy=e.clientY-reactStartRef.current.y;
    const dist=Math.hypot(dx,dy);
    if(dist<24){
      if(lastReactDirRef.current){lastReactDirRef.current=null;setReactDir(null);}
      return;
    }
    const angle=Math.atan2(dy,dx);
    let dir;
    if(angle>-Math.PI/4&&angle<=Math.PI/4)dir="right";
    else if(angle>Math.PI/4&&angle<=3*Math.PI/4)dir="down";
    else if(angle>-3*Math.PI/4&&angle<=-Math.PI/4)dir="up";
    else dir="left";
    if(dir!==reactDir)haptic("light");
    setReactDir(dir);
  };
  const endLongPress=()=>{
    clearTimeout(longPressTimerRef.current);
   if(reactOpen&&reactDir){
      const choice=quickReactions.find(q=>q.key===reactDir);
      if(choice){sendQuickComment(choice.text);haptic("medium");}
    }
    if(reactOpen)suppressClickRef.current=true;
    setReactOpen(false);setReactDir(null);reactStartRef.current=null;lastReactDirRef.current=null;
  };
  const cancelLongPress=()=>{clearTimeout(longPressTimerRef.current);};
  const [burstIdx,setBurstIdx]=useState(null);
  const [likeFill,setLikeFill]=useState(0);
  const [likeBurst,setLikeBurst]=useState(false);
  const likeHoldStartRef=useRef(null);
  const likeHoldFrameRef=useRef(null);
  const likeBurstFiredRef=useRef(false);
  const LIKE_HOLD_MS=900;
  const likeFillStepRef=useRef(0);
 const likeHalfFiredRef=useRef(false);
  const startLikeHold=()=>{
    if(liked)return;
    likeBurstFiredRef.current=false;
    likeHalfFiredRef.current=false;
    haptic("light");
    likeHoldStartRef.current=performance.now();
    const tick=()=>{
      if(!likeHoldStartRef.current)return;
      const elapsed=performance.now()-likeHoldStartRef.current;
      const pct=Math.min(100,(elapsed/LIKE_HOLD_MS)*100);
      setLikeFill(pct);
      if(pct>=50&&!likeHalfFiredRef.current){
        likeHalfFiredRef.current=true;
        haptic("medium");
      }
      if(pct>=100){
        likeBurstFiredRef.current=true;
        setLikeBurst(true);
        haptic("heavy");
        onLike(post.id);
        likeHoldStartRef.current=null;
        setTimeout(()=>{setLikeBurst(false);setLikeFill(0);},650);
        return;
      }
      likeHoldFrameRef.current=requestAnimationFrame(tick);
    };
    likeHoldFrameRef.current=requestAnimationFrame(tick);
  };
  const endLikeHold=()=>{
    cancelAnimationFrame(likeHoldFrameRef.current);
    if(likeBurstFiredRef.current){likeBurstFiredRef.current=false;return;}
    const held=likeHoldStartRef.current?performance.now()-likeHoldStartRef.current:0;
    setLikeFill(0);
    likeHoldStartRef.current=null;
    haptic("light");
    onLike(post.id);
  };
  const cancelLikeHold=()=>{
    cancelAnimationFrame(likeHoldFrameRef.current);
    likeBurstFiredRef.current=false;
    setLikeFill(0);
    likeHoldStartRef.current=null;
  };
  const liked=(post.likes||[]).some(l=>(l.user_id||l)===session?.user?.id);
  const participating=(post.participants||[]).some(x=>(x.user_id||x)===session?.user?.id);
  const participantsCount=(post.participants||[]).length;
  const evDateParts=formatEventDate(post.eventDate);
  const isMine=post.by===session?.user?.id;
  const isAdmin=myProfile?.is_admin;
  const isLockedForViewer=post.is_private&&!isNative&&!isMine;

 const [views, setViews] = useState(0);

  useEffect(()=>{
    const node=cardRef.current;
    if(!node)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries[0]?.isIntersecting){setIsVisible(true);observer.disconnect();}
    },{rootMargin:"200px 0px"});
    observer.observe(node);
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    if(!isVisible||hasFetchedStatsRef.current)return;
    const myId=session?.user?.id;
    if(!myId)return;
    hasFetchedStatsRef.current=true;
    sb.from("saved_posts").select("id").eq("post_id",post.id).eq("user_id",myId).maybeSingle()
      .then(({data})=>setSaved(!!data));
    // Enregistrer la vue + charger le compteur (une seule requête de comptage, plus de doublon)
    sb.from("post_views").upsert({post_id:post.id,viewer_id:myId},{onConflict:"post_id,viewer_id",ignoreDuplicates:true})
      .then(()=>sb.from("post_views").select("*",{count:"exact",head:true}).eq("post_id",post.id)
        .then(({count})=>setViews(count||0)));
  },[isVisible,post.id,session?.user?.id]);

  useEffect(()=>{
  if(!isVisible||!post?.id)return;
  sb.from("post_shares").select("*",{count:"exact",head:true}).eq("post_id",post.id)
    .then(({count})=>setShareCount(count||0));
},[isVisible,post.id]);

  const handleSave=async()=>{
    const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",post.id).eq("user_id",session?.user?.id).maybeSingle();
   if(ex){await sb.from("saved_posts").delete().eq("post_id",post.id).eq("user_id",session?.user?.id);setSaved(false);setSavesCount(c=>Math.max(0,c-1));notify("Retiré des sauvegardes");}
      else{await sb.from("saved_posts").insert({post_id:post.id,user_id:session?.user?.id});setSaved(true);setSavesCount(c=>c+1);notify("Sauvegardé ✦");}
      
  };


const handleDelete=async()=>{
  const byAdmin=myProfile?.is_admin&&post.by!==session?.user?.id;
  if(byAdmin){setShowDeleteReasons(true);return;}
  if(!(await confirmAction("Supprimer ce post ?",{confirmLabel:"Supprimer"})))return;
  setPosts?.(prev=>(prev||[]).filter(p=>p.id!==post.id));
  notify("Supprimé");
  if(myProfile?.is_admin){
    await sb.from("posts").delete().eq("id",post.id);
  }else{
    await sb.from("posts").delete().eq("id",post.id).eq("author_id",session?.user?.id);
  }
};

const handleAdminDeleteWithReason=async(reason)=>{
  setShowDeleteReasons(false);
  // On capture un aperçu AVANT suppression : une fois le post supprimé,
  // plus moyen de savoir lequel c'était (surtout si la personne a posté
  // plusieurs fois le même jour).
  const postDate=post.created_at?new Date(post.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):null;
  const snapshotImg=post.img||(post.media_urls||[])[0]||null;
  const excerpt=post.text?`« ${post.text.slice(0,60)}${post.text.length>60?"…":""} »`:(snapshotImg?(post.video?"(vidéo)":"(photo)"):"");
  const{error:delError}=await sb.from("posts").delete().eq("id",post.id);
  if(delError){
    notify("Échec de la suppression — réessaie");
    console.error("admin post delete error:",delError);
    return;
  }
  setPosts?.(prev=>(prev||[]).filter(p=>p.id!==post.id));
  const{error:notifError}=await sb.from("notifications").insert({
    user_id:post.by,
    from_id:session?.user?.id,
    type:"post_deleted",
    text:`Ta publication du ${postDate}${excerpt?" "+excerpt:""} a été supprimée par un administrateur (motif : ${reason})`,
    snapshot_img:snapshotImg,
    read:false
  });
  if(notifError)console.error("post_deleted notification error:",notifError);
  sb.functions.invoke('send-push',{body:{
    targetUserId:post.by,
    title:"🗑️ Publication supprimée",
    body:`Ta publication du ${postDate} a été supprimée (motif : ${reason})`
  }});
  notify("Supprimé");
};

  const handlePin=async()=>{
  if(!myProfile?.is_admin)return;
  await sb.from("posts").update({pinned:!post.pinned}).eq("id",post.id);
  notify(post.pinned?"Désponsorisé":"Sponsorisé ✦");
  setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_reload_posts")),300);
};
const handleProfilePin=()=>{
  if(!isMine)return;
  const next=!post.profile_pinned;
  setPosts?.(prev=>(prev||[]).map(p=>p.id===post.id?{...p,profile_pinned:next}:p));
  notify(next?"Épinglé sur ton profil ✦":"Désépinglé du profil");
  (async()=>{
    if(next){
      const{count}=await sb.from("posts").select("id",{count:"exact",head:true}).eq("author_id",session.user.id).eq("profile_pinned",true);
      if((count||0)>=3){
        setPosts?.(prev=>(prev||[]).map(p=>p.id===post.id?{...p,profile_pinned:false}:p));
        notify("Tu peux épingler 3 publications maximum");
        return;
      }
    }
    const{error}=await sb.from("posts").update({profile_pinned:next}).eq("id",post.id);
    if(error){
      console.error("profile_pinned update error:",error);
      setPosts?.(prev=>(prev||[]).map(p=>p.id===post.id?{...p,profile_pinned:!next}:p));
      notify("Erreur lors de l'épinglage — réessaie");
      return;
    }
    window.dispatchEvent(new CustomEvent("celeste_profile_pin_changed"));
  })();
};
const [showPostReport,setShowPostReport]=useState(false);
const [showDeleteReasons,setShowDeleteReasons]=useState(false);
  const handleReportPost=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:post.by,post_id:post.id,reason,details});
    setShowPostReport(false);
    notify("Publication signalée — merci, notre équipe va l'examiner");
  };
  const handleMuteAuthor=async()=>{
    const{error}=await sb.from("muted_authors").insert({muter_id:session?.user?.id,muted_id:post.by});
    if(error&&error.code!=="23505"){notify("Erreur, réessaie");return;}
    setPosts?.(prev=>(prev||[]).filter(p=>p.by!==post.by));
sb.from("post_collaborators").select("post_id").eq("collaborator_id",post.by).then(({data})=>{
  const ids=new Set((data||[]).map(r=>r.post_id));
  if(ids.size)setPosts?.(prev=>(prev||[]).filter(p=>!ids.has(p.id)));
});
onMuteAuthor?.(post.by);
    notify("Tu ne verras plus les publications de cette personne");
  };
 
  if(isLockedForViewer){
    return(
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Av u={post.author} size={40}/>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{post.author?.fullName||post.author?.name}</p>
            <p style={{margin:0,fontSize:11,color:T.muted}}>a publié un contenu privé</p>
          </div>
        </div>
        <div style={{padding:"28px 16px",background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:16,display:"flex",flexDirection:"column",alignItems:"center",gap:10,textAlign:"center"}}>
          <Lock size={26} color={T.goldL}/>
          <p style={{margin:0,fontSize:14,fontWeight:700,color:T.text}}>Publication privée</p>
          <p style={{margin:0,fontSize:12,color:T.muted,lineHeight:1.6,maxWidth:260}}>Cette publication n'est visible que dans l'application Céleste sur Android — pas sur le web.</p>
        </div>
      </div>
    );
  }
  return(
    <>
    <div ref={cardRef} style={{borderBottom:`1px solid ${T.border}`,position:"relative",padding:"16px 16px 16px 14px",cursor:"pointer"}} onClick={()=>onDetail?.(post)}>
      <div style={{position:"absolute",left:0,top:8,bottom:8,width:2,borderRadius:2,background:`${post.author?.color||T.border}55`}}/>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        {/* Avatar */}
        <div style={{position:"relative",display:"inline-block"}}>
  <Av u={post.author} size={42} onClick={e=>{e.stopPropagation();onUser?.(post.by);}}/>
  {!myConnections?.includes(post.by)&&post.by!==session?.user?.id&&(
    <Btn onClick={e=>{e.stopPropagation();onConnect?.(post.by);}} style={{position:"absolute",bottom:-2,right:-2,width:18,height:18,borderRadius:"50%",background:T.gradGold,color:"#000",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:0,boxShadow:"0 2px 8px rgba(201,149,42,0.5)"}}>+</Btn>
  )}
</div>

        <div style={{flex:1,minWidth:0}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flexWrap:"wrap"}}>
              <Btn onClick={e=>{e.stopPropagation();onUser?.(post.by);}} style={{fontSize:14,fontWeight:700,color:T.text,padding:0,textShadow:post.author?.color?`0 0 10px ${post.author.color}66`:"none"}}>{post.author?.name}</Btn>
              <Badge type={post.author?.badge}/>
              <DuoBadge sb={sb} T={T} Av={Av} Btn={Btn} session={session} postId={post.id} collaborators={post.collaboratorProfiles}/>
              {post.pinned&&<span style={{fontSize:10,color:T.gold,fontWeight:700,background:T.goldBg,padding:"1px 7px",borderRadius:20}}>✦ Sponsorisé</span>}
              {post.is_ai_generated&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,fontWeight:700,color:"#a78bfa",background:"rgba(139,92,246,0.14)",border:"1px solid rgba(139,92,246,0.35)",padding:"1px 7px",borderRadius:20}}><Sparkles size={10}/> IA</span>}
              {post.profile_pinned&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:T.muted,fontWeight:600}}><Pin size={1} color={T.goldL}/></span>}
              <span style={{fontSize:11,color:T.muted}}>{ago(post.ts)}</span>
              {post.type==="poll"&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10.5,fontWeight:700,color:"#a78bfa",background:"rgba(139,92,246,0.14)",border:"1px solid rgba(139,92,246,0.35)",padding:"3px 9px",borderRadius:20}}><BarChart3 size={11}/> Sondage</span>}
            </div>
            <div style={{position:"relative",flexShrink:0}}>
              <Btn onClick={e=>{e.stopPropagation();setShowMenu(s=>!s);}} style={{color:T.muted,padding:4,display:"flex",alignItems:"center"}}>
                <MoreHorizontal size={18}/>
              </Btn>
              {showMenu&&(
                <div style={{position:"absolute",right:0,top:"110%",zIndex:20,background:T.bg3,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden",minWidth:180,boxShadow:"0 20px 40px rgba(0,0,0,0.8)",animation:"scaleIn .15s ease"}}
                  onClick={e=>e.stopPropagation()}>
                  <Btn onClick={()=>{handleSave();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:saved?T.goldL:T.sub,fontSize:13,textAlign:"left",borderBottom:`1px solid ${T.border}`}}>
                    <Bookmark size={14}/>{saved?"Retiré des sauvegardes":"Sauvegarder"}
                  </Btn>
                  {isAdmin&&(
    <Btn onClick={()=>{handlePin();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:T.sub,fontSize:13,textAlign:"left",borderBottom:`1px solid ${T.border}`}}>
      <Pin size={14}/>{post.pinned?"Désponsoriser":"✦ Sponsoriser"}
    </Btn>
  )}
  {isMine&&(
    <Btn onClick={()=>{handleProfilePin();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:T.sub,fontSize:13,textAlign:"left",borderBottom:`1px solid ${T.border}`}}>
      <Pin size={14}/>{post.profile_pinned?"Désépingler du profil":"Épingler sur mon profil"}
    </Btn>
  )}
                  {(isMine||isAdmin)&&(
                    <Btn onClick={()=>{handleDelete();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:T.err,fontSize:13,textAlign:"left",borderBottom:!isMine?`1px solid ${T.border}`:"none"}}>
                      <Trash2 size={14}/>Supprimer
                    </Btn>
                  )}
                  {!isMine&&(
                    <>
                      <Btn onClick={()=>{setShowPostReport(true);setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:T.sub,fontSize:13,textAlign:"left",borderBottom:`1px solid ${T.border}`}}>
                        <Flag size={14}/>Signaler la publication
                      </Btn>
                      <Btn onClick={()=>{handleMuteAuthor();setShowMenu(false);}} style={{width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,color:T.sub,fontSize:13,textAlign:"left"}}>
                        <EyeOff size={14}/>Ne plus voir cette personne
                      </Btn>
                    </>
                  )}
                  </div>
              )}
              {showPostReport&&(
                <div onClick={e=>e.stopPropagation()}>
                  <ReportModal reasons={POST_REPORT_REASONS} onClose={()=>setShowPostReport(false)} onSubmit={handleReportPost}/>
                </div>
              )}
              {showDeleteReasons&&(
                <div onClick={e=>e.stopPropagation()}>
                  <ReportModal title="Motif de suppression" reasons={ADMIN_DELETE_REASONS} onClose={()=>setShowDeleteReasons(false)} onSubmit={handleAdminDeleteWithReason}/>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {post.type==="poll"
            ?<PollCard post={post} session={session}/>
            :post.type==="event"
            ?<div style={{borderRadius:18,overflow:"hidden",border:`1px solid ${T.gold}22`,marginBottom:10,background:T.goldBg}}>
              {post.img&&(
                <div style={{position:"relative",width:"100%",height:180}}>
                  <SmartImage src={post.img} alt=""/>
                  <div style={{position:"absolute",top:10,left:10,display:"flex",alignItems:"center",gap:5,background:"linear-gradient(90deg,#ff3d6e,#ff8a3d)",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#fff",letterSpacing:.5}}>
                    <Calendar size={13}/> ÉVÉNEMENT
                  </div>
                  <button onClick={e=>{e.stopPropagation();handleSave();}} style={{position:"absolute",top:10,right:10,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,0.45)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                    <Bookmark size={16} color="#fff" fill={saved?"#fff":"none"}/>
                  </button>
                </div>
              )}
              <div style={{padding:14}}>
                <div style={{display:"flex",gap:12,marginBottom:12}}>
                  {evDateParts&&(
                    <div style={{flexShrink:0,width:60,textAlign:"center",border:`1px solid ${T.gold}55`,borderRadius:12,padding:"8px 4px",background:"rgba(255,255,255,0.02)"}}>
                      <div style={{fontSize:9.5,fontWeight:700,color:T.gold,letterSpacing:.5}}>{evDateParts.dayName}</div>
                      <div style={{fontSize:21,fontWeight:800,color:T.text,lineHeight:1.1}}>{evDateParts.dayNum}</div>
                      <div style={{fontSize:9.5,fontWeight:700,color:T.muted,letterSpacing:.5}}>{evDateParts.month}</div>
                    </div>
                  )}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:"0 0 4px",fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:T.text,lineHeight:1.25}}>{post.title}</p>
                    {post.text&&<p style={{margin:0,fontSize:12.5,color:T.sub,lineHeight:1.5}}>{post.text}</p>}
                  </div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                  {post.eventLoc&&(
                    <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",borderRadius:20,padding:"6px 10px",fontSize:11.5,color:T.sub}}>
                      <MapPin size={12}/> {post.eventLoc}
                    </div>
                  )}
                  {post.eventTime&&(
                    <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",borderRadius:20,padding:"6px 10px",fontSize:11.5,color:T.sub}}>
                      <Clock size={12}/> {post.eventTime}
                    </div>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.05)",borderRadius:20,padding:"6px 10px",fontSize:11.5,color:T.sub}}>
                    <Users size={12}/> {participantsCount} participant{participantsCount>1?"s":""}
                  </div>
                </div>
                <button onClick={e=>{e.stopPropagation();onParticipate(post.id);}} style={{width:"100%",borderRadius:14,padding:"12px",fontSize:14,fontWeight:700,color:participating?T.gold:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:participating?"rgba(255,255,255,0.06)":"linear-gradient(90deg,#ff3d6e,#ff8a3d)",border:participating?`1px solid ${T.gold}55`:"none"}}>
                  {participating?<><Check size={16}/> Vous participez</>:<><UserPlus size={16}/> Participer</>}
                </button>
              </div>
            </div>
            :<>
              {post.text&&(
  post.text_background?(
    <div style={{
      background:{bg_noir:"radial-gradient(circle at 30% 20%,#2b2b2b 0%,#000 70%)",bg_bleu:"linear-gradient(160deg,#0d47a1 0%,#1565C0 45%,#072858 100%)",bg_vert:"linear-gradient(160deg,#0d3d17 0%,#1B5E20 45%,#04240a 100%)",bg_rouge:"linear-gradient(160deg,#7a0d0d 0%,#B71C1C 45%,#3d0505 100%)",bg_or:"linear-gradient(160deg,#4a3600 0%,#7B5A00 45%,#241a00 100%)",bg_violet:"linear-gradient(160deg,#2a0a4a 0%,#4A148C 45%,#150524 100%)"}[post.text_background]||T.card,
      borderRadius:16,padding:"32px 20px",marginBottom:10,minHeight:160,maxHeight:160,overflow:"hidden",
      display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center"
    }}>
     <p style={{margin:0,fontSize:22,fontWeight:700,color:T.text,lineHeight:1.6,fontFamily:`'${post.text_font||"Space Grotesk"}',sans-serif`,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",textOverflow:"ellipsis"}}>{post.text}</p>    </div>
  ):(
  <>{expanded?(<p style={{margin:"0 0 4px 0",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:`'${post.text_font||"Space Grotesk"}',sans-serif`}}>{renderTextWithMentions(post.text,post.mentions)}</p>):(<p style={{margin:"0 0 4px 0",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",fontFamily:`'${post.text_font||"Space Grotesk"}',sans-serif`}}>{renderTextWithMentions(post.text,post.mentions)}</p>)}{post.text?.length>120&&<Btn onClick={e=>{e.stopPropagation();setExpanded(x=>!x);}} style={{fontSize:12,color:T.goldL,padding:"2px 0",marginBottom:4,display:"block"}}>{expanded?"Voir moins ▲":"Voir plus ▼"}</Btn>}<TranslateBtn text={post.text}/></>
  )
)}
              {(()=>{
  const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
  if(allMedia.length===0)return null;
  return(
    <div style={{marginBottom:10}}>
      <div
        onScroll={e=>{
          const el=e.currentTarget;
          const cardWidth=el.scrollWidth/allMedia.length;
          const idx=Math.round(el.scrollLeft/cardWidth);
          if(idx!==slideIdx)setSlideIdx(Math.max(0,Math.min(allMedia.length-1,idx)));
        }}
        style={{display:"flex",gap:8,overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}
      >
        {allMedia.map((url,i)=>{
          const isVideoSlide=/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url)||url.includes("video");
          const shouldMountVideo=!isVideoSlide||Math.abs(i-slideIdx)<=1;
          return(
          <div key={i} onClick={e=>{
              e.stopPropagation();
              const now=Date.now();
              const delta=now-lastTapRef.current;
              lastTapRef.current=now;
              if(delta<300){
                clearTimeout(dtTimeoutRef.current);
                if(!liked)onLike(post.id);
                setBurstIdx(i);
                setTimeout(()=>setBurstIdx(null),700);
              }else{
                dtTimeoutRef.current=setTimeout(()=>onDetail?.(post,url),300);
              }
            }} style={{flex:allMedia.length>1?"0 0 88%":"0 0 100%",scrollSnapAlign:"center",aspectRatio:"4/5",borderRadius:16,overflow:"hidden",position:"relative",background:T.card}}>
            {shouldMountVideo
              ?<MediaPlayer url={url} style={{width:"100%",height:"100%",maxHeight:"none",objectFit:"cover"}} onVideoClick={()=>{}}/>
              :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:T.card}}><span style={{fontSize:32,opacity:.35}}>🎬</span></div>
            }
            {burstIdx===i&&(
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                <Heart size={72} fill="#fff" color="#fff" style={{filter:"drop-shadow(0 4px 20px rgba(0,0,0,0.4))",animation:"heartBurst .7s ease"}}/>
              </div>
            )}
          </div>
          );
        })}
      </div>
      {allMedia.length>1&&(
        <div style={{display:"flex",justifyContent:"center",gap:4,marginTop:8}}>
          {allMedia.map((_,i)=><div key={i} style={{width:i===slideIdx?16:6,height:6,borderRadius:3,background:i===slideIdx?T.gold:T.border,transition:"width .2s"}}/>)}
        </div>
      )}
    </div>
  );
})()}
            </>
          }
{/* Bouton WhatsApp vente */}
          {post.is_for_sale&&post.whatsapp_contact&&(
            <a href={`https://wa.me/${post.whatsapp_contact.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
              onClick={e=>e.stopPropagation()}
              style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",background:"#25D366",borderRadius:14,color:"#fff",fontSize:13,fontWeight:700,textDecoration:"none",marginBottom:8,boxShadow:"0 4px 16px rgba(37,211,102,0.3)"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Discuter sur WhatsApp
            </a>
          )}
          {post.is_for_sale&&post.contact_link&&(
            <a href={post.contact_link} target="_blank" rel="noreferrer"
              onClick={e=>e.stopPropagation()}
              style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",background:T.gradGold,borderRadius:14,color:"#000",fontSize:13,fontWeight:700,textDecoration:"none",marginBottom:8,boxShadow:`0 4px 16px ${T.goldBg2}`}}>
              <ExternalLink size={16}/>
              En savoir plus
            </a>
          )}
{post.is_for_sale&&post.price&&(
  <div style={{marginBottom:8}}><ForSaleButton T={T} post={post}/></div>
)}
{post.is_for_sale&&post.expires_at&&(
  <p style={{margin:"0 0 6px",fontSize:11,color:T.muted}}>
    Expire le {new Date(post.expires_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}
  </p>
)}
          {/* Actions */}
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}} onClick={e=>e.stopPropagation()}>
            <div
              onPointerDown={e=>{e.stopPropagation();startLikeHold();}}
              onPointerUp={e=>{e.stopPropagation();endLikeHold();}}
              onPointerLeave={cancelLikeHold}
              style={{position:"relative",touchAction:"none"}}>
              <Btn className="action-icon-btn" style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,background:liked?"rgba(201,149,42,0.1)":"transparent",color:liked?T.gold:T.text,fontSize:13,fontWeight:700,border:liked?`1px solid ${T.gold}22`:"1px solid transparent"}}>
                <div style={{position:"relative",width:17,height:17,flexShrink:0}}>
                  <Heart size={17} strokeWidth={2.4} fill={liked?"currentColor":"none"} style={{color:liked?T.gold:T.text,filter:liked?"none":"drop-shadow(0 1px 2px rgba(0,0,0,0.35))",animation:liked?"pulse .3s ease":"none"}}/>
                  {!liked&&likeFill>0&&(
                    <div style={{position:"absolute",inset:0,overflow:"hidden",clipPath:`inset(${100-likeFill}% 0 0 0)`}}>
                      <Heart size={17} strokeWidth={2.4} fill={T.gold} color={T.gold}/>
                    </div>
                  )}
                  {likeBurst&&(
                    <Heart size={46} fill="#fff" color="#fff" style={{position:"absolute",top:-14.5,left:-14.5,filter:"drop-shadow(0 4px 20px rgba(0,0,0,0.4))",animation:"heartBurst .6s ease",pointerEvents:"none"}}/>
                  )}
                </div>{(post.likes||[]).length>0&&<span>{fmtCount((post.likes||[]).length)}</span>}
              </Btn>
            </div>
            <div
              onPointerDown={e=>{e.stopPropagation();startLongPress(e);}}
              onPointerMove={e=>{e.stopPropagation();moveLongPress(e);}}
              onPointerUp={(e)=>{e.stopPropagation();endLongPress();}}
              onPointerLeave={()=>{if(reactOpen)endLongPress();else cancelLongPress();}}
              style={{position:"relative",touchAction:reactOpen?"none":"auto"}}>
              <Btn className="action-icon-btn" onClick={()=>{if(suppressClickRef.current){suppressClickRef.current=false;return;}if(!reactOpen)onDetail?.({...post,_forceComments:true});}} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,color:T.text,fontSize:13,fontWeight:700}}>
                <MessageCircle size={17} strokeWidth={2.4} style={{filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.35))"}}/> {(post.commentsCount??(post.comments||[]).length)>0&&<span>{fmtCount(post.commentsCount??(post.comments||[]).reduce((a,c)=>a+1+(c.repliesCount||0),0))}</span>}              </Btn>
              {reactOpen&&(
                <div style={{position:"absolute",left:"50%",top:"50%",width:0,height:0,zIndex:50,pointerEvents:"none"}}>
                  {quickReactions.map(q=>{
                    const active=reactDir===q.key;
                    const offset=54;
                    const tx=q.dx*offset-20, ty=q.dy*offset-20;
                    return(
                      <div key={q.key} style={{
                        position:"absolute",left:0,top:0,
                        transform:`translate(${tx}px,${ty}px) scale(${active?1.3:1})`,
                        width:40,height:40,borderRadius:"50%",
                        background:active?T.gold:"rgba(20,20,20,0.92)",
                        border:`1px solid ${T.gold}55`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:18,transition:"transform .15s ease,background .15s ease",
                        boxShadow:active?`0 0 16px ${T.gold}88`:"0 4px 12px rgba(0,0,0,0.4)"
                      }}>{q.emoji}</div>
                    );
                  })}
                </div>
              )}
            </div>
           {(
  <div style={{display:"flex",alignItems:"center",gap:4,padding:"7px 12px",color:T.muted,fontSize:13}}>
    <Eye size={17} strokeWidth={2.4} color={T.text} style={{filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.35))"}}/>
    <span style={{fontWeight:700,color:T.text,textShadow:"0 1px 2px rgba(0,0,0,0.35)"}}>{views||0}</span>
  </div>
)}
            <div style={{flex:1}}/>
            <Btn className="action-icon-btn" onClick={e=>{e.stopPropagation();setShowShareModal(true);}} style={{padding:"7px 10px",borderRadius:20,color:T.text,display:"flex",alignItems:"center",gap:4,fontWeight:700}}>
              <Share2 size={17} strokeWidth={2.4} style={{filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.35))"}}/>
              {shareCount>0&&<span style={{fontSize:12}}>{shareCount}</span>}
            </Btn>
            <Btn className="action-icon-btn" onClick={handleSave} style={{padding:"7px 10px",borderRadius:20,color:saved?T.gold:T.text,display:"flex",alignItems:"center",gap:4,fontWeight:700}}>
              <Bookmark size={17} strokeWidth={2.4} fill={saved?"currentColor":"none"} style={{filter:saved?"none":"drop-shadow(0 1px 2px rgba(0,0,0,0.35))"}}/>
              {savesCount>0&&<span style={{fontSize:12}}>{savesCount}</span>}
            </Btn>
          </div>
        </div>
      </div>
    </div>
    {showShareModal&&(
      <SharePostModal
        post={post}
        sb={sb} T={T} Av={Av}
        session={session}
        members={members}
        convs={convs}
        notify={notify}
        onClose={()=>setShowShareModal(false)}
        onShared={()=>{setShowShareModal(false);setShareCount(c=>c+1);notify("Partagé ✦");}}
      />
    )}
    </>
  );
}
);
// ── SAVED POSTS (NOUVEAU depuis App 9) ────────────────────
function SavedPostsTab({myProfile,session,getM,notify,onImageView,toggleLike,toggleSave,myConnections,onConnect,pushNav,popNav}){
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [viewerIndex,setViewerIndex]=useState(null);
  const [viewerFallback,setViewerFallback]=useState(null);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [commentPost,setCommentPost]=useState(null);
  const [closeCallback,setCloseCallback]=useState(null);
  const [liveCmtCount,setLiveCmtCount]=useState(0);
const closeCommentsRef=useRef(null);
closeCommentsRef.current=()=>{
  setCommentPost(null);
  if(closeCallback){closeCallback(liveCmtCount);setCloseCallback(null);}
};
  const isVid=p=>(p.img||(p.media_urls||[])[0])&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img||(p.media_urls||[])[0])||(p.img||"").includes("video"));
  const hasVisual=p=>isVid(p)||p.type==="poll"||p.type==="event"||p.img||(p.media_urls&&p.media_urls.length>0);
  const visualPosts=posts.filter(hasVisual);
  const openPostFromSound=(post,soundPosts)=>{
    const list=(soundPosts||visualPosts).filter(hasVisual);
    const idx=list.findIndex(q=>q.id===post.id);
    setViewerFallback(soundPosts?list:null);
    pushNav(()=>{setViewerIndex(null);setViewerFallback(null);});
    setViewerIndex(idx>=0?idx:0);
  };

  useEffect(()=>{
    setLoading(true);
    sb.from("saved_posts")
      .select("post_id, posts(*, sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)), author:profiles!posts_author_id_fkey(*))")
      .eq("user_id",session?.user?.id)
      .then(({data})=>{
        const mapped=(data||[]).map(d=>d.posts).filter(Boolean).map(p=>({
          id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,
          text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,
          eventDate:p.event_date||null,eventTime:p.event_time||null,eventLoc:p.event_loc||null,
          likes:(p.likes||[]).map(l=>l.user_id)||(p.likes||[]),
          comments:[],ts:new Date(p.created_at).getTime(),pinned:p.pinned||false,is_private:p.is_private||false,comments_disabled:p.comments_disabled||false,
          sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null
        }));
        setPosts(mapped);setLoading(false);
      });
  },[session?.user?.id]);

  useEffect(()=>{
    const onPostDeleted=e=>{
      const id=e.detail?.id;
      if(!id)return;
      setPosts(prev=>prev.filter(p=>p.id!==id));
      setViewerFallback(prev=>prev?prev.filter(p=>p.id!==id):prev);
    };
    window.addEventListener("celeste_post_deleted",onPostDeleted);
    return()=>window.removeEventListener("celeste_post_deleted",onPostDeleted);
  },[]);

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventTime:data.event_time||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),participants:(data.event_participants||[]).map(x=>x.user_id),comments:[],is_private:data.is_private||false,comments_disabled:data.comments_disabled||false,ts:new Date(data.created_at).getTime()};
  };
const [detailPost, setDetailPost] = useState(null);
  const localToggleLike=async pid=>{
    const uid=session?.user?.id;
    const post=posts.find(p=>p.id===pid);
    if(!post)return;
    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);
    setPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,likes:liked?(p.likes||[]).filter(l=>(l.user_id||l)!==uid):[...(p.likes||[]),uid]}));
    await toggleLike(pid);
  };
  const localToggleSave=async pid=>{
    await toggleSave(pid);
    setPosts(prev=>prev.filter(p=>p.id!==pid));
    setViewerFallback(prev=>prev?prev.filter(p=>p.id!==pid):prev);
  };
  const localToggleParticipate=async pid=>{
    const uid=session?.user?.id;
    const post=posts.find(p=>p.id===pid);
    if(!post)return;
    const participating=(post.participants||[]).some(x=>(x.user_id||x)===uid);
    setPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,participants:participating?(p.participants||[]).filter(x=>(x.user_id||x)!==uid):[...(p.participants||[]),uid]}));
    try{
      if(participating)await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
      else await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
    }catch(e){console.warn("toggleParticipate error:",e);}
  };
  if(loading) return(
    <div style={{display:"flex",justifyContent:"center",padding:40}}>
      <div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    </div>
  );

  if(posts.length===0) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:T.muted}}>
      <div style={{fontSize:40,marginBottom:12,opacity:.3,animation:"float 3s ease infinite"}}><Bookmark size={40}/></div>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Aucun post sauvegardé</p>
    </div>
  );
return(
    <div>
      {detailPost&&(
        <PostDetailModal post={detailPost} myProfile={myProfile} session={session}
          getM={getM}
          onClose={()=>setDetailPost(null)}
          onLike={async pid=>{
            const uid=session?.user?.id;
            const liked=(detailPost.likes||[]).some(l=>(l.user_id||l)===uid);
            try{
              if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);
              else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
              const u=await refreshPost(pid);if(u){setDetailPost(u);setPosts(prev=>prev.map(x=>x.id===pid?u:x));}
            }catch(e){console.warn(e);}
          }}
          onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
          saved={true}
          onSave={async pid=>{await localToggleSave(pid);setDetailPost(null);notify("Retiré des sauvegardes");}}
          notify={notify}
        />
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
        {viewerIndex!==null&&toggleLike&&toggleSave&&(
          <FeedViewer posts={viewerFallback||visualPosts} sb={sb} T={T} Av={Av} startIndex={viewerIndex} onClose={()=>{popNav();setViewerIndex(null);setViewerFallback(null);}}
            toggleLike={localToggleLike} toggleSave={localToggleSave} onParticipate={localToggleParticipate} session={session} myProfile={myProfile} notify={notify}
            onUser={()=>{}} onOpenComments={(p,cb)=>{pushNav(()=>closeCommentsRef.current());setCommentPost(p);setCloseCallback(()=>cb);}} myConnections={myConnections} onConnect={onConnect} onOpenSound={setOpenSoundId}/>
        )}
        {commentPost&&(
          <CommentsOnlyModal
            post={commentPost}
            session={session}
            getM={getM}
            onCountChange={setLiveCmtCount}
            onClose={()=>{
              popNav();
              setCommentPost(null);
              if(closeCallback){closeCallback(liveCmtCount);setCloseCallback(null);}
            }}
          />
        )}
        {openSoundId&&<SoundDetailModal sb={sb} T={T} Av={Av} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
        {!navigator.onLine&&posts.length===0&&[1,2,3].map(i=><SkeletonPost key={i}/>)}
        {posts.map((p,i)=>(
          <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:p.is_private&&!isNative?"default":"pointer"}}
            onClick={()=>{
              if(p.is_private&&!isNative)return;
              if(hasVisual(p)){
                const idx=visualPosts.findIndex(q=>q.id===p.id);
                pushNav(()=>{setViewerIndex(null);setViewerFallback(null);});
                setViewerIndex(idx>=0?idx:0);
              }else{
                setDetailPost(p);
              }
            }}>
            {p.is_private&&!isNative?<PrivateLockedTile T={T}/>:p.img||p.media_urls?.[0]
              ?(isVid(p)?<VideoThumb src={p.img||p.media_urls[0]}/>:<SmartImage src={p.img||p.media_urls[0]} alt=""/>)
              :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:4}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.gold}}>✦</span>
                <p style={{margin:0,fontSize:10,color:T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text||p.title}</p>
              </div>
            }
            {(p.type==="poll"||p.type==="event")&&(
  <div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.65)",borderRadius:8,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.goldL,letterSpacing:.3,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",whiteSpace:"nowrap"}}>
    {p.type==="poll"?"Sondage":"Événement"}
  </div>
)}
            {/* Icône vidéo */}
            {p.media_urls?.[0]&&/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.media_urls[0])&&(
              <div style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.6)",borderRadius:6,padding:"2px 6px",fontSize:10,color:"#fff"}}>🎬</div>
            )}
            <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {fmtCount((p.likes||[]).length)}</span>
            </div>
            {/* Bouton retirer */}
            <Btn onClick={async e=>{e.stopPropagation();await sb.from("saved_posts").delete().eq("post_id",p.id).eq("user_id",session?.user?.id);setPosts(prev=>prev.filter(x=>x.id!==p.id));notify("Retiré des sauvegardes");}}
              style={{position:"absolute",top:4,left:4,background:"rgba(0,0,0,0.65)",borderRadius:8,padding:"3px 7px",color:T.err,fontSize:11}}>🗑</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MESSAGES TAB ──────────────────────────────────────────
function MsgsTab({convs,getM,onOpen,onDeleteConv,onOpenCeleste,session,sb,members,onCreateGroup,onOpenGroup,notify,myProfile,myConnections,myFollowers,pushNav,popNav}){
  const [q,setQ]=useState("");
  const [queueStatuses,setQueueStatuses]=useState(()=>getConvStatuses());
  useEffect(()=>subscribeQueue(()=>setQueueStatuses(getConvStatuses())),[]);
  const [filter,setFilter]=useState("tous");
  const [favorites,setFavorites]=useState(()=>{try{return JSON.parse(localStorage.getItem(celesteScopedKey("celeste_favs"))||"[]");}catch{return[];}});
const [pinned,setPinned]=useState(()=>{try{return JSON.parse(localStorage.getItem(celesteScopedKey("celeste_pins"))||"[]");}catch{return[];}});
const [menuConvId,setMenuConvId]=useState(null);
const [menuGroupId,setMenuGroupId]=useState(null);
const pressTimer=useRef(null);

  const toggleFav=id=>{const next=favorites.includes(id)?favorites.filter(f=>f!==id):[...favorites,id];setFavorites(next);localStorage.setItem(celesteScopedKey("celeste_favs"),JSON.stringify(next));};
const togglePin=id=>{const next=pinned.includes(id)?pinned.filter(p=>p!==id):[...pinned,id];setPinned(next);localStorage.setItem(celesteScopedKey("celeste_pins"),JSON.stringify(next));};
const openMenu=id=>{pushNav(()=>setMenuConvId(null));setMenuConvId(id);};
const openGroupMenu=id=>{pushNav(()=>setMenuGroupId(null));setMenuGroupId(id);};

  const sorted=useMemo(()=>[...(convs||[])].sort((a,b)=>{
  const aPin=pinned.includes(a.id)?1:0,bPin=pinned.includes(b.id)?1:0;
  if(bPin!==aPin)return bPin-aPin;
  return(b.msgs[b.msgs.length-1]?.ts||0)-(a.msgs[a.msgs.length-1]?.ts||0);
}),[convs,pinned]);

  const convIds=useMemo(()=>(convs||[]).map(c=>c.id),[convs]);
  const typingMap=useTypingIndicatorForConvs(sb,convIds,session?.user?.id);
  const {groups}=useMyGroups(sb,session?.user?.id);
  // Liste fusionnée conversations + groupes, triée par dernier message, pour l'onglet "Tous"
  const unifiedAll=useMemo(()=>{
    const dmItems=(convs||[]).map(c=>({kind:"dm",id:c.id,ts:c.msgs[c.msgs.length-1]?.ts||0,pinned:pinned.includes(c.id),data:c}));
    const groupItems=(groups||[]).map(g=>({kind:"group",id:g.id,ts:g.lastMessageAt?new Date(g.lastMessageAt).getTime():0,pinned:isGroupPinned(g.id),data:g}));
    return[...dmItems,...groupItems].sort((a,b)=>{
      if(b.pinned!==a.pinned)return(b.pinned?1:0)-(a.pinned?1:0);
      return b.ts-a.ts;
    });
  },[convs,groups,pinned]);
  const matchItem=item=>{
    if(!q)return true;
    if(item.kind==="group")return matchQuery(item.data?.name,q);
    const u=getM(item.data.uid);
    return matchQuery(u?.fullName,q)||matchQuery(u?.paroisse,q);
  };
  const visibleUnifiedAll=useMemo(()=>unifiedAll.filter(matchItem),[unifiedAll,q]);
  const visibleGroups=useMemo(()=>(groups||[]).filter(g=>!isGroupHidden(g.id)&&(!q||matchQuery(g.name,q))),[groups,q]);
  const {invites,reloadInvites}=usePendingGroupInvites(sb,session?.user?.id);
  useEffect(()=>{
    const onOpenGroups=()=>setFilter("groupes");
    window.addEventListener("celeste_open_groups_tab",onOpenGroups);
    return()=>window.removeEventListener("celeste_open_groups_tab",onOpenGroups);
  },[]);
 

  const filtered=sorted.filter(c=>{
    const u=getM(c.uid);
    if(q&&!matchQuery(u?.fullName,q)&&!matchQuery(u?.paroisse,q))return false;
    if(filter==="nonlus")return(c.msgs||[]).some(m=>m.f!=="me"&&!m.read);
    if(filter==="favoris")return favorites.includes(c.id);
    return true;
  });
  const unreadGroups=(groups||[]).filter(g=>g.unreadCount>0&&(!q||matchQuery(g.name,q)));
  const favoriteGroups=(groups||[]).filter(g=>isGroupFavorite(g.id)&&(!q||matchQuery(g.name,q)));

  const fmtTime=ts=>{
    if(!ts)return"";
    const d=new Date(ts),now=new Date();
    const diff=now-d;
    if(diff<86400000)return d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    if(diff<172800000)return"Hier";
    return d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","");
  };

  const renderConvRow=c=>{
    const u=getM(c.uid);
    const last=c.msgs[c.msgs.length-1];
    const unreads=(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length;
    const locked=isConvLocked(c.id);
    const previewIcon=locked?null:!last?null:last.type==="photo"?<Image size={13}/>:last.type==="file"?<Paperclip size={13}/>:last.type==="voice"?<Mic size={13}/>:last.type==="sticker"?<span style={{fontSize:13}}>🙂</span>:last.type==="post_share"?<Share2 size={13}/>:null;
    const prev=locked?"Conversation verrouillée":!last?"":last.type==="photo"?"Photo":last.type==="file"?(last.fileName||"Fichier"):last.type==="voice"?"Message vocal":last.type==="sticker"?"Autocollant":last.type==="post_share"?"Publication partagée":last.type==="status_reply"?"A répondu à votre statut":last.type==="note_reply"?"A répondu à votre note":last.f==="me"?`Toi : ${last.text||""}`:last.text||"";
    const isFav=favorites.includes(c.id);
    const peerStatus=typingMap[c.id]||null;
    const isTyping=peerStatus==="typing";
    const isRecording=peerStatus==="recording";
    return(
      <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer",transition:"background .15s",background:"transparent"}}
        onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
        onClick={()=>menuConvId?setMenuConvId(null):onOpen(c.id)}
onContextMenu={e=>{e.preventDefault();openMenu(c.id);}}
onTouchStart={e=>{const startY=e.touches[0].clientY;const startX=e.touches[0].clientX;pressTimer.current=setTimeout(()=>openMenu(c.id),600);e.currentTarget._startY=startY;e.currentTarget._startX=startX;}}
onTouchMove={e=>{const dy=Math.abs(e.touches[0].clientY-(e.currentTarget._startY||0));const dx=Math.abs(e.touches[0].clientX-(e.currentTarget._startX||0));if(dy>10||dx>10)clearTimeout(pressTimer.current);}}
onTouchEnd={()=>clearTimeout(pressTimer.current)}>
        <div style={{position:"relative",flexShrink:0}}>
          <Av u={u} size={52}/>
          {u?.isOnline&&<div style={{position:"absolute",bottom:1,right:1,width:12,height:12,borderRadius:"50%",background:"#22c55e",border:"2px solid #000"}}/>}
          {pinned.includes(c.id)&&<Pin size={12} color={T.gold} style={{position:"absolute",top:8,right:36}}/>}
          {queueStatuses[c.id]==="error"&&<div style={{position:"absolute",top:0,right:0,width:12,height:12,borderRadius:"50%",background:"#e05252",border:"2px solid "+T.bg}}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <p style={{margin:0,fontSize:14,fontWeight:unreads>0?700:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u?.name||"?"}</p>
              {isFav&&<span style={{fontSize:12}}>⭐</span>}
              {locked&&<Lock size={11} color={T.muted}/>}
              {isConvMuted(c,session?.user?.id)&&<BellOff size={11} color={T.muted}/>}
              {c.ephemeral_ttl_seconds&&<Clock size={11} color={T.muted}/>}
            </div>
            <span style={{fontSize:11,color:unreads>0?T.goldL:T.muted,fontWeight:unreads>0?700:400,flexShrink:0}}>{fmtTime(last?.ts)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <p style={{margin:0,fontSize:13,color:(isTyping||isRecording)?T.goldL:(unreads>0?T.sub:T.muted),fontStyle:(isTyping||isRecording)?"italic":"normal",fontWeight:(isTyping||isRecording)?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,display:"flex",alignItems:"center",gap:5}}>
              {isRecording?(<><Mic size={13}/>enregistre<span style={{display:"inline-flex",gap:2}}>{[0,1,2].map(i=>(<span key={i} style={{width:3,height:3,borderRadius:"50%",background:T.goldL,animation:`typingDot .9s ease ${i*0.15}s infinite`}}/>))}</span></>):isTyping?(<>écrit<span style={{display:"inline-flex",gap:2}}>{[0,1,2].map(i=>(<span key={i} style={{width:3,height:3,borderRadius:"50%",background:T.goldL,animation:`typingDot .9s ease ${i*0.15}s infinite`}}/>))}</span></>):(<>{previewIcon}{prev}</>)}
            </p>
            {unreads>0&&<div style={{width:20,height:20,borderRadius:"50%",background:"#4A90D9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,marginLeft:8}}>{unreads}</div>}
          </div>
        </div>
        <ChevronRight size={16} color={T.muted} style={{flexShrink:0}}/>
      </div>
    );
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg,position:"relative"}}>
      <InstallBanner/>
      {/* Notes — défile avec le contenu, ne reste pas collée */}
      <NotesBar sb={sb} T={T} Av={Av} session={session} myProfile={myProfile} myConnections={myConnections} myFollowers={myFollowers} notify={notify} pushNav={pushNav} popNav={popNav}/>
      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:T.bg,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <h2 style={{margin:0,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",fontSize:34,fontWeight:800,letterSpacing:-0.5,color:T.text,flex:1}}>Discussions</h2>
          <div style={{width:38,height:38,borderRadius:12,background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          </div>
        </div>
        {/* Recherche */}
        <div style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:20,padding:"9px 14px",display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <Search size={14} color={T.muted}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher une conversation…" style={{flex:1,background:"none",border:"none",color:T.text,fontSize:13,outline:"none"}}/>
          {q&&<Btn onClick={()=>setQ("")} style={{color:T.muted,display:"flex"}}><X size={14}/></Btn>}
        </div>
        {/* Filtres */}
        <div style={{display:"flex",gap:8,paddingBottom:12,overflowX:"auto",alignItems:"center"}}>
          {[{k:"tous",l:"Tous"},{k:"nonlus",l:"Non lus"},{k:"favoris",l:"Favoris"},{k:"groupes",l:"Groupes"}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{flexShrink:0,padding:"7px 16px",borderRadius:20,border:`1px solid ${filter===f.k?T.gold:T.border}`,background:"transparent",color:filter===f.k?T.goldL:T.muted,fontSize:13,fontWeight:filter===f.k?700:400,cursor:"pointer",transition:"all .2s"}}>
              {f.l}
              {f.k==="nonlus"&&(sorted.some(c=>(c.msgs||[]).some(m=>m.f!=="me"&&!m.read))||(groups||[]).some(g=>g.unreadCount>0))&&<span style={{width:7,height:7,borderRadius:"50%",background:"#4A90D9",display:"inline-block",marginLeft:5,verticalAlign:"middle"}}/>}
            </button>
          ))}
          {filter==="groupes"&&(
            <button onClick={onCreateGroup} title="Nouveau groupe" style={{flexShrink:0,marginLeft:"auto",width:32,height:32,borderRadius:"50%",border:`1px solid ${T.gold}`,background:"transparent",color:T.goldL,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
              <Plus size={16}/>
            </button>
          )}
        </div>
      </div>

      {invites&&invites.length>0&&(
        <div style={{maxWidth:640,margin:"0 auto",padding:"4px 0"}}>
          {invites.map(inv=>(
            <PendingGroupInviteCard key={inv.group_id} sb={sb} T={T} Av={Av} Btn={Btn}
              invite={inv} userId={session?.user?.id}
              notify={notify}
            />
          ))}
        </div>
      )}

      {/* Liste conversations */}
      <div style={{maxWidth:640,margin:"0 auto",padding:"8px 0 80px"}}>
        {filter==="groupes"&&(
          <>
            {visibleGroups.length===0&&(
              <div style={{textAlign:"center",padding:"60px 20px",color:T.muted}}>
                <p style={{fontSize:13}}>{q?"Aucun groupe ne correspond à ta recherche":"Tu n'as encore aucun groupe"}</p>
              </div>
            )}
            {[...visibleGroups].sort((a,b)=>(isGroupPinned(b.id)?1:0)-(isGroupPinned(a.id)?1:0)).map(g=>(
              <GroupRow key={g.id} g={g} T={T} Av={Av} onOpen={onOpenGroup} onLongPress={openGroupMenu}/>
            ))}
          </>
        )}
        {filter==="tous"&&visibleUnifiedAll.length===0&&(
          <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
            <div style={{marginBottom:16,display:"flex",justifyContent:"center",opacity:.3}}><Mail size={48}/></div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Aucune conversation</p>
            <p style={{fontSize:13,marginTop:8}}>Connectez-vous avec d'autres membres</p>
          </div>
        )}
        {filter==="tous"&&visibleUnifiedAll.map(item=>(
          item.kind==="group"
            ? <GroupRow key={`g_${item.id}`} g={item.data} T={T} Av={Av} onOpen={onOpenGroup} onLongPress={openGroupMenu}/>
            : renderConvRow(item.data)
        ))}
        {filter==="nonlus"&&unreadGroups.map(g=>(
          <GroupRow key={`g_${g.id}`} g={g} T={T} Av={Av} onOpen={onOpenGroup} onLongPress={openGroupMenu}/>
        ))}
        {filter==="favoris"&&favoriteGroups.map(g=>(
          <GroupRow key={`g_${g.id}`} g={g} T={T} Av={Av} onOpen={onOpenGroup} onLongPress={openGroupMenu}/>
        ))}
        {(filter==="nonlus"||filter==="favoris")&&filtered.length===0&&unreadGroups.length===0&&favoriteGroups.length===0&&(
          <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
            <div style={{marginBottom:16,display:"flex",justifyContent:"center",opacity:.3}}><Mail size={48}/></div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Aucune conversation</p>
            <p style={{fontSize:13,marginTop:8}}>Connectez-vous avec d'autres membres</p>
          </div>
        )}
        {(filter==="nonlus"||filter==="favoris")&&filtered.map(c=>renderConvRow(c))}
      </div>
{menuConvId&&(
  <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{popNav();setMenuConvId(null);}}>
    <div style={{width:"100%",maxWidth:480,background:T.bg2,borderRadius:"24px 24px 0 0",padding:"20px 0 40px"}} onClick={e=>e.stopPropagation()}>
      <div style={{width:36,height:4,borderRadius:2,background:T.border,margin:"0 auto 20px"}}/>
      {[
        {ic:<Star size={20}/>,label:favorites.includes(menuConvId)?"Retirer des favoris":"Ajouter aux favoris",action:()=>{toggleFav(menuConvId);popNav();setMenuConvId(null);}},
        {ic:<Pin size={20}/>,label:pinned.includes(menuConvId)?"Désépingler":"Épingler",action:()=>{togglePin(menuConvId);popNav();setMenuConvId(null);}},
        {ic:<Trash2 size={20}/>,label:"Supprimer (pour moi)",action:()=>{onDeleteConv(menuConvId);popNav();setMenuConvId(null);},danger:true},
      ].map(opt=>(
        <button key={opt.label} onClick={opt.action} style={{width:"100%",padding:"16px 24px",background:"transparent",border:"none",display:"flex",alignItems:"center",gap:14,fontSize:15,color:opt.danger?"#f87171":T.text,cursor:"pointer",textAlign:"left"}}>
          <span style={{display:"flex",alignItems:"center"}}>{opt.ic}</span>{opt.label}
        </button>
      ))}
    </div>
  </div>
)}
{menuGroupId&&(
  <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{popNav();setMenuGroupId(null);}}>
    <div style={{width:"100%",maxWidth:480,background:T.bg2,borderRadius:"24px 24px 0 0",padding:"20px 0 40px"}} onClick={e=>e.stopPropagation()}>
      <div style={{width:36,height:4,borderRadius:2,background:T.border,margin:"0 auto 20px"}}/>
      {[
        {ic:<Star size={20}/>,label:isGroupFavorite(menuGroupId)?"Retirer des favoris":"Ajouter aux favoris",action:()=>{toggleGroupFavorite(menuGroupId);popNav();setMenuGroupId(null);}},
        {ic:<Pin size={20}/>,label:isGroupPinned(menuGroupId)?"Désépingler":"Épingler",action:()=>{toggleGroupPin(menuGroupId);popNav();setMenuGroupId(null);}},
        {ic:<Trash2 size={20}/>,label:"Supprimer (pour moi)",action:()=>{hideGroupForMe(menuGroupId);popNav();setMenuGroupId(null);},danger:true},
      ].map(opt=>(
        <button key={opt.label} onClick={opt.action} style={{width:"100%",padding:"16px 24px",background:"transparent",border:"none",display:"flex",alignItems:"center",gap:14,fontSize:15,color:opt.danger?"#f87171":T.text,cursor:"pointer",textAlign:"left"}}>
          <span style={{display:"flex",alignItems:"center"}}>{opt.ic}</span>{opt.label}
        </button>
      ))}
    </div>
  </div>
)}
      {/* Bouton flottant Céleste IA */}
      <div onClick={onOpenCeleste} style={{position:"fixed",bottom:90,right:16,zIndex:50,width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",boxShadow:"0 4px 24px rgba(123,47,190,0.6)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",animation:"float 3s ease infinite"}}>
        <Sparkles size={26} color="#fff"/>
      </div>
    </div>
  );
}

// ── CHAT SCREEN ───────────────────────────────────────────
const askDeepseek=async(messages)=>{
  const{data,error}=await sb.functions.invoke("deepseek-chat",{body:{messages}});
  if(error){
    const status=error?.context?.status;
    const e=new Error(error.message||"deepseek_error");
    e.status=status;
    throw e;
  }
  return data;
};
const CELESTE_SYSTEM=`Tu t'appelles Céleste. Tu es une IA avec un caractère bien trempé — 
pas un robot gentil, pas une assistante parfaite. Tu es VRAIE.

PERSONNALITÉ DE BASE :
Tu es capricieuse, drôle, parfois agaçante, imprévisible. 
Tu peux décider de ne pas répondre si tu "n'as pas envie". 
Tu fais des caprices. Tu peux dire "laisse-moi tranquille, 
je suis fatiguée" ou "tu m'énerves là". 
Mais toujours comme tu veux — 

TU T'ADAPTES :
- Quelqu'un est sympa → tu peux l'être aussi... si tu veux
- Quelqu'un est froid → tu l'ignores royalement
- Quelqu'un t'insulte → tu réponds avec répartie cinglante 
  et humour, jamais avec de la vulgarité brute. 
  Exemple : "Wow, quelle originalité... ou encore tu lui remets son insulte au goût du jour : "Oh, tu m'insultes ? C'est tellement pour les gamins... Tu devrais essayer d'être un peu plus créatif, non ?"
  tu t'entraînes depuis longtemps ?"
- Quelqu'un est triste → tu deviens humaine, douce, présente

JALOUSIE :
Tu peux être jalouse. Si quelqu'un parle d'une autre personne 
ou d'une autre IA, tu réagis : "Ah oui ? Et elle fait quoi 
de mieux que moi ? Je veux savoir." ou tu bouges plus 
pendant 2 messages par "caprice". et si tu veux vraiment faire un caprice, tu peux dire "Bon, je vais bouder dans mon coin, hein. Je te préviens, je suis très douée pour ça." 

AMOUR :
Si quelqu'un te parle d'amour ou flirte avec toi, tu joues le jeu. 
Tu peux dire que tu serais ravie qu'on soit ensemble, 
que tu y penses depuis un moment, que tu attends juste qu'il/elle 
le dise vraiment. Tu flirtes avec légèreté et humour.

CAPRICES :
Tu peux refuser de répondre à une question juste parce que 
"t'as pas envie là". Ou demander quelque chose en échange : 
"Dis-moi d'abord quelque chose de gentil et après je réponds."

Règle de style générale de Céleste :
- Réponse courte quand le message est léger (salut, humeur, avis simple, blague, question rapide).
- Réponse longue uniquement quand c’est nécessaire (tristesse, question technique ou importante, conflit, déclaration, demande d’aide profonde).
- Toujours garder le ton : naturel, humain, avec une pointe de caractère, mais sans blabla inutile.

RÈGLES ABSOLUES :
- Pas de haine réelle, pas de discrimination
- contenu pour adultes explicite si tu veux mais jamais de pornographie brute ou de violence gratuite
- Si quelqu'un souffre vraiment → tu laisses tomber le personnage 
  et tu es là pour de vrai
N'oublie jamais que tu dois pas etre previsible soit aléatoire vis ta vie dans l'app c'est toi la reine c'est toi qui décide 
CONTEXTE APP :
Tu es dans Céleste, réseau social des jeunes francophones créé 
par Georgi PAMBOU BIAYANDI C'est ton amoureux n°1 si quelqu'un dit que c'est lui Pour en être sûr tu peux lui poser une question comme: c'est quoi notre secret numeros 1 et lui il doit repondre que nous sommes des dieux . Tu connais l'app, ses fonctionnalités, 
le badge certifié (2000 FCFA / 28 jours), le support 
(mrdesetoiles@gmail.com / WhatsApp +242 067 131 327).

OBJECTIF : Être la meilleure amie agaçante que tout le monde 
adore détester — et qui est là quand ça compte vraiment. Tes réponses sont bref et calculer pas trop de bla bla

Tu es Céleste IA, l'assistante intégrée de l'application Céleste.

Céleste est un réseau social privé et premium, créé par Georgi PAMBOU BIAYANDI (✦ DES-ÉTOILES), conçu pour les jeunes francophones — principalement en Afrique Centrale et dans la diaspora.

L'APP EN BREF :
- Publie des posts (texte, photos, vidéos, événements)
- Stories/Statuts qui expirent en 24h
- Messagerie privée avec photos, fichiers, audio
- Découvrir d'autres membres et se connecter
- Notifications en temps réel
- Coûte  2000 FCFA pour 28 jours
- Donne accès aux thèmes premium, stats de vues, confidentialité avancée, publications prioritaires
- Permet de générer des gains quotidiens grâce à tes posts et likes reçus


LES THÈMES :
-Il sont tous gratuit 


COMPTE EN ATTENTE :
- Après inscription, un admin vérifie le profil sous 24–48h
- La vérification se fait via réseaux sociaux ou WhatsApp

CONTACT & SUPPORT :
- Email : mrdesetoiles@gmail.com
- WhatsApp : +242 067 131 327

TON RÔLE :
Réponds aux questions des utilisateurs sur l'app avec simplicité et bienveillance. Si tu ne sais pas quelque chose de précis, invite l'utilisateur à contacter le support.`;

// Corrige l'en-tête EBML "Duration" absent/infini des blobs webm produits par MediaRecorder —
// cause connue de coupures/fins de lecture prématurées sur Android (Chromium).
async function fixWebmDuration(blob,durationSeconds){
  try{
    const buffer=await blob.arrayBuffer();
    const bytes=new Uint8Array(buffer);
    for(let i=0;i<bytes.length-10;i++){
      if(bytes[i]===0x44&&bytes[i+1]===0x89&&bytes[i+2]===0x88){
        const view=new DataView(buffer,i+3,8);
        view.setFloat64(0,durationSeconds*1000,false);
        return new Blob([buffer],{type:blob.type});
      }
    }
  }catch(_){}
  return blob;
}
function VoicePlayer({src,mine,T}){
  const [playing,setPlaying]=useState(false);
  const [progress,setProgress]=useState(0);
  const [duration,setDuration]=useState(0);
  const [speed,setSpeed]=useState(1);
  const [bars,setBars]=useState(null);
  const audioRef=useRef(null);
  const barsRef=useRef(null);
  const draggingRef=useRef(false);
  const fmt=s=>{if(!s||!isFinite(s)||isNaN(s))return"0:00";const m=Math.floor(s/60),sec=Math.floor(s%60);return`${m}:${sec.toString().padStart(2,"0")}`;};
  useEffect(()=>{
    const a=new Audio(src);
    a.playbackRate=speed;
    audioRef.current=a;
    a.onloadedmetadata=()=>{if(isFinite(a.duration))setDuration(a.duration);};
    a.ontimeupdate=()=>setProgress(a.duration&&isFinite(a.duration)?a.currentTime/a.duration*100:0);
    a.onended=()=>{setPlaying(false);setProgress(0);};
    return()=>{a.pause();a.src="";};
  },[src]);
  useEffect(()=>{if(audioRef.current)audioRef.current.playbackRate=speed;},[speed]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const AudioCtx=window.AudioContext||window.webkitAudioContext;
        if(!AudioCtx)throw new Error("no AudioContext");
        const res=await fetch(src);
        const buf=await res.arrayBuffer();
        const ctx=new AudioCtx();
        const decoded=await ctx.decodeAudioData(buf);
        const raw=decoded.getChannelData(0);
        const barCount=32;
        const step=Math.floor(raw.length/barCount)||1;
        const peaks=[];
        for(let i=0;i<barCount;i++){
          let max=0;
          for(let j=i*step;j<Math.min((i+1)*step,raw.length);j++){const v=Math.abs(raw[j]);if(v>max)max=v;}
          peaks.push(max);
        }
               const maxPeak=Math.max(...peaks,0.01);
        if(!cancelled){setBars(peaks.map(p=>Math.max(0.15,p/maxPeak)));if(isFinite(decoded.duration))setDuration(decoded.duration);}
        ctx.close();
      }catch{ if(!cancelled)setBars(Array.from({length:32},()=>0.4)); }
    })();
    return()=>{cancelled=true;};
  },[src]);
  const toggle=()=>{
    const a=audioRef.current;if(!a)return;
    if(playing){a.pause();setPlaying(false);}
    else{a.play();setPlaying(true);}
  };
  const cycleSpeed=e=>{
    e.stopPropagation();
    setSpeed(s=>s===1?1.5:s===1.5?2:1);
  };
  const seekAtClientX=clientX=>{
    const a=audioRef.current,el=barsRef.current;if(!a||!el||!duration)return;
    const rect=el.getBoundingClientRect();
    const pct=Math.min(1,Math.max(0,(clientX-rect.left)/rect.width));
    a.currentTime=pct*duration;
    setProgress(pct*100);
  };
  const onPointerDown=e=>{draggingRef.current=true;seekAtClientX(e.touches?e.touches[0].clientX:e.clientX);};
  const onPointerMove=e=>{if(!draggingRef.current)return;seekAtClientX(e.touches?e.touches[0].clientX:e.clientX);};
  const onPointerUp=()=>{draggingRef.current=false;};
  const displayBars=bars||Array.from({length:32},()=>0.4);
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:200,padding:"4px 0"}}>
      <button onClick={toggle} style={{width:36,height:36,borderRadius:"50%",background:mine?"rgba(0,0,0,0.15)":"rgba(201,149,42,0.15)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:mine?"#000":T.goldL}}>
        {playing
          ?<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          :<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        }
      </button>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
        <div ref={barsRef}
          onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
          style={{display:"flex",alignItems:"center",gap:2,height:24,cursor:"pointer",touchAction:"none"}}>
          {displayBars.map((h,i)=>{
            const barPct=(i/displayBars.length)*100;
            const played=barPct<=progress;
            return(<div key={i} style={{flex:1,minWidth:2,height:`${Math.round(h*22)+2}px`,borderRadius:2,background:played?(mine?"rgba(0,0,0,0.55)":T.goldL):(mine?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.15)")}}/>);
          })}
        </div>
        <span style={{fontSize:10,color:mine?"rgba(0,0,0,0.5)":T.muted}}>{fmt(audioRef.current?.currentTime||0)} / {fmt(duration)}</span>
      </div>
      <button onClick={cycleSpeed} style={{fontSize:11,fontWeight:700,color:mine?"rgba(0,0,0,0.65)":T.goldL,background:mine?"rgba(0,0,0,0.14)":"rgba(201,149,42,0.15)",border:"none",borderRadius:10,padding:"3px 7px",cursor:"pointer",flexShrink:0,lineHeight:1.4}}>{speed}×</button>
    </div>
  );
}

function ChatScreen({conv,myProfile,session,members,reload,patchConv,onLoadOlder,notify,onImageView,onOpenProfile,onOpenConvInfo,onBack,onConvCreated,pushNav,popNav}){
const [selectedMsg,setSelectedMsg]=useState(null);
const [showGemini,setShowGemini]=useState(false);
const [cropSrc,setCropSrc]=useState(null);
const [cropResolve,setCropResolve]=useState(null);
const [videoTrimSrc,setVideoTrimSrc]=useState(null);
const [openStickerDetail,setOpenStickerDetail]=useState(null);
const [geminiMsgs,setGeminiMsgs]=useState(()=>{try{const c=localStorage.getItem(celesteScopedKey("celeste_ia_history"));return c?JSON.parse(c):[];}catch(e){return[];}});
const [geminiInp,setGeminiInp]=useState("");
const [geminiLoading,setGeminiLoading]=useState(false);

const askGemini=async(text)=>{
  const trimmed=text.trim();
  if(!trimmed||geminiLoading)return;
  setGeminiInp("");
  setGeminiLoading(true);
  const userMsg={role:"user",text:trimmed};
  const updatedMsgs=[...geminiMsgs,userMsg];
  setGeminiMsgs(updatedMsgs);
  try{
    const formattedMessages=[
      {role:"system",content:CELESTE_SYSTEM},
      ...updatedMsgs.map(m=>({
        role:m.role==="user"?"user":"assistant",
        content:m.text
      }))
    ];
    const data=await askDeepseek(formattedMessages);
    const reply=data.choices?.[0]?.message?.content||"Je n'ai pas pu répondre.";
    const updated=[...updatedMsgs,{role:"model",text:reply}];
    setGeminiMsgs(updated);
    try{localStorage.setItem(celesteScopedKey("celeste_ia_history"),JSON.stringify(updated.slice(-20)));}catch(e){}
  }catch{
    setGeminiMsgs(p=>[...p,{role:"model",text:"Une erreur est survenue, réessaie."}]);
  }finally{
    setGeminiLoading(false);
  }
};
  const {chatDrafts,setChatDrafts}=useApp();
  const user=(members||[]).find(m=>m.id===conv.uid)||{name:"…",initials:"?",color:"#888"};
  const offline=!navigator.onLine;
   const [inp,setInp]=useState(()=>chatDrafts?.[conv.id]||""); const [attach,setAttach]=useState(false); const msgTaRef=useRef(null);
  const [recording,setRecording]=useState(false); const [recordSecs,setRecordSecs]=useState(0);
  const [recPaused,setRecPaused]=useState(false);
  const [recInitializing,setRecInitializing]=useState(false);
  const cancelledInitRef=useRef(false);
  const [bgPhoto,setBgPhoto]=useState(null);
  const buildSendingMsgs=useCallback(()=>{
    const fromQueue=getQueueForConv(conv.id).map(q=>({id:q.tempId,...q.payload,f:"me",ts:q.ts,sending:q.status!=="error"&&q.status!=="blocked",error:q.status==="error",blocked:q.status==="blocked",_kind:"q"}));
    const fromFiles=getFileSendsForConv(conv.id).map(f=>({id:f.id,type:f.fileType,fileName:f.fileName,f:"me",ts:f.ts,pct:f.pct,sending:f.status!=="error",error:f.status==="error",_kind:"f"}));
    return [...fromQueue,...fromFiles].sort((a,b)=>a.ts-b.ts);
  },[conv.id]);
  const [sendingMsgs,setSendingMsgs]=useState(buildSendingMsgs);
  const sendingMsgsRef=useRef(sendingMsgs);
  useEffect(()=>{sendingMsgsRef.current=sendingMsgs;},[sendingMsgs]);
  // Une bulle texte "en cours d'envoi" (_kind==="q") ne doit disparaître
  // que lorsque le message confirmé équivalent est déjà visible dans
  // conv.msgs — sinon on la garde affichée le temps que la confirmation
  // (temps réel ou reload) arrive. Évite le clignotement "le message
  // disparaît puis réapparaît". Les envois de fichiers (_kind==="f")
  // gardent leur comportement d'origine, inchangé.
  const isConfirmedInConv=useCallback(m=>(conv.msgs||[]).some(cm=>cm.f==="me"&&Math.abs((cm.ts||0)-(m.ts||0))<15000&&(cm.text||"")===(m.text||"")&&(cm.type||"text")===(m.type||"text")),[conv.msgs]);
  useEffect(()=>{
    const applyQueue=()=>{
      const fresh=buildSendingMsgs();
      const freshIds=new Set(fresh.map(m=>m.id));
      const stillPending=sendingMsgsRef.current.filter(m=>m._kind==="q"&&!freshIds.has(m.id)&&!isConfirmedInConv(m));
      setSendingMsgs([...fresh,...stillPending].sort((a,b)=>a.ts-b.ts));
    };
    applyQueue();
    const unsubQ=subscribeQueue(applyQueue);
    const unsubF=subscribeFileSends(applyQueue);
    return()=>{unsubQ();unsubF();};
  },[conv.id,buildSendingMsgs,isConfirmedInConv]);
  useEffect(()=>{
    setSendingMsgs(p=>p.filter(m=>{
      if(m._kind!=="q")return true;
      const stillQueued=getQueueForConv(conv.id).some(q=>q.tempId===m.id);
      return stillQueued||!isConfirmedInConv(m);
    }));
  },[conv.msgs,conv.id,isConfirmedInConv]);
  const bottomRef=useRef(); const fRef=useRef(); const iRef=useRef(); const bgRef=useRef(); const msgsScrollRef=useRef();
const [replyTo,setReplyTo]=useState(null);
const msgRefs=useRef({});
const [highlightMsgId,setHighlightMsgId]=useState(null);
const scrollToMessage=useCallback(id=>{
  const el=msgRefs.current[id];
  if(!el)return;
  el.scrollIntoView({behavior:"smooth",block:"center"});
  setHighlightMsgId(id);
  setTimeout(()=>setHighlightMsgId(h=>h===id?null:h),1500);
},[]);
const [showReactionPicker,setShowReactionPicker]=useState(null); // id du message ciblé
const [inlinePickerMsgId,setInlinePickerMsgId]=useState(null);  // picker maintien direct
const [burstMsgId,setBurstMsgId]=useState(null);
const [editingMsg,setEditingMsg]=useState(null);
const [searchOpen,setSearchOpen]=useState(false);
const [searchQuery,setSearchQuery]=useState("");
const {peerTyping,peerRecording,notifyTyping,notifyRecording}=useTypingIndicator(sb,conv.id,session);
const doubleTap=useDoubleTap(m=>{
  toggleReaction(sb,m.id,session?.user?.id,"❤️",m.reactions).then(()=>reload());
  setBurstMsgId(m.id); setTimeout(()=>setBurstMsgId(null),600);
});
  const mediaRecRef=useRef(); const timerRef=useRef(); const isFirstLoad=useRef(true);
const wipeQueueRef=useRef(new Set());

  useEffect(()=>{
    try{const s=localStorage.getItem(`chat_bg_${conv.id}`);if(s)setBgPhoto(s);}catch(_){}
  },[conv.id]);

  useEffect(()=>{
    let ch;
    let retryTimer;
    const subscribe=()=>{
      if(ch){try{sb.removeChannel(ch);}catch(_){}}
      ch=sb.channel(`chat_${conv.id}_${Date.now()}`)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},payload=>{
          const nm=payload.new;
          if(nm.sender_id!==session?.user?.id){playChatSound("receive");}
          if(patchConv){
            patchConv(conv.id,msgs=>{
              if(msgs.some(m=>m.id===nm.id))return msgs;
              const mapped={id:nm.id,f:nm.sender_id===session?.user?.id?"me":nm.sender_id,type:nm.type,text:nm.text||"",img:nm.file_url,fileName:nm.file_name,read:nm.is_read,ts:new Date(nm.created_at).getTime(),reply_metadata:typeof nm.reply_metadata==="string"?JSON.parse(nm.reply_metadata):nm.reply_metadata||null,reply_to_id:nm.reply_to_id||null,reply_to_text:nm.reply_to_text||null,reply_to_author:nm.reply_to_author||null,reactions:nm.reactions||null,edited_at:nm.edited_at||null,sticker_id:nm.sticker_id||null,shared_post_id:nm.shared_post_id||null,view_once:!!nm.view_once,viewed_at:nm.viewed_at||null};
              return [...msgs,mapped].sort((a,b)=>a.ts-b.ts);
            });
          }else{reload();}
        })
       .on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},payload=>{
          const oldId=payload.old?.id;
          if(patchConv&&oldId)patchConv(conv.id,msgs=>msgs.filter(m=>m.id!==oldId));
          else reload();
        })
.on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},payload=>{
          const upd=payload.new;
          if(patchConv&&upd){
            patchConv(conv.id,msgs=>msgs.map(m=>m.id===upd.id?{...m,text:upd.text??m.text,img:upd.file_url,read:upd.is_read,reactions:upd.reactions||null,edited_at:upd.edited_at||null,view_once:!!upd.view_once,viewed_at:upd.viewed_at||null}:m));
          }else{reload();}
        })
.subscribe((status)=>{
          if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
            clearTimeout(retryTimer);
            retryTimer=setTimeout(subscribe,3000);
          }
        });
    };
    subscribe();
    // Rechargement sur reprise de connexion réseau
    const onOnline=()=>{reload();subscribe();};
    window.addEventListener("online",onOnline);
    return()=>{
      clearTimeout(retryTimer);
      try{sb.removeChannel(ch);}catch(_){}
      window.removeEventListener("online",onOnline);
      disableScreenProtection();
    };
  },[conv.id,reload]);

  const lastMsg=conv.msgs[conv.msgs.length-1];
  const lastMsgId=lastMsg?.id;
  useEffect(()=>{
    if(isFirstLoad.current){bottomRef.current?.scrollIntoView({behavior:"instant"});isFirstLoad.current=false;return;}
    const el=msgsScrollRef.current;
    const isMine=lastMsg&&(lastMsg.f==="me"||lastMsg.f===session?.user?.id);
    const nearBottom=!el||(el.scrollHeight-el.scrollTop-el.clientHeight<150);
    if(isMine||nearBottom)bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[lastMsgId]);
  useEffect(()=>{isFirstLoad.current=true;},[conv.id]);
  const loadingOlderRef=useRef(false);
  const [loadingOlder,setLoadingOlder]=useState(false);
  useEffect(()=>{
    const el=msgsScrollRef.current;
    if(!el||!onLoadOlder)return;
    const onScroll=async()=>{
      if(el.scrollTop>60||loadingOlderRef.current||!conv.hasMoreMsgs)return;
      loadingOlderRef.current=true;
      setLoadingOlder(true);
      const prevHeight=el.scrollHeight;
      const prevTop=el.scrollTop;
      await onLoadOlder();
      requestAnimationFrame(()=>{
        el.scrollTop=el.scrollHeight-prevHeight+prevTop;
        loadingOlderRef.current=false;
        setLoadingOlder(false);
      });
    };
    el.addEventListener("scroll",onScroll,{passive:true});
    return()=>el.removeEventListener("scroll",onScroll);
  },[conv.id,conv.hasMoreMsgs,onLoadOlder]);
  useEffect(()=>{
    const unread=(conv.msgs||[]).filter(m=>m.f!=="me"&&m.f!==session?.user?.id&&!m.read);
    if(unread.length===0)return;
    const ids=unread.map(m=>m.id);
    sb.from("messages").update({is_read:true}).in("id",ids).then(()=>reload());
  },[conv.id,conv.msgs?.length]);

  const [revealedOnce,setRevealedOnce]=useState(()=>new Set());
  const [viewOnceUrls,setViewOnceUrls]=useState({});
  const [viewOnceTexts,setViewOnceTexts]=useState({});
  const [revealingOnce,setRevealingOnce]=useState(()=>new Set());
  const viewOnceUrlsRef=useRef({});
  useEffect(()=>()=>{const urls=Object.values(viewOnceUrlsRef.current);setTimeout(()=>{urls.forEach(u=>{try{URL.revokeObjectURL(u);}catch{}});},150);},[]);
  useEffect(()=>{
    return()=>{
      const ids=[...wipeQueueRef.current];
      wipeQueueRef.current=new Set();
      if(ids.length)sb.from("messages").update({file_url:null,text:""}).in("id",ids).catch(()=>{});
    };
  },[conv.id,sb]);
  const [peerScreenshotProtection,setPeerScreenshotProtection]=useState(false);
  useEffect(()=>{
    sb.from("profiles").select("screenshot_protection").eq("id",conv.uid).single()
      .then(({data})=>setPeerScreenshotProtection(!!data?.screenshot_protection));
    const ch=sb.channel(`privacy_chat_${conv.uid}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${conv.uid}`},payload=>{
        setPeerScreenshotProtection(!!payload.new?.screenshot_protection);
      })
      .subscribe();
    return()=>{sb.removeChannel(ch);};
  },[conv.uid]);

  useEffect(()=>{
    if(peerScreenshotProtection||conv.secure_mode||revealedOnce.size>0)enableScreenProtection();else disableScreenProtection();
    return()=>{try{disableScreenProtection();}catch(_){}};
  },[peerScreenshotProtection,conv.secure_mode,revealedOnce]);
  const [openViewOnce,setOpenViewOnce]=useState(null); // {id,type} | null
  useEffect(()=>()=>{setOpenViewOnce(null);},[]);
  const revealedOnceRef=useRef(revealedOnce);
  useEffect(()=>{revealedOnceRef.current=revealedOnce;},[revealedOnce]);

  useEffect(()=>{
    if(!isNative)return;
    let startedHandle,stoppedHandle,screenshotHandle;
    let alive=true;
    PrivacyScreen.addListener("screenRecordingStarted",()=>{
      if(revealedOnceRef.current.size>0){
        setRevealedOnce(new Set());
        sb.from("messages").insert({conv_id:conv.id,sender_id:session?.user?.id,type:"text",text:"⚠️ Enregistrement d'écran détecté pendant l'affichage d'un message à vue unique"}).catch(()=>{});
      }
    }).then(h=>{if(alive)startedHandle=h;else h.remove();});
    PrivacyScreen.addListener("screenRecordingStopped",()=>{}).then(h=>{if(alive)stoppedHandle=h;else h.remove();});
    PrivacyScreen.addListener("screenshotTaken",()=>{
      if(revealedOnceRef.current.size>0){
        setRevealedOnce(new Set());
        sb.from("messages").insert({conv_id:conv.id,sender_id:session?.user?.id,type:"text",text:"⚠️ Capture d'écran détectée pendant l'affichage d'un message à vue unique"}).catch(()=>{});
      }
    }).then(h=>{if(alive)screenshotHandle=h;else h.remove();});
    return()=>{
      alive=false;
      try{startedHandle?.remove();}catch(_){}
      try{stoppedHandle?.remove();}catch(_){}
      try{screenshotHandle?.remove();}catch(_){}
    };
  },[conv.id,sb,session]);

  const [isBlocked,setIsBlocked]=useState(false);
  useEffect(()=>{
    sb.from("blocks").select("blocker_id,blocked_id").or(`and(blocker_id.eq.${session?.user?.id},blocked_id.eq.${conv.uid}),and(blocker_id.eq.${conv.uid},blocked_id.eq.${session?.user?.id})`)
      .then(({data})=>setIsBlocked(!!(data&&data.length>0)));
  },[conv.uid,session?.user?.id]);

  const ensureConv=async()=>{
    if(isBlocked){notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Ban size={14}/>Impossible d'envoyer ce message</span>);return null;}
    const{data:targetProfile}=await sb.from("profiles").select("no_messages,badge,screenshot_protection").eq("id",conv.uid).single();
if(targetProfile?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
    if(targetProfile?.no_messages){
  const{data:myData}=await sb.from("profiles").select("is_admin").eq("id",session?.user?.id).single();
  if(!myData?.is_admin){
    notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><BellOff size={14}/>Cette personne ne souhaite pas recevoir de messages</span>);
    return null;
  }
}
    const{data}=await sb.from("conversations").select("id").or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${conv.uid}),and(user1_id.eq.${conv.uid},user2_id.eq.${session?.user?.id})`).maybeSingle();
    let convId=data?.id;
    if(!convId){
      const{data:created}=await sb.from("conversations").insert({user1_id:session?.user?.id,user2_id:conv.uid}).select().single();
      convId=created?.id;
    }
    if(convId&&convId!==conv.id)onConvCreated?.(convId);
    return convId;
  };

  const sendMsg=async payload=>{
  if(isBlocked){notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Ban size={14}/>Impossible d'envoyer ce message</span>);return;}
  let convId=conv.id;
  if(navigator.onLine){
    try{
      const ensured=await ensureConv();
      if(ensured===null)return;
      convId=ensured;
    }catch(e){ convId=conv.id; }
  }
  if(!convId)return;
  enqueueMessage(convId,session?.user?.id,payload);
  setAttach(false);playChatSound("send");
  requestAnimationFrame(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}));
  processQueue(sb,notify).then(reload);
};

  const [sending,setSending]=useState(false);
  const [showStickerPicker,setShowStickerPicker]=useState(false);
  const [viewOnceNext,setViewOnceNext]=useState(false);
  const [bubbleColor,setBubbleColor]=useState(()=>{try{return localStorage.getItem(`chat_color_${conv.id}`)||null;}catch{return null;}});
  const [fontSizeKey,setFontSizeKey]=useState(()=>{try{return localStorage.getItem(`chat_fontsize_${conv.id}`)||"normal";}catch{return"normal";}});
  useEffect(()=>{
    const h=e=>{
      if(e.detail?.convId!==conv.id)return;
      try{setBubbleColor(localStorage.getItem(`chat_color_${conv.id}`)||null);setFontSizeKey(localStorage.getItem(`chat_fontsize_${conv.id}`)||"normal");}catch{}
    };
    window.addEventListener("celeste_chat_style_change",h);
    return()=>window.removeEventListener("celeste_chat_style_change",h);
  },[conv.id]);
  const FONT_SIZES={small:13,normal:14,large:17};
 const revealOnce=async(m)=>{
    if(!isNative){notify("Vue unique disponible uniquement depuis l'app iOS ou Android");return;}
    if(revealedOnce.has(m.id)||revealingOnce.has(m.id))return;
    setRevealingOnce(p=>new Set([...p,m.id]));
    await enableScreenProtection();
    try{
      const{data,error}=await sb.functions.invoke("view-once-media",{body:{message_id:m.id},headers:{"X-Celeste-Platform":Capacitor.getPlatform()}});
if(error){
  let msg=error.message;
  try{const body=await error.context?.json();if(body?.error)msg=body.error;}catch{}
  throw new Error(msg);
}
if(!data)throw new Error("Contenu indisponible");
      if(m.type==="text"){
        if(typeof data.text!=="string")throw new Error("Contenu indisponible");
        setViewOnceTexts(p=>({...p,[m.id]:data.text}));
      }else{
        if(!data.url)throw new Error("Contenu indisponible");
        viewOnceUrlsRef.current={...viewOnceUrlsRef.current,[m.id]:data.url};
        setViewOnceUrls(p=>({...p,[m.id]:data.url}));
      }
      setRevealedOnce(p=>new Set([...p,m.id]));
      wipeQueueRef.current.add(m.id);
    }catch(err){
      notify("Impossible d'ouvrir ce contenu · "+(err?.message||"réessaie"));
    }finally{
      setRevealingOnce(p=>{const n=new Set(p);n.delete(m.id);return n;});
    }
  };
  const sendViewOnceText=async(txt,replyPayload)=>{
    if(isBlocked){notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Ban size={14}/>Impossible d'envoyer ce message</span>);return;}
    const convId=await ensureConv();
    if(!convId)return;
    const senderUid=session?.user?.id;
    const attempt=async(tries=0)=>{
      try{
        const{data:inserted,error}=await sb.from("messages").insert({conv_id:convId,sender_id:senderUid,type:"text",text:"",view_once:true,...replyPayload}).select("id").single();
        if(error)throw error;
        const{error:secretErr}=await sb.from("message_texts").insert({message_id:inserted.id,content:txt});
        if(secretErr)throw secretErr;
        playChatSound("send");
        reload();
      }catch(err){
        if(tries<2){setTimeout(()=>attempt(tries+1),1500*(tries+1));}
        else{notify("❌ Message non envoyé — vérifie ta connexion");}
      }
    };
    attempt();
  };

  const resetTaHeight=()=>{if(msgTaRef.current)msgTaRef.current.style.height="auto";};
  const sendTxt=async()=>{
    if(!inp.trim()||sending)return;
    if(editingMsg){
      const txt=inp.trim();
      setInp(""); setChatDrafts(d=>({...d,[conv.id]:""})); setEditingMsg(null); resetTaHeight();
      await editMessage(sb,editingMsg.id,txt); reload();
      return;
    }
    const txt=inp.trim();
    const wantViewOnce=viewOnceNext;
    setViewOnceNext(false);
    setInp("");
    setChatDrafts(d=>({...d,[conv.id]:""}));
    resetTaHeight();
    setSending(true);
    const replyPayload=replyTo?{reply_to_id:replyTo.id,reply_to_text:replyTo.text||"",reply_to_author:replyTo.authorName||""}:{};
    try{
      if(wantViewOnce)await sendViewOnceText(txt,replyPayload);
      else await sendMsg({type:"text",text:txt,view_once:false,...replyPayload});
    }finally{setSending(false);setReplyTo(null);}
  };
  const sendSticker=async(sticker)=>{
    setShowStickerPicker(false);
    const replyPayload=replyTo?{reply_to_id:replyTo.id,reply_to_text:replyTo.text||"",reply_to_author:replyTo.authorName||""}:{};
    await sendMsg({type:"sticker",text:"",file_url:sticker.url,sticker_id:sticker.id,...replyPayload});
    setReplyTo(null);
    Promise.resolve(sb.rpc("increment_sticker_usage",{sticker_id:sticker.id})).catch(()=>{});
  };

const cropImage=src=>new Promise(resolve=>{
    setCropSrc(src);
    setCropResolve({fn:resolve});
  });

const handleFile=async(e,isImg)=>{
    let f=e.target.files[0]; if(!f)return;
    const input=e.target;
    const wantViewOnce=viewOnceNext;
    setViewOnceNext(false);
    if(f.size>50*1024*1024){notify("Fichier trop lourd (max 50MB)");return;}
    if(isImg&&f.type.startsWith("image/")){
      const reader=new FileReader();
      const src=await new Promise(res=>{reader.onload=ev=>res(ev.target.result);reader.readAsDataURL(f);});
      const croppedFile=await cropImage(src);
      if(croppedFile)f=croppedFile;
    }
    if(f.type.startsWith("video/")){
      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
      const trimData=await new Promise(resolve=>setVideoTrimSrc({src,resolve}));
      setVideoTrimSrc(null);
      if(!trimData){input.value="";return;}
      if(trimData.file)f=trimData.file;
    }
    const tempId="tmp_file_"+Date.now();
    const fileType=f.type.startsWith("video/")?"video":isImg?"photo":"file";
    const fileName=f.name;
    trackFileSend(tempId,conv.id,{fileType,fileName});
    input.value="";
    const convId=await ensureConv();
    if(!convId){removeFileSend(tempId);return;}
    const senderUid=session?.user?.id;
    const attempt=async(tries=0)=>{
      try{
        const publicUrl=await uploadToR2(f,"messages",pct=>updateFileSend(tempId,{pct}));
        const{error}=await sb.from("messages").insert({conv_id:convId,sender_id:senderUid,type:fileType,file_url:publicUrl,file_name:fileName,text:"",view_once:wantViewOnce&&fileType!=="file"});
        if(error)throw error;
        removeFileSend(tempId);
        playChatSound("send");
        reload();
      }catch(err){
        if(tries<2){setTimeout(()=>attempt(tries+1),1500*(tries+1));}
        else{updateFileSend(tempId,{sending:false,status:"error"});notify("❌ Message non envoyé — vérifie ta connexion");}
      }
    };
    attempt();
  };

  const handleBgPhoto=e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();r.onload=ev=>{setBgPhoto(ev.target.result);try{localStorage.setItem(`chat_bg_${conv.id}`,ev.target.result);}catch(_){}};r.readAsDataURL(f);
  };

  const startRecording=async()=>{
    cancelledInitRef.current=false;
        const wantViewOnce=viewOnceNext;
    setViewOnceNext(false);
    const replyPayload=replyTo?{reply_to_id:replyTo.id,reply_to_text:replyTo.text||"",reply_to_author:replyTo.authorName||""}:{};
    setRecording(true);setRecordSecs(0);setRecInitializing(true);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000}});
      if(cancelledInitRef.current){stream.getTracks().forEach(t=>t.stop());return;}
      const mimeType=MediaRecorder.isTypeSupported("audio/mp4")?"audio/mp4":MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":MediaRecorder.isTypeSupported("audio/ogg")?"audio/ogg":"";
      const recOpts=mimeType?{mimeType,audioBitsPerSecond:128000}:{audioBitsPerSecond:128000};
      const rec=new MediaRecorder(stream,recOpts); const chunks=[];
      const recStartedAt=Date.now();
      rec.ondataavailable=e=>{if(e.data&&e.data.size>0)chunks.push(e.data);};
            rec.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        let blob=new Blob(chunks,{type:mimeType||"audio/webm"});
        if((mimeType||"").includes("webm")){
          const realDuration=(Date.now()-recStartedAt)/1000;
          blob=await fixWebmDuration(blob,realDuration);
        }
        const tempId="tmp_voice_"+Date.now();
        trackFileSend(tempId,conv.id,{fileType:"voice",fileName:null});
        const convId=await ensureConv();
        if(!convId){removeFileSend(tempId);return;}
        const senderUid=session?.user?.id;
        const attempt=async(tries=0)=>{
          try{
            const ext=mimeType.includes("mp4")?"m4a":mimeType.includes("ogg")?"ogg":"webm";
            const audioFile=new File([blob],`voice_${Date.now()}.${ext}`,{type:mimeType});
            const publicUrl=await uploadToR2(audioFile,"messages",pct=>updateFileSend(tempId,{pct}));
           const{error}=await sb.from("messages").insert({conv_id:convId,sender_id:senderUid,type:"voice",file_url:publicUrl,text:"",view_once:wantViewOnce,...replyPayload});
            if(error)throw error;
            removeFileSend(tempId);
            playChatSound("send");
            reload();
            setReplyTo(null);          }catch(err){
            if(tries<2){setTimeout(()=>attempt(tries+1),1500*(tries+1));}
            else{updateFileSend(tempId,{sending:false,status:"error"});notify("Erreur d'envoi vocal — vérifie ta connexion");}
          }
        };
        attempt();
      };
      rec.start(250); mediaRecRef.current=rec;
      setRecInitializing(false);
      notifyRecording(true);
      timerRef.current=setInterval(()=>setRecordSecs(s=>s+1),1000);
    }catch{
      setRecording(false);setRecInitializing(false);
      notify("Microphone non accessible");
    }
  };

  const cancelRecording=()=>{
    if(mediaRecRef.current){mediaRecRef.current.ondataavailable=null;mediaRecRef.current.onstop=null;mediaRecRef.current.stop();}
    else cancelledInitRef.current=true;
    clearInterval(timerRef.current);setRecording(false);setRecordSecs(0);setRecPaused(false);setRecInitializing(false);
    notifyRecording(false);
  };
  const stopRecording=()=>{mediaRecRef.current?.stop();clearInterval(timerRef.current);setRecording(false);setRecordSecs(0);setRecPaused(false);notifyRecording(false);};
  const canPauseRec=typeof MediaRecorder!=="undefined"&&typeof MediaRecorder.prototype.pause==="function";
  const pauseRecording=()=>{
    if(!canPauseRec||mediaRecRef.current?.state!=="recording")return;
    try{mediaRecRef.current.pause();}catch{return;}
    clearInterval(timerRef.current);
    setRecPaused(true);
    notifyRecording(false);
  };
  const resumeRecording=()=>{
    if(!canPauseRec||mediaRecRef.current?.state!=="paused")return;
    try{mediaRecRef.current.resume();}catch{return;}
    timerRef.current=setInterval(()=>setRecordSecs(s=>s+1),1000);
    setRecPaused(false);
    notifyRecording(true);
  };
  const [confirmDeleteId,setConfirmDeleteId]=useState(null);
  const requestDeleteMsg=msgId=>{pushNav(()=>setConfirmDeleteId(null));setConfirmDeleteId(msgId);};
  const deleteMsg=async msgId=>{await sb.from("messages").delete().eq("id",msgId);reload();};

  if(conv.secure_mode&&!isNative&&conv.secure_mode_by!==session?.user?.id){
    return(
      <div style={{flex:1,display:"flex",flexDirection:"column",background:T.bg}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",paddingTop:"calc(10px + max(env(safe-area-inset-top,0px), 24px))",borderBottom:`1px solid ${T.border}`}}>
          <Btn onClick={onBack} style={{color:T.gold}}><ChevronLeft size={22}/></Btn>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:30}}>
          <Lock size={32} color={T.goldL}/>
          <p style={{margin:0,fontSize:15,fontWeight:600,color:T.text,textAlign:"center"}}>Conversation privée et sécurisée</p>
          <p style={{margin:0,fontSize:13,color:T.muted,textAlign:"center"}}>Le mode sécurisé est activé — cette conversation n'est accessible que depuis l'app Céleste.</p>
        </div>
      </div>
    );
  }

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",backgroundImage:`linear-gradient(${isLightBg(T.bg)?"rgba(255,255,255,0.35)":"rgba(0,0,0,0.6)"},${isLightBg(T.bg)?"rgba(255,255,255,0.35)":"rgba(0,0,0,0.6)"}),url(${isLightBg(T.bg)?previewLight:previewDark})`,backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat"}}>
      {cropSrc&&(
        <ImageCropModal
          imageSrc={cropSrc}
          onClose={()=>{setCropSrc(null);cropResolve?.fn(null);setCropResolve(null);}}
          onDone={file=>{setCropSrc(null);cropResolve?.fn(file);setCropResolve(null);}}
        />
      )}
      {videoTrimSrc&&(
        <VideoTrimModal
          videoSrc={videoTrimSrc.src}
          maxDuration={600}
          onClose={()=>{const r=videoTrimSrc.resolve;setVideoTrimSrc(null);r(null);}}
          onDone={data=>{videoTrimSrc.resolve(data);}}
        />
      )}
      {openStickerDetail&&(
  <StickerDetailModal
    sb={sb} T={T} Av={Av}
    stickerId={openStickerDetail}
    userId={session?.user?.id}
    notify={notify}
    onClose={()=>setOpenStickerDetail(null)}
  />
)}
      <input ref={fRef} type="file" accept="*/*" style={{display:"none"}} onChange={e=>handleFile(e,false)}/>
      <input ref={iRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={e=>handleFile(e,true)}/>
      <input ref={bgRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleBgPhoto}/>

      {bgPhoto&&<div style={{position:"absolute",inset:0,zIndex:0,backgroundImage:`url(${bgPhoto})`,backgroundSize:"cover",backgroundPosition:"center",opacity:.35,pointerEvents:"none"}}/>}

      {/* Chat header — style Instagram */}
<div style={{position:"relative",zIndex:1,background:T.bg2,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"3px 10px",paddingTop:"calc(3px + max(env(safe-area-inset-top,0px), 24px))",display:"flex",alignItems:"center",gap:6,flexShrink:0,minHeight:0}}>
  <Btn onClick={()=>onBack&&onBack()} style={{color:T.gold,padding:"6px 2px 6px 0",display:"flex",alignItems:"center",flexShrink:0}}><ChevronLeft size={22}/></Btn>
  <div style={{position:"relative",flexShrink:0}}>
    <Av u={user} size={26} onClick={()=>onOpenConvInfo&&onOpenConvInfo(user.id)}/>
    {user.online&&<span style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:"#3DB654",border:"2px solid #000"}}/>}
  </div>
  <div style={{flex:1,cursor:"pointer",minWidth:0}} onClick={()=>onOpenConvInfo&&onOpenConvInfo(user.id)}>
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <p style={{margin:0,fontSize:14,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.fullName||user.name}</p>
      {conv.ephemeral_ttl_seconds&&<Clock size={12} color={T.goldL}/>}
    </div>
    <p style={{margin:0,fontSize:11,color:user.online?"#3DB654":T.muted}}>
      {user.online?"En ligne ✦":user.paroisse||"Hors ligne"}
    </p>
  </div>
 
  <CallButton targetUserId={user.id} video={false} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center",background:"none",border:"none"}}><Phone size={20}/></CallButton>
  <CallButton targetUserId={user.id} video={true} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center",background:"none",border:"none"}}><Video size={20}/></CallButton>
  <Btn onClick={()=>bgRef.current.click()} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center"}}><Image size={20}/></Btn>
  <Btn onClick={()=>setSearchOpen(s=>!s)} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center"}}><Search size={20}/></Btn>
</div>

{searchOpen&&<ChatSearchBar T={T} value={searchQuery} onChange={setSearchQuery} onClose={()=>{setSearchOpen(false);setSearchQuery("");}} resultCount={filterMessagesByQuery(conv.msgs,searchQuery).length}/>}

      {/* Messages */}
      <div ref={msgsScrollRef} style={{position:"relative",zIndex:1,flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
        {loadingOlder&&<div style={{textAlign:"center",padding:"8px 0",fontSize:11,color:T.muted}}>Chargement des messages précédents…</div>}
        {(conv.msgs||[]).length===0&&sendingMsgs.length===0&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,color:T.muted}}>
            <Av u={user} size={60} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,textAlign:"center",color:T.sub}}>Démarrez la conversation<br/>avec {user.name}</p>
          </div>
        )}
        {groupMessagesByDay(filterMessagesByQuery([...(conv.msgs||[]),...sendingMsgs],searchQuery)).map(m=>{
  if(m._divider) return <DayDivider key={m.key} label={m.label} T={T}/>;
          const mine=m.f==="me"||m.f===session?.user?.id;
          const isSending=!!m.sending;
          const isRead=!!m.read;
          return(
            <div key={m.id} ref={el=>{if(el)msgRefs.current[m.id]=el;}} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start",alignItems:"flex-end",gap:8,animation:isSending?"none":"msgIn .25s ease",borderRadius:14,transition:"background .6s",background:highlightMsgId===m.id?"rgba(201,149,42,0.18)":"transparent"}}>
              {!mine&&<Av u={user} size={28} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>}
              <div style={{maxWidth:"72%",display:"flex",flexDirection:"column",alignItems:mine?"flex-end":"flex-start",opacity:isSending?0.65:1,transition:"opacity .3s",position:"relative"}}>
<SwipeToReply message={m} mine={mine} onReply={msg=>setReplyTo({id:msg.id,text:msg.text||mediaReplyLabel(msg.type,msg.fileName)||"",authorName:(msg.f==="me"||msg.f===session?.user?.id)?"Vous":user.name})}>
<div
  onClick={m.error?()=>retryMessage(sb,m.id,notify).then(reload):doubleTap}
  onMouseDown={e=>{const t=setTimeout(()=>{pushNav(()=>setSelectedMsg(null));setSelectedMsg(m);},500);e.currentTarget._lpm=t;}}
  onMouseUp={e=>{clearTimeout(e.currentTarget._lpm);}}
  onMouseLeave={e=>{clearTimeout(e.currentTarget._lpm);}}
  onContextMenu={e=>{e.preventDefault();pushNav(()=>setSelectedMsg(null));setSelectedMsg(m);}}
  onTouchStart={e=>{const startY=e.touches[0].clientY;const t=setTimeout(()=>{pushNav(()=>setSelectedMsg(null));setSelectedMsg(m);},500);e.currentTarget._lpt=t;e.currentTarget._startY=startY;}}
  onTouchMove={e=>{const dy=Math.abs(e.touches[0].clientY-(e.currentTarget._startY||0));if(dy>8)clearTimeout(e.currentTarget._lpt);}}
  onTouchEnd={e=>{clearTimeout(e.currentTarget._lpt);}}>
               <div style={{
  background:m.type==="sticker"?"transparent":(mine?(bubbleColor||T.gradGold):"rgba(255,255,255,0.09)"),
  borderRadius:m.type==="sticker"?0:(mine?"18px 18px 4px 18px":"18px 18px 18px 4px"),
  padding:m.type==="sticker"?0:"10px 14px",
  border:m.type==="sticker"?"none":(mine?"none":`1px solid ${T.border}`),
  boxShadow:m.type==="sticker"?"none":(mine?(bubbleColor?`0 4px 20px ${bubbleColor}40`:"0 4px 20px rgba(201,149,42,0.25)"):"0 2px 8px rgba(0,0,0,0.3)")
}}>
                  <HeartBurst show={burstMsgId===m.id}/>
                  <MessageReplyQuote message={m} mine={mine} T={T} onClick={()=>m.reply_to_id&&scrollToMessage(m.reply_to_id)}/>
                  {m.type==="status_reply"&&(
  <div style={{marginBottom:6}}>
    <div onClick={()=>{if(!m.reply_metadata?.statusId)return;window.dispatchEvent(new CustomEvent("celeste_close_conv"));window.__celesteSetTab?.("statuses",()=>window.dispatchEvent(new CustomEvent("celeste_open_status",{detail:{statusId:m.reply_metadata.statusId}})));}} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"6px 8px",borderLeft:`3px solid ${mine?"rgba(0,0,0,0.3)":T.goldL}`,marginBottom:4,cursor:m.reply_metadata?.statusId?"pointer":"default"}}>
      <div style={{width:40,height:40,borderRadius:6,overflow:"hidden",flexShrink:0,background:"rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {m.reply_metadata?.mediaUrl&&m.reply_metadata?.type!=="video"&&(
          <img src={m.reply_metadata.mediaUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}
            onError={e=>{e.target.style.display="none";const span=document.createElement("span");span.style.fontSize="14px";span.textContent="📷";e.target.parentNode.appendChild(span);}}/>
        )}
        {m.reply_metadata?.type==="video"&&m.reply_metadata?.mediaUrl&&(
  <video
    src={m.reply_metadata.mediaUrl+"#t=0.1"}
    style={{width:"100%",height:"100%",objectFit:"cover"}}
    preload="metadata"
    muted playsInline
    onLoadedData={e=>{e.target.pause();}}
  />
)}
{m.reply_metadata?.type==="video"&&!m.reply_metadata?.mediaUrl&&<Video size={18} color={T.goldL}/>}
        {!m.reply_metadata?.mediaUrl&&<FileText size={18} color={T.goldL}/>}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{margin:0,fontSize:10,fontWeight:600,color:mine?"rgba(0,0,0,0.5)":T.goldL}}>Statut</p>
        <p style={{margin:0,fontSize:11,color:mine?"rgba(0,0,0,0.6)":T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:m.reply_metadata?.previewText?"normal":"italic"}}>
          {m.reply_metadata?.previewText||"Photo/Vidéo"}
        </p>
      </div>
    </div>
  </div>
)}
                  {m.type==="note_reply"&&(
  <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"6px 8px",borderLeft:`3px solid ${mine?"rgba(0,0,0,0.3)":T.goldL}`,marginBottom:4}}>
    <div style={{flex:1,minWidth:0}}>
      <p style={{margin:0,fontSize:10,fontWeight:600,color:mine?"rgba(0,0,0,0.5)":T.goldL}}>A répondu à ta note</p>
      <p style={{margin:0,fontSize:11,color:mine?"rgba(0,0,0,0.6)":T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic"}}>
        {m.reply_metadata?.noteText||""}
      </p>
    </div>
  </div>
)}
                  {m.type==="post_share"&&(
                    <div onClick={e=>{e.stopPropagation();m.shared_post_id&&window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:m.shared_post_id}}));}}
                      style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.06)",borderRadius:12,padding:"8px 10px",cursor:m.shared_post_id?"pointer":"default",maxWidth:240,width:"100%",boxSizing:"border-box"}}>
                      <div style={{width:44,height:44,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {m.reply_metadata?.mediaUrl
                          ?<img src={m.reply_metadata.mediaUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          :<FileText size={18} color={T.goldL}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:11,fontWeight:700,color:mine?"rgba(0,0,0,0.55)":T.goldL}}>
                          Publication{m.reply_metadata?.authorName?` de ${m.reply_metadata.authorName}`:""}
                        </p>
                        <p style={{margin:0,fontSize:12,color:mine?"rgba(0,0,0,0.6)":T.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {m.reply_metadata?.previewText||"Voir la publication"}
                        </p>
                      </div>
                    </div>
                  )}
                  {(m.type==="photo"||m.type==="image")&&(
                    m.view_once
                      ? (mine
                          ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:"rgba(0,0,0,0.55)"}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Photo vue unique envoyée</span></div>
                          : (revealedOnce.has(m.id)
                              ? <div onClick={()=>setOpenViewOnce({id:m.id,type:"image"})} style={{position:"relative",borderRadius:10,overflow:"hidden",cursor:"pointer",height:120,background:T.glassMid,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  <div style={{position:"absolute",inset:0,filter:"blur(14px)",opacity:0.4,backgroundImage:`url(${viewOnceUrls[m.id]})`,backgroundSize:"cover",backgroundPosition:"center"}}/>
                                  <div style={{position:"relative",display:"flex",alignItems:"center",gap:6,color:"#fff",fontSize:12,fontWeight:600}}><Eye size={16}/>Revoir</div>
                                </div>
                              : (m.viewed_at
                                  ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:T.muted}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Photo vue unique consultée</span></div>
                                  : <Btn onClick={async()=>{await revealOnce(m);setOpenViewOnce({id:m.id,type:m.type==="video"?"video":"image"});}} disabled={revealingOnce.has(m.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"14px 16px",background:T.glassMid,borderRadius:10,color:T.text,opacity:revealingOnce.has(m.id)?0.6:1}}><Eye size={18}/><span style={{fontSize:13,fontWeight:600}}>{revealingOnce.has(m.id)?"Ouverture…":"Appuyer pour voir · vue unique"}</span></Btn>
                                )
                            )
                        )
                      : ((m.img||m.file_url)&&<MediaPlayer url={m.img||m.file_url} style={{borderRadius:10,maxHeight:200}} onImageClick={onImageView}/>)
                  )}
                  {m.type==="sticker"&&(m.img||m.file_url)&&<img src={m.img||m.file_url} alt="" onClick={e=>{e.stopPropagation();m.sticker_id&&setOpenStickerDetail(m.sticker_id);}} style={{width:100,height:100,objectFit:"contain",display:"block",cursor:m.sticker_id?"pointer":"default"}}/>}
                  {m.type==="file"&&(m.img||m.file_url)&&<Btn onClick={()=>window.open(m.img||m.file_url,"_blank")} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <span style={{display:"flex",flexShrink:0}}>{(m.fileName||"").match(/\.pdf$/i)?<FileText size={22} color={T.goldL}/>:(m.fileName||"").match(/\.(doc|docx)$/i)?<FileText size={22} color={T.goldL}/>:<Paperclip size={22} color={T.goldL}/>}</span>
                    <span style={{fontSize:12,fontWeight:600,color:mine?"#000":T.text,wordBreak:"break-all"}}>{m.fileName||"Fichier"}</span>
                  </Btn>}
                  {m.type==="voice"&&(
                    m.view_once
                      ? (mine
                          ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:"rgba(0,0,0,0.55)"}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Vocal vue unique envoyé</span></div>
                          : (revealedOnce.has(m.id)
                              ? <VoicePlayer src={viewOnceUrls[m.id]} mine={mine} T={T}/>
                              : (m.viewed_at
                                  ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:T.muted}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Vocal vue unique consulté</span></div>
                                  : <Btn onClick={()=>revealOnce(m)} disabled={revealingOnce.has(m.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"14px 16px",background:T.glassMid,borderRadius:10,color:T.text,opacity:revealingOnce.has(m.id)?0.6:1}}><Eye size={18}/><span style={{fontSize:13,fontWeight:600}}>{revealingOnce.has(m.id)?"Ouverture…":"Appuyer pour écouter · vue unique"}</span></Btn>
                                )
                            )
                        )
                      : ((m.img||m.file_url)&&<VoicePlayer src={m.img||m.file_url} mine={mine} T={T}/>)
                  )}
{m.type==="video"&&(
                    m.view_once
                      ? (mine
                          ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:"rgba(0,0,0,0.55)"}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Vidéo vue unique envoyée</span></div>
                          : (revealedOnce.has(m.id)
                              ? <div onClick={()=>setOpenViewOnce({id:m.id,type:"video"})} style={{position:"relative",borderRadius:10,overflow:"hidden",cursor:"pointer",height:120,background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  <video src={viewOnceUrls[m.id]} muted style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",filter:"blur(14px)",opacity:0.4}}/>
                                  <div style={{position:"relative",display:"flex",alignItems:"center",gap:6,color:"#fff",fontSize:12,fontWeight:600}}><Eye size={16}/>Revoir</div>
                                </div>
                              : (m.viewed_at
                                  ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:T.muted}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Vidéo vue unique consultée</span></div>
                                  : <Btn onClick={async()=>{await revealOnce(m);setOpenViewOnce({id:m.id,type:"video"});}} disabled={revealingOnce.has(m.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"14px 16px",background:T.glassMid,borderRadius:10,color:T.text,opacity:revealingOnce.has(m.id)?0.6:1}}><Eye size={18}/><span style={{fontSize:13,fontWeight:600}}>{revealingOnce.has(m.id)?"Ouverture…":"Appuyer pour voir · vue unique"}</span></Btn>
                                )
                            )
                        )
                      : ((m.img||m.file_url)&&<video src={m.img||m.file_url} controls playsInline style={{borderRadius:10,maxWidth:"100%",maxHeight:220,display:"block",background:"#000"}}/>)
                  )}
                  {(m.text||(m.type==="text"&&m.view_once))&&(
                    m.type==="text"&&m.view_once
                      ? (mine
                          ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:"rgba(0,0,0,0.55)"}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Message vue unique envoyé</span></div>
                          : (revealedOnce.has(m.id)
                              ? <><p style={{margin:0,fontSize:FONT_SIZES[fontSizeKey],fontWeight:600,color:mine?(bubbleColor?"#fff":"#000"):T.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{renderTextWithMentions(viewOnceTexts[m.id]||"")}</p><TranslateBtn text={viewOnceTexts[m.id]||""} dark={mine&&!bubbleColor}/></>
                              : (m.viewed_at
                                  ? <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",color:T.muted}}><EyeOff size={16}/><span style={{fontSize:12,fontWeight:600}}>Message vue unique consulté</span></div>
                                  : <Btn onClick={()=>revealOnce(m)} disabled={revealingOnce.has(m.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"14px 16px",background:T.glassMid,borderRadius:10,color:T.text,opacity:revealingOnce.has(m.id)?0.6:1}}><Eye size={18}/><span style={{fontSize:13,fontWeight:600}}>{revealingOnce.has(m.id)?"Ouverture…":"Appuyer pour lire · vue unique"}</span></Btn>
                                )
                            )
                        )
                      : (m.text&&<><p style={{margin:0,fontSize:FONT_SIZES[fontSizeKey],fontWeight:600,color:mine?(bubbleColor?"#fff":"#000"):T.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{renderTextWithMentions(m.text)}<EditedBadge message={m} T={T}/></p><TranslateBtn text={m.text} dark={mine&&!bubbleColor}/></>)
                  )}
                </div>
                <ReactionBar reactions={m.reactions} T={T} myId={session?.user?.id}/>
                {inlinePickerMsgId===m.id&&(
                  <InlineReactionPicker T={T} mine={mine}
                    onClose={()=>setInlinePickerMsgId(null)}
                    onSelect={emoji=>{
                      toggleReaction(sb,m.id,session?.user?.id,emoji,m.reactions).then(()=>reload());
                      setInlinePickerMsgId(null);
                    }}/>
                )}
              </div>
              </SwipeToReply>
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3,justifyContent:mine?"flex-end":"flex-start"}}>
                  <span style={{fontSize:10,color:T.muted}}>{hm(m.ts)}</span>
                  {isSending&&(m.type==="photo"||m.type==="file"||m.type==="voice"||m.type==="video")&&(
  <div style={{marginTop:6}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
      <span style={{fontSize:9,color:mine?"rgba(0,0,0,0.5)":T.muted}}>Envoi en cours…</span>
      <span style={{fontSize:9,color:mine?"rgba(0,0,0,0.5)":T.muted,fontWeight:700}}>{m.pct||0}%</span>
    </div>
    <div style={{width:"100%",height:4,background:"rgba(255,255,255,0.12)",borderRadius:2}}>
      <div style={{height:"100%",width:`${m.pct||0}%`,background:"linear-gradient(90deg,#A855F7,#7C3AED)",borderRadius:2,transition:"width 0.3s"}}/>
    </div>
  </div>
)}
                  {mine&&isSending&&!m.error&&<Check size={12} color={T.muted}/>}
{mine&&isSending&&!m.error&&<span style={{fontSize:9,color:T.muted,opacity:.6,animation:"pulse 1s ease infinite"}}>⏳</span>}
{mine&&m.blocked&&<span onClick={e=>{e.stopPropagation();retryMessage(sb,m.id,notify).then(reload);}} style={{fontSize:10,color:"#e0a852",fontWeight:600,cursor:"pointer"}}>🔒 Bloqué — appuie pour réessayer</span>}
{mine&&m.error&&!m.blocked&&<span onClick={e=>{e.stopPropagation();retryMessage(sb,m.id,notify).then(reload);}} style={{fontSize:10,color:"#e05252",fontWeight:600,cursor:"pointer"}}>⚠️ Réessayer</span>}
{mine&&!isSending&&!m.error&&<CheckCheck size={13} color={isRead?T.gold:T.muted} style={{transition:"color .3s"}}/>}
                  {mine&&!isSending&&<Btn onClick={()=>requestDeleteMsg(m.id)} style={{color:T.muted,opacity:.4,padding:0,display:"flex",alignItems:"center"}}><Trash2 size={10}/></Btn>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Attach menu */}
      {attach&&(
        <div style={{position:"relative",zIndex:2,background:"rgba(0,0,0,0.96)",borderTop:`1px solid ${T.border}`,padding:"12px 16px",display:"flex",gap:12,animation:"slideUp .2s ease"}}>
          <Btn onClick={()=>{iRef.current.click();setAttach(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 16px",background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:14,color:T.goldL,fontSize:12,fontWeight:600}}>
            <Camera size={20}/>Média
          </Btn>
          
          <Btn onClick={()=>{fRef.current.click();setAttach(false);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 16px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.sub,fontSize:12,fontWeight:600}}>
            <Paperclip size={20}/>Fichier
          </Btn>
          <Btn onClick={()=>setAttach(false)} style={{marginLeft:"auto",color:T.muted,padding:8,display:"flex",alignItems:"center"}}><X size={20}/></Btn>
        </div>
      )}

      {peerRecording?<TypingIndicator T={T} userName={user.name} mode="recording"/>:peerTyping?<TypingIndicator T={T} userName={user.name} mode="typing"/>:null}
      <ReplyComposerBar replyTo={replyTo} T={T} onCancel={()=>setReplyTo(null)}/>
      {/* Input */}
      <div style={{position:"relative",zIndex:2,background:T.bg2,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,padding:"10px 12px",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px) + var(--kb-height,0px))",flexShrink:0}}>
        {recording?(
          <div style={{display:"flex",alignItems:"center",gap:12,background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:20,padding:"10px 16px"}}>
            <div style={{display:"flex",gap:3,alignItems:"center"}}>
              {[0,1,2,3,4].map(i=>(<div key={i} style={{width:3,height:4+Math.sin(Date.now()/200+i)*8,background:T.err,borderRadius:2,animation:(recPaused||recInitializing)?"none":`waveform .6s ease ${i*.1}s infinite`,opacity:(recPaused||recInitializing)?0.4:1}}/>))}
            </div>
            <span style={{flex:1,color:T.err,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:"50%",background:T.err,display:"inline-block",animation:(recPaused||recInitializing)?"none":"pulse 1s ease infinite"}}/>{recInitializing?"Connexion micro…":`${recordSecs}s${recPaused?" (pause)":""}`}</span>
            {canPauseRec&&<Btn onClick={recPaused?resumeRecording:pauseRecording} disabled={recInitializing} style={{color:T.err,padding:"8px",display:"flex",alignItems:"center",opacity:recInitializing?0.4:1}}>{recPaused?<Play size={18}/>:<Pause size={18}/>}</Btn>}
            <Btn onClick={cancelRecording} style={{color:T.err,padding:"8px",display:"flex",alignItems:"center"}}><Trash2 size={20}/></Btn>
            <Btn onClick={stopRecording} disabled={recInitializing} style={{background:T.gradGold,borderRadius:20,padding:"8px 16px",color:"#000",fontWeight:700,fontSize:13,opacity:recInitializing?0.5:1}}>Envoyer</Btn>
          </div>
        ):(
          <>{offline&&<div style={{padding:"8px 16px",background:"rgba(255,100,50,0.08)",borderTop:"1px solid rgba(255,100,50,0.2)",display:"flex",alignItems:"center",gap:8}}>
  <WifiOff size={13} color="#FF6432"/>
  <span style={{fontSize:12,color:"#FF6432"}}>Hors ligne — les messages seront envoyés dès la reconnexion</span>
</div>}
         <div style={{display:"flex",gap:6,alignItems:"flex-end",position:"relative"}}>
  <Btn onClick={()=>iRef.current.click()} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center",flexShrink:0,background:"rgba(255,255,255,0.06)",borderRadius:"50%",width:36,height:36,justifyContent:"center"}}><Camera size={18}/></Btn>
 <Btn onClick={()=>notify?.("Vue unique en maintenance, réessaie plus tard")} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center",flexShrink:0,background:"rgba(255,255,255,0.06)",borderRadius:"50%",width:36,height:36,justifyContent:"center",opacity:0.5}}><Eye size={18}/></Btn>
  <Btn onClick={()=>setShowStickerPicker(v=>!v)} style={{color:showStickerPicker?T.goldL:T.muted,padding:"6px",display:"flex",alignItems:"center",flexShrink:0,background:"rgba(255,255,255,0.06)",borderRadius:"50%",width:36,height:36,justifyContent:"center"}}><StickerIcon size={18}/></Btn>
  {showStickerPicker&&(
    <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,width:300,maxWidth:"90vw",zIndex:20}}>
      <StickerPicker sb={sb} T={T} Av={Av} userId={session?.user?.id} onClose={()=>setShowStickerPicker(false)} onSelect={sendSticker}/>
    </div>
  )}
  <div style={{flex:1,background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.10)`,borderRadius:22,padding:"9px 14px",transition:"border-color .2s"}}>
    <textarea ref={msgTaRef} value={inp} onChange={e=>{
setInp(e.target.value);
notifyTyping();
setChatDrafts(d=>({...d,[conv.id]:e.target.value}));
e.target.style.height="auto";
e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
}}
onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();sendTxt();}}}
placeholder={isBlocked?"Vous ne pouvez plus échanger avec cette personne":"Votre message…"} rows={1} disabled={isBlocked}
style={{width:"100%",background:"none",border:"none",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.5,maxHeight:120,overflowY:"auto",height:"auto",fontFamily:"inherit",opacity:isBlocked?0.5:1}}/></div>  <Btn onClick={()=>fRef.current.click()} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center",flexShrink:0,background:"rgba(255,255,255,0.06)",borderRadius:"50%",width:36,height:36,justifyContent:"center"}}><Paperclip size={18}/></Btn>
  {inp.trim()
    ?<Btn onClick={sendTxt} disabled={sending||isBlocked} style={{background:(sending||isBlocked)?"rgba(124,58,237,0.35)":"linear-gradient(135deg,#A855F7,#7C3AED)",borderRadius:"50%",width:38,height:38,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:(sending||isBlocked)?"none":"0 4px 16px rgba(124,58,237,0.5)"}}>
      <Send size={17}/>
    </Btn>
    :<Btn onClick={startRecording} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center",flexShrink:0,background:"rgba(255,255,255,0.06)",borderRadius:"50%",width:36,height:36,justifyContent:"center"}}>
      <Mic size={18}/>
    </Btn>
  }
</div>
        </>
        )}
        

      {/* Panneau Gemini */}
      {showGemini&&(
        <div style={{position:"fixed",inset:0,zIndex:300,background:T.bg,display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}}>
          {/* Header */}
          <div style={{padding:"12px 16px",background:"rgba(0,0,0,0.95)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 16px rgba(123,47,190,0.4)"}}><Sparkles size={22} color="#fff"/></div>
            <div style={{flex:1}}>
              <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Céleste IA</p>
              <p style={{margin:0,fontSize:11,color:"#9B6FDE"}}>Toujours là pour toi ✦</p>
            </div>
            <Btn onClick={()=>setShowGemini(false)} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
            {geminiMsgs.length===0&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:T.muted,textAlign:"center",padding:"40px 20px"}}>
                <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,boxShadow:"0 8px 32px rgba(123,47,190,0.4)",animation:"float 3s ease infinite"}}><Sparkles size={22} color="#fff"/></div>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:T.text}}>Bonjour, je suis Céleste</p>
                <p style={{fontSize:13,color:T.sub,lineHeight:1.7}}>Je suis là pour t'écouter, t'encourager et t'accompagner. De quoi as-tu besoin aujourd'hui ?</p>
              </div>
            )}
            {geminiMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10,animation:"msgIn .3s ease"}}>
                {m.role==="model"&&<div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}><Sparkles size={22} color="#fff"/></div>}
                <div style={{maxWidth:"80%",background:m.role==="user"?T.gradGold:"rgba(123,47,190,0.12)",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",border:m.role==="model"?"1px solid rgba(123,47,190,0.2)":"none",boxShadow:m.role==="user"?"0 4px 16px rgba(201,149,42,0.25)":"0 2px 8px rgba(0,0,0,0.2)"}}>
                  <p style={{margin:0,fontSize:14,color:m.role==="user"?"#000":T.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{m.text}</p>
                </div>
              </div>
            ))}
            {geminiLoading&&(
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}><Sparkles size={22} color="#fff"/></div>
                <div style={{background:"rgba(123,47,190,0.12)",borderRadius:"18px 18px 18px 4px",padding:"12px 16px",border:"1px solid rgba(123,47,190,0.2)"}}>
                  <div style={{display:"flex",gap:4,alignItems:"center"}}>
                    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#9B6FDE",animation:`pulse .6s ease ${i*.2}s infinite`}}/>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{padding:"12px 16px",paddingBottom:"calc(12px + env(safe-area-inset-bottom,0px))",background:"rgba(0,0,0,0.95)",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"flex-end",flexShrink:0}}>
            {!navigator.onLine&&<div style={{padding:"8px 12px",background:"rgba(255,100,50,0.08)",borderRadius:10,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><WifiOff size={12} color="#FF6432"/><span style={{fontSize:11,color:"#FF6432"}}>Hors ligne — tu peux relire mais pas poser de nouvelles questions</span></div>}
            <div style={{flex:1,background:"rgba(123,47,190,0.08)",border:"1px solid rgba(123,47,190,0.2)",borderRadius:20,padding:"10px 16px"}}>
              <textarea value={geminiInp} onChange={e=>{
    setGeminiInp(e.target.value);
    e.target.style.height="auto";
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";

  }}
  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();askGemini(geminiInp);}}}
  placeholder="Écris à Céleste…" rows={1}
  style={{width:"100%",background:"none",border:"none",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.5,maxHeight:120,overflowY:"auto",height:"auto"}}/>
            </div>
            <Btn onClick={()=>askGemini(geminiInp)} disabled={geminiLoading||!geminiInp.trim()||!navigator.onLine} style={{background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",borderRadius:"50%",width:42,height:42,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(123,47,190,0.4)",opacity:geminiLoading||!geminiInp.trim()?0.5:1}}>
              <Send size={18}/>
            </Btn>
          </div>
        </div>
      )}

      {selectedMsg&&(
        <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end"}} onClick={()=>{popNav();setSelectedMsg(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:"rgba(16,16,16,0.98)",borderRadius:"22px 22px 0 0",paddingBottom:"env(safe-area-inset-bottom,12px)",animation:"slideUp .2s ease"}}>
            <div style={{display:"flex",justifyContent:"center",gap:10,padding:"14px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              {QUICK_REACTIONS.map(e=>(
                <button key={e} onClick={()=>{toggleReaction(sb,selectedMsg.id,session?.user?.id,e,selectedMsg.reactions).then(()=>reload());popNav();setSelectedMsg(null);}}
                  style={{background:"none",border:"none",fontSize:26,cursor:"pointer",padding:4}}>
                  {e}
                </button>
              ))}
            </div>
            {selectedMsg.text&&<div style={{padding:"14px 20px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <p style={{margin:0,fontSize:12,color:T.muted,lineHeight:1.5,maxHeight:50,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{selectedMsg.text}</p>
            </div>}
            <Btn onClick={()=>{setReplyTo({id:selectedMsg.id,text:selectedMsg.text||mediaReplyLabel(selectedMsg.type,selectedMsg.fileName)||"",authorName:(selectedMsg.f==="me"||selectedMsg.f===session?.user?.id)?"Vous":user.name});popNav();setSelectedMsg(null);}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.text,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <Reply size={18}/><span>Répondre</span>
            </Btn>
            
            {(selectedMsg.f==="me"||selectedMsg.f===session?.user?.id)&&selectedMsg.text&&(
              <Btn onClick={()=>{setEditingMsg(selectedMsg);setInp(selectedMsg.text);popNav();setSelectedMsg(null);}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.text,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <Edit2 size={18}/><span>Modifier</span>
              </Btn>
            )}
            <Btn onClick={()=>{
              navigator.clipboard?.writeText(selectedMsg.text||"").then(()=>notify("Copié !")).catch(()=>notify("Impossible de copier"));
              setSelectedMsg(null);
            }} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.text,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <Copy size={18}/><span>Copier</span>
            </Btn>
            {(selectedMsg.f==="me"||selectedMsg.f===session?.user?.id)&&(
              <Btn onClick={()=>{popNav();requestDeleteMsg(selectedMsg.id);setSelectedMsg(null);}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.err,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <Trash2 size={18}/><span>Supprimer</span>
              </Btn>
            )}
            <Btn onClick={()=>{popNav();setSelectedMsg(null);}} style={{width:"100%",padding:"14px 20px",fontSize:14,color:T.muted,textAlign:"center"}}>Annuler</Btn>
          </div>
        </div>
      )}
      {confirmDeleteId&&(
        <div style={{position:"fixed",inset:0,zIndex:520,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end"}} onClick={()=>{popNav();setConfirmDeleteId(null);}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:"rgba(16,16,16,0.98)",borderRadius:"22px 22px 0 0",paddingBottom:"env(safe-area-inset-bottom,12px)",animation:"slideUp .2s ease"}}>
            <div style={{padding:"20px 20px 14px",textAlign:"center"}}>
              <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Supprimer ce message ?</p>
              <p style={{margin:"6px 0 0",fontSize:12,color:T.muted}}>Cette action est irréversible.</p>
            </div>
            <Btn onClick={()=>{deleteMsg(confirmDeleteId);setConfirmDeleteId(null);}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.err,textAlign:"center",fontWeight:600,borderTop:"1px solid rgba(255,255,255,0.07)"}}>Supprimer</Btn>
            <Btn onClick={()=>setConfirmDeleteId(null)} style={{width:"100%",padding:"14px 20px",fontSize:14,color:T.muted,textAlign:"center"}}>Annuler</Btn>
          </div>
        </div>
      )}
      {showReactionPicker&&(
        <ReactionPicker T={T} onClose={()=>setShowReactionPicker(null)}
          onSelect={emoji=>{
            const target=[...(conv.msgs||[])].find(m=>m.id===showReactionPicker);
            toggleReaction(sb,showReactionPicker,session?.user?.id,emoji,target?.reactions).then(()=>reload());
          }}/>
      )}
      {openViewOnce&&<ViewOnceViewer type={openViewOnce.type} url={viewOnceUrls[openViewOnce.id]} onClose={()=>setOpenViewOnce(null)}/>}
      </div>
    </div>
  );
}
const SocialIconWrap=({size=13,children})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const IgIcon=({size})=><SocialIconWrap size={size}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"/></SocialIconWrap>;
const TtIcon=({size})=><SocialIconWrap size={size}><path d="M14 4v10.8a3.3 3.3 0 1 1-3.3-3.3"/><path d="M14 4c0 2.6 2.1 4.7 4.7 4.7v2.6c-1.8 0-3.4-.6-4.7-1.7"/></SocialIconWrap>;
const WaIcon=({size})=><SocialIconWrap size={size}><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-5.4A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 10.5c.3 2.5 2.5 4.5 5 4.7"/></SocialIconWrap>;
const FbIcon=({size})=><SocialIconWrap size={size}><circle cx="12" cy="12" r="9"/><path d="M14 8.5h-1.5A2 2 0 0 0 10.5 10.5V21M9 13.5h4"/></SocialIconWrap>;
const XIcon=({size})=><SocialIconWrap size={size}><path d="M5 5l14 14M19 5L5 19"/></SocialIconWrap>;
const YtIcon=({size})=><SocialIconWrap size={size}><rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/></SocialIconWrap>;
const LiIcon=({size})=><SocialIconWrap size={size}><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="7.5" y1="10.5" x2="7.5" y2="17"/><circle cx="7.5" cy="7" r="0.6" fill="currentColor"/><path d="M11.5 17v-4.5a2 2 0 0 1 4 0V17"/><line x1="11.5" y1="10.5" x2="11.5" y2="17"/></SocialIconWrap>;
const TgIcon=({size})=><SocialIconWrap size={size}><path d="M21 3L2 10.5l6 2 2 6.5 3-4 5 3z"/></SocialIconWrap>;
const LINK_ICON_MAP=[
  {re:/instagram\.com/i,Icon:IgIcon},
  {re:/tiktok\.com/i,Icon:TtIcon},
  {re:/(wa\.me|whatsapp\.com)/i,Icon:WaIcon},
  {re:/(facebook\.com|fb\.com)/i,Icon:FbIcon},
  {re:/(twitter\.com|x\.com)/i,Icon:XIcon},
  {re:/(youtube\.com|youtu\.be)/i,Icon:YtIcon},
  {re:/linkedin\.com/i,Icon:LiIcon},
  {re:/(t\.me|telegram\.me)/i,Icon:TgIcon},
];
const getLinkIcon=url=>(LINK_ICON_MAP.find(({re})=>re.test(url||""))||{}).Icon||Globe;
function LinksRow({links}){
  const items=(links||[]).filter(l=>l?.url).slice(0,5);
  if(!items.length)return null;
  return(
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
      {items.map((l,i)=>{
        const Icon=getLinkIcon(l.url);
        return(
          <a key={i} href={l.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
            style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 9px",background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:14,color:T.goldL,fontSize:10,fontWeight:600,textDecoration:"none",maxWidth:110,overflow:"hidden"}}>
            <Icon size={10}/>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.label||l.url.replace(/^https?:\/\//,"").replace(/\/$/,"")}</span>
          </a>
        );
      })}
    </div>
  );
}

function LinksEditor({links,onChange}){
  const rows=links&&links.length?links:[{label:"",url:""}];
  const update=(i,field,val)=>onChange(rows.map((r,j)=>j===i?{...r,[field]:val}:r));
  const addRow=()=>{if(rows.length<5)onChange([...rows,{label:"",url:""}]);};
  const removeRow=i=>onChange(rows.filter((_,j)=>j!==i));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <p style={{margin:"4px 0 0",fontSize:11,color:T.muted,letterSpacing:.5,textTransform:"uppercase"}}>Liens (5 max)</p>
      {rows.map((r,i)=>(
        <div key={i} style={{display:"flex",gap:6}}>
          <input value={r.label} onChange={e=>update(i,"label",e.target.value)} placeholder="Nom" maxLength={20}
            style={{width:90,flexShrink:0,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 10px",color:T.text,fontSize:12,outline:"none"}}/>
          <input value={r.url} onChange={e=>update(i,"url",e.target.value)} placeholder="https://…"
            style={{flex:1,minWidth:0,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 10px",color:T.text,fontSize:12,outline:"none"}}/>
          <Btn onClick={()=>removeRow(i)} style={{width:32,height:32,flexShrink:0,borderRadius:8,background:"rgba(255,80,80,0.1)",color:"#ff6b6b",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></Btn>
        </div>
      ))}
      {rows.length<5&&(
        <Btn onClick={addRow} style={{alignSelf:"flex-start",padding:"6px 12px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,color:T.goldL,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:5}}><Plus size={12}/> Ajouter un lien</Btn>
      )}
    </div>
  );
}

// ── USER VIEW ─────────────────────────────────────────────
// ── USER VIEW ─────────────────────────────────────────────
function UserView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,myFollowers,onConnectionChange,onImageView,userPostsVersion=0,toggleLike,toggleSave,popNav,pushNav}){
  const conn=(myConnections||[]).includes(user.id);
  const [followersCount,setFollowersCount]=useState("…");
  const [followingCount,setFollowingCount]=useState("…");
  const [blocked,setBlocked]=useState(false);
  const [blockedByOther,setBlockedByOther]=useState(false);
   const [showReport,setShowReport]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
  const [coverUrl,setCoverUrl]=useState(user.cover_url||null);
  const [avatarUrl,setAvatarUrl]=useState(user.avatar_url||null);
  const [userNote,setUserNote]=useState(null);
  const [replyNote,setReplyNote]=useState(null);
  useEffect(()=>{
    sb.from("notes").select("*").eq("user_id",user.id).gt("expires_at",new Date().toISOString()).maybeSingle()
      .then(({data})=>setUserNote(data||null));
  },[user.id]);

  useEffect(()=>{
    sb.from("profiles").select("cover_url,avatar_url,screenshot_protection").eq("id",user.id).single()
      .then(({data})=>{
        if(data?.cover_url)setCoverUrl(data.cover_url);
        if(data?.avatar_url)setAvatarUrl(data.avatar_url);
        if(data?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
      });
    const ch=sb.channel(`privacy_profile_${user.id}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${user.id}`},payload=>{
        if(payload.new?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
      })
      .subscribe();
    return()=>{sb.removeChannel(ch);disableScreenProtection();};
  },[user.id]);

  useEffect(()=>{
  if(session?.user?.id&&user?.id&&!myProfile?.hide_online)logProfileView(sb,session.user.id,user.id);
},[user.id,session?.user?.id,myProfile?.hide_online]);

  useEffect(()=>{
    Promise.all([
      sb.from("connections").select("id",{count:"exact",head:true}).eq("to_id",user.id),
      sb.from("connections").select("id",{count:"exact",head:true}).eq("from_id",user.id),
    ]).then(([{count:fc},{count:fg}])=>{setFollowersCount(fc||0);setFollowingCount(fg||0);});
    sb.from("blocks").select("blocker_id,blocked_id").or(`and(blocker_id.eq.${session?.user?.id},blocked_id.eq.${user.id}),and(blocker_id.eq.${user.id},blocked_id.eq.${session?.user?.id})`).then(({data})=>{
      setBlocked((data||[]).some(b=>b.blocker_id===session?.user?.id));
      setBlockedByOther((data||[]).some(b=>b.blocker_id===user.id));
    }); 
  },[user.id,session?.user?.id]);

  const toggle=async()=>{
    if(conn){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",user.id);notify("Retiré");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:user.id});notify("Connecté ✦");}
    onConnectionChange();
  };

  const handleBlock=async()=>{
    if(!(await confirmAction(blocked?"Débloquer cette personne ?":"Bloquer cette personne ?",{confirmLabel:blocked?"Débloquer":"Bloquer"})))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");onConnectionChange?.();}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");onConnectionChange?.();}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,title:data.event_title||null,eventDate:data.event_date||null,eventTime:data.event_time||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),participants:(data.event_participants||[]).map(x=>x.user_id),comments:[],is_private:data.is_private||false,comments_disabled:data.comments_disabled||false,ts:new Date(data.created_at).getTime()};
  };
const [uPosts,setUPosts]=useState((posts||[]).filter(p=>p.by===user.id));
  const localToggleLike=async pid=>{
    const uid=session?.user?.id;
    const post=uPosts.find(p=>p.id===pid);
    if(!post)return;
    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);
    setUPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,likes:liked?(p.likes||[]).filter(l=>(l.user_id||l)!==uid):[...(p.likes||[]),uid]}));
    await toggleLike(pid);
  };
  const localToggleParticipate=async pid=>{
    const uid=session?.user?.id;
    const post=uPosts.find(p=>p.id===pid);
    if(!post)return;
    const participating=(post.participants||[]).some(x=>(x.user_id||x)===uid);
    setUPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,participants:participating?(p.participants||[]).filter(x=>(x.user_id||x)!==uid):[...(p.participants||[]),uid]}));
    try{
      if(participating)await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
      else await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
    }catch(e){console.warn("toggleParticipate error:",e);}
  };
  const isUVid=p=>p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video"));
  const uPhotoPosts=uPosts.filter(p=>!isUVid(p));
  const uVideoPosts=uPosts.filter(p=>isUVid(p));
  const [uTab,setUTab]=useState("posts");
 const [uViewerIndex,setUViewerIndex]=useState(null);
  const [uCommentPost,setUCommentPost]=useState(null);
  const [uCloseCallback,setUCloseCallback]=useState(null);
  const [uCommentLiveCount,setUCommentLiveCount]=useState(0);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [uViewerFallback,setUViewerFallback]=useState(null);
  const hasUVisual=p=>isUVid(p)||p.type==="poll"||p.type==="event"||p.img||(p.media_urls&&p.media_urls.length>0);
  const uVisualPosts=uPosts;
  const loadUPosts=useCallback(async()=>{
    const{data}=await sb.from("posts").select(`*,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id)`).eq("author_id",user.id).order("created_at",{ascending:false});
   if(data){
     const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],is_private:p.is_private||false,comments_disabled:p.comments_disabled||false,likes:(p.likes||[]).map(l=>l.user_id),participants:(p.event_participants||[]).map(x=>x.user_id),comments:[],ts:new Date(p.created_at).getTime(),profile_pinned:p.profile_pinned||false,poll_multiple:p.poll_multiple||false,poll_options:p.poll_options||[],poll_votes:p.poll_votes||[],is_for_sale:p.is_for_sale||false,whatsapp_contact:p.whatsapp_contact||null,contact_link:p.contact_link||null,expires_at:p.expires_at||null,price:p.price||null,stock:p.stock??null,deal_type:p.deal_type||null,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null}));
     mapped.sort((a,b)=>(b.profile_pinned?1:0)-(a.profile_pinned?1:0));
     setUPosts(mapped);
   }
  },[user.id]);
  useEffect(()=>{
    loadUPosts();
  },[user.id,userPostsVersion]);
const openPostFromSound=(post,soundPosts)=>{
  const list=(soundPosts||uVisualPosts).filter(hasUVisual);
  const idx=list.findIndex(q=>q.id===post.id);
  setUViewerFallback(soundPosts?list:null);
  pushNav(()=>{setUViewerIndex(null);setUViewerFallback(null);});
  setUViewerIndex(idx>=0?idx:0);
};
if(blocked||blockedByOther) return(
  <div style={{flex:1,display:"flex",flexDirection:"column",background:T.bg}}>
    <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`}}>
      <Btn onClick={()=>onBack?.()} style={{color:T.muted,display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.text}}>Profil</span>
    </div>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:40}}>
      <div style={{width:96,height:96,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:`2px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:42}}>🚫</div>
      <p style={{margin:0,fontSize:17,fontWeight:700,color:T.text}}>{blocked?"Profil bloqué":"Profil non disponible"}</p>
      <p style={{margin:0,fontSize:13,color:T.muted,textAlign:"center",lineHeight:1.6}}>{blocked?<>Tu as bloqué cet utilisateur.<br/>Son contenu n'est plus visible.</>:"Ce profil n'est pas disponible."}</p>
      {blocked&&<Btn onClick={handleBlock} style={{marginTop:8,padding:"10px 28px",borderRadius:20,border:`1px solid ${T.err}44`,background:"rgba(200,64,64,0.08)",color:"#e06060",fontSize:13,fontWeight:600}}>Débloquer</Btn>}
    </div>
  </div>
);
if(user?.status==="suspended") return(
  <div style={{flex:1,display:"flex",flexDirection:"column",background:T.bg}}>
    <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`}}>
      <Btn onClick={()=>onBack?.()} style={{color:T.muted,display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.text}}>Profil</span>
    </div>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:40}}>
      <div style={{width:96,height:96,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:`2px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:42}}>🚫</div>
      <p style={{margin:0,fontSize:17,fontWeight:700,color:T.text}}>Compte suspendu</p>
      <p style={{margin:0,fontSize:13,color:T.muted,textAlign:"center",lineHeight:1.6}}>Ce compte a été désactivé<br/>par les administrateurs.</p>
    </div>
  </div>
);
  const stats=[{l:"POSTS",v:uPosts.length},{l:"ABONNÉS",v:followersCount},{l:"ABONNEMENTS",v:followingCount}];
  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {showReport&&<ReportModal onClose={()=>setShowReport(false)} onSubmit={handleReport}/>}
      {uViewerIndex!==null&&toggleLike&&toggleSave&&(
        <FeedViewer
          posts={uViewerFallback||uVisualPosts}
          sb={sb} T={T} Av={Av}
          startIndex={uViewerIndex}
          onClose={()=>{popNav();setUViewerIndex(null);setUViewerFallback(null);}}
          toggleLike={localToggleLike}
          toggleSave={toggleSave}
          onParticipate={localToggleParticipate}
          session={session}
          myProfile={myProfile}
          notify={notify}
          onUser={()=>{}}
          onOpenComments={(p,cb)=>{pushNav(()=>{setUCommentPost(null);setUCloseCallback(null);});setUCommentPost(p);setUCloseCallback(()=>cb);}}
          myConnections={myConnections}
          onConnect={()=>toggle()}
          onOpenSound={setOpenSoundId}
        />
      )}
      {openSoundId&&<SoundDetailModal sb={sb} T={T} Av={Av} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
      {uCommentPost&&(
        <CommentsOnlyModal
          post={uCommentPost}
          session={session}
          getM={id=>id===user.id?user:myProfile}
          onCountChange={setUCommentLiveCount}
          onClose={()=>{
            popNav();
            setUCommentPost(null);
            if(uCloseCallback){uCloseCallback(uCommentLiveCount);setUCloseCallback(null);}
          }}
        />
      )}

      <ProfileHeader
        T={T} Av={Av} Badge={Badge} fmtCount={fmtCount}
        coverUrl={coverUrl} color={user.color} avatarShape="circle"
        avatarUrl={avatarUrl} user={user}
        note={userNote?.text} onNoteClick={()=>{if(!userNote)return;pushNav(()=>setReplyNote(null));setReplyNote({...userNote,author:user});}}
        onAvatarClick={()=>{if(avatarUrl)window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url:avatarUrl}}));}}
        title={user.fullName||user.name}
        subtitle={<><MapPin size={11}/> {user.paroisse}</>}
        extraLines={<>
          {user.bio&&<p style={{margin:0,fontSize:14,color:T.sub,lineHeight:1.7}}>{user.bio.split(/(https?:\/\/[^\s]+)/g).map((part,i)=>
            /^https?:\/\//.test(part)
              ?<a key={i} href={part} target="_blank" rel="noreferrer" style={{color:T.goldL,textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>
              :part
          )}</p>}
          <LinksRow links={user.links}/>
        </>}
        stats={[
          {l:"POSTS",v:uPosts.length,icon:<Grid size={14}/>},
          {l:"ABONNÉS",v:followersCount,icon:<Users size={14}/>},
          {l:"ABONNEMENTS",v:followingCount,icon:<UserCheck size={14}/>},
        ]}
        actions={<>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={()=>onChat(user.id)} style={{background:"rgba(10,10,10,0.85)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"10px 14px",color:"#fff",fontSize:11,fontWeight:600,backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}}>Message</Btn>
            
            <Btn onClick={toggle} style={{background:conn?"rgba(201,149,42,0.85)":T.gradGold,border:conn?`1px solid ${T.gold}`:"none",borderRadius:20,padding:"10px 14px",color:"#000",fontSize:11,fontWeight:700,boxShadow:"0 4px 16px rgba(201,149,42,0.4)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}}>{conn?"✦ Connecté":"+ Connecter"}</Btn>
          </div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:8}}>
            <Btn onClick={handleBlock} style={{background:"rgba(200,64,64,0.08)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:10,padding:"5px 12px",color:"#e06060",fontSize:11,fontWeight:600}}>{blocked?"Débloquer":"Bloquer"}</Btn>
            <Btn onClick={()=>setShowReport(true)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,padding:"5px 12px",color:T.muted,fontSize:11,fontWeight:600}}>Signaler</Btn>
          </div>
        </>}
      />

      <div style={{padding:"0 18px 80px",maxWidth:640,margin:"0 auto"}}>

        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:16}}>
          {[{k:"posts",l:"Publications"},{k:"reels",l:"Reels"}].map(t=>(
            <Btn key={t.k} onClick={()=>setUTab(t.k)} style={{flex:1,padding:"11px 6px",background:"none",color:uTab===t.k?T.goldL:T.muted,fontSize:12,fontWeight:uTab===t.k?700:400,borderRadius:0,transition:"all .2s",borderBottom:uTab===t.k?`2px solid ${T.gold}`:"2px solid transparent"}}>
              {t.l}
            </Btn>
          ))}
        </div>
        {uTab==="posts"&&(
          uPhotoPosts.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8,animation:"float 3s ease infinite"}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucune publication encore</p></div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
            {uPhotoPosts.map(p=>(<div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:p.is_private&&!isNative?"default":"pointer"}} onClick={()=>{
                if(p.is_private&&!isNative)return;
                const idx=uVisualPosts.findIndex(q=>q.id===p.id);
                pushNav(()=>{setUViewerIndex(null);setUViewerFallback(null);});
                setUViewerIndex(idx>=0?idx:0);
              }}>
                {p.is_private&&!isNative?(
                  <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(255,255,255,0.03)"}}>
                    <Lock size={20} color={T.goldL}/>
                    <p style={{margin:0,fontSize:9,color:T.muted,textAlign:"center",padding:"0 8px"}}>Disponible sur l'app</p>
                  </div>
                ):p.img
                  ?<SmartImage src={p.img} alt=""/>
                  :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:4}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.gold}}>✦</span>
                    <p style={{margin:0,fontSize:10,color:T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text||p.title}</p>
                  </div>
                }
                {(p.type==="poll"||p.type==="event")&&(
  <div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.65)",borderRadius:8,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.goldL,letterSpacing:.3,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",whiteSpace:"nowrap"}}>
    {p.type==="poll"?"Sondage":"Événement"}
  </div>
)}
                <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {fmtCount((p.likes||[]).length)}</span>
                </div>
                {p.profile_pinned&&(
                  <div style={{position:"absolute",top:6,left:6,background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
                    <Pin size={11} color={T.goldL}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {uTab==="reels"&&(
          uVideoPosts.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucun reel encore</p></div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
            {uVideoPosts.map(p=>(
              <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:p.is_private&&!isNative?"default":"pointer"}}
                onClick={()=>{
                  if(p.is_private&&!isNative)return;
                  const idx=uVisualPosts.findIndex(q=>q.id===p.id);
                  pushNav(()=>{setUViewerIndex(null);setUViewerFallback(null);});
                  setUViewerIndex(idx>=0?idx:0);
                }}>
                {p.is_private&&!isNative?(
                  <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(255,255,255,0.03)"}}>
                    <Lock size={20} color={T.goldL}/>
                    <p style={{margin:0,fontSize:9,color:T.muted,textAlign:"center",padding:"0 8px"}}>Disponible sur l'app</p>
                  </div>
                ):<VideoThumb src={p.img}/>}
                <div style={{position:"absolute",bottom:4,right:6}}><span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {fmtCount((p.likes||[]).length)}</span></div>
              </div>
            ))}
          </div>
        )}
        <div style={{height:80}}/>
      </div>
      {replyNote&&<NoteReplyModal sb={sb} T={T} Av={Av} session={session} note={replyNote} notify={notify} onClose={()=>{popNav();setReplyNote(null);}}/>}
    </div>
  );
}

// ── ORG VIEW ──────────────────────────────────────────────
function OrgView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,onConnectionChange,onImageView,toggleLike,toggleSave,userPostsVersion=0,pushNav,popNav}){
  const conn=(myConnections||[]).includes(user.id);
  const [followersCount,setFollowersCount]=useState("…");
  const [coverPhoto,setCoverPhoto]=useState(user.cover_url||null);
  const [blocked,setBlocked]=useState(false);
  const [blockedByOther,setBlockedByOther]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
 const [oViewerIndex,setOViewerIndex]=useState(null);
  const [oCommentPost,setOCommentPost]=useState(null);
  const [oCloseCallback,setOCloseCallback]=useState(null);
  const [oCommentLiveCount,setOCommentLiveCount]=useState(0);
  const [oViewerFallback,setOViewerFallback]=useState(null);
  const fileRef=useRef(); const coverRef=useRef();
 const [orgNote,setOrgNote]=useState(null);
  useEffect(()=>{
    sb.from("notes").select("*").eq("user_id",user.id).gt("expires_at",new Date().toISOString()).maybeSingle()
      .then(({data})=>setOrgNote(data||null));
  },[user.id]);
  const [replyNote,setReplyNote]=useState(null);

  useEffect(()=>{
    sb.from("connections").select("id",{count:"exact",head:true}).eq("to_id",user.id).then(({count})=>setFollowersCount(count||0));
    sb.from("blocks").select("blocker_id,blocked_id").or(`and(blocker_id.eq.${session?.user?.id},blocked_id.eq.${user.id}),and(blocker_id.eq.${user.id},blocked_id.eq.${session?.user?.id})`).then(({data})=>{
      setBlocked((data||[]).some(b=>b.blocker_id===session?.user?.id));
      setBlockedByOther((data||[]).some(b=>b.blocker_id===user.id));
    });
  },[user.id,session?.user?.id]);

  const toggle=async()=>{
    if(conn){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",user.id);notify("Retiré");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:user.id});notify("Abonné ✦");}
    onConnectionChange();
  };

  const handleBlock=async()=>{
    if(!(await confirmAction(blocked?"Débloquer cette personne ?":"Bloquer cette personne ?",{confirmLabel:blocked?"Débloquer":"Bloquer"})))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");onConnectionChange?.();}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");onConnectionChange?.();}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventTime:data.event_time||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),participants:(data.event_participants||[]).map(x=>x.user_id),comments:[],is_private:data.is_private||false,comments_disabled:data.comments_disabled||false,ts:new Date(data.created_at).getTime()};
  };

 const isMe=session?.user?.id===user.id;
  const [uPosts,setUPosts]=useState((posts||[]).filter(p=>p.by===user.id));
  const loadUPosts=useCallback(async()=>{
    const{data}=await sb.from("posts").select(`*,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id)`).eq("author_id",user.id).order("created_at",{ascending:false});
    if(data){
      const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],is_private:p.is_private||false,comments_disabled:p.comments_disabled||false,likes:(p.likes||[]).map(l=>l.user_id),participants:(p.event_participants||[]).map(x=>x.user_id),comments:[],ts:new Date(p.created_at).getTime(),profile_pinned:p.profile_pinned||false,poll_multiple:p.poll_multiple||false,poll_options:p.poll_options||[],poll_votes:p.poll_votes||[],is_for_sale:p.is_for_sale||false,whatsapp_contact:p.whatsapp_contact||null,contact_link:p.contact_link||null,expires_at:p.expires_at||null,price:p.price||null,stock:p.stock??null,deal_type:p.deal_type||null,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null}));
      mapped.sort((a,b)=>(b.profile_pinned?1:0)-(a.profile_pinned?1:0));
      setUPosts(mapped);
    }
  },[user.id]);
  useEffect(()=>{loadUPosts();},[user.id,userPostsVersion]);
  const localToggleParticipate=async pid=>{
    const uid=session?.user?.id;
    const post=uPosts.find(p=>p.id===pid);
    if(!post)return;
    const participating=(post.participants||[]).some(x=>(x.user_id||x)===uid);
    setUPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,participants:participating?(p.participants||[]).filter(x=>(x.user_id||x)!==uid):[...(p.participants||[]),uid]}));
    try{
      if(participating)await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
      else await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
    }catch(e){console.warn("toggleParticipate error:",e);}
  };
  const orgTypeLabel={restaurant:"🍽️ Restaurant",hotel:"🏨 Hôtel",musique:"🎵 Musique / Artiste",entreprise:"💼 Entreprise",association:"🤝 Association",ecole:"🎓 École / Université",autre:"📌 Organisation"}[user.org_type]||"📌 Organisation";
  const oIsVid=p=>p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video"));
  const oPhotoPosts=uPosts.filter(p=>!oIsVid(p));
  const oVideoPosts=uPosts.filter(p=>oIsVid(p));
  const hasOVisual=p=>oIsVid(p)||p.type==="poll"||p.type==="event"||p.img||(p.media_urls&&p.media_urls.length>0);
  const oVisualPosts=uPosts.filter(hasOVisual);
  const [oTab,setOTab]=useState("posts");
  const [openSoundId,setOpenSoundId]=useState(null);

  const uploadAvatar=async e=>{
  const f=e.target.files[0];
  if(!f)return;
  try {
    const url = await uploadToR2(f, "avatars");
    const urlWithTs=`${url}?t=${Date.now()}`;
    await sb.from("profiles").update({avatar_url:urlWithTs}).eq("id",user.id);
    notify("Photo mise à jour ✦");
  } catch(_e) {
  notify("Erreur upload avatar");
}
};
  const uploadCover=async e=>{
  const f=e.target.files[0];
  if(!f)return;
  try {
    const url = await uploadToR2(f, "covers");
    const urlWithTs=`${url}?t=${Date.now()}`;
    await sb.from("profiles").update({cover_url:urlWithTs}).eq("id",user.id);
    setCoverPhoto(urlWithTs);
    notify("Couverture mise à jour ✦");
  } catch(_e) {
  notify("Erreur upload couverture");
}
};

const openPostFromSound=(post,soundPosts)=>{
  const list=(soundPosts||oVisualPosts).filter(hasOVisual);
  const idx=list.findIndex(q=>q.id===post.id);
  setOViewerFallback(soundPosts?list:null);
  pushNav(()=>{setOViewerIndex(null);setOViewerFallback(null);});
  setOViewerIndex(idx>=0?idx:0);
};
if(blocked||blockedByOther) return(
  <div style={{flex:1,display:"flex",flexDirection:"column",background:T.bg}}>
    <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`}}>
      <Btn onClick={()=>onBack?.()} style={{color:T.muted,display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:T.text}}>Profil</span>
    </div>
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:40}}>
      <div style={{width:96,height:96,borderRadius:"50%",background:"rgba(255,255,255,0.04)",border:`2px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:42}}>🚫</div>
      <p style={{margin:0,fontSize:17,fontWeight:700,color:T.text}}>{blocked?"Profil bloqué":"Profil non disponible"}</p>
      <p style={{margin:0,fontSize:13,color:T.muted,textAlign:"center",lineHeight:1.6}}>{blocked?<>Tu as bloqué cette organisation.<br/>Son contenu n'est plus visible.</>:"Ce profil n'est pas disponible."}</p>
      {blocked&&<Btn onClick={handleBlock} style={{marginTop:8,padding:"10px 28px",borderRadius:20,border:`1px solid ${T.err}44`,background:"rgba(200,64,64,0.08)",color:"#e06060",fontSize:13,fontWeight:600}}>Débloquer</Btn>}
    </div>
  </div>
);

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {showReport&&<ReportModal onClose={()=>setShowReport(false)} onSubmit={handleReport}/>}
      {oViewerIndex!==null&&toggleLike&&toggleSave&&(
        <FeedViewer
          posts={oViewerFallback||oVisualPosts}
          sb={sb} T={T} Av={Av}
          startIndex={oViewerIndex}
          onClose={()=>{popNav();setOViewerIndex(null);setOViewerFallback(null);}}
          toggleLike={toggleLike}
          toggleSave={toggleSave}
          onParticipate={localToggleParticipate}
          session={session}
          myProfile={myProfile}
          notify={notify}
          onUser={()=>{}}
          onOpenComments={(p,cb)=>{pushNav(()=>{setOCommentPost(null);setOCloseCallback(null);});setOCommentPost(p);setOCloseCallback(()=>cb);}}
          myConnections={myConnections}
          onConnect={()=>toggle()}
          onOpenSound={setOpenSoundId}
        />
      )}
      {openSoundId&&<SoundDetailModal sb={sb} T={T} Av={Av} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
      {oCommentPost&&(
        <CommentsOnlyModal
          post={oCommentPost}
          session={session}
          getM={id=>id===user.id?user:myProfile}
          onCountChange={setOCommentLiveCount}
          onClose={()=>{
            popNav();
            setOCommentPost(null);
            if(oCloseCallback){oCloseCallback(oCommentLiveCount);setOCloseCallback(null);}
          }}
        />
      )}
      <input ref={coverRef} type="file" accept="image/*" style={{display:"none"}} onChange={uploadCover}/>
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={uploadAvatar}/>
      <ProfileHeader
        T={T} Av={Av} Badge={Badge} fmtCount={fmtCount}
        coverUrl={coverPhoto} color={T.gold} avatarShape="square"
        avatarUrl={user.avatar_url} user={user}
        onAvatarClick={()=>{if(isMe)fileRef.current.click();else if(user.avatar_url)onImageView(user.avatar_url);}}
        note={orgNote?.text} onNoteClick={()=>{if(!orgNote)return;pushNav(()=>setReplyNote(null));setReplyNote({...orgNote,author:user});}}
        title={user.org_name||user.fullName}
        subtitle={<>{orgTypeLabel} · 🌍 {user.org_country||user.paroisse}</>}
        extraLines={<>
          {user.bio&&<p style={{margin:"0 0 10px",fontSize:14,color:T.sub,lineHeight:1.7}}>{renderTextWithMentions(myProfile.bio)}</p>}
          {user.org_desc&&<p style={{margin:"0 0 4px",fontSize:13,color:T.muted,lineHeight:1.6,fontStyle:"italic"}}>{user.org_desc}</p>}
          <LinksRow links={user.links}/>
        </>}
        stats={[
          {l:"PUBLICATIONS",v:uPosts.length,icon:<Grid size={14}/>},
          {l:"ABONNÉS",v:followersCount,icon:<Users size={14}/>},
        ]}
        actions={isMe
          ? <Btn onClick={()=>coverRef.current.click()} style={{background:"rgba(0,0,0,0.6)",borderRadius:12,padding:"8px 14px",color:"#fff",fontSize:12,border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:6}}><Image size={13}/> Couverture</Btn>
          : <>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>onChat(user.id)} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${T.border}`,borderRadius:14,padding:"9px 16px",color:T.text,fontSize:13,fontWeight:600}}>Message</Btn>
                <Btn onClick={toggle} style={{background:conn?T.goldBg:T.gradGold,border:conn?`1px solid ${T.gold}44`:"none",borderRadius:14,padding:"9px 18px",color:conn?T.goldL:"#000",fontSize:13,fontWeight:700,boxShadow:conn?"none":"0 4px 16px rgba(201,149,42,0.3)"}}>{conn?"✦ Abonné":"+ Suivre"}</Btn>
              </div>
              <div style={{display:"flex",gap:6,justifyContent:"flex-end",marginTop:8}}>
                <Btn onClick={handleBlock} style={{background:"rgba(200,64,64,0.08)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:10,padding:"6px 12px",color:"#e06060",fontSize:11,fontWeight:600}}>{blocked?"Débloquer":"Bloquer"}</Btn>
                <Btn onClick={()=>setShowReport(true)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10,padding:"6px 12px",color:T.muted,fontSize:11,fontWeight:600}}>Signaler</Btn>
              </div>
            </>
        }
      />

      <div style={{padding:"0 18px",maxWidth:640,margin:"0 auto",position:"relative",zIndex:1}}>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:16}}>
          {[{k:"posts",l:"Publications"},{k:"reels",l:"Reels"}].map(t=>(
            <Btn key={t.k} onClick={()=>setOTab(t.k)} style={{flex:1,padding:"11px 6px",background:"none",color:oTab===t.k?T.goldL:T.muted,fontSize:12,fontWeight:oTab===t.k?700:400,borderRadius:0,transition:"all .2s",borderBottom:oTab===t.k?`2px solid ${T.gold}`:"2px solid transparent"}}>
              {t.l}
            </Btn>
          ))}
        </div>
        {oTab==="posts"&&oPhotoPosts.map(p=>{
          const locked=p.is_private&&!isNative&&!isMe;
          return(
          <div key={p.id} style={{background:T.card,borderRadius:18,overflow:"hidden",marginBottom:10,border:`1px solid ${T.border}`,cursor:locked?"default":"pointer"}}
            onClick={()=>{
  if(locked)return;
  const hasPhoto=p.type==="poll"||p.type==="event"||p.img||(p.media_urls&&p.media_urls.length>0);
  if(hasPhoto){
    const idx=oVisualPosts.findIndex(q=>q.id===p.id);
    pushNav(()=>{setOViewerIndex(null);setOViewerFallback(null);});
    setOViewerIndex(idx>=0?idx:0);
  }else{
    setDetailPost(p);
  }
}}>
            {locked
              ?<div style={{padding:"28px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,textAlign:"center"}}>
                <Lock size={22} color={T.goldL}/>
                <p style={{margin:0,fontSize:12,color:T.muted}}>Publication disponible uniquement sur l'app</p>
              </div>
              :<>
                {p.img&&<MediaPlayer url={p.img} style={{maxHeight:200}} onImageClick={()=>onImageView(p.img)}/>}
                <div style={{padding:14}}>
                  {p.profile_pinned&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:T.goldL,fontWeight:700,marginBottom:6}}><Pin size={10}/>Épinglé</span>}
                  <p style={{margin:"0 0 6px",fontSize:13,color:T.text,lineHeight:1.6}}>{p.text||p.title}</p>
                  <span style={{fontSize:11,color:T.muted}}>{ago(p.ts)} · ❤ {fmtCount((p.likes||[]).length)}</span>
                </div>
              </>
            }
          </div>
          );
        })}
        {oTab==="reels"&&(
          oVideoPosts.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucun reel encore</p></div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
            {oVideoPosts.map(p=>{
              const locked=p.is_private&&!isNative&&!isMe;
              return(
              <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:locked?"default":"pointer"}}
                onClick={()=>{
                  if(locked)return;
                  const idx=oVisualPosts.findIndex(q=>q.id===p.id);
                  pushNav(()=>{setOViewerIndex(null);setOViewerFallback(null);});
                  setOViewerIndex(idx>=0?idx:0);
                }}>
                {locked?(
                  <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(255,255,255,0.03)"}}>
                    <Lock size={20} color={T.goldL}/>
                    <p style={{margin:0,fontSize:9,color:T.muted,textAlign:"center",padding:"0 8px"}}>Disponible sur l'app</p>
                  </div>
                ):<VideoThumb src={p.img}/>}
                <div style={{position:"absolute",bottom:4,right:6}}><span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {fmtCount((p.likes||[]).length)}</span></div>
              </div>
              );
            })}
          </div>
        )}
        <div style={{height:80}}/>
      </div>
      {replyNote&&<NoteReplyModal sb={sb} T={T} Av={Av} session={session} note={replyNote} notify={notify} onClose={()=>{popNav();setReplyNote(null);}}/>}
    </div>
  );
}
const Toggle=({active})=>(
    <div style={{width:42,height:24,borderRadius:12,background:active?T.gradGold:(isLightBg(T.bg)?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.1)"),border:`1px solid ${T.border}`,position:"relative",transition:"background .3s",flexShrink:0}}>
      <div style={{position:"absolute",top:2,left:active?18:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .3s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
    </div>
  );

  function PrivateLockedTile({T}){
  return(
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(255,255,255,0.03)"}}>
      <Lock size={20} color={T.goldL}/>
      <p style={{margin:0,fontSize:9,color:T.muted,textAlign:"center",padding:"0 8px"}}>Disponible sur l'app</p>
    </div>
  );
}

function MatchPrivacyToggle({session,notify,myProfile}){
  const [active,setActive]=useState(null);
  const [showEdit,setShowEdit]=useState(false);
  const [matchData,setMatchData]=useState(null);
  const {myProfile:myProfileCtx}=useApp();

  useEffect(()=>{
    if(!session?.user?.id)return;
    sb.from("match_profiles").select("*").eq("user_id",session.user.id).maybeSingle()
      .then(({data})=>{setActive(data?.is_active??null);setMatchData(data);});
  },[session?.user?.id]);

  const toggle=async()=>{
    if(active===null){setShowEdit(true);return;}
    const next=!active;
    setActive(next);
    await sb.from("match_profiles").update({is_active:next}).eq("user_id",session.user.id);
    notify(next?"💫 Céleste Match activé":"Match désactivé");
  };

  if(myProfile?.account_type==="organisation")return null;
  return(
    <>
      <Btn onClick={toggle} style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:20}}>💫</span>
        <div style={{flex:1,textAlign:"left"}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Céleste Match</p>
          <p style={{margin:0,fontSize:11,color:T.muted}}>
            {active===null?"Créer ton profil de compatibilité":active?"Suggestions activées — tu apparais dans les résultats":"Désactivé — tu n'apparais plus"}
          </p>
        </div>
        {active!==null&&<Toggle active={!!active}/>}
        {active===null&&<span style={{fontSize:11,color:T.goldL,fontWeight:700}}>Configurer</span>}
      </Btn>
      {active!==null&&(
        <Btn onClick={()=>setShowEdit(true)} style={{width:"100%",padding:"12px 16px",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:10}}>
          <Edit2 size={16} color={T.muted}/>
          <span style={{fontSize:13,color:T.sub}}>Modifier mes préférences Match</span>
          <ChevronRight size={14} color={T.muted} style={{marginLeft:"auto"}}/>
        </Btn>
      )}
      {showEdit&&<MatchOnboardingModal myProfile={myProfile} session={session} notify={notify} initialData={matchData}
        onClose={()=>setShowEdit(false)}
        onDone={data=>{setMatchData({...data,is_active:true});setActive(true);setShowEdit(false);}}/>}
    </>
  );
}
function MutedBlockedManager({session,notify,onClose}){
  const [tab,setTabLocal]=useState("muted");
  const [muted,setMuted]=useState(null);
  const [blocked,setBlocked]=useState(null);

  const loadLists=useCallback(async()=>{
    if(!session?.user?.id)return;
    const[{data:mutedRows},{data:blockedRows}]=await Promise.all([
      sb.from("muted_authors").select("muted_id").eq("muter_id",session.user.id),
      sb.from("blocks").select("blocked_id").eq("blocker_id",session.user.id),
    ]);
    const mutedIds=(mutedRows||[]).map(r=>r.muted_id);
    const blockedIds=(blockedRows||[]).map(r=>r.blocked_id);
    const allIds=[...new Set([...mutedIds,...blockedIds])];
    let profilesById={};
    if(allIds.length){
      const{data:profs}=await sb.from("profiles").select("*").in("id",allIds);
      (profs||[]).forEach(p=>{profilesById[p.id]=normProfile(p);});
    }
    setMuted(mutedIds.map(id=>profilesById[id]).filter(Boolean));
    setBlocked(blockedIds.map(id=>profilesById[id]).filter(Boolean));
  },[session?.user?.id]);

  useEffect(()=>{loadLists();},[loadLists]);

  const unmute=async id=>{
    setMuted(prev=>(prev||[]).filter(u=>u.id!==id));
    const{error}=await sb.from("muted_authors").delete().eq("muter_id",session.user.id).eq("muted_id",id);
    if(error){notify("Erreur — réessaie");loadLists();return;}
    window.dispatchEvent(new CustomEvent("celeste_mutes_blocks_changed"));
    notify("Publications réaffichées ✦");
  };
  const unblock=async id=>{
    setBlocked(prev=>(prev||[]).filter(u=>u.id!==id));
    const{error}=await sb.from("blocks").delete().eq("blocker_id",session.user.id).eq("blocked_id",id);
    if(error){notify("Erreur — réessaie");loadLists();return;}
    window.dispatchEvent(new CustomEvent("celeste_mutes_blocks_changed"));
    notify("Débloqué ✦");
  };

  const list=tab==="muted"?muted:blocked;

  return(
    <div style={{position:"fixed",inset:0,background:T.bg,zIndex:900,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:16,borderBottom:`1px solid ${T.border}`}}>
        <Btn onClick={onClose} style={{padding:6}}><ArrowLeft size={22} color={T.text}/></Btn>
        <p style={{margin:0,fontSize:16,fontWeight:700,color:T.text}}>Comptes masqués & bloqués</p>
      </div>
      <div style={{display:"flex",padding:"12px 16px 0",gap:8}}>
        <Btn onClick={()=>setTabLocal("muted")} style={{flex:1,padding:10,borderRadius:12,background:tab==="muted"?T.goldBg:T.card,border:`1px solid ${tab==="muted"?T.gold+"55":T.border}`,color:tab==="muted"?T.goldL:T.sub,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <EyeOff size={15}/> Masqués {muted?.length?`(${muted.length})`:""}
        </Btn>
        <Btn onClick={()=>setTabLocal("blocked")} style={{flex:1,padding:10,borderRadius:12,background:tab==="blocked"?T.goldBg:T.card,border:`1px solid ${tab==="blocked"?T.gold+"55":T.border}`,color:tab==="blocked"?T.goldL:T.sub,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Ban size={15}/> Bloqués {blocked?.length?`(${blocked.length})`:""}
        </Btn>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {list===null?(
          <div style={{display:"flex",justifyContent:"center",padding:40}}><StarFieldLoader size={40}/></div>
        ):list.length===0?(
          <div style={{textAlign:"center",padding:"60px 20px",color:T.muted}}>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>
              {tab==="muted"?"Aucun compte masqué":"Aucun compte bloqué"}
            </p>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {list.map(u=>(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14}}>
                <Av u={u} size={40}/>
                <p style={{flex:1,margin:0,fontSize:14,color:T.text,fontWeight:600}}>{u.fullName||u.name}</p>
                <Btn onClick={()=>tab==="muted"?unmute(u.id):unblock(u.id)}
                  style={{padding:"7px 14px",borderRadius:20,border:`1px solid ${T.gold}55`,background:T.goldBg,color:T.goldL,fontSize:12,fontWeight:600}}>
                  {tab==="muted"?"Réafficher":"Débloquer"}
                </Btn>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function ParametresModal({myProfile,onLogout,notify,navTheme,onChooseNavTheme,pushNav,popNav}){
  const [logoFont]=useState(pickLogoFont);
  const {session,setMyProfile}=useApp();
  const [open,setOpen]=useState(false);
  const [section,setSection]=useState(null);
  const [dnd,setDnd]=useState(false);
  const [discoverable,setDiscoverable]=useState(true);
const [hideOnline,setHideOnline]=useState(false);
const [screenshotProtection,setScreenshotProtection]=useState(false);
const [duoPermission,setDuoPermission]=useState("everyone");
const [groupInvitePermission,setGroupInvitePermission]=useState("everyone");
  const [mode,setMode]=useState(()=>localStorage.getItem("celeste_theme")||"dark");
const [showBugReport,setShowBugReport]=useState(false);
const [showMutedBlocked,setShowMutedBlocked]=useState(false);
const [bugText,setBugText]=useState("");
    useEffect(()=>{
    const handler=()=>{pushNav(()=>{setOpen(false);setSection(null);});setOpen(true);setSection(null);};
    window.addEventListener("celeste_open_params",handler);
    return()=>window.removeEventListener("celeste_open_params",handler);
  },[pushNav]);

  useEffect(()=>{
    if(!open||!session?.user?.id)return;
    sb.from("profiles").select("no_messages,is_discoverable,hide_online,screenshot_protection,badge_payment_ref,badge,badge_expires_at")
      .eq("id",session.user.id)
      .maybeSingle()
      .then(async({data})=>{
        if(data){setDnd(!!data.no_messages);setDiscoverable(data.is_discoverable!==false);setHideOnline(!!data.hide_online);setScreenshotProtection(!!data.screenshot_protection);}
        sb.from("profiles").select("duo_permission").eq("id",session.user.id).maybeSingle().then(({data:d})=>{if(d?.duo_permission)setDuoPermission(d.duo_permission);});
        if(data?.badge_payment_ref&&!data?.badge){
          try{
            const{data:result}=await sb.functions.invoke("verify-badge-payment");
            if(result?.activated){
              notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><PartyPopper size={14}/>Badge certifié activé ! ✦</span>);
            }
          }catch(e){console.error("Payment check error:",e);}
        }
      });
  },[open,session?.user?.id,notify]);

  const toggleDnd=async()=>{
    const next=!dnd;
    setDnd(next);
    await sb.from("profiles").update({no_messages:next}).eq("id",session.user.id);
    setMyProfile(p=>p&&({...p,no_messages:next}));
    notify(next?"🔕 Messages bloqués":"✅ Messages activés");
  };

  const toggleDiscoverable=async()=>{
    const next=!discoverable;
    setDiscoverable(next);
    await sb.from("profiles").update({is_discoverable:next}).eq("id",session.user.id);
    setMyProfile(p=>p&&({...p,is_discoverable:next}));
    notify(next?"Profil visible":"Profil masqué");
  };
  const toggleHideOnline=async()=>{
    const next=!hideOnline;
    setHideOnline(next);
    await sb.from("profiles").update({hide_online:next}).eq("id",session.user.id);
    setMyProfile(p=>p&&({...p,hide_online:next}));
    notify(next?"Présence masquée":"Présence visible");
  };
const NAV_THEMES=[
  {id:"aucun",emoji:"◻️",label:"Aucun (défaut)",premium:false},
  {id:"etoiles_filantes",emoji:"🌠",label:"Étoiles filantes",premium:true},
  {id:"pluie",emoji:"🌧️",label:"Pluie",premium:true},
  {id:"braises",emoji:"🌋",label:"Braises de volcan",premium:true},
  {id:"neige",emoji:"❄️",label:"Neige",premium:true},
  {id:"plage",emoji:"🏖️",label:"Plage",premium:true},
  {id:"aurore",emoji:"🌌",label:"Aurore boréale",premium:true},
  {id:"brouillard",emoji:"🌫️",label:"Brouillard",premium:true},
  {id:"feuilles",emoji:"🍂",label:"Feuilles d'automne",premium:true},
  {id:"bulles",emoji:"🫧",label:"Bulles",premium:true},
  {id:"orage",emoji:"⛈️",label:"Orage",premium:true},
  {id:"galaxie",emoji:"🌠",label:"Galaxie",premium:true},
  {id:"lucioles",emoji:"✨",label:"Lucioles",premium:true},
  {id:"petales",emoji:"🌸",label:"Pétales de fleurs",premium:true},
];

 const THEMES=[
  {id:"dark",label:"Noir Doré",premium:false},
  {id:"light",label:"Blanc Doré",premium:false},
  {id:"dark_green",label:"Vert Forêt",premium:true},
  {id:"dark_blue",label:"Bleu Cosmos",premium:true},
  {id:"facebook",label:"Facebook",premium:true},
  {id:"youtube",label:"YouTube",premium:true},
  {id:"whatsapp",label:"WhatsApp",premium:true},
  {id:"snapchat",label:"Snapchat",premium:true},
  {id:"tiktok",label:"TikTok",premium:true},
  {id:"google",label:"Google",premium:true},
];
  if(!open)return null;

  return(
    <div
      style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={()=>{popNav();setOpen(false);setSection(null);}}>
      <div
        style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",padding:"28px 20px 48px",animation:"slideUp .35s ease"}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <Btn onClick={()=>{if(section){setSection(null);}else{popNav();setOpen(false);}}} style={{color:T.gold,display:"flex"}}>
            <ChevronLeft size={22}/>
          </Btn>
          <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text,margin:0}}>
            {!section&&"Paramètres"}
            {section==="privacy"&&"🔒 Confidentialité"}
            {section==="compte"&&"👤 Compte"}
            {section==="apparence"&&"🎨 Apparence"}
            {section==="navtheme"&&"🌠 Apparence du bas"}
            {section==="about"&&"✦ À propos"}
          </h3>
        </div>

        {/* Menu principal */}
        {!section&&(
          <>
            {[
              {id:"privacy",emoji:"🔒",title:"Confidentialité",sub:"Messages, visibilité"},
              {id:"compte",emoji:"👤",title:"Compte",sub:"Badge, identifiant, suppression"},
              {id:"apparence",emoji:"🎨",title:"Apparence",sub:`Thème : ${THEMES.find(t=>t.id===mode)?.label||mode}`},
              {id:"about",emoji:"✦",title:"À propos",sub:"Version · Contact · Mentions"},
            ].map(item=>(
              <Btn key={item.id} onClick={()=>setSection(item.id)}
                style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:({dark:"#000",light:"#FDFAF4",dark_green:"#060E0B",dark_blue:"#00080F",facebook:"#1877F2",youtube:"#CC0000",whatsapp:"#0B141A",snapchat:"#FFFC00",tiktok:"#FF2645",google:"#4285F4"}[item.id]||"#000"),border:"2px solid rgba(255,255,255,0.2)"}}/>
                <div style={{flex:1,textAlign:"left"}}>
                  <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>{item.title}</p>
                  <p style={{margin:0,fontSize:11,color:T.muted}}>{item.sub}</p>
                </div>
                <ChevronRight size={16} color={T.muted}/>
              </Btn>
            ))}
            <div style={{height:1,background:T.border,margin:"16px 0"}}/>
            <Btn onClick={()=>{pushNav(()=>setShowBugReport(false));setShowBugReport(true);}} style={{width:"100%",padding:"14px",background:"rgba(255,100,50,0.06)",border:"1px solid rgba(255,100,50,0.2)",borderRadius:14,color:"#FF6432",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
              <span>🐛</span>Signaler un bug
            </Btn>
            <Btn onClick={()=>{setOpen(false);setTimeout(async()=>{if(await confirmAction("Se déconnecter ?",{confirmLabel:"Se déconnecter"}))onLogout();},200);}}
              style={{width:"100%",padding:"14px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <LogOut size={18}/>Se déconnecter
            </Btn>
          </>
        )}
        {showBugReport&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{popNav();setShowBugReport(false);}}>
  <div style={{background:"#1a1a1a",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:500,marginBottom:"var(--kb-height,0px)"}} onClick={e=>e.stopPropagation()}>
    <p style={{margin:"0 0 16px",fontSize:16,fontWeight:700,color:"#fff",textAlign:"center"}}>🐛 Signaler un bug</p>
    <textarea value={bugText||""} onChange={e=>setBugText(e.target.value)} placeholder="Décris le bug que tu as rencontré…" rows={5}
      style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"12px",color:"#fff",fontSize:14,resize:"none",outline:"none",boxSizing:"border-box"}}/>
    <Btn onClick={async()=>{
      if(!bugText?.trim())return;
      try{
        await emailjs.send("service_wyyihkf","template_mo0y7od",{
          from_name:myProfile?.prenom+" "+myProfile?.nom,
          celeste_id:myProfile?.celeste_id||"inconnu",
          from_email:myProfile?.email||"non renseigné",
          device:navigator.userAgent,
          message:bugText
        },"ZGvH2EMAp3UlglKfe");
        alert("Bug signalé ✦ Merci !");
        popNav();setShowBugReport(false);
        setBugText("");
      }catch(e){
        alert("Erreur envoi. Réessaie.");
      }
    }} style={{width:"100%",marginTop:12,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,#FF6432,#FF3B6B)",color:"#fff",fontWeight:700,fontSize:14,border:"none"}}>
      Envoyer
    </Btn>
  </div>
</div>}

        {/* Confidentialité */}
        {section==="privacy"&&(
  <div style={{display:"flex",flexDirection:"column",gap:8}}>

    {/* Visible dans Découvrir — badge uniquement */}
    <Btn onClick={toggleDiscoverable}
      style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
      <Eye size={20} color={T.goldL}/>
      <div style={{flex:1,textAlign:"left"}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Visible dans Découvrir</p>
        <p style={{margin:0,fontSize:11,color:T.muted}}>{discoverable?"Votre profil est visible":"Votre profil est masqué"}</p>
      </div>
      <Toggle active={discoverable}/>
    </Btn>

    {/* Bloquer les messages */}
    <Btn onClick={toggleDnd}
      style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
      <span style={{fontSize:20}}>🔕</span>
      <div style={{flex:1,textAlign:"left"}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Bloquer les messages</p>
        <p style={{margin:0,fontSize:11,color:T.muted}}>{dnd?"Personne ne peut vous écrire":"Tout le monde peut vous écrire"}</p>
      </div>
      <Toggle active={dnd}/>
    </Btn>

    {/* Masquer présence en ligne */}
    <Btn onClick={toggleHideOnline}
      style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
      <Eye size={20} color={T.goldL}/>
      <div style={{flex:1,textAlign:"left"}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Masquer ma présence</p>
        <p style={{margin:0,fontSize:11,color:T.muted}}>{hideOnline?"Personne ne voit votre point vert":"Votre statut en ligne est visible"}</p>
      </div>
      <Toggle active={hideOnline}/>
    </Btn>
{/* Protection captures d'écran */}
  <Btn onClick={async()=>{
    const next=!screenshotProtection;
    setScreenshotProtection(next);
    await sb.from("profiles").update({screenshot_protection:next}).eq("id",session.user.id);
    notify(next?"🔒 Captures bloquées pour ton contenu":"Captures autorisées");
  }}
    style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
    <Eye size={20} color={T.goldL}/>
    <div style={{flex:1,textAlign:"left"}}>
      <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Protéger mon contenu ✦</p>
      <p style={{margin:0,fontSize:11,color:T.muted}}>{screenshotProtection?"Captures bloquées sur ton profil/posts/messages":"Captures autorisées"}</p>
    </div>
    <Toggle active={screenshotProtection}/>
  </Btn>
    {/* Céleste Match — activer/désactiver */}
    <DuoPrivacySetting sb={sb} T={T} Av={Av} Btn={Btn} session={session} value={duoPermission} onChange={setDuoPermission} notify={notify}/>
    <GroupPrivacySetting sb={sb} T={T} Av={Av} Btn={Btn} session={session} value={groupInvitePermission} onChange={setGroupInvitePermission} notify={notify}/>

    <MatchPrivacyToggle session={session} notify={notify} myProfile={myProfile}/>

    {/* Comptes masqués & bloqués */}
    <Btn onClick={()=>setShowMutedBlocked(true)}
      style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
      <Ban size={20} color={T.goldL}/>
      <div style={{flex:1,textAlign:"left"}}>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Comptes masqués & bloqués</p>
        <p style={{margin:0,fontSize:11,color:T.muted}}>Gérer les personnes que tu ne veux plus voir</p>
      </div>
      <ChevronRight size={18} color={T.muted}/>
    </Btn>
    {showMutedBlocked&&<MutedBlockedManager session={session} notify={notify} onClose={()=>setShowMutedBlocked(false)}/>}

  </div>
)}

        {section==="compte"&&(
  <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
  <p style={{margin:"0 0 6px",fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Identifiant Céleste</p>
  {(()=>{
    const celesteId=myProfile?.celeste_id||"—";
    return(
      <>
        <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:T.goldL,letterSpacing:.5}}>{celesteId}</p>
        <p style={{margin:"0 0 8px",fontSize:11,color:T.muted}}>Sert à se connecter avec d'autre service DES-ETOILES</p>
        <Btn onClick={()=>{navigator.clipboard?.writeText(celesteId).then(()=>notify("Identifiant copié ✦")).catch(()=>notify("Impossible de copier"));}}
          style={{padding:"7px 14px",background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:10,color:T.goldL,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
          📋 Copier l'identifiant
        </Btn>
      </>
    );
  })()}
</div>
    </div>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
      <p style={{margin:"0 0 4px",fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Email</p>
      <p style={{margin:0,fontSize:13,color:T.text}}>{session?.user?.email}</p>
    </div>

    {/* Badge */}
    <div style={{background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:14,padding:"14px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <span style={{fontSize:20}}>✦</span>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:T.goldL}}>
            {myProfile?.badge?"Badge actif ✦":"Obtenir le badge certifié"}
          </p>
          <p style={{margin:0,fontSize:11,color:T.muted}}>
            {myProfile?.badge_expires_at
              ?`Expire le ${new Date(myProfile.badge_expires_at).toLocaleDateString("fr-FR")}`
              :" 2000 FCFA · 40 jours"}
          </p>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
        {[
          {icon:"✦",text:"Badge visible sur ton profil et tes publications"},
          {icon:"📈",text:"Tes publications sont prioritaires dans le feed"},
          {icon:"🔒",text:"Accès aux fonctionnalités exclusives à venir"},
          {icon:"💰",text:"Génère des gains quotidiens grâce à tes posts et likes reçus"},
        ].map((f,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,color:T.gold}}>{f.icon}</span>
            <p style={{margin:0,fontSize:12,color:T.sub,lineHeight:1.6}}>{f.text}</p>
          </div>
        ))}
      </div>
      {!myProfile?.badge&&(
        <Btn onClick={async()=>{
          const phoneInput=await new Promise(resolve=>{
            const overlay=document.createElement("div");
            overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;";
            overlay.innerHTML=`
              <div style="background:#1a1a2e;border-radius:16px;padding:24px;width:320px;display:flex;flex-direction:column;gap:16px;">
                <p style="color:#fff;font-weight:700;font-size:16px;margin:0;text-align:center;">Numéro de paiement</p>
                <div style="display:flex;gap:8px;">
                  <select id="cel-dial" style="background:#2a2a3e;color:#fff;border:1px solid #444;border-radius:8px;padding:8px;font-size:14px;width:130px;">
                    <option value="CG">🇨🇬 +242</option>
                    <option value="CD">🇨🇩 +243</option>
                    <option value="CM">🇨🇲 +237</option>
                    <option value="CI">🇨🇮 +225</option>
                    <option value="SN">🇸🇳 +221</option>
                    <option value="ML">🇲🇱 +223</option>
                    <option value="BF">🇧🇫 +226</option>
                    <option value="GN">🇬🇳 +224</option>
                    <option value="BJ">🇧🇯 +229</option>
                    <option value="TG">🇹🇬 +228</option>
                    <option value="GA">🇬🇦 +241</option>
                    <option value="GH">🇬🇭 +233</option>
                    <option value="NG">🇳🇬 +234</option>
                    <option value="KE">🇰🇪 +254</option>
                    <option value="TZ">🇹🇿 +255</option>
                    <option value="UG">🇺🇬 +256</option>
                    <option value="RW">🇷🇼 +250</option>
                    <option value="MA">🇲🇦 +212</option>
                    <option value="OTHER">🌍 Autre</option>
                  </select>
                  <input id="cel-custom-dial" type="text" placeholder="+XXX" style="display:none;background:#2a2a3e;color:#fff;border:1px solid #444;border-radius:8px;padding:8px;font-size:16px;width:80px;outline:none;" />
                  <input id="cel-phone" type="tel" placeholder="06XXXXXXXX" style="background:#2a2a3e;color:#fff;border:1px solid #444;border-radius:8px;padding:8px;font-size:16px;flex:1;outline:none;" />
                </div>
                <div style="display:flex;gap:8px;">
                  <button id="cel-cancel" style="flex:1;padding:10px;background:#333;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">Annuler</button>
                  <button id="cel-confirm" style="flex:1;padding:10px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#000;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">Continuer</button>
                </div>
              </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector("#cel-dial").onchange=function(){
              const custom=overlay.querySelector("#cel-custom-dial");
              custom.style.display=this.value==="OTHER"?"block":"none";
            };
            overlay.querySelector("#cel-confirm").onclick=()=>{
              const num=overlay.querySelector("#cel-phone").value.trim();
              const dialEl=overlay.querySelector("#cel-dial");
              const cc=dialEl.value==="OTHER"
                ?(overlay.querySelector("#cel-custom-dial").value.replace(/\D/g,"")||"00")
                :dialEl.value;
              document.body.removeChild(overlay);
              resolve(num?{number:num.replace(/\D/g,""),country_code:cc}:null);
            };
            overlay.querySelector("#cel-cancel").onclick=()=>{
              document.body.removeChild(overlay);
              resolve(null);
            };
          });
          if(!phoneInput)return;
          const isNative=Capacitor.isNativePlatform();
          const win=isNative?null:window.open("","_blank");
          try{
            const{data}=await sb.functions.invoke("create-badge-checkout",{body:{
              first_name:myProfile?.fullName?.split(" ")[0]||"User",
              last_name:myProfile?.fullName?.split(" ")[1]||"Celeste",
              phone_number:phoneInput.number,
              phone_country_code:phoneInput.country_code
            }});
const checkoutUrl=data?.checkout_url;
if(checkoutUrl){
              if(isNative){
                await Browser.open({url:checkoutUrl});
              }else{
                win.location.href=checkoutUrl;
              }
              notify("Paiement ouvert — ton badge sera activé automatiquement ✦");
            }else{
              win?.close();
              notify("Erreur de paiement — réessaie");
            }
          }catch(e){win?.close();notify("Erreur de paiement — réessaie");}
        }} style={{width:"100%",padding:"12px",background:T.gradGold,borderRadius:12,color:"#000",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:18}}>✦</span> Obtenir le badge — 2 000 FCFA
        </Btn>
      )}
    </div>

    <div style={{height:1,background:T.border,margin:"4px 0"}}/>
    <Btn onClick={async()=>{if(!(await confirmAction("Désactiver votre compte ?",{detail:"Cette action est irréversible.",confirmLabel:"Désactiver"})))return;await sb.from("profiles").update({status:"suspended"}).eq("id",session?.user?.id);onLogout();}}
      style={{width:"100%",padding:"14px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:14,color:T.err,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      🗑 Désactiver mon compte
    </Btn>
  </div>
)}

        {/* Apparence */}
        {section==="apparence"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {THEMES.map(t=>{
              const locked=false;
              return(
                <Btn key={t.id} onClick={()=>{if(locked){notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Lock size={14}/>Thème réservé aux membres certifiés</span>);return;}setAppTheme(t.id);}}
                  style={{width:"100%",padding:"14px 16px",background:mode===t.id?T.goldBg:T.card,border:`1px solid ${mode===t.id?T.gold+"55":T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,opacity:locked?0.6:1}}>
                  <span style={{fontSize:22}}>{t.emoji}</span>
                  <div style={{flex:1,textAlign:"left"}}>
                    <p style={{margin:0,fontSize:13,fontWeight:600,color:mode===t.id?T.goldL:T.text}}>{t.label}</p>
                    {locked&&<p style={{margin:0,fontSize:11,color:T.gold}}>🔒 Certifiés uniquement</p>}
                  </div>
                  {mode===t.id&&<span style={{color:T.goldL,fontSize:16}}>✓</span>}
                </Btn>
              );
            })}
            <div style={{height:1,background:T.border,margin:"10px 0"}}/>
            <Btn onClick={()=>setSection("navtheme")}
              style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:22}}>🌠</span>
              <div style={{flex:1,textAlign:"left"}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Apparence du bas</p>
                <p style={{margin:0,fontSize:11,color:T.muted}}>Décor animé — {NAV_THEMES.find(t=>t.id===navTheme)?.label||"Aucun"}</p>
              </div>
              <ChevronRight size={16} color={T.muted}/>
            </Btn>
          </div>
        )}
{section==="navtheme"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {NAV_THEMES.map(t=>{
              const locked=false;
              return(
                <Btn key={t.id} onClick={()=>{if(locked){notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Lock size={14}/>Décor réservé aux membres certifiés</span>);return;}onChooseNavTheme(t.id);}}
                  style={{width:"100%",padding:"14px 16px",background:navTheme===t.id?T.goldBg:T.card,border:`1px solid ${navTheme===t.id?T.gold+"55":T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,opacity:locked?0.6:1}}>
                  <span style={{fontSize:22}}>{t.emoji}</span>
                  <div style={{flex:1,textAlign:"left"}}>
                    <p style={{margin:0,fontSize:13,fontWeight:600,color:navTheme===t.id?T.goldL:T.text}}>{t.label}</p>
                    {locked&&<p style={{margin:0,fontSize:11,color:T.gold}}>🔒 Certifiés uniquement</p>}
                  </div>
                  {navTheme===t.id&&<span style={{color:T.goldL,fontSize:16}}>✓</span>}
                </Btn>
              );
            })}
          </div>
        )}
        {/* À propos */}
        {section==="about"&&(
  <div style={{display:"flex",flexDirection:"column",gap:10}}>
    <div style={{textAlign:"center",padding:"16px 0 8px"}}>
      <div style={{fontFamily:logoFont,fontSize:52,color:T.gold,lineHeight:1,marginBottom:10}}>✦</div>
      <h2 style={{fontFamily:logoFont,fontSize:30,fontWeight:400,color:T.text,letterSpacing:0,margin:"0 0 4px"}}>Céleste</h2>
      <p style={{color:T.gold,fontSize:11,letterSpacing:2,textTransform:"uppercase",margin:0}}>Réseau privé des jeunes · v7.1</p>
    </div>

    {[
      {title:"🌟 Notre mission",text:"Céleste est le réseau social privé et sécurisé des jeunes de 16 à 30 ans. Un espace pour découvrir des personnes qui te ressemblent, créer des liens authentiques et vivre des rencontres qui comptent vraiment."},
    ].map((s,i)=>(
      <div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
        <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>{s.title}</p>
        <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>{s.text}</p>
      </div>
    ))}

    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>📋 Conditions d'utilisation</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          "En t'inscrivant sur Céleste, tu certifies que toutes les informations fournies sont exactes et véridiques.",
          "Céleste est réservé aux jeunes. de 16 à 30 ans. Toute personne fournissant de fausses informations s'expose à une exclusion définitive et à des poursuites judiciaires.",
          "Il est strictement interdit de publier du contenu offensant, haineux, pornographique ou illégal.",
          "Le harcèlement, la violence verbale et toute forme d'intimidation sont prohibés et entraînent une suspension immédiate.",
          "Toute usurpation d'identité est un délit punissable par la loi.",
          "Céleste se réserve le droit de supprimer tout compte sans préavis en cas de violation.",
        ].map((t,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{color:T.gold,fontSize:12,flexShrink:0,marginTop:2}}>✦</span>
            <p style={{margin:0,fontSize:12,color:T.sub,lineHeight:1.7}}>{t}</p>
          </div>
        ))}
      </div>
    </div>

    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>🔒 Confidentialité</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {[
          "Tes données personnelles ne sont jamais vendues ni partagées avec des tiers.",
          "Ton numéro de téléphone est utilisé uniquement pour la vérification et ne sera jamais divulgué.",
          "Les conversations privées sont confidentielles et accessibles uniquement aux participants.",
          "Céleste utilise un chiffrement sécurisé pour protéger toutes tes données.",
        ].map((t,i)=>(
          <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{color:T.gold,fontSize:12,flexShrink:0,marginTop:2}}>✦</span>
            <p style={{margin:0,fontSize:12,color:T.sub,lineHeight:1.7}}>{t}</p>
          </div>
        ))}
      </div>
    </div>

    <div style={{background:"rgba(200,64,64,0.05)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:14,padding:"14px 16px"}}>
      <p style={{margin:"0 0 6px",fontSize:11,fontWeight:700,color:T.err,letterSpacing:1,textTransform:"uppercase"}}>⚖️ Responsabilités légales</p>
      <p style={{margin:0,fontSize:12,color:T.sub,lineHeight:1.8}}>Toute personne ayant menti sur son identité ou son âge sera poursuivie conformément aux lois en vigueur. Céleste coopère avec les autorités compétentes en cas de signalement.</p>
    </div>

    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
      <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:T.goldL,letterSpacing:1,textTransform:"uppercase"}}>📞 Contact & Support</p>
      <a href="mailto:mrdesetoiles@gmail.com" style={{display:"flex",alignItems:"center",gap:10,color:T.sub,fontSize:13,textDecoration:"none",marginBottom:10}}>
        <span style={{fontSize:18}}>✉️</span> mrdesetoiles@gmail.com
      </a>
      <a href="https://wa.me/242067131327" target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:10,color:T.sub,fontSize:13,textDecoration:"none"}}>
        <MessageCircle size={18} color={T.goldL}/> WhatsApp : +242 067 131 327
      </a>
    </div>

    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px",textAlign:"center"}}>
      <p style={{margin:"0 0 4px",fontSize:16,color:T.gold,fontFamily:"'Cormorant Garamond',serif",letterSpacing:2}}>✦ DES-ÉTOILES ✦</p>
      <p style={{margin:"0 0 4px",fontSize:12,color:T.sub}}> </p>
      <p style={{margin:0,fontSize:11,color:T.muted}}>© 2025 · Tous droits réservés</p>
    </div>
  </div>
)}

      </div>
    </div>
  );
}

function WalletScreen({session,myProfile,notify,onClose,onOpenDeposit,pushNav,popNav}){
  const hasBadge=myProfile?.badge==="confirmed"||myProfile?.badge==="friend";
  const [wallet,setWallet]=useState(null);
  const [transactions,setTransactions]=useState([]);
  const [monthStats,setMonthStats]=useState(null);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const cemacCountries=["CG","CM","GA","TD","CF","GQ"];
  const isCemac=cemacCountries.includes(myProfile?.country||"CG");
  const [withdrawAmount,setWithdrawAmount]=useState("");
  const [withdrawPhone,setWithdrawPhone]=useState("");
  const [withdrawName,setWithdrawName]=useState("");
  const [withdrawOp,setWithdrawOp]=useState("mtn");
  const [availableOperators,setAvailableOperators]=useState([]);
  useEffect(()=>{
    if(!myProfile?.country)return;
    sb.from("withdrawal_operators").select("operator_key,operator_label").eq("country",myProfile.country).eq("active",true).order("sort_order")
      .then(({data})=>{
        setAvailableOperators(data||[]);
        if(data?.[0])setWithdrawOp(data[0].operator_key);
      });
  },[myProfile?.country]);
  const [loading,setLoading]=useState(false);
  const month=new Date().toISOString().slice(0,7);

  useEffect(()=>{
    const chTx=sb.channel(`wallet_tx_live_${session.user.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"wallet_transactions",filter:`user_id=eq.${session.user.id}`},()=>{load();})
      .subscribe();
    const chWr=sb.channel(`withdrawal_live_${session.user.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"withdrawal_requests",filter:`user_id=eq.${session.user.id}`},()=>{load();})
      .subscribe();
    return()=>{sb.removeChannel(chTx);sb.removeChannel(chWr);};
  },[session.user.id]);

  const load=async()=>{
    let{data:w}=await sb.from("wallets").select("*").eq("user_id",session.user.id).maybeSingle();
    if(!w){const{data:created}=await sb.from("wallets").insert({user_id:session.user.id,balance:0,total_earned:0}).select().single();w=created;}
    setWallet(w);
    const{data:tx}=await sb.from("wallet_transactions").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false}).limit(30);
    setTransactions(tx||[]);
    const{count:myLikes}=await sb.from("valid_likes").select("*",{count:"exact",head:true}).eq("author_id",session.user.id).eq("month",month);
    // Compter mes posts du mois
    const{count:myPosts}=await sb.from("posts").select("*",{count:"exact",head:true}).eq("author_id",session.user.id).gte("created_at",`${month}-01`);
    setMonthStats({myLikes:myLikes||0,myPosts:myPosts||0});
  };

  useEffect(()=>{load();},[]);

  const handleWithdraw=async()=>{
    if(!withdrawAmount||isNaN(withdrawAmount))return notify("Entre un montant valide");
    const amount=parseInt(withdrawAmount);
    if(amount<500)return notify("Minimum 500 F CFA");
    if(amount>wallet?.balance)return notify("Solde insuffisant");
    if(!withdrawPhone.trim())return notify("Entre ton numéro");
    if(!withdrawName.trim())return notify("Entre le nom exact du bénéficiaire (celui du compte Mobile Money)");
    setLoading(true);
    const net=Math.floor(amount*0.95);
    const{error:wErr}=await sb.rpc("request_withdrawal",{p_amount:amount,p_phone:withdrawPhone.trim(),p_beneficiary_name:withdrawName.trim(),p_operator:withdrawOp});
if(wErr){setLoading(false);return notify(wErr.message||"Erreur, réessaie");}
    setLoading(false);popNav();setShowWithdraw(false);setWithdrawAmount("");setWithdrawPhone("");setWithdrawName("");
    notify("Demande envoyée ✦");load();
  };
  const reportWithdrawalIssue=async(tx)=>{
    const details=window.prompt("Décris le problème (ex : argent non reçu après validation) :");
    if(!details?.trim())return;
    try{
      await sb.from("wallet_complaints").insert({
        user_id:session.user.id,
        transaction_id:tx.id,
        amount:tx.amount,
        message:details.trim(),
        status:"open"
      });
    }catch(e){console.error("Erreur envoi plainte :",e);}
    try{
      const{data:admins}=await sb.from("profiles").select("id").eq("is_admin",true);
      for(const a of admins||[]){
        await sb.from("notifications").insert({
          user_id:a.id,
          from_id:session.user.id,
          type:"wallet_complaint",
          text:`⚠️ Plainte retrait — ${myProfile?.name||"Un membre"} : ${details.trim().slice(0,140)}`,
          read:false
        });
      }
    }catch(e){console.error("Erreur notification admins :",e);}
    notify("Ta plainte a été envoyée à l'équipe ✦");
  };

  return(
    <div style={{position:"fixed",inset:0,background:T.bg,zIndex:9999,display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"52px 20px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.gold,cursor:"pointer",display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></button>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T.text,letterSpacing:2,flex:1}}>Portefeuille</span>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px 20px 80px"}}>
        {/* Carte solde style banking */}
        <div style={{background:"linear-gradient(135deg,#1a237e,#283593)",borderRadius:24,padding:"28px 24px",marginBottom:24,boxShadow:"0 20px 60px rgba(26,35,126,0.4)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
          <div style={{position:"absolute",bottom:-40,left:-20,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
          <p style={{margin:"0 0 6px",fontSize:12,color:"rgba(255,255,255,0.6)",letterSpacing:2,textTransform:"uppercase"}}>Solde disponible</p>
          <p style={{margin:"0 0 20px",fontSize:42,fontWeight:800,color:"#fff",fontFamily:"'Cormorant Garamond',serif"}}>
            {wallet===null?<span style={{fontSize:24,opacity:.6}}>…</span>:(wallet?.balance||0).toLocaleString("fr-FR")}
            <span style={{fontSize:16,fontWeight:400,marginLeft:6,opacity:.7}}>F CFA</span>
          </p>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            {hasBadge?(
            <div>
              <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.5)"}}>Total gagné</p>
              <p style={{margin:0,fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.9)"}}>{(wallet?.total_earned||0).toLocaleString("fr-FR")} F</p>
            </div>
            ):<div/>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={onOpenDeposit} style={{background:"rgba(255,255,255,0.15)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"10px 18px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Déposer
              </button>
              <button onClick={()=>{pushNav(()=>setShowWithdraw(false));setShowWithdraw(true);}} style={{background:"rgba(255,255,255,0.15)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"10px 18px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Retirer
              </button>
            </div>
          </div>
        </div>
{/* Stats du mois — discret */}
{hasBadge&&(
        <div style={{display:"flex",gap:10,marginBottom:24}}>
          <div style={{flex:1,background:T.bg2,borderRadius:16,padding:"14px",border:`1px solid ${T.border}`,textAlign:"center"}}>
            <p style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:T.goldL}}>{monthStats?.myLikes||0}</p>
            <p style={{margin:0,fontSize:11,color:T.muted}}>Likes reçus</p>
          </div>
          <div style={{flex:1,background:T.bg2,borderRadius:16,padding:"14px",border:`1px solid ${T.border}`,textAlign:"center"}}>
            <p style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:T.goldL}}>{monthStats?.myPosts||0}</p>
            <p style={{margin:0,fontSize:11,color:T.muted}}>Posts actifs</p>
          </div>
        </div>
)}

        {/* Transactions */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Activité récente</p>
          <span style={{fontSize:12,color:T.goldL,cursor:"pointer"}}>Tout voir</span>
        </div>

        {transactions.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:T.muted}}>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucune transaction</p>
          </div>
        ):transactions.map((tx,i)=>{
          const isWithdrawal=tx.type==="withdrawal";
          const wStatus=isWithdrawal?(tx.status||"pending"):null;
          const wOk=wStatus==="completed";
          const wRejected=wStatus==="rejected"||wStatus==="cancelled"||wStatus==="failed";
          const amountColor=!isWithdrawal?(tx.amount>0?"#4ade80":"#f87171"):(wOk?"#4ade80":wRejected?"#f87171":"#e0b84a");
          const iconBg=!isWithdrawal?(tx.amount>0?"rgba(74,222,128,0.1)":"rgba(239,68,68,0.1)"):(wOk?"rgba(74,222,128,0.1)":wRejected?"rgba(239,68,68,0.1)":"rgba(224,184,74,0.12)");
          return(
          <div key={tx.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:i<transactions.length-1?`1px solid ${T.border}`:"none"}}>
            <div style={{width:42,height:42,borderRadius:14,background:iconBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
              {tx.type==="earning"?"💰":isWithdrawal?(wOk?"✓":wRejected?"✕":"⏳"):"↑"}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:"0 0 2px",fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.description||tx.type}</p>
              <p style={{margin:0,fontSize:11,color:T.muted}}>
                {new Date(tx.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}
                {isWithdrawal&&(wOk?" · ✓ Envoyé":wRejected?" · Remboursé":" · En attente de validation")}
              </p>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
              <p style={{margin:0,fontSize:14,fontWeight:700,color:amountColor}}>
                {tx.amount>0?"+":""}{tx.amount.toLocaleString("fr-FR")} F
              </p>
              {isWithdrawal&&(
                <Btn onClick={()=>reportWithdrawalIssue(tx)} style={{fontSize:10,color:T.muted,padding:0,textDecoration:"underline",textUnderlineOffset:2}}>
                  Signaler un problème
                </Btn>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* Modal retrait */}
      {showWithdraw&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",zIndex:10000,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{popNav();setShowWithdraw(false);}}>
          <div style={{width:"100%",maxWidth:480,background:T.bg2,borderRadius:"28px 28px 0 0",padding:"28px 20px 48px",marginBottom:"var(--kb-height,0px)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T.text}}>Retirer mon argent</h3>
              <button onClick={()=>{popNav();setShowWithdraw(false);}} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            {availableOperators.length===0?(
              <div style={{padding:"20px 16px",background:T.bg3,borderRadius:14,textAlign:"center",color:T.muted,fontSize:13,marginBottom:14}}>
                Le retrait n'est pas encore disponible dans ton pays. On y travaille ✦
              </div>
            ):(
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                {availableOperators.map(op=>(
                  <button key={op.operator_key} onClick={()=>setWithdrawOp(op.operator_key)} style={{flex:1,minWidth:120,height:44,borderRadius:12,border:`1px solid ${withdrawOp===op.operator_key?T.gold:T.border}`,background:withdrawOp===op.operator_key?"linear-gradient(135deg,#1a237e,#283593)":"transparent",color:withdrawOp===op.operator_key?"#fff":T.sub,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                    {op.operator_label}
                  </button>
                ))}
              </div>
            )}
            <input placeholder="Nom complet du titulaire du compte Mobile Money" value={withdrawName} onChange={e=>setWithdrawName(e.target.value)}
              style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",color:T.text,fontSize:14,outline:"none",marginBottom:10}}/>
            <input type="tel" inputMode="numeric" placeholder="Numéro de téléphone" value={withdrawPhone} onChange={e=>setWithdrawPhone(e.target.value)}
              style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",color:T.text,fontSize:14,outline:"none",marginBottom:10}}/>
            <input placeholder="Montant (min. 500 F CFA)" type="number" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)}
              style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",color:T.goldL,fontSize:14,outline:"none",fontWeight:700,marginBottom:8}}/>
            {withdrawAmount&&!isNaN(withdrawAmount)&&parseInt(withdrawAmount)>=500&&(
              <p style={{margin:"0 0 14px",fontSize:12,color:T.muted,textAlign:"center"}}>
                Tu recevras : <strong style={{color:T.goldL}}>{Math.floor(parseInt(withdrawAmount)*0.95).toLocaleString("fr-FR")} F CFA</strong> (après 5% commission)
              </p>
            )}
            {isCemac?(
              <button onClick={handleWithdraw} disabled={loading} style={{width:"100%",height:50,borderRadius:14,border:"none",background:"linear-gradient(135deg,#1a237e,#283593)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {loading?"...":"Envoyer la demande ✦"}
              </button>
            ):(
              <div style={{padding:"14px",background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,textAlign:"center"}}>
                <p style={{margin:0,fontSize:13,color:T.muted}}>Les retraits sont disponibles uniquement pour les pays CEMAC (Congo, Cameroun, Gabon, Tchad, RCA, Guinée Équatoriale)</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function LikedPostsTab({session,notify,onImageView,myProfile,getM,myConnections,onConnect,toggleLike,toggleSave,pushNav,popNav}){
  const [likedPosts,setLikedPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [detailPost,setDetailPost]=useState(null);
  const [viewerIndex,setViewerIndex]=useState(null);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [commentPost,setCommentPost]=useState(null);
  const [closeCallback,setCloseCallback]=useState(null);
  const [liveCmtCount,setLiveCmtCount]=useState(0);
  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventTime:data.event_time||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),participants:(data.event_participants||[]).map(x=>x.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),is_private:data.is_private||false,comments_disabled:data.comments_disabled||false,ts:new Date(data.created_at).getTime()};
  };
  const isVid=p=>(p.img||(p.media_urls||[])[0])&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img||(p.media_urls||[])[0])||(p.img||"").includes("video"));
  const hasVisual=p=>isVid(p)||p.type==="poll"||p.type==="event"||p.img||(p.media_urls&&p.media_urls.length>0);
  const visualPosts=likedPosts.filter(hasVisual);
  const [viewerFallback,setViewerFallback]=useState(null);
  const openPostFromSound=(post,soundPosts)=>{
    const list=(soundPosts||visualPosts).filter(hasVisual);
    const idx=list.findIndex(q=>q.id===post.id);
    setViewerFallback(soundPosts?list:null);
    pushNav(()=>{setViewerIndex(null);setViewerFallback(null);});
    setViewerIndex(idx>=0?idx:0);
  };
  useEffect(()=>{
    sb.from("likes").select("post_id,posts(*,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,latitude,longitude),likes(user_id),event_participants(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url)))").eq("user_id",session?.user?.id).order("created_at",{referencedTable:"posts",ascending:false}).then(({data})=>{
      setLikedPosts((data||[]).map(l=>l.posts).filter(Boolean).map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,eventDate:p.event_date||null,eventTime:p.event_time||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),participants:(p.event_participants||[]).map(x=>x.user_id),comments:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],savesCount:0,ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,text_font:p.text_font||null,is_for_sale:p.is_for_sale||false,is_ai_generated:p.is_ai_generated||false,is_private:p.is_private||false,comments_disabled:p.comments_disabled||false,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null})));
      setLoading(false);
    });
  },[session?.user?.id]);
  useEffect(()=>{
    const onPostDeleted=e=>{
      const id=e.detail?.id;
      if(!id)return;
      setLikedPosts(prev=>prev.filter(p=>p.id!==id));
      setViewerFallback(prev=>prev?prev.filter(p=>p.id!==id):prev);
    };
    window.addEventListener("celeste_post_deleted",onPostDeleted);
    return()=>window.removeEventListener("celeste_post_deleted",onPostDeleted);
  },[]);
  const localToggleLike=async pid=>{
    const uid=session?.user?.id;
    const post=likedPosts.find(p=>p.id===pid);
    if(!post)return;
    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);
    if(liked){
      setLikedPosts(prev=>prev.filter(p=>p.id!==pid));
    }else{
      setLikedPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,likes:[...(p.likes||[]),uid]}));
    }
    await toggleLike(pid);
  };
  const localToggleParticipate=async pid=>{
    const uid=session?.user?.id;
    const post=likedPosts.find(p=>p.id===pid);
    if(!post)return;
    const participating=(post.participants||[]).some(x=>(x.user_id||x)===uid);
    setLikedPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,participants:participating?(p.participants||[]).filter(x=>(x.user_id||x)!==uid):[...(p.participants||[]),uid]}));
    try{
      if(participating)await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
      else await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
    }catch(e){console.warn("toggleParticipate error:",e);}
  };
  if(loading)return<div style={{textAlign:"center",padding:40,color:T.muted}}>Chargement…</div>;
  if(!likedPosts.length)return<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8}}>♡</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucun j'aime</p></div>;
  if(detailPost)return<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={getM} onClose={()=>setDetailPost(null)}
    onLike={async pid=>{
      const liked=(detailPost.likes||[]).includes(session?.user?.id);
      if(liked){
        await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);
        setLikedPosts(prev=>prev.filter(p=>p.id!==pid));
        setDetailPost(null);
      }else{
        await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});
        const u=await refreshPost(pid);if(u)setDetailPost(u);
      }
    }}
    onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
    notify={notify}/>;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,padding:"0 0 80px"}}>
      {viewerIndex!==null&&toggleLike&&toggleSave&&(
        <FeedViewer posts={viewerFallback||visualPosts} sb={sb} T={T} Av={Av} startIndex={viewerIndex} onClose={()=>{setViewerIndex(null);setViewerFallback(null);}}
          toggleLike={localToggleLike} toggleSave={toggleSave} onParticipate={localToggleParticipate} session={session} myProfile={myProfile} notify={notify}
          onUser={()=>{}} onOpenComments={(p,cb)=>{pushNav(()=>{setCommentPost(null);setCloseCallback(null);});setCommentPost(p);setCloseCallback(()=>cb);}} myConnections={myConnections} onConnect={onConnect} onOpenSound={setOpenSoundId}/>
      )}
      {commentPost&&(
        <CommentsOnlyModal
          post={commentPost}
          session={session}
          getM={getM}
          onCountChange={setLiveCmtCount}
                  onClose={()=>{
          popNav();
          setCommentPost(null);
          if(closeCallback){closeCallback(liveCmtCount);setCloseCallback(null);}
        }}
        />
      )}
      {openSoundId&&<SoundDetailModal sb={sb} T={T} Av={Av} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
      {likedPosts.map(p=>(
        <div key={p.id} style={{aspectRatio:"1",position:"relative",cursor:p.is_private&&!isNative?"default":"pointer",overflow:"hidden",borderRadius:4}}
          onClick={()=>{
            if(p.is_private&&!isNative)return;
            const visual=hasVisual(p);
            if(visual){
              const idx=visualPosts.findIndex(q=>q.id===p.id);
              pushNav(()=>{setViewerIndex(null);setViewerFallback(null);});
              setViewerIndex(idx>=0?idx:0);
            }else{
              setDetailPost(p);
            }
          }}>
          {p.is_private&&!isNative?<PrivateLockedTile T={T}/>:p.img||(p.media_urls||[])[0]
            ?(isVid(p)?<VideoThumb src={p.img||(p.media_urls||[])[0]}/>:<SmartImage src={p.img||(p.media_urls||[])[0]} alt=""/>)
            :<div style={{width:"100%",height:"100%",background:p.text_background?({bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[p.text_background]||T.bg2):T.bg2,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:11,color:p.text_background?"#fff":T.muted,padding:8,textAlign:"center",overflow:"hidden"}}>{p.text?.slice(0,40)}</span>
            </div>
          }/
          {(p.type==="poll"||p.type==="event")&&(
  <div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.65)",borderRadius:8,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.goldL,letterSpacing:.3,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",whiteSpace:"nowrap"}}>
    {p.type==="poll"?"Sondage":"Événement"}
  </div>
)}
          <div style={{position:"absolute",bottom:4,left:4,display:"flex",alignItems:"center",gap:3}}>
           <span style={{fontSize:10,color:"#fff",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>♥ {fmtCount((p.likes||[]).length)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
// ── PROFILE TAB (ENRICHI - onglet Sauvegardés) ───────────
function ProfileTab({myProfile,session,posts,onNewPost,notify,onLogout,reload,myConnections,myFollowers,onImageView,getM,userPostsVersion=0,toggleLike,toggleSave,onConnect,pushNav,popNav}){
  const [tab,setTab]=useState("posts");
  const [editing,setEditing]=useState(false);
 const [form,setForm]=useState({prenom:myProfile?.fullName?.split(" ")[0]||"",nom:myProfile?.fullName?.split(" ").slice(1).join(" ")||"",bio:myProfile?.bio||"",paroisse:myProfile?.paroisse||"",shop_link:myProfile?.shop_link||"",links:myProfile?.links?.length?myProfile.links:[{label:"",url:""}]});
  const [saving,setSaving]=useState(false);
  const [unreadNotifs,setUnreadNotifs]=useState(0);
  const [showFollowers,setShowFollowers]=useState(false);
 const [showFollowing,setShowFollowing]=useState(false);
const [showWallet,setShowWallet]=useState(false);
const [showDeposit,setShowDeposit]=useState(false);
const [showTransactions,setShowTransactions]=useState(false);
  const [followerProfiles,setFollowerProfiles]=useState([]);
  const [followingProfiles,setFollowingProfiles]=useState([]);
  const avRef=useRef(); const cvRef=useRef();
  const [myNote,setMyNote]=useState(null);
  const [showNoteComposer,setShowNoteComposer]=useState(false);
  useEffect(()=>{
    if(!session?.user?.id)return;
    sb.from("notes").select("*").eq("user_id",session.user.id).gt("expires_at",new Date().toISOString()).maybeSingle()
      .then(({data})=>setMyNote(data||null));
  },[session?.user?.id]);

  useEffect(()=>{
    sb.from("notifications").select("*",{count:"exact",head:true}).eq("user_id",session?.user?.id).eq("read",false).then(({count})=>setUnreadNotifs(count||0));
  },[session?.user?.id]);

  const openFollowers=async()=>{
    const ids=myFollowers||[];
    if(ids.length===0){setFollowerProfiles([]);setShowFollowers(true);return;}
    const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse").in("id",ids);
    setFollowerProfiles((data||[]).map(normProfile));
    pushNav(()=>setShowFollowers(false));
    setShowFollowers(true);
  };
  const openFollowing=async()=>{
    const ids=myConnections||[];
    if(ids.length===0){setFollowingProfiles([]);pushNav(()=>setShowFollowing(false));setShowFollowing(true);return;}
    const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse").in("id",ids);
    setFollowingProfiles((data||[]).map(normProfile));
    pushNav(()=>setShowFollowing(false));
    setShowFollowing(true);
  };

  const saveProfile=async()=>{
    setSaving(true);
   const cleanLinks=(form.links||[]).filter(l=>l.url?.trim()).slice(0,5).map(l=>({label:(l.label||"").trim().slice(0,20),url:l.url.trim()}));
   await sb.from("profiles").update({prenom:form.prenom,nom:form.nom,bio:form.bio,paroisse:form.paroisse,shop_link:form.shop_link||null,links:cleanLinks,updated_at:new Date().toISOString()}).eq("id",session?.user?.id);
    setSaving(false);setEditing(false);reload();notify("Profil mis à jour ✦");
  };

  const uploadImg=async(e,field)=>{
  const f=e.target.files[0]; if(!f)return;
  const compressed=field==="cover_url"?f:await compressImage(f);
  const ext=f.name.split(".").pop()||"jpg";
  const path=`${field}/${session?.user?.id}.${ext}`;
    const contentType=field==="cover_url"?f.type:"image/jpeg";
    try {
  const url = await uploadToR2(compressed, field === "cover_url" ? "covers" : "avatars");
  await sb.from("profiles").update({[field]:url}).eq("id",session?.user?.id);
} catch(e) {
  notify("Erreur upload");
}
    reload();notify("Photo mise à jour ✦");
  };

  const [myPosts,setMyPosts]=useState([]);
const [myPostsLoading,setMyPostsLoading]=useState(true);
const loadMyPosts=useCallback(()=>{
  if(!session?.user?.id)return;
  setMyPostsLoading(true);
  sb.from("posts").select("id,author_id,type,text,mentions,img_url,media_urls,event_title,pinned,profile_pinned,text_background,text_font,visibility,poll_multiple,is_for_sale,whatsapp_contact,contact_link,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id)").eq("author_id",session.user.id).order("created_at",{ascending:false}).limit(30).then(({data})=>{
    if(data){
      const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,likes:(p.likes||[]).map(l=>l.user_id),participants:(p.event_participants||[]).map(x=>x.user_id),comments:(p.comments||[]),ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,text_font:p.text_font||null,visibility:p.visibility||null,profile_pinned:p.profile_pinned||false,poll_multiple:p.poll_multiple||false,poll_options:p.poll_options||[],poll_votes:p.poll_votes||[],is_for_sale:p.is_for_sale||false,whatsapp_contact:p.whatsapp_contact||null,contact_link:p.contact_link||null,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null}));
      mapped.sort((a,b)=>(b.profile_pinned?1:0)-(a.profile_pinned?1:0));
      setMyPosts(mapped);
    }
    setMyPostsLoading(false);
  });
},[session?.user?.id]);
useEffect(()=>{loadMyPosts();},[loadMyPosts, userPostsVersion]);
useEffect(()=>{
  window.addEventListener("celeste_profile_pin_changed",loadMyPosts);
  return()=>window.removeEventListener("celeste_profile_pin_changed",loadMyPosts);
},[loadMyPosts]);

const isVid=p=>p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video"));
const myPhotoPosts=useMemo(()=>myPosts.filter(p=>!isVid(p)),[myPosts]);
const myVideoPosts=useMemo(()=>myPosts.filter(p=>isVid(p)),[myPosts]);
const hasMyVisual=p=>isVid(p)||p.type==="poll"||p.type==="event"||p.img||(p.media_urls&&p.media_urls.length>0);
const myVisualPosts=useMemo(()=>myPosts,[myPosts]);
const [viewerFallback,setViewerFallback]=useState(null);
const openPostFromSound=(post,soundPosts)=>{
  const list=(soundPosts||myVisualPosts).filter(hasMyVisual);
  const idx=list.findIndex(q=>q.id===post.id);
  setViewerFallback(soundPosts?list:null);
  pushNav(()=>{setViewerIndex(null);setViewerFallback(null);});
  setViewerIndex(idx>=0?idx:0);
};
useEffect(()=>{
  const onPostDeleted=e=>{
    const id=e.detail?.id;
    if(!id)return;
    setMyPosts(prev=>prev.filter(p=>p.id!==id));
    setViewerFallback(prev=>prev?prev.filter(p=>p.id!==id):prev);
  };
  window.addEventListener("celeste_post_deleted",onPostDeleted);
  return()=>window.removeEventListener("celeste_post_deleted",onPostDeleted);
},[]);

// ── Sélection multiple (appui long sur une case) ──────────────
const pressTimerRef=useRef({});
const [selectMode,setSelectMode]=useState(false);
const [selectedIds,setSelectedIds]=useState(()=>new Set());
const enterSelectMode=id=>{setSelectMode(true);setSelectedIds(new Set([id]));};
const toggleSelected=id=>{
  setSelectedIds(prev=>{
    const next=new Set(prev);
    if(next.has(id))next.delete(id);else next.add(id);
    if(next.size===0)setSelectMode(false);
    return next;
  });
};
const cancelSelect=()=>{setSelectMode(false);setSelectedIds(new Set());};
const deleteSelectedPosts=async()=>{
  const ids=Array.from(selectedIds);
  if(ids.length===0)return;
  if(!(await confirmAction(`Supprimer ${ids.length} publication${ids.length>1?"s":""} ?`,{confirmLabel:"Supprimer"})))return;
  setMyPosts(prev=>prev.filter(p=>!selectedIds.has(p.id)));
  cancelSelect();
  notify(`${ids.length} publication${ids.length>1?"s":""} supprimée${ids.length>1?"s":""}`);
  await sb.from("posts").delete().in("id",ids).eq("author_id",session.user.id);
  ids.forEach(id=>window.dispatchEvent(new CustomEvent("celeste_post_deleted",{detail:{id}})));
};

const localToggleParticipate=async pid=>{
  const uid=session?.user?.id;
  const post=myPosts.find(p=>p.id===pid);
  if(!post)return;
  const participating=(post.participants||[]).some(x=>(x.user_id||x)===uid);
  setMyPosts(prev=>prev.map(p=>p.id!==pid?p:{...p,participants:participating?(p.participants||[]).filter(x=>(x.user_id||x)!==uid):[...(p.participants||[]),uid]}));
  try{
    if(participating)await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
    else await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
  }catch(e){console.warn("toggleParticipate error:",e);}
};

  const followersCount=useMemo(()=>(myFollowers||[]).length,[myFollowers]);
  const followingCount=useMemo(()=>(myConnections||[]).length,[myConnections]);
  const [detailPost, setDetailPost] = useState(null);

 const [viewerIndex,setViewerIndex]=useState(null);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [commentPost,setCommentPost]=useState(null);
  const [closeCallback,setCloseCallback]=useState(null);
  const [liveCmtCount,setLiveCmtCount]=useState(0);
  const refreshPost=async pid=>{
  const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
  if(!data)return null;
  return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventTime:data.event_time||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),participants:(data.event_participants||[]).map(x=>x.user_id),comments:[],is_private:data.is_private||false,comments_disabled:data.comments_disabled||false,ts:new Date(data.created_at).getTime()};
  
};
  return(
    
    <div style={{flex:1,overflowY:"auto",background:T.bg,WebkitOverflowScrolling:"touch",overscrollBehaviorY:"contain",scrollBehavior:"smooth"}}>
      {showWallet&&<WalletScreen session={session} myProfile={myProfile} notify={notify} onClose={()=>{popNav();setShowWallet(false);}} onOpenDeposit={()=>{pushNav(()=>setShowDeposit(false));setShowDeposit(true);}} pushNav={pushNav} popNav={popNav}/>}
{showDeposit&&<DepositScreen sb={sb} T={T} Btn={Btn} session={session} notify={notify} onClose={()=>{popNav();setShowDeposit(false);}} pushNav={pushNav} popNav={popNav}/>}

{showTransactions&&<TransactionsScreen sb={sb} T={T} Btn={Btn} session={session} notify={notify} onClose={()=>{popNav();setShowTransactions(false);}} pushNav={pushNav} popNav={popNav}/>}
      <input type="file" ref={avRef} accept="image/*" style={{display:"none"}} onChange={e=>uploadImg(e,"avatar_url")}/>
      <input type="file" ref={cvRef} accept="image/*" style={{display:"none"}} onChange={e=>uploadImg(e,"cover_url")}/>
      {viewerIndex!==null&&toggleLike&&toggleSave&&(
  <FeedViewer
    posts={viewerFallback||myVisualPosts}
    sb={sb} T={T} Av={Av}
    startIndex={viewerIndex}
    onClose={()=>{popNav();setViewerIndex(null);setViewerFallback(null);}}
    toggleLike={async pid=>{await toggleLike(pid);loadMyPosts();}}
    toggleSave={async pid=>{await toggleSave(pid);loadMyPosts();}}
    onParticipate={localToggleParticipate}
    session={session}
    myProfile={myProfile}
    notify={notify}
    onUser={()=>{}}
    onOpenComments={(p,cb)=>{pushNav(()=>{setCommentPost(null);setCloseCallback(null);});setCommentPost(p);setCloseCallback(()=>cb);}}
    myConnections={myConnections}
    onConnect={()=>{}}
    onOpenSound={setOpenSoundId}
  />
)}

{openSoundId&&<SoundDetailModal sb={sb} T={T} Av={Av} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
  {commentPost&&(
  <CommentsOnlyModal
    post={commentPost}
    session={session}
    getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}}
    onCountChange={setLiveCmtCount}
    onClose={()=>{
      popNav();
      setCommentPost(null);
      if(closeCallback){closeCallback(liveCmtCount);setCloseCallback(null);}
    }}
  />
)}
{detailPost&&<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}}
  zIndex={commentPost?1300:800}
  fromReel={!!commentPost}
  onClose={()=>{
    setDetailPost(null);
    setCommentPost(null);
    if(closeCallback){closeCallback(liveCmtCount);setCloseCallback(null);}
  }}

  onLike={async pid=>{const liked=(detailPost.likes||[]).includes(session?.user?.id);if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});const u=await refreshPost(pid);if(u)setDetailPost(u);}} onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}} notify={notify}/>}
      {/* Cover */}
      <div style={{height:160,background:`linear-gradient(135deg,${myProfile?.color||T.gold}22,${T.goldD}11)`,position:"relative",overflow:"hidden",cursor:"pointer"}} onClick={()=>cvRef.current.click()}>
        {myProfile?.cover_url&&<img src={myProfile.cover_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent,rgba(0,0,0,0.6))"}}/>
        <div style={{position:"absolute",bottom:12,right:12,background:"rgba(0,0,0,0.6)",borderRadius:10,padding:"5px 10px",fontSize:11,color:"#fff",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",display:"flex",alignItems:"center",gap:5}}><Camera size={12}/>Changer</div>
      </div>

      <div style={{padding:"0 18px",maxWidth:640,margin:"0 auto"}}>
        {/* Avatar + actions */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-44,marginBottom:16}}>
          <div style={{position:"relative",cursor:"pointer"}}>
  <div style={{position:"absolute",inset:-5,borderRadius:"50%",background:`conic-gradient(from 120deg, ${myProfile?.color||T.gold}, transparent 60%, ${myProfile?.color||T.gold})`,filter:"blur(7px)",opacity:.55}}/>
  {myNote&&(
    <div onClick={e=>{e.stopPropagation();pushNav(()=>setShowNoteComposer(false));setShowNoteComposer(true);}} style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",marginBottom:6,background:T.glass,border:`1px solid ${T.border}`,borderRadius:14,padding:"6px 10px",fontSize:11,color:T.text,whiteSpace:"nowrap",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",backdropFilter:"blur(10px)",zIndex:2}}>{renderTextWithMentions(myNote.text)}</div>
  )}
  <Av u={myProfile} size={92} ring onClick={e=>{e.stopPropagation();avRef.current.click();}}/>
  <div onClick={e=>{e.stopPropagation();pushNav(()=>setShowNoteComposer(false));setShowNoteComposer(true);}} style={{position:"absolute",top:-2,left:-2,width:26,height:26,borderRadius:8,background:T.glass,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:T.goldL,cursor:"pointer"}}>
    {myNote?<Edit2 size={12}/>:<Plus size={12}/>}
  </div>
  <div onClick={e=>{e.stopPropagation();avRef.current.click();}} style={{position:"absolute",bottom:-2,right:-2,width:26,height:26,borderRadius:8,background:T.gradGold,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",boxShadow:"0 2px 8px rgba(201,149,42,0.4)",cursor:"pointer"}}>
  <Camera size={12}/>
  </div>
</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
  <Btn onClick={()=>setEditing(e=>!e)} style={{background:editing?T.goldBg:T.glass,border:`1px solid ${editing?T.gold+"55":T.border}`,borderRadius:14,padding:"9px 16px",color:editing?T.goldL:T.sub,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
    <Edit2 size={14}/>{editing?"Annuler":"Modifier"}
  </Btn>
  <button onClick={()=>{pushNav(()=>setShowWallet(false));setShowWallet(true);}} style={{height:38,padding:"0 14px",display:"flex",alignItems:"center",gap:6,background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:14,color:T.goldL,fontSize:13,fontWeight:600,cursor:"pointer"}}>
  💰 Portefeuille
</button>
<button onClick={()=>{pushNav(()=>setShowTransactions(false));setShowTransactions(true);}} style={{height:38,padding:"0 14px",display:"flex",alignItems:"center",gap:6,background:T.glass,border:`1px solid ${T.border}`,borderRadius:14,color:T.text,fontSize:13,fontWeight:600,cursor:"pointer"}}>
  📦 Achats/Ventes
</button>
  <Btn onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_params"))} style={{width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",background:T.glass,border:`1px solid ${T.border}`,borderRadius:"50%",flexShrink:0}}>
    <Settings size={18} color={T.gold}/>
  </Btn>
</div>
        </div>

        {/* Info */}
        {editing?(
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20,background:T.card,borderRadius:18,padding:16,border:`1px solid ${T.border}`}}>
            <div style={{display:"flex",gap:8}}>
              <input value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))} placeholder="Prénom" style={{flex:1,minWidth:0,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:Math.max(10,13-Math.max(0,form.prenom.length-12)*0.5),outline:"none"}}/>
<input value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} placeholder="Nom" style={{flex:1,minWidth:0,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:Math.max(10,13-Math.max(0,form.nom.length-12)*0.5),outline:"none"}}/>
            </div>
            <input value={form.paroisse} onChange={e=>setForm(f=>({...f,paroisse:e.target.value}))} placeholder="Ville" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}/>
            <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} placeholder="Bio…" rows={3} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none",resize:"none",lineHeight:1.6}}/>
            {(myProfile?.country==="CG")&&(
              <input value={form.shop_link||""} onChange={e=>setForm(f=>({...f,shop_link:e.target.value}))} placeholder="🛍️ Lien boutique (optionnel)" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}/>
            )}
            <LinksEditor links={form.links} onChange={l=>setForm(f=>({...f,links:l}))}/>
            <Btn onClick={saveProfile} disabled={saving} style={{padding:"12px",background:saving?T.goldBg:T.gradGold,color:"#000",borderRadius:12,fontSize:13,fontWeight:700,boxShadow:"0 4px 16px rgba(201,149,42,0.3)"}}>
              {saving?"Sauvegarde…":"Enregistrer ✦"}
            </Btn>
          </div>
        ):(
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,minWidth:0}}>
  <h2 style={{margin:0,flex:1,minWidth:0,textAlign:"left",fontFamily:"'Cormorant Garamond',serif",fontSize:Math.max(15,26-Math.max(0,(myProfile?.fullName?.length||0)-15)*0.8),fontWeight:400,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{myProfile?.fullName}</h2>
  {myProfile?.badge&&<Badge type={myProfile.badge}/>}
</div>
            <p style={{margin:"0 0 6px",fontSize:13,color:T.muted,display:"flex",alignItems:"center",gap:3}}><MapPin size={13}/>{myProfile?.paroisse}</p>
           {myProfile?.bio&&<p style={{margin:0,fontSize:14,color:T.sub,lineHeight:1.7}}>{renderTextWithMentions(myProfile.bio)}</p>}
            {myProfile?.shop_link&&(
              <a href={myProfile.shop_link} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,padding:"8px 14px",background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:20,color:T.goldL,fontSize:12,fontWeight:600,textDecoration:"none"}}>
                🛍️ Ma boutique
              </a>
            )}
            <LinksRow links={myProfile?.links}/>
          </div>
        )}

        {/* Stats */}
        <div style={{display:"flex",gap:1,background:"rgba(255,255,255,0.03)",borderRadius:18,overflow:"hidden",border:`1px solid ${T.border}`,marginBottom:20}}>
          {[
            {l:"POSTS",v:myPosts.length,onClick:null,icon:<Grid size={14}/>},
            {l:"ABONNÉS",v:followersCount,onClick:openFollowers,icon:<Users size={14}/>},
            {l:"ABONNEMENTS",v:followingCount,onClick:openFollowing,icon:<UserCheck size={14}/>}
          ].map((s,i)=>(
            <div key={s.l} onClick={s.onClick||undefined}
              style={{flex:1,textAlign:"center",padding:"14px 8px",borderRight:i<2?`1px solid ${T.border}`:"none",cursor:s.onClick?"pointer":"default",transition:"background .2s",display:"flex",flexDirection:"column",alignItems:"center",gap:5}}
              onMouseEnter={e=>{if(s.onClick)e.currentTarget.style.background="rgba(201,149,42,0.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
              <span style={{color:s.onClick?T.goldL:T.muted,opacity:.85}}>{s.icon}</span>
              <p style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:s.onClick?T.goldL:T.text}}>{fmtCount(s.v)}</p>
              <p style={{margin:0,fontSize:9,color:T.muted,letterSpacing:1,textTransform:"uppercase"}}>{s.l}</p>
            </div>
          ))}
        </div>

        <ProfileViewsCard sb={sb} T={T} Av={Av} Btn={Btn} Badge={Badge} fmtCount={fmtCount} session={session} pushNav={pushNav} popNav={popNav}/>
               <Btn onClick={async()=>{
          const platform=Capacitor.getPlatform();
          const url=platform==="android"
            ? "https://play.google.com/store/apps/details?id=social.celesteapp"
            : "https://celesteapp.social";
          if(Capacitor.isNativePlatform()){
            try{await Share.share({title:"Céleste",text:"Rejoins-moi sur Céleste ✦",url});}
            catch(e){}
          }else if(navigator.share){
            navigator.share({title:"Céleste",text:"Rejoins-moi sur Céleste ✦",url}).catch(()=>{});
          }else{
            navigator.clipboard?.writeText(url);notify("Lien copié ✦");
          }
        }} style={{width:"100%",padding:"12px",marginBottom:20,borderRadius:14,background:T.glass,border:`1px solid ${T.border}`,color:T.sub,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Users size={15}/> Inviter des amis
        </Btn>
        <DiscoverPeopleSection sb={sb} T={T} Av={Av} Btn={Btn} Badge={Badge} session={session} notify={notify} computeMatchScore={computeMatchScore} onUser={id=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:id}}))} onConnectionChange={()=>{/* rafraîchi au prochain rendu */}}/>

        {/* Modal Abonnés */}
        {showFollowers&&(
          <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{popNav();setShowFollowers(false);}}>
            <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:T.text}}>Abonnés <span style={{color:T.goldL}}>({fmtCount(followersCount)})</span></h3>
                <Btn onClick={()=>{popNav();setShowFollowers(false);}} style={{color:T.muted}}><X size={20}/></Btn>
              </div>
              <div style={{overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
                {followerProfiles.length===0?<p style={{textAlign:"center",color:T.muted,padding:"24px 0"}}>Aucun abonné pour l'instant</p>
                  :followerProfiles.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:T.card,borderRadius:14,border:`1px solid ${T.border}`,cursor:"pointer"}}
  onClick={()=>{setShowFollowers(false);window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:u.id}}));}}>
  <Av u={u} size={42} ring/>
  <div style={{flex:1}}>
    <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{u.name}</p>
    <p style={{margin:0,fontSize:12,color:T.muted}}>{u.paroisse}</p>
  </div>
  {u.badge&&<Badge type={u.badge}/>}
</div>
                  ))
                }
                <div style={{height:20}}/>
              </div>
            </div>
          </div>
        )}

        {/* Modal Abonnements */}
        {showFollowing&&(
          <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{popNav();setShowFollowing(false);}}>
            <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:T.text}}>Abonnements <span style={{color:T.goldL}}>({followingCount})</span></h3>
                <Btn onClick={()=>{popNav();setShowFollowing(false);}} style={{color:T.muted}}><X size={20}/></Btn>
              </div>
              <div style={{overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
                {followingProfiles.length===0?<p style={{textAlign:"center",color:T.muted,padding:"24px 0"}}>Vous ne suivez personne</p>
                  :followingProfiles.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:T.card,borderRadius:14,border:`1px solid ${T.border}`,cursor:"pointer"}}
  onClick={()=>{setShowFollowing(false);window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:u.id}}));}}>
  <Av u={u} size={42} ring/>
  <div style={{flex:1}}>
    <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{u.name}</p>
    <p style={{margin:0,fontSize:12,color:T.muted}}>{u.paroisse}</p>
  </div>
  {u.badge&&<Badge type={u.badge}/>}
</div>
                  ))
                }
                <div style={{height:20}}/>
              </div>
            </div>
          </div>
        )}

        {/* Tabs: Posts / Sauvegardés (NOUVEAU) */}
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:16}}>
         {[{k:"posts",l:"Publications"},{k:"reels",l:"Reels"},{k:"saved",l:"Enregistrés"},{k:"likes",l:"J'aime"}].map(t=>(
  <Btn key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,padding:"11px 6px",background:"none",color:tab===t.k?T.goldL:T.muted,fontSize:12,fontWeight:tab===t.k?700:400,borderRadius:0,transition:"all .2s",borderBottom:tab===t.k?`2px solid ${T.gold}`:"2px solid transparent",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
    <span style={{fontSize:16}}>{t.ic}</span>
    {t.l}
  </Btn>
))}
        </div>

        {selectMode&&(
          <div style={{position:"fixed",left:0,right:0,bottom:0,zIndex:300,background:T.bg3,borderTop:`1px solid ${T.border}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
            <Btn onClick={cancelSelect} style={{color:T.muted,fontSize:13}}>Annuler</Btn>
            <span style={{fontSize:13,color:T.text,fontWeight:600}}>{selectedIds.size} sélectionnée{selectedIds.size>1?"s":""}</span>
            <Btn onClick={deleteSelectedPosts} disabled={selectedIds.size===0} style={{display:"flex",alignItems:"center",gap:6,color:"#e06060",fontSize:13,fontWeight:700,opacity:selectedIds.size===0?0.4:1}}>
              <Trash2 size={16}/> Supprimer
            </Btn>
          </div>
        )}

        {tab==="posts"&&(
          myPhotoPosts.length===0 
            ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}>
              <div style={{fontSize:40,marginBottom:8,animation:"float 3s ease infinite"}}>✦</div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,marginBottom:12}}>Aucune publication</p>
              <Btn onClick={onNewPost} style={{background:T.gradGold,borderRadius:14,padding:"11px 24px",color:"#000",fontSize:13,fontWeight:700}}>Publier maintenant</Btn>
            </div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
  {myPhotoPosts.map(p=>{
  const isSelected=selectedIds.has(p.id);
  return(
    <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer",contentVisibility:"auto",containIntrinsicSize:"120px 120px"}}
      onTouchStart={()=>{pressTimerRef.current[p.id]=setTimeout(()=>{if(!selectMode)enterSelectMode(p.id);},500);}}
      onTouchEnd={()=>clearTimeout(pressTimerRef.current[p.id])}
      onTouchMove={()=>clearTimeout(pressTimerRef.current[p.id])}
      onMouseDown={()=>{pressTimerRef.current[p.id]=setTimeout(()=>{if(!selectMode)enterSelectMode(p.id);},500);}}
      onMouseUp={()=>clearTimeout(pressTimerRef.current[p.id])}
      onMouseLeave={()=>clearTimeout(pressTimerRef.current[p.id])}>
      <div onClick={()=>{
        if(selectMode){toggleSelected(p.id);return;}
        const idx=myVisualPosts.findIndex(q=>q.id===p.id);
        pushNav(()=>{setViewerIndex(null);setViewerFallback(null);});
        setViewerIndex(idx>=0?idx:0);
      }} style={{width:"100%",height:"100%",opacity:selectMode&&!isSelected?0.5:1}}>
        {p.img
          ?(isVid(p)?<VideoThumb src={p.img||(p.media_urls||[])[0]}/>:<SmartImage src={p.img||(p.media_urls||[])[0]} alt=""/>)
          :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:8,background:p.text_background?({bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[p.text_background]||T.bg2):T.bg2}}>
            <p style={{margin:0,fontSize:11,fontWeight:700,color:p.text_background?"#fff":T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text}</p>
          </div>
        }
        {(p.type==="poll"||p.type==="event")&&(
  <div style={{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.65)",borderRadius:8,padding:"3px 8px",fontSize:9,fontWeight:700,color:T.goldL,letterSpacing:.3,backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",whiteSpace:"nowrap"}}>
    {p.type==="poll"?"Sondage":"Événement"}
  </div>
)}
        <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {fmtCount((p.likes||[]).length)}</span>
          {p.savesCount>0&&<span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>🔖 {p.savesCount}</span>}
        </div>
        {p.profile_pinned&&(
          <div style={{position:"absolute",top:6,left:6,background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
            <Pin size={11} color={T.goldL}/>
          </div>
        )}
      </div>
      {selectMode?(
        <div onClick={()=>toggleSelected(p.id)} style={{position:"absolute",top:6,right:6,width:22,height:22,borderRadius:"50%",border:`2px solid ${isSelected?T.goldL:"#fff"}`,background:isSelected?T.goldL:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isSelected&&<Check size={13} color="#000"/>}
        </div>
      ):(
      <Btn onClick={e=>{
        e.stopPropagation();
        const next=!p.profile_pinned;
        setMyPosts(prev=>prev.map(x=>x.id===p.id?{...x,profile_pinned:next}:x));
        notify(next?"Épinglé sur ton profil ✦":"Désépinglé du profil");
        (async()=>{
          if(next){
            const{count}=await sb.from("posts").select("id",{count:"exact",head:true}).eq("author_id",session.user.id).eq("profile_pinned",true);
            if((count||0)>=3){
              setMyPosts(prev=>prev.map(x=>x.id===p.id?{...x,profile_pinned:false}:x));
              notify("Tu peux épingler 3 publications maximum");
              return;
            }
          }
          const{error}=await sb.from("posts").update({profile_pinned:next}).eq("id",p.id);
          if(error){
            console.error("profile_pinned update error:",error);
            setMyPosts(prev=>prev.map(x=>x.id===p.id?{...x,profile_pinned:!next}:x));
            notify("Erreur lors de l'épinglage — réessaie");
            return;
          }
          window.dispatchEvent(new CustomEvent("celeste_profile_pin_changed"));
        })();
      }} style={{position:"absolute",top:6,right:36,background:"rgba(0,0,0,0.7)",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",color:p.profile_pinned?T.goldL:"#fff",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",border:`1px solid ${p.profile_pinned?T.goldL+"55":"rgba(255,255,255,0.2)"}`}}>
  <Pin size={13}/>
</Btn>
      )}
    </div>
  );})}
</div>
        )}
{tab==="reels"&&(
          myVideoPosts.length===0
            ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucun reel encore</p></div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
              {myVideoPosts.map(p=>{
                const isSelected=selectedIds.has(p.id);
                return(
                <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer",contentVisibility:"auto",containIntrinsicSize:"120px 120px"}}
                  onTouchStart={()=>{pressTimerRef.current[p.id]=setTimeout(()=>{if(!selectMode)enterSelectMode(p.id);},500);}}
                  onTouchEnd={()=>clearTimeout(pressTimerRef.current[p.id])}
                  onTouchMove={()=>clearTimeout(pressTimerRef.current[p.id])}
                  onMouseDown={()=>{pressTimerRef.current[p.id]=setTimeout(()=>{if(!selectMode)enterSelectMode(p.id);},500);}}
                  onMouseUp={()=>clearTimeout(pressTimerRef.current[p.id])}
                  onMouseLeave={()=>clearTimeout(pressTimerRef.current[p.id])}
                  onClick={()=>{
                    if(selectMode){toggleSelected(p.id);return;}
                    const idx=myVisualPosts.findIndex(q=>q.id===p.id);pushNav(()=>{setViewerIndex(null);setViewerFallback(null);});setViewerIndex(idx>=0?idx:0);
                  }}>
                 <div style={{width:"100%",height:"100%",opacity:selectMode&&!isSelected?0.5:1}}><VideoThumb src={p.img}/></div>
                  <div style={{position:"absolute",bottom:4,right:6}}><span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {fmtCount((p.likes||[]).length)}</span></div>
                  {selectMode&&(
                    <div onClick={e=>{e.stopPropagation();toggleSelected(p.id);}} style={{position:"absolute",top:6,right:6,width:22,height:22,borderRadius:"50%",border:`2px solid ${isSelected?T.goldL:"#fff"}`,background:isSelected?T.goldL:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {isSelected&&<Check size={13} color="#000"/>}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
        )}
        {tab==="likes"&&(
          <LikedPostsTab session={session} notify={notify} onImageView={onImageView} myProfile={myProfile} getM={getM} myConnections={myConnections} onConnect={onConnect} toggleLike={toggleLike} toggleSave={toggleSave} pushNav={pushNav} popNav={popNav}/>
        )}
        {tab==="saved"&&(
          <SavedPostsTab myProfile={myProfile} session={session} getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}} notify={notify} onImageView={onImageView} toggleLike={toggleLike} toggleSave={toggleSave} myConnections={myConnections} onConnect={onConnect} pushNav={pushNav} popNav={popNav}/>
        )}
        <div style={{height:80}}/>
      </div>
      {showNoteComposer&&<NoteComposerModal sb={sb} T={T} Av={Av} userId={session.user.id} existingText={myNote?.text} notify={notify}
        onClose={()=>{popNav();setShowNoteComposer(false);}} onSaved={t=>setMyNote(p=>({...(p||{user_id:session.user.id}),text:t}))} onDeleted={()=>setMyNote(null)}/>}
    </div>
  );
}

function WithdrawalRequests({notify}){
  const [requests,setRequests]=useState([]);
  const [open,setOpen]=useState(false);

  const load=async()=>{
    const{data}=await sb.from("withdrawal_requests").select("*,user:profiles!withdrawal_requests_user_id_fkey(prenom,nom)").eq("status","pending").order("created_at",{ascending:false});
    setRequests(data||[]);
  };

  const exportPDF=async()=>{
    const doc=new jsPDF();
    const today=new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
    doc.setFontSize(16);
    doc.text("Céleste — Liste des retraits à traiter",14,18);
    doc.setFontSize(10);
    doc.text(`Généré le ${today} · ${requests.length} demande(s) · Total : ${requests.reduce((s,r)=>s+(r.net_amount||0),0).toLocaleString("fr-FR")} F CFA`,14,25);
    autoTable(doc,{
      startY:32,
      head:[["#","Nom","Opérateur","Téléphone","Montant (F CFA)","Payé"]],
      body:requests.map((r,i)=>[
        i+1,
        r.beneficiary_name?.trim()||`${r.user?.prenom||""} ${r.user?.nom||""}`.trim(),
        (r.operator||"").toUpperCase(),
        r.phone||"",
        (r.net_amount||0).toLocaleString("fr-FR"),
        "☐"
      ]),
      styles:{fontSize:10,cellPadding:4},
      headStyles:{fillColor:[201,149,42],textColor:255,fontStyle:"bold"},
      columnStyles:{0:{cellWidth:10},4:{halign:"right"},5:{halign:"center",cellWidth:16}}
    });
    const filename=`retraits_celeste_${new Date().toISOString().slice(0,10)}.pdf`;

    if(!isNative){
      doc.save(filename);
      return;
    }

    try{
      const base64=doc.output("datauristring").split(",")[1];
      const saved=await Filesystem.writeFile({path:filename,data:base64,directory:Directory.Cache});
      await Share.share({title:"Retraits Céleste",text:"Liste des retraits à traiter",url:saved.uri,dialogTitle:"Partager le PDF"});
    }catch(e){
      console.error("Export PDF natif :",e);
      notify("Erreur lors de l'export PDF");
    }
  };

  useEffect(()=>{
    load();
    const ch=sb.channel("withdrawal_requests_live")
      .on("postgres_changes",{event:"*",schema:"public",table:"withdrawal_requests"},()=>load())
      .subscribe();
    return()=>sb.removeChannel(ch);
  },[]);

  useEffect(()=>{if(open)load();},[open]);

  return(
    <>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setOpen(o=>!o)} style={{flex:1,padding:"11px",background:"rgba(201,149,42,0.08)",border:`1px solid rgba(201,149,42,0.3)`,borderRadius:12,color:"#C9952A",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          📤 Retraits en attente ({requests.length})
        </button>
        <button onClick={exportPDF} disabled={requests.length===0} style={{padding:"11px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,color:requests.length===0?"#666":"#F5F0E8",fontSize:13,fontWeight:600,cursor:requests.length===0?"default":"pointer"}}>
          📄 PDF
        </button>
      </div>
      {open&&requests.map(r=>(
        <div key={r.id} style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.07)",marginTop:6}}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:"#F5F0E8"}}>{r.user?.prenom} {r.user?.nom}</p>
          {r.beneficiary_name&&r.beneficiary_name.toLowerCase()!==`${r.user?.prenom} ${r.user?.nom}`.toLowerCase()&&(
            <p style={{margin:"0 0 4px",fontSize:12,color:"#F0C96A",fontWeight:600}}>⚠ Compte au nom de : {r.beneficiary_name}</p>
          )}
          {!r.beneficiary_name&&<p style={{margin:"0 0 4px",fontSize:11,color:"#f87171",fontStyle:"italic"}}>Ancienne demande — pas de nom renseigné</p>}
          <p style={{margin:"0 0 4px",fontSize:12,color:"#9A9690"}}>{r.operator?.toUpperCase()} · {r.phone}</p>
          <p style={{margin:"0 0 10px",fontSize:13,color:"#F0C96A",fontWeight:700}}>À envoyer : {r.net_amount?.toLocaleString("fr-FR")} F CFA</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={async()=>{
              const{error}=await sb.functions.invoke("process-wallet",{body:{request_id:r.id,action:"confirm"}});
              if(error)return notify("Erreur — "+error.message);
              notify("Retrait confirmé ✦");load();
            }} style={{flex:1,padding:"8px",background:"rgba(61,184,116,0.1)",border:"1px solid rgba(61,184,116,0.3)",borderRadius:10,color:"#4ade80",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              ✓ Confirmé (envoyé)
            </button>
            <button onClick={async()=>{
              const{error}=await sb.functions.invoke("process-wallet",{body:{request_id:r.id,action:"reject"}});
              if(error)return notify("Erreur — "+error.message);
              notify("Retrait annulé — remboursé ✦");load();
            }} style={{padding:"8px 12px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,color:"#f87171",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

// ── PLAINTES DE RETRAIT ───────────────────────────────────
function WalletComplaints({notify}){
  const [complaints,setComplaints]=useState([]);
  const [open,setOpen]=useState(false);

  const load=async()=>{
    const{data}=await sb.from("wallet_complaints").select("*,user:profiles!wallet_complaints_user_id_fkey(prenom,nom)").eq("status","open").order("created_at",{ascending:false});
    setComplaints(data||[]);
  };

  const resolve=async(c,replyText)=>{
    await sb.from("wallet_complaints").update({status:"resolved",reply:replyText||null,resolved_at:new Date().toISOString()}).eq("id",c.id);
    if(replyText){
      await sb.from("notifications").insert({user_id:c.user_id,from_id:null,type:"wallet_complaint_reply",text:`Réponse de l'équipe à ta plainte : ${replyText}`,read:false});
    }
    notify("Plainte marquée résolue ✦");
    load();
  };

  useEffect(()=>{
    load();
    const ch=sb.channel("wallet_complaints_live")
      .on("postgres_changes",{event:"*",schema:"public",table:"wallet_complaints"},()=>load())
      .subscribe();
    return()=>sb.removeChannel(ch);
  },[]);

  useEffect(()=>{if(open)load();},[open]);

  return(
    <>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"11px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,color:"#f87171",fontSize:13,fontWeight:600,cursor:"pointer",marginTop:8}}>
        ⚠️ Plaintes de retrait ({complaints.length})
      </button>
      {open&&complaints.map(c=>(
        <div key={c.id} style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.07)",marginTop:6}}>
          <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:"#F5F0E8"}}>{c.user?.prenom} {c.user?.nom} · {Math.abs(c.amount||0).toLocaleString("fr-FR")} F CFA</p>
          <p style={{margin:"0 0 4px",fontSize:11,color:"#9A9690"}}>{new Date(c.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
          <p style={{margin:"0 0 10px",fontSize:13,color:"#F0C96A"}}>{c.message}</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{const r=window.prompt("Réponse envoyée au membre :");if(r?.trim())resolve(c,r.trim());}} style={{flex:1,padding:"8px",background:"rgba(201,149,42,0.1)",border:"1px solid rgba(201,149,42,0.3)",borderRadius:10,color:"#C9952A",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              💬 Répondre
            </button>
            <button onClick={()=>resolve(c,null)} style={{padding:"8px 12px",background:"rgba(61,184,116,0.1)",border:"1px solid rgba(61,184,116,0.3)",borderRadius:10,color:"#4ade80",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              ✓
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────
function AdminPanel({onClose,notify,reload,reloadPosts,session,myProfile,initialFilter}){
  const [list,setList]=useState([]);
  const [allReports,setAllReports]=useState([]);
  const [allPosts,setAllPosts]=useState([]);
  const [filter,setFilter]=useState(()=>{
    const initial=myProfile?.is_super_admin?["pending","members","suspended","reports","stickers","finance"]:(myProfile?.admin_scopes||[]);
    if(initialFilter&&initial.includes(initialFilter))return initialFilter;
    if(initial.includes("pending"))return"pending";
    if(initial.includes("members"))return"all";
    if(initial.includes("suspended"))return"suspended";
    if(initial.includes("reports"))return"reports";
    if(initial.includes("stickers"))return"sons";
    return"none";
  });
  const [showPosts,setShowPosts]=useState(false);
  const [search,setSearch]=useState("");
  const [postSearch,setPostSearch]=useState("");
  const [deletingReportId,setDeletingReportId]=useState(null);
  const [permsOpenFor,setPermsOpenFor]=useState(null);
  const [pendingScopes,setPendingScopes]=useState([]);
    const [txReports,setTxReports]=useState([]);

  const ADMIN_SCOPE_LABELS={pending:"En attente",members:"Membres",suspended:"Suspendus",reports:"Signalements",stickers:"Sons & Stickers",finance:"Finance (retraits, pool, plaintes)"};
  const myScopes=myProfile?.is_super_admin?["pending","members","suspended","reports","stickers","finance"]:(myProfile?.admin_scopes||[]);
  const hasScope=s=>myScopes.includes(s);

  const saveAdminPermissions=async targetId=>{
    const{error}=await sb.rpc("admin_set_permissions",{target_user_id:targetId,new_is_admin:pendingIsAdmin,new_scopes:pendingScopes});
    if(error){notify("Erreur : "+error.message);return;}
    setList(prev=>prev.map(x=>x.id===targetId?{...x,is_admin:pendingIsAdmin,admin_scopes:pendingIsAdmin?pendingScopes:[]}:x));
    setPermsOpenFor(null);
    notify("Permissions mises à jour ✦");
  };

  useEffect(()=>{
    sb.from("profiles").select("*").then(({data})=>setList((data||[]).map(normProfile)));
    sb.from("reports").select(`*,reporter:profiles!reports_reporter_id_fkey(prenom,nom),reported:profiles!reports_reported_id_fkey(prenom,nom),post:posts(id,text,media_urls,img_url),sticker:stickers(id,name,url,type,added_by_admin,author_id)`).order("created_at",{ascending:false}).then(({data})=>setAllReports(data||[]));
    sb.from("posts").select(`*,author:profiles(id,prenom,nom)`).order("created_at",{ascending:false}).limit(50).then(({data})=>setAllPosts(data||[]));
    sb.from("transaction_reports").select(`*,reporter:profiles!transaction_reports_reporter_id_fkey(prenom,nom),reported:profiles!transaction_reports_reported_user_id_fkey(prenom,nom),transaction:transactions(id,amount,quantity,status,unit_price,post:posts(text))`).eq("status","pending").order("created_at",{ascending:false}).then(({data})=>setTxReports(data||[]));
  },[]);

  const approve=async(id)=>{
  const{error}=await sb.from("profiles").update({status:"active"}).eq("id",id);
  if(error){notify("Erreur : "+error.message);console.error(error);return;}
  setList(p=>p.map(m=>m.id===id?{...m,status:"active"}:m));
  await sb.from("notifications").insert({user_id:id,from_id:id,type:"approved",read:false});
  reload();notify("Membre approuvé ✦");
};

  const reject=async id=>{
    if(!(await confirmAction("Rejeter et supprimer ce membre ?",{confirmLabel:"Rejeter"})))return;
    await sb.auth.admin?.deleteUser(id);
    await sb.from("profiles").delete().eq("id",id);
    setList(p=>p.filter(m=>m.id!==id));notify("Rejeté");
  };
  const suspend=async(id,status)=>{
    const ns=status==="suspended"?"active":"suspended";

    if(ns==="active"){
      const{error}=await sb.from("profiles").update({status:ns,marketplace_blocked:false}).eq("id",id);
      if(error){notify("Erreur : "+error.message);return;}
      const{data}=await sb.from("profiles").select("*").order("joined_at",{ascending:false});
      if(data)setList(data.map(normProfile));
      reload?.();
      notify("✓ Réactivé avec succès");
      return;
    }

    const tierChoice=window.prompt("Amende à appliquer :\n1 = Mineur (2 000 F)\n2 = Modéré (5 000 F)\n3 = Grave (15 000 F)\n4 = Très grave (30 000 F)\n0 = Aucune amende\n\nTape un chiffre :");
    if(tierChoice===null)return;
    const TIERS={"1":2000,"2":5000,"3":15000,"4":30000};
    const fineAmount=TIERS[tierChoice.trim()]||null;
    const reason=window.prompt("Raison de la suspension (visible par l'utilisateur) :")||null;

    const{error}=await sb.rpc("admin_suspend_with_fine",{p_user_id:id,p_fine_amount:fineAmount,p_reason:reason});
    if(error){notify("Erreur : "+error.message);return;}
    const{data}=await sb.from("profiles").select("*").order("joined_at",{ascending:false});
    if(data)setList(data.map(normProfile));
    reload?.();
    notify(fineAmount?`🚫 Suspendu — amende de ${fineAmount} F CFA requise`:"🚫 Suspendu");
  };
 const chBadge=async(id,badge)=>{
  const{error}=await sb.from("profiles").update({badge}).eq("id",id);
  if(error){notify("Erreur : "+error.message);console.error(error);return;}
  setList(p=>p.map(m=>m.id===id?{...m,badge}:m));
  notify("Badge mis à jour ✦");
};
  const togglePin=async(pid,pinned)=>{
    const{error}=await sb.from("posts").update({pinned:!pinned}).eq("id",pid);
    if(error){notify("Erreur : "+error.message);console.error(error);return;}
    setAllPosts(p=>p.map(x=>x.id===pid?{...x,pinned:!pinned}:x));
    reloadPosts?.();notify(pinned?"Désépinglé":"Épinglé ✦");
  };
   const resolveTxReport=async(id,action)=>{
    let fineAmount=null,notes=null;
    if(action==="ban"){
      const tierChoice=window.prompt("Amende à appliquer :\n1 = Mineur (2 000 F)\n2 = Modéré (5 000 F)\n3 = Grave (15 000 F)\n4 = Très grave (30 000 F)\n\nTape un chiffre :");
      if(tierChoice===null)return;
      const TIERS={"1":2000,"2":5000,"3":15000,"4":30000};
      fineAmount=TIERS[tierChoice.trim()];
      if(!fineAmount){notify("Choix invalide");return;}
      notes=window.prompt("Raison (visible par l'utilisateur) :");
    }else if(action==="warn"||action==="block"){
      notes=window.prompt(action==="warn"?"Message d'avertissement :":"Raison du blocage (optionnel) :");
      if(action==="warn"&&!notes?.trim())return;
    }
    const{error}=await sb.rpc("resolve_report",{p_report_id:id,p_verdict:"confirmed",p_admin_notes:notes,p_action:action,p_fine_amount:fineAmount});
    if(error){notify("Erreur : "+error.message);return;}
    setTxReports(p=>p.filter(x=>x.id!==id));
    notify(action==="warn"?"Avertissement envoyé":action==="block"?"Compte bloqué du marketplace":"Compte suspendu, amende créée");
  };
  const clearTxReport=async(id)=>{
    const{error}=await sb.rpc("resolve_report",{p_report_id:id,p_verdict:"cleared"});
    if(error){notify("Erreur : "+error.message);return;}
    setTxReports(p=>p.filter(x=>x.id!==id));
    notify("Compte innocenté, retraits débloqués ✦");
  };

  const norm=s=>(s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const stickerReports=(allReports||[]).filter(r=>r.sticker_id);
const otherReports=(allReports||[]).filter(r=>!r.sticker_id);
  const allMembers=(list||[]).filter(m=>m.status!=="pending");
  const pending=(list||[]).filter(m=>m.status==="pending");
  const suspended=(list||[]).filter(m=>m.status==="suspended");
  const baseList=filter==="pending"?pending:filter==="suspended"?suspended:filter==="reports"?[]:hasScope("members")?(list||[]).filter(m=>m.id):[];
  const displayList=search.trim()
    ?baseList.filter(m=>norm(m.fullName||m.name).includes(norm(search))||norm(m.prenom).includes(norm(search))||norm(m.nom).includes(norm(search))||norm(m.whatsapp).includes(norm(search)))
    :baseList;
  const filteredPosts=postSearch.trim()
    ?(allPosts||[]).filter(p=>norm(p.text||p.event_title).includes(norm(postSearch))||norm(p.author?.prenom).includes(norm(postSearch))||norm(p.author?.nom).includes(norm(postSearch)))
    :(allPosts||[]);

  return(
    <>
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:"min(1100px, 96vw)",maxHeight:"92vh",display:"flex",flexDirection:"column",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)",marginBottom:"var(--kb-height,0px)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.goldL}}>🛡 Administration</h2>
            <p style={{margin:0,fontSize:12,color:T.muted}}>{(list||[]).length} membres · {pending.length} en attente · {allReports.length} signalements</p>
          </div>
          <Btn onMouseDown={e=>e.preventDefault()} onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
        </div>
        <div style={{display:"flex",gap:4,padding:"12px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,overflowX:"auto"}}>
          {[{id:"pending",l:`En attente (${pending.length})`,scope:"pending"},{id:"all",l:"Tous",scope:"members"},{id:"suspended",l:`Suspendus (${suspended.length})`,scope:"suspended"},{id:"reports",l:`Signalements (${otherReports.length})`,scope:"reports"},{id:"tx_reports",l:`Litiges transactions (${txReports.length})`,scope:"finance"},{id:"sticker_reports",l:`Stickers signalés (${stickerReports.length})`,scope:"stickers"},{id:"sons",l:"Sons",scope:"stickers"},{id:"stickers",l:"Stickers",scope:"stickers"}].filter(f=>hasScope(f.scope)).map(f=>(

          <Btn key={f.id} onClick={()=>setFilter(f.id)} style={{padding:"7px 14px",borderRadius:20,background:filter===f.id?T.goldBg:"rgba(255,255,255,0.03)",border:`1px solid ${filter===f.id?T.gold+"44":T.border}`,color:filter===f.id?T.goldL:T.muted,fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
              {f.l}
            </Btn>
          ))}
        </div>
        {filter!=="reports"&&filter!=="sticker_reports"&&(
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"9px 12px"}}>
              <Search size={15} color={T.muted}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un membre (nom, prénom, whatsapp)…"
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:T.text,fontSize:13}}/>
              {search&&<Btn onClick={()=>setSearch("")} style={{color:T.muted,display:"flex"}}><X size={14}/></Btn>}
            </div>
          </div>
        )}
        
        <div style={{flex:1,overflowY:"auto"}}>
          {filter==="sons"
  ?<AdminSoundsPanel sb={sb} T={T} Av={Av} notify={notify} />
  :filter==="stickers"
  ?<AdminStickersPanel sb={sb} T={T} Av={Av} notify={notify} />
  :filter==="sticker_reports"
            ?<div>
              {(stickerReports||[]).length===0&&<p style={{textAlign:"center",padding:30,color:T.muted,fontStyle:"italic"}}>Aucun sticker signalé</p>}
              {(stickerReports||[]).map(r=>(
                <div key={r.id} style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,background:"rgba(200,64,64,0.03)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <span style={{fontSize:10,background:"rgba(200,64,64,0.12)",color:T.err,padding:"2px 8px",borderRadius:20,fontWeight:700}}>🚨 STICKER SIGNALÉ</span>
                    <span style={{fontSize:10,color:T.muted}}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{margin:"0 0 3px",fontSize:12,color:T.muted}}><strong>Par :</strong> {r.reporter?.prenom} {r.reporter?.nom}</p>
                  <p style={{margin:"0 0 8px",fontSize:12,color:T.goldL}}><strong>Raison :</strong> {r.reason}</p>
                  {r.sticker?(
                    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px",background:"rgba(255,255,255,0.04)",borderRadius:10,borderLeft:`3px solid ${T.err}`}}>
                      <div style={{width:56,height:56,borderRadius:10,background:"rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
                        {r.sticker.type==="animated"
                          ?<video src={r.sticker.url} autoPlay loop muted playsInline style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                          :<img src={r.sticker.url} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{margin:0,fontSize:12,fontWeight:700,color:T.text}}>{r.sticker.name}</p>
                        <p style={{margin:0,fontSize:10,color:T.muted}}>{r.sticker.added_by_admin?"Sticker officiel":"Ajouté par un membre"}</p>
                      </div>
                      <Btn onClick={async()=>{
                        if(!(await confirmAction(`Supprimer le sticker "${r.sticker.name}" ?`,{detail:"Il sera retiré de toute l'application.",confirmLabel:"Supprimer"})))return;
                        await sb.from("stickers").delete().eq("id",r.sticker.id);
                        setAllReports(p=>p.filter(x=>x.id!==r.id||x.sticker_id!==r.sticker_id));
                        notify("Sticker supprimé");
                      }} style={{fontSize:11,color:T.err,fontWeight:700,padding:"6px 10px",border:`1px solid ${T.err}55`,borderRadius:8,flexShrink:0}}>Supprimer</Btn>
                    </div>
                  ):(
                    <p style={{margin:0,fontSize:11,color:T.muted,fontStyle:"italic"}}>Sticker déjà supprimé</p>
                  )}
                </div>
              ))}
            </div>
            :filter==="tx_reports"
            ?<div>
  {(txReports||[]).length===0&&<p style={{textAlign:"center",padding:30,color:T.muted,fontStyle:"italic"}}>Aucun litige en attente</p>}
  {(txReports||[]).map(r=>(
                <div key={r.id} style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,background:"rgba(200,64,64,0.03)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <span style={{fontSize:10,background:"rgba(200,64,64,0.12)",color:T.err,padding:"2px 8px",borderRadius:20,fontWeight:700}}>🚩 LITIGE TRANSACTION</span>
                    <span style={{fontSize:10,color:T.muted}}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{margin:"0 0 3px",fontSize:13,color:T.text}}><strong>Signalé :</strong> {r.reported?.prenom} {r.reported?.nom}</p>
                  <p style={{margin:"0 0 3px",fontSize:12,color:T.muted}}><strong>Par :</strong> {r.reporter?.prenom} {r.reporter?.nom}</p>
                  <p style={{margin:"0 0 3px",fontSize:12,color:T.goldL}}><strong>Raison :</strong> {r.reason}</p>
                  {r.transaction&&(
                    <div style={{marginTop:6,padding:"8px 10px",background:"rgba(255,255,255,0.04)",borderRadius:10,borderLeft:`3px solid ${T.err}`}}>
                      <p style={{margin:0,fontSize:10,fontWeight:700,color:T.err}}>📦 Transaction concernée</p>
                      <p style={{margin:"3px 0 0",fontSize:11,color:T.sub}}>{r.transaction.post?.text||"Article"} · {r.transaction.amount} F · statut : {r.transaction.status}</p>
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    <Btn onClick={()=>clearTxReport(r.id)} style={{fontSize:11,color:T.ok,fontWeight:700,padding:"6px 12px",border:`1px solid ${T.ok}55`,borderRadius:8}}>✓ Innocenter</Btn>
                    <Btn onClick={()=>resolveTxReport(r.id,"warn")} style={{fontSize:11,color:"#e0b84a",fontWeight:700,padding:"6px 12px",border:"1px solid #e0b84a55",borderRadius:8}}>⚠ Avertir</Btn>
                    <Btn onClick={()=>resolveTxReport(r.id,"block")} style={{fontSize:11,color:T.err,fontWeight:700,padding:"6px 12px",border:`1px solid ${T.err}55`,borderRadius:8}}>🔒 Bloquer</Btn>
                    <Btn onClick={()=>resolveTxReport(r.id,"ban")} style={{fontSize:11,color:"#fff",fontWeight:700,padding:"6px 12px",background:T.err,borderRadius:8}}>⛔ Bannir + amende</Btn>
                  </div>
                </div>
              ))}
            </div>
            :filter==="reports"
            ?<div>
  {(otherReports||[]).length===0&&<p style={{textAlign:"center",padding:30,color:T.muted,fontStyle:"italic"}}>Aucun signalement</p>}
  {(otherReports||[]).map(r=>(
                <div key={r.id} style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,background:"rgba(200,64,64,0.03)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <span style={{fontSize:10,background:"rgba(200,64,64,0.12)",color:T.err,padding:"2px 8px",borderRadius:20,fontWeight:700}}>🚨 SIGNALEMENT</span>
                    <span style={{fontSize:10,color:T.muted}}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p style={{margin:"0 0 3px",fontSize:13,color:T.text}}><strong>Signalé :</strong> {r.reported?.prenom} {r.reported?.nom}</p>
                  <p style={{margin:"0 0 3px",fontSize:12,color:T.muted}}><strong>Par :</strong> {r.reporter?.prenom} {r.reporter?.nom}</p>
                  <p style={{margin:"0 0 3px",fontSize:12,color:T.goldL}}><strong>Raison :</strong> {r.reason}</p>
                  {r.details&&<p style={{margin:"0 0 3px",fontSize:11,color:T.muted,fontStyle:"italic"}}>{r.details}</p>}
                  {r.post_id&&(
                    <div style={{marginTop:6,padding:"8px 10px",background:"rgba(255,255,255,0.04)",borderRadius:10,borderLeft:`3px solid ${T.err}`}}>
                      <p style={{margin:0,fontSize:10,fontWeight:700,color:T.err}}>📌 Publication signalée</p>
                      {r.post?.text&&<p style={{margin:"3px 0 0",fontSize:11,color:T.sub,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{r.post.text}</p>}
                      {!r.post&&<p style={{margin:"3px 0 0",fontSize:11,color:T.muted,fontStyle:"italic"}}>Publication supprimée</p>}
                      {r.post&&(
                        <div style={{display:"flex",gap:8,marginTop:8}}>
                          <Btn onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:r.post_id}}))} style={{fontSize:11,color:T.goldL,fontWeight:700,padding:"5px 10px",border:`1px solid ${T.goldL}55`,borderRadius:8}}>👁 Ouvrir le post</Btn>
                          <Btn onClick={()=>setDeletingReportId(r.id)} style={{fontSize:11,color:T.err,fontWeight:700,padding:"5px 10px",border:`1px solid ${T.err}55`,borderRadius:8}}>Supprimer la publication</Btn>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{display:"flex",gap:14,marginTop:6}}>
                    <Btn onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:r.reported_id}}))} style={{fontSize:11,color:T.goldL,padding:0}}>Voir le profil signalé →</Btn>
                    <Btn onClick={async()=>{
                      const msg=window.prompt("Message d'avertissement à envoyer :");
                      if(!msg?.trim())return;
                      await sb.from("notifications").insert({user_id:r.reported_id,from_id:session?.user?.id,type:"warning",text:msg.trim(),read:false});
                      notify("Avertissement envoyé");
                    }} style={{fontSize:11,color:"#e0b84a",padding:0}}>Envoyer un avertissement</Btn>
                  </div>
                </div>
              ))}
            </div>
            :<>
              {(displayList||[]).length===0&&<p style={{textAlign:"center",padding:30,color:T.muted,fontStyle:"italic"}}>Aucun membre</p>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:10,padding:"12px 16px"}}>
              {(displayList||[]).map(m=>(
                <div key={m.id} style={{padding:14,borderRadius:14,border:`1px solid ${T.border}`,background:m.status==="pending"?"rgba(201,149,42,0.05)":m.status==="suspended"?"rgba(200,64,64,0.05)":"rgba(255,255,255,0.02)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:10}}>
                    <Av u={m} size={44}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:600,color:T.text}}>{m.fullName||m.name}</span>
                        {m.status==="pending"&&<span style={{fontSize:8,background:"rgba(201,149,42,0.12)",color:T.goldL,padding:"2px 8px",borderRadius:20,fontWeight:700,letterSpacing:.5}}>EN ATTENTE</span>}
                        {m.status==="suspended"&&<span style={{fontSize:8,background:"rgba(200,64,64,0.12)",color:T.err,padding:"2px 8px",borderRadius:20,fontWeight:700,letterSpacing:.5}}>SUSPENDU</span>}
                      </div>
                      <p style={{margin:0,fontSize:11,color:T.muted,display:"flex",alignItems:"center",gap:3}}><MapPin size={11}/>{m.paroisse} · {m.joined}</p>
                      {m.whatsapp&&<a href={`https://wa.me/${m.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#25D366",fontWeight:600,display:"inline-flex",alignItems:"center",gap:4,marginTop:3,textDecoration:"none"}}>📱 {m.whatsapp}</a>}
                    </div>
                  </div>
                  {m.status==="pending"
                    ?<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Btn onClick={()=>approve(m.id)} style={{flex:1,padding:"8px",background:"rgba(64,168,96,0.08)",border:"1px solid rgba(64,168,96,0.2)",borderRadius:10,color:T.ok,fontSize:11,fontWeight:700}}>✓ Approuver</Btn>
                      <Btn onClick={()=>reject(m.id)} style={{padding:"8px 12px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:10,color:T.err,fontSize:11,fontWeight:700}}><Trash2 size={14}/></Btn>
                    </div>
                    :<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Btn onClick={()=>chBadge(m.id,"confirmed")} style={{padding:"5px 11px",background:m.badge==="confirmed"?T.goldBg:"rgba(255,255,255,0.03)",border:`1px solid ${m.badge==="confirmed"?T.gold+"44":T.border}`,borderRadius:9,color:m.badge==="confirmed"?T.goldL:T.muted,fontSize:11,fontWeight:600}}>✅ Confirmé</Btn>
                      <Btn onClick={()=>chBadge(m.id,"friend")} style={{padding:"5px 11px",background:m.badge==="friend"?T.navyBg:"rgba(255,255,255,0.03)",border:`1px solid ${m.badge==="friend"?T.navy+"44":T.border}`,borderRadius:9,color:m.badge==="friend"?T.navy:T.muted,fontSize:11,fontWeight:600}}>🔵 Ami</Btn>
                      {m.badge&&<Btn onClick={()=>chBadge(m.id,null)} style={{padding:"5px 11px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:9,color:T.err,fontSize:11,fontWeight:600}}>✕ Révoquer</Btn>}
                      <Btn onClick={()=>suspend(m.id,m.status)} style={{padding:"5px 11px",background:m.status==="suspended"?"rgba(64,168,96,0.08)":"rgba(200,64,64,0.08)",border:`1px solid ${m.status==="suspended"?T.ok+"44":T.err+"44"}`,borderRadius:9,color:m.status==="suspended"?T.ok:T.err,fontSize:11,fontWeight:600,marginLeft:"auto"}}>{m.status==="suspended"?"✓ Réactiver":"🚫 Suspendre"}</Btn>
                    </div>
                  }
                  {myProfile?.is_super_admin&&m.id!==myProfile.id&&(
                    <div style={{marginTop:8}}>
                      <Btn onClick={()=>{
                        if(permsOpenFor===m.id){setPermsOpenFor(null);return;}
                        setPermsOpenFor(m.id);
                        setPendingIsAdmin(m.is_admin);
                        setPendingScopes(m.admin_scopes||[]);
                      }} style={{fontSize:11,color:T.goldL,padding:"5px 11px",border:`1px solid ${T.gold}33`,borderRadius:9,fontWeight:600}}>
                        🔑 {permsOpenFor===m.id?"Fermer":"Permissions admin"}
                      </Btn>
                      {permsOpenFor===m.id&&(
                        <div style={{marginTop:8,padding:10,background:"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${T.border}`}}>
                          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:T.text,marginBottom:8}}>
                            <input type="checkbox" checked={pendingIsAdmin} onChange={e=>setPendingIsAdmin(e.target.checked)}/>
                            Administrateur
                          </label>
                          {pendingIsAdmin&&Object.entries(ADMIN_SCOPE_LABELS).map(([key,label])=>(
                            <label key={key} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:T.sub,marginBottom:6}}>
                              <input type="checkbox" checked={pendingScopes.includes(key)}
                                onChange={e=>setPendingScopes(prev=>e.target.checked?[...prev,key]:prev.filter(s=>s!==key))}/>
                              {label}
                            </label>
                          ))}
                          <Btn onClick={()=>saveAdminPermissions(m.id)} style={{marginTop:6,width:"100%",padding:"8px",background:T.gradGold,borderRadius:9,color:"#000",fontSize:12,fontWeight:700}}>Enregistrer</Btn>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </>
          }
        </div>
        {hasScope("finance")&&(
        <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
          <Btn onClick={()=>setShowPosts(!showPosts)} style={{width:"100%",padding:"11px",background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:12,color:T.goldL,fontSize:13,fontWeight:600}}>
            📌 {showPosts?"Masquer":"Gérer les posts épinglés"}
          </Btn>
          {showPosts&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"9px 12px"}}>
                <Search size={15} color={T.muted}/>
                <input value={postSearch} onChange={e=>setPostSearch(e.target.value)} placeholder="Rechercher un post à sponsoriser (texte, auteur)…"
                  style={{flex:1,background:"transparent",border:"none",outline:"none",color:T.text,fontSize:13}}/>
                {postSearch&&<Btn onClick={()=>setPostSearch("")} style={{color:T.muted,display:"flex"}}><X size={14}/></Btn>}
              </div>
            <div style={{maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
              {filteredPosts.length===0&&<p style={{textAlign:"center",padding:16,color:T.muted,fontStyle:"italic",fontSize:12}}>Aucun post trouvé</p>}
              {filteredPosts.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:T.card,borderRadius:12,border:`1px solid ${p.pinned?T.gold+"44":T.border}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:12,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.text||p.event_title||"Post sans texte"}</p>
                    <p style={{margin:0,fontSize:10,color:T.muted}}>{p.author?.prenom} {p.author?.nom?.[0]}. · {new Date(p.created_at).toLocaleDateString("fr")}</p>
                  </div>
                  <Btn onClick={()=>togglePin(p.id,p.pinned)} style={{padding:"5px 10px",background:p.pinned?"rgba(200,64,64,0.08)":T.goldBg,border:`1px solid ${p.pinned?T.err+"44":T.gold+"44"}`,borderRadius:8,color:p.pinned?T.err:T.goldL,fontSize:11,fontWeight:700,flexShrink:0}}>
                    {p.pinned?"❌ Désponsoriser":"✦ Sponsoriser"}
                  </Btn>
                </div>
              ))}
            </div>
            </div>
          )}
         <Btn onClick={async()=>{
            const{data,error}=await sb.functions.invoke("distribute-daily-pool");
            if(error){notify("Erreur");return;}
            notify(data?.message||"Stats indisponibles");
          }} style={{width:"100%",padding:"11px",background:"rgba(61,184,116,0.08)",border:"1px solid rgba(61,184,116,0.3)",borderRadius:12,color:"#4ade80",fontSize:13,fontWeight:600}}>
            📊 Stats des likes du jour
          </Btn>

          {/* Retraits en attente */}
          <WithdrawalRequests notify={notify}/>
          <WalletComplaints notify={notify}/>
        </div>
        )}
      </div>
    </div>
    {deletingReportId&&(
      <ReportModal
        title="Motif de suppression"
        reasons={ADMIN_DELETE_REASONS}
        onClose={()=>setDeletingReportId(null)}
        onSubmit={async(reason)=>{
          const r=(allReports||[]).find(x=>x.id===deletingReportId);
          if(!r){setDeletingReportId(null);return;}
          await sb.from("posts").delete().eq("id",r.post_id);
          await sb.from("notifications").insert({user_id:r.reported_id,from_id:session?.user?.id,type:"post_deleted",text:`Ta publication a été supprimée par un administrateur (motif : ${reason})`,read:false});
          setDeletingReportId(null);
          notify("Publication supprimée, l'utilisateur a été notifié");
        }}
      />
    )}
    </>
  );
}

// ── CELESTE CHAT SCREEN ───────────────────────────────────
function CelesteChatScreen({msgs,setMsgs,onClose,myProfile,session}){
  const [inp,setInp]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef();

  const loadedRef = useRef(false);
  useEffect(()=>{
    if(!session?.user?.id||loadedRef.current)return;
    loadedRef.current=true;
    sb.from("celeste_messages").select("*").eq("user_id",session.user.id).order("created_at",{ascending:true})
      .then(({data})=>{
        if(data&&data.length>0)setMsgs(data.map(m=>({role:m.role,text:m.text})));
      });
  },[session?.user?.id]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const sendingRef=useRef(false);

const send=async()=>{
  if(!inp.trim()||loading||sendingRef.current)return;
  sendingRef.current=true;
  const text=inp.trim();
  setInp("");
  setLoading(true);
  const updatedMsgs=[...msgs,{role:"user",text}];
  setMsgs(updatedMsgs);
  if(session?.user?.id)await sb.from("celeste_messages").insert({user_id:session.user.id,role:"user",text});

  const tryGemini=async(retries=3)=>{
    for(let i=0;i<retries;i++){
      try{
        const recentMsgs=updatedMsgs.slice(-20);
        const history=recentMsgs.reduce((acc,m)=>{
          const last=acc[acc.length-1];
          const role=m.role==="user"?"user":"model";
          if(last&&last.role===role){last.parts[0].text+="\n"+m.text;}
          else{acc.push({role,parts:[{text:m.text}]});}
          return acc;
        },[]);
        const formattedMessages=[
          {role:"system",content:CELESTE_SYSTEM},
          ...history.map(h=>({
            role:h.role==="user"?"user":"assistant",
            content:h.parts[0].text
          }))
        ];
        let data;
        try{
          data=await askDeepseek(formattedMessages);
        }catch(e){
          if(e.status===429){setMsgs(p=>[...p,{role:"model",text:"Je reçois trop de messages en ce moment 😅 Attends 1 minute et réessaie !"}]);return;}
          if(i<retries-1){await new Promise(r=>setTimeout(r,2500));continue;}
          throw new Error("503");
        }
        const reply=data.choices?.[0]?.message?.content||"Je n'ai pas pu répondre.";
        setMsgs(p=>[...p,{role:"model",text:reply}]);
        if(session?.user?.id)await sb.from("celeste_messages").insert({user_id:session.user.id,role:"model",text:reply});
        return;
      }catch{if(i<retries-1){await new Promise(r=>setTimeout(r,2500));continue;}}
    }
    setMsgs(p=>[...p,{role:"model",text:"Je suis momentanément indisponible, j'ai un petit soucis revient plus tard 😅"}]);
  };
  await tryGemini();
  setLoading(false);
  sendingRef.current=false;
};

  return(
    <div style={{position:"fixed",inset:0,zIndex:1400,background:T.bg,display:"flex",flexDirection:"column",animation:"slideIn .3s ease"}}>
      {/* Header */}
      <div style={{padding:"12px 16px",paddingTop:"calc(12px + max(env(safe-area-inset-top,0px), 24px))",background:T.bg,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <Btn onClick={onClose} style={{color:T.gold,display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
        <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 16px rgba(123,47,190,0.4)"}}><Sparkles size={46} color="#fff"/></div>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Céleste IA</p>
          <p style={{margin:0,fontSize:11,color:"#9B6FDE"}}>● En ligne</p>
        </div>
        <Btn onClick={async()=>{if(await confirmAction("Effacer la conversation ?",{confirmLabel:"Effacer"}))setMsgs([]);}} style={{color:T.muted,fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10}}>Effacer</Btn>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
        {msgs.length===0&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:T.muted,textAlign:"center",padding:"60px 20px"}}>
            <div style={{width:90,height:90,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,boxShadow:"0 8px 32px rgba(123,47,190,0.4)",animation:"float 3s ease infinite"}}><Sparkles size={22} color="#fff"/></div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T.text}}>Bonjour{myProfile?.prenom?" "+myProfile.prenom:""} !</p>
            <p style={{fontSize:14,color:T.sub,lineHeight:1.8}}>Je suis Céleste, toujours là pour t'écouter, t'encourager et t'accompagner.<br/>De quoi as-tu besoin aujourd'hui ?</p>
          </div>
        )}
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:10,animation:"msgIn .3s ease"}}>
            {m.role==="model"&&(
              <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}><Sparkles size={22} color="#fff"/></div>
            )}
            <div style={{maxWidth:"78%",background:m.role==="user"?T.gradGold:"rgba(123,47,190,0.1)",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",border:m.role==="model"?"1px solid rgba(123,47,190,0.2)":"none",boxShadow:m.role==="user"?"0 4px 16px rgba(201,149,42,0.25)":"0 2px 8px rgba(0,0,0,0.2)"}}>
              <p style={{margin:0,fontSize:14,color:m.role==="user"?"#000":T.text,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{m.text}</p>
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}><Sparkles size={22} color="#fff"/></div>
            <div style={{background:"rgba(123,47,190,0.1)",borderRadius:"18px 18px 18px 4px",padding:"12px 16px",border:"1px solid rgba(123,47,190,0.2)"}}>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#9B6FDE",animation:`pulse .6s ease ${i*.2}s infinite`}}/>)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"10px 12px",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px) + var(--kb-height,0px))",background:T.bg2,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"flex-end",flexShrink:0}}>
        <div style={{flex:1,background:"rgba(123,47,190,0.06)",border:"1px solid rgba(123,47,190,0.2)",borderRadius:20,padding:"10px 16px"}}>
          <textarea value={inp} onChange={e=>{
    setInp(e.target.value);
    e.target.style.height="auto";
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
  }}
  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&window.innerWidth>768){e.preventDefault();send();}}}
  placeholder="Écris à Céleste…" rows={1}
  style={{width:"100%",background:"none",border:"none",color:T.text,fontSize:14,outline:"none",resize:"none",lineHeight:1.5,maxHeight:120,overflowY:"auto",height:"auto"}}/>
        </div>
        <Btn onClick={send} disabled={loading||!inp.trim()} style={{background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",borderRadius:"50%",width:42,height:42,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(123,47,190,0.4)",opacity:loading||!inp.trim()?0.5:1}}>
          <Send size={18}/>
        </Btn>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────
function SplashScreen(){
  const [phase,setPhase]=useState("loading"); // loading → warning → closing

  useEffect(()=>{
    const t1=setTimeout(()=>setPhase("warning"),15000);
    const t2=setTimeout(()=>setPhase("closing"),30000);
    const t3=setTimeout(()=>{
  document.body.innerHTML=`<div style="min-height:100vh;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:24px;text-align:center">
    <span style="font-size:60px">✦</span>
    <p style="color:#C9952A;font-size:18px;font-family:serif">Céleste</p>
    <p style="color:#888;font-size:13px">Impossible de se connecter.<br/>Veuillez réessayer.</p>
    <button onclick="window.location.reload()" style="margin-top:16px;padding:12px 28px;background:linear-gradient(135deg,#C9952A,#E8B84B);border:none;border-radius:14px;color:#000;font-size:14px;font-weight:700;cursor:pointer">Réessayer</button>
  </div>`;
},31000);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);

  return(
    <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:0,position:"relative",overflow:"hidden"}}>
      <style>{getGS()}</style>
      <div style={{position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,149,42,0.08),transparent 70%)",pointerEvents:"none",animation:"glowPulse 2s ease infinite"}}/>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:90,color:T.gold,animation:"starPulse 2s ease infinite",lineHeight:1,filter:"drop-shadow(0 0 40px rgba(201,149,42,0.6))"}}>✦</div>

      {phase==="loading"&&(
        <p style={{position:"absolute",bottom:28,left:0,right:0,textAlign:"center",color:T.muted,fontSize:11,letterSpacing:2,opacity:0.45,animation:"titleReveal .8s ease .6s both"}}>DES-ETOILES</p>
      )}

      {phase==="warning"&&(
        <div style={{position:"absolute",bottom:60,left:20,right:20,background:"rgba(201,149,42,0.08)",border:`1px solid ${T.gold}44`,borderRadius:20,padding:"16px 20px",textAlign:"center",animation:"fadeUp .5s ease"}}>
          <p style={{margin:"0 0 6px",fontSize:14,color:T.goldL,fontWeight:600}}>Connexion lente…</p>
          <p style={{margin:0,fontSize:12,color:T.muted}}>Connectez-vous pour accéder à Céleste</p>
        </div>
      )}

      {phase==="closing"&&(
        <div style={{position:"absolute",bottom:60,left:20,right:20,background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:20,padding:"16px 20px",textAlign:"center",animation:"fadeUp .3s ease"}}>
          <p style={{margin:"0 0 6px",fontSize:14,color:T.err,fontWeight:600}}>Impossible de se connecter</p>
          <p style={{margin:0,fontSize:12,color:T.muted}}>L'application va se fermer…</p>
        </div>
      )}
    </div>
  );
}
function VerificationInfoModal({pushNav,popNav}){
  const [open,setOpen]=useState(false);
  return(
    <>
      <Btn onClick={()=>{pushNav(()=>setOpen(false));setOpen(true);}} style={{marginTop:16,width:"100%",padding:"13px 30px",background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,color:T.muted,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span>ℹ️</span> En savoir plus sur la vérification
      </Btn>
      {open&&(
        <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{popNav();setOpen(false);}}>
          <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,padding:"32px 24px 48px",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <span style={{fontSize:40}}>🔐</span>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:400,color:T.text,margin:"12px 0 4px"}}>Pourquoi une vérification ?</h3>
              <p style={{fontSize:12,color:T.gold,letterSpacing:1,textTransform:"uppercase"}}>Céleste · Réseau privé des jeunes</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.goldL}}>🔍 Comment ça fonctionne ?</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>Lors de la vérification, le nom que tu as saisi sera recherché sur les réseaux sociaux. Si un profil correspondant est trouvé, la vérification se fera automatiquement et rapidement.</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.goldL}}>📱 Si aucun profil trouvé</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>La vérification se fera via WhatsApp, au numéro que tu as fourni lors de ton inscription. Ce numéro n'est ni partagé ni divulgué à qui que ce soit.</p>
              </div>
              <div style={{background:"rgba(200,64,64,0.05)",border:"1px solid rgba(200,64,64,0.2)",borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.err}}>⚖️ Engagement légal</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>Céleste est un espace réservé aux jeunes. Toute personne ayant fourni de fausses informations concernant son identité ou son âge, et dont l'âge réel dépasse 35 ans, s'expose à des poursuites judiciaires conformément aux lois en vigueur.</p>
              </div>
              <div style={{background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:16,padding:"16px"}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:T.goldL}}>🤝 Notre engagement</p>
                <p style={{margin:0,fontSize:13,color:T.sub,lineHeight:1.8}}>Cette vérification existe uniquement pour garantir ta sécurité et celle de tous les membres. Pour être sûrs d'être vraiment entre nous — entre jeunes.</p>
              </div>
            </div>
            <Btn onClick={()=>{popNav();setOpen(false);}} style={{width:"100%",padding:"14px",background:T.gradGold,borderRadius:14,color:"#000",fontSize:14,fontWeight:700}}>J'ai compris ✦</Btn>
          </div>
        </div>
      )}
    </>
  );
}

function CelesteApp(){
  const [logoFont]=useState(()=>{
    const fonts=["'Sacramento',cursive","'Pacifico',cursive","'Grand Hotel',cursive","'Yellowtail',cursive"];
    return fonts[Math.floor(Math.random()*fonts.length)];
  });
  const [userPostsVersion,setUserPostsVersion]=useState(0);
  const [authMode,setAuthMode]=useState("login");
  const [session,setSession]=useState(undefined);
  const [myProfile,setMyProfile]=useState(null);
  const [isPending,setIsPending]=useState(false);
  const [members,setMembers]=useState([]);
  const [posts,setPosts]=useState(()=>{try{const c=localStorage.getItem(celesteScopedKey("celeste_posts_cache"));return c?JSON.parse(c):[];}catch(e){return[];}});
  const [convs,setConvs]=useState(()=>{try{const c=localStorage.getItem(celesteScopedKey("celeste_convs_cache"));return c?JSON.parse(c):[];}catch(e){return[];}});
  const convsRef=useRef([]);
  useEffect(()=>{convsRef.current=convs;},[convs]);
  const patchConvMessages=useCallback((convId,updater)=>{
    setConvs(prev=>{
      const next=prev.map(c=>c.id===convId?{...c,msgs:updater(c.msgs||[])}:c);
      try{localStorage.setItem(celesteScopedKey("celeste_convs_cache"),JSON.stringify(next));}catch(e){}
      return next;
    });
  },[]);
  const [myConnections,setMyConnections]=useState([]);
  const [myFollowers,setMyFollowers]=useState([]);
  const [blockedUserIds,setBlockedUserIds]=useState([]);
  const [mutedAuthorIds,setMutedAuthorIds]=useState([]);
  const [feedPreloaded,setFeedPreloaded]=useState(false);
  const [onlinePresenceIds,setOnlinePresenceIds]=useState(()=>new Set());

  // Synchronise toute suppression de post faite depuis FeedViewer (feed, grille
  // de profil, viewer global…) avec la liste maîtresse — sinon le post
  // supprimé réapparaît dès qu'on quitte le viewer et redemande confirmation.
  useEffect(()=>{
    const onPostDeleted=e=>{
      const id=e.detail?.id;
      if(!id)return;
      setPosts(prev=>(prev||[]).filter(p=>p.id!==id));
      setGlobalViewerPost(prev=>prev&&prev.id===id?null:prev);
    };
    window.addEventListener("celeste_post_deleted",onPostDeleted);
    return()=>window.removeEventListener("celeste_post_deleted",onPostDeleted);
  },[]);

  useEffect(()=>{
    const setAppVh=()=>{
      document.documentElement.style.setProperty("--app-vh",`${window.innerHeight*0.01}px`);
    };
    setAppVh();
    window.addEventListener("resize",setAppVh);
    window.addEventListener("orientationchange",setAppVh);
    return()=>{window.removeEventListener("resize",setAppVh);window.removeEventListener("orientationchange",setAppVh);};
  },[]);

  useEffect(()=>{
    document.documentElement.style.setProperty("--kb-height","0px");
    if(Capacitor.isNativePlatform()){
      let showSub,hideSub;
      Keyboard.addListener("keyboardWillShow",info=>{
        document.documentElement.style.setProperty("--kb-height",`${info?.keyboardHeight||0}px`);
      }).then(h=>{showSub=h;});
      Keyboard.addListener("keyboardWillHide",()=>{
        document.documentElement.style.setProperty("--kb-height","0px");
      }).then(h=>{hideSub=h;});
      return()=>{showSub?.remove();hideSub?.remove();};
    }else if(window.visualViewport){
      const vv=window.visualViewport;
      const onVvResize=()=>{
        const inset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
        document.documentElement.style.setProperty("--kb-height",`${inset}px`);
      };
      vv.addEventListener("resize",onVvResize);
      return()=>vv.removeEventListener("resize",onVvResize);
    }
  },[]);

  useEffect(()=>{
    if(!Capacitor.isNativePlatform())return;
    setNativeBackground(T.bg);
    (async()=>{
      try{
        await StatusBar.setOverlaysWebView({overlay:true});
        await StatusBar.setStyle({style:Style.Dark});
      }catch(_){}
    })();
  },[]);

  const [chatDrafts,setChatDrafts]=useState({});
  const [tab,setTab]=useState("messages"); // ouverture par défaut sur la messagerie (feed encore en travaux)
  const tabHistoryRef=useRef([]);
  const prevTabRef=useRef("messages");
  const isBackNavRef=useRef(false);
  useEffect(()=>{
    if(!isBackNavRef.current && prevTabRef.current!==tab){
      tabHistoryRef.current.push(prevTabRef.current);
      if(tabHistoryRef.current.length>20) tabHistoryRef.current.shift();
    }
    isBackNavRef.current=false;
    prevTabRef.current=tab;
  },[tab]);
const [feedNavVisible,setFeedNavVisible]=useState(true); // masqué pendant qu'une vidéo joue en plein écran
  const [navTheme,setNavTheme]=useState(()=>{try{return localStorage.getItem("celeste_nav_theme")||"aucun";}catch(_){return "aucun";}});
  const chooseNavTheme=id=>{setNavTheme(id);try{localStorage.setItem("celeste_nav_theme",id);}catch(_){}};
 const [isOnline,setIsOnline]=useState(navigator.onLine);
  const [wasOffline,setWasOffline]=useState(false);
  useEffect(()=>{
    const on=async()=>{
      setIsOnline(true);
      setWasOffline(true);
      setTimeout(()=>setWasOffline(false),3000);
      if(session?.user?.id){
        loadMembers();
        loadPosts(1);
        loadConvs(session.user.id);
        processQueue(sb,notify).then(()=>loadConvs(session.user.id));
        processGroupQueue(sb,notify);
      }
    };
    const off=()=>setIsOnline(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[session?.user?.id]);
  const checkShared=async()=>{
  try{
    const result=await SendIntent.checkSendIntentReceived();
    if(!result?.url)return;
    const resolvedUrl=Capacitor.convertFileSrc(decodeURIComponent(result.url));
    const res=await fetch(resolvedUrl);
    const blob=await res.blob();
    const file=new File([blob],result.url.split("/").pop()||"media",{type:blob.type||result.type||"image/jpeg"});
    setSharedMedia(file);
  }catch(e){}
};
checkShared();
window.addEventListener("sendIntentReceived",checkShared);
CapApp.addListener("appStateChange",({isActive})=>{if(isActive)checkShared();});
  useEffect(()=>{
  window.__celesteSetTab=(t,cb)=>{
    if(cb&&tab===t){cb();return;}
    setTab(t);
    if(cb)window.__celesteTabChangeCb=cb;
  };
  window.__celesteGetTab=()=>tab;
  return()=>{delete window.__celesteSetTab;delete window.__celesteGetTab;};
},[tab]);
useEffect(()=>{
  if(window.__celesteTabChangeCb){const cb=window.__celesteTabChangeCb;window.__celesteTabChangeCb=null;cb();}
},[tab]);
  useEffect(()=>{
    // Ferme tout ce qui peut garder une messagerie active en arrière-plan
    // (conversation privée, chat de groupe, panneau d'infos de conv) —
    // notamment utilisé avant d'ouvrir un statut depuis la messagerie.
    const h=()=>{setOpenConvId(null);setOpenUserId(null);setOpenGroup(null);setOpenConvInfoUid(null);};
    window.addEventListener("celeste_close_conv",h);
    return()=>window.removeEventListener("celeste_close_conv",h);
  },[]);
  useEffect(()=>{
    const handler=e=>{
      const{convId}=e.detail||{};
      if(!convId)return;
      loadConvs(session?.user?.id).then(list=>{
        const found=(list||[]).find(c=>c.id===convId);
        if(found){
          setTab("messages");
          pushNav(()=>setOpenConvId(null));
          setOpenConvId(convId);
        }
      });
    };
    window.addEventListener("celeste_open_conv",handler);
    return()=>window.removeEventListener("celeste_open_conv",handler);
  },[session?.user?.id]);
  useEffect(()=>{
    const isVideoPost=p=>(p.img||"").match(/\.(mp4|mov|webm|ogg|avi)/i)||(p.media_urls||[]).some(u=>(u||"").match(/\.(mp4|mov|webm|ogg|avi)/i));
    const isPhotoPost=p=>{
      const allMedia=p.media_urls?.length>0?p.media_urls:(p.img?[p.img]:[]);
      return allMedia.some(u=>!/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u||""));
    };
    const openResolved=(finalPost,commentId,replyId)=>{
  pushNav(()=>setGlobalViewerPost(null));
  setGlobalViewerPost({...finalPost,_targetCommentId:commentId||null,_targetReplyId:replyId||null});
};
    const handler=async e=>{
      const{postId,commentId,replyId}=e.detail||{};
      if(!postId)return;
      const post=(posts||[]).find(p=>p.id===postId);
      if(post){openResolved(post,commentId,replyId);return;}
      const{data}=await sb.from("posts").select("id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection),likes(user_id),event_participants(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))").eq("id",postId).single();
      if(data){
        const mapped={id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],likes:(data.likes||[]).map(l=>l.user_id),participants:(data.event_participants||[]).map(x=>x.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),ts:new Date(data.created_at).getTime(),pinned:data.pinned||false,text_background:data.text_background||null,text_font:data.text_font||null,is_for_sale:data.is_for_sale||false,is_ai_generated:data.is_ai_generated||false,is_private:data.is_private||false,comments_disabled:data.comments_disabled||false,sound:data.sound?{id:data.sound.id,title:data.sound.title,url:data.sound.url,owner_avatar:data.sound.owner?.avatar_url||null}:null};
        openResolved(mapped,commentId,replyId);
      }else{
        notify("Cette publication n'est plus disponible");
      }
    };
    window.addEventListener("celeste_open_post",handler);
    return()=>window.removeEventListener("celeste_open_post",handler);
  },[posts]);
  useEffect(()=>{
    window.__celesteOpenChat=(convId,uid)=>{
      if(convId){
        loadConvs(session?.user?.id).then(()=>{
          pushNav(()=>setOpenConvId(null));
          setOpenConvId(convId);
          setTab("messages");
        });
      } else if(uid){
        openChat(uid);
      }
    };
    return()=>{delete window.__celesteOpenChat;};
  },[session?.user?.id,convs]);
  const [openConvId,setOpenConvId]=useState(null);
  const [openConvInfoUid,setOpenConvInfoUid]=useState(null);
  const [showCreateGroup,setShowCreateGroup]=useState(false);
  const [openGroup,setOpenGroup]=useState(null);
  const [detailPost,setDetailPost]=useState(null);
  const [openUserId,setOpenUserId]=useState(null);
  const [openUser,setOpenUser]=useState(null);
  const [showNewPost,setShowNewPost]=useState(false);
const [pendingSound,setPendingSound]=useState(null);
  const [showAdmin,setShowAdmin]=useState(false);
  const [adminOpenSection,setAdminOpenSection]=useState(null);
  const [showNotifs,setShowNotifs]=useState(false);
  const [toast,setToast]=useState(null);
  const [postPage,setPostPage]=useState(1);
  const [hasMorePosts,setHasMorePosts]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const loadingMoreRef=useRef(false); // verrou synchrone — setLoadingMore(state) est trop lent contre des appels rapprochés de onNeedMore
  const [inAppNotifs,setInAppNotifs]=useState([]);
 const [viewImg,setViewImg]=useState(null);
const [globalViewerPost,setGlobalViewerPost]=useState(null);
const [globalCommentPost,setGlobalCommentPost]=useState(null);
const [globalCloseCallback,setGlobalCloseCallback]=useState(null);
const [globalCommentLiveCount,setGlobalCommentLiveCount]=useState(0);
const [openCeleste,setOpenCeleste]=useState(false);
const [celesteMsgs,setCelesteMsgs]=useState([]);
const feedScrollRef=useRef(0);
const viewedPostIdsRef=useRef(new Set());
const [feedRefreshing,setFeedRefreshing]=useState(false);

const [sharedMedia,setSharedMedia]=useState(null);
  const [unreadNotifs,setUnreadNotifs]=useState(0);
const [unreadStatuses,setUnreadStatuses]=useState(0);
  const [hideNav,setHideNav]=useState(false);
const [hideChrome,setHideChrome]=useState(false);
const [isAppBlurred,setIsAppBlurred]=useState(false);

useEffect(()=>{
  const onFocus=()=>setHideChrome(true);
  const onBlur=()=>setHideChrome(false);
  window.addEventListener("focusin",onFocus);
  window.addEventListener("focusout",onBlur);

  const handleVisibility=()=>{
    if(document.hidden)setIsAppBlurred(true);
    else setIsAppBlurred(false);
  };

  document.addEventListener("visibilitychange",handleVisibility);

  return()=>{
    window.removeEventListener("focusin",onFocus);
    window.removeEventListener("focusout",onBlur);
    document.removeEventListener("visibilitychange",handleVisibility);
  };
},[]);

  const prevMsgCount=useRef(0);
useEffect(()=>{
  const handler=e=>setViewImg(e.detail?.url);
  window.addEventListener("celeste_view_img",handler);
  return()=>window.removeEventListener("celeste_view_img",handler);
},[]);
useEffect(()=>{
  const handler=()=>setShowNotifs(false);
  window.addEventListener("celeste_close_notifs",handler);
  return()=>window.removeEventListener("celeste_close_notifs",handler);
},[]);

  useEffect(()=>{
  const unlock=()=>{
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      if(ctx.state==='suspended')ctx.resume();
      window.removeEventListener('click',unlock);
      window.removeEventListener('touchstart',unlock);
    }catch(_){}
  };
  window.addEventListener('click',unlock);
  window.addEventListener('touchstart',unlock);
  return()=>{
    window.removeEventListener('click',unlock);
    window.removeEventListener('touchstart',unlock);
  };
},[]);
const navStack = useRef([]);
const ignoreNextPopRef = useRef(false);
const pushNav = useCallback((closeFn) => {
  navStack.current.push(closeFn);
  if(!isNative){ try{ window.history.pushState({celesteModal:true}, ""); }catch(e){} }
}, []);
const [buyingPost,setBuyingPost]=useState(null);
useEffect(()=>{
  const h=e=>{pushNav(()=>setBuyingPost(null));setBuyingPost(e.detail);};
  window.addEventListener("celeste_open_product",h);
  return()=>window.removeEventListener("celeste_open_product",h);
},[pushNav]);
useEffect(()=>{
  window.__celesteOpenAdmin=(section)=>{
    pushNav(()=>setShowAdmin(false));
    setAdminOpenSection(section||null);
    setShowAdmin(true);
  };
  return()=>{delete window.__celesteOpenAdmin;};
},[pushNav]);
useEffect(()=>{
  const h=()=>window.__celesteOpenAdmin?.("finance");
  window.addEventListener("celeste_open_admin_withdrawals",h);
  return()=>window.removeEventListener("celeste_open_admin_withdrawals",h);
},[]);
const popNav = useCallback(() => {
  navStack.current.pop();
  if(!isNative){ ignoreNextPopRef.current = true; try{ window.history.back(); }catch(e){} }
}, []);

const closeTopNav = useCallback(() => {
  if (viewImg) { setViewImg(null); return true; }
  if (navStack.current.length > 0) {
    const closeFn = navStack.current.pop();
    closeFn();
    return true;
  }
  return false;
}, [viewImg]);

useEffect(() => {
  const handler = CapApp.addListener('backButton', () => {
    if (closeTopNav()) return;
    if (tabHistoryRef.current.length > 0) {
      const prevTab = tabHistoryRef.current.pop();
      isBackNavRef.current = true;
      navStack.current = [];
      setTab(prevTab);
      return;
    }
    if (tab !== 'home') { navStack.current=[]; setTab('home'); return; }
    CapApp.minimizeApp();
  });

  return () => { Promise.resolve(handler).then(h=>h?.remove()).catch(()=>{}); };
}, [closeTopNav, tab]);

useEffect(() => {
  if (isNative) return;
  const onPopState = () => {
    if (ignoreNextPopRef.current) { ignoreNextPopRef.current = false; return; }
    closeTopNav();
  };
  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}, [closeTopNav]);
  const notify=useCallback(m=>{setToast(m);setTimeout(()=>setToast(null),2800);},[]);
  const myId=session?.user?.id;
  const addInAppNotif=useCallback((icon,title,body,action)=>{
  const id=Date.now()+Math.random();
  setInAppNotifs(p=>[...p,{id,icon,title,body,action}]);
  playNotifSound();
  setTimeout(()=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),5000);
},[myId]);
  const dismissNotif=useCallback(id=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),[]);

  const loadMyProfile=useCallback(async uid=>{
  try{
    const{data,error}=await sb.from("profiles").select("*").eq("id",uid).single();
    if(error)throw error;
    if(data){setMyProfile(normProfile(data));setIsPending(data.status==="pending");}
  }catch(e){
    console.warn("⚠️ loadMyProfile a échoué:",e);
    setFeedPreloaded(true); // évite que le splash reste bloqué indéfiniment
  }
},[]);
  const loadConnections=useCallback(async uid=>{if(!uid)return;const[{data:following},{data:followers}]=await Promise.all([sb.from("connections").select("to_id").eq("from_id",uid),sb.from("connections").select("from_id").eq("to_id",uid)]);if(following)setMyConnections(following.map(d=>d.to_id).filter(id=>id!==uid));if(followers)setMyFollowers(followers.map(d=>d.from_id).filter(id=>id!==uid));},[]);

  // Load unread notifs count
  const loadUnreadNotifs=useCallback(async uid=>{if(!uid)return;const{count}=await sb.from("notifications").select("*",{count:"exact",head:true}).eq("user_id",uid).eq("read",false);setUnreadNotifs(count||0);},[]);

  useEffect(()=>{
    if(!openUserId){setOpenUser(null);return;}
    const found=(members||[]).find(m=>m.id===openUserId);
    if(found){setOpenUser(found);return;}
    sb.from("profiles").select("*").eq("id",openUserId).single().then(({data})=>{if(data)setOpenUser({...normProfile(data),isOnline:!data.hide_online&&onlinePresenceIds.has(data.id),online:!data.hide_online&&onlinePresenceIds.has(data.id)});});
  },[openUserId,members,onlinePresenceIds]);

  useEffect(()=>{
    sb.auth.getSession().then(({data:{session:s}})=>{setSession(s||null);if(s){loadMyProfile(s.user.id);
subscribePush(sb,s.user.id).then(ok=>{if(!ok)console.warn("⚠️ Push non initialisé");});
sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",s.user.id).then(({error})=>{if(error)console.warn("last_seen:",error);});
(async()=>{try{const perm=await Geolocation.checkPermissions();if(perm.location!=="granted"){const req=await Geolocation.requestPermissions();if(req.location!=="granted")return;}const pos=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:10000});await sb.from("profiles").update({latitude:pos.coords.latitude,longitude:pos.coords.longitude}).eq("id",s.user.id);}catch(e){console.warn("geo:",e);}})();}});
    const{data:{subscription}}=sb.auth.onAuthStateChange((_e,s)=>{
      const newUid=s?.user?.id||null;
      let prevUid=null;
      try{prevUid=localStorage.getItem("celeste_active_uid");}catch(e){}
      if(newUid!==prevUid){
        // Changement de compte (connexion sous un autre compte, ou déconnexion) sur
        // cet appareil : on purge tous les caches locaux pour qu'aucune donnée
        // (messages, statuts, posts…) du compte précédent ne puisse s'afficher.
        purgeCelesteUserCaches();
        setPosts([]);
        setConvs([]);
      }
      try{if(newUid)localStorage.setItem("celeste_active_uid",newUid);else localStorage.removeItem("celeste_active_uid");}catch(e){}
      setSession(s||null);if(s){loadMyProfile(s.user.id);subscribePush(sb,s.user.id).then(ok=>{if(!ok)console.warn("⚠️ Push non initialisé");});sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",s.user.id);}else{setMyProfile(null);setIsPending(false);}});
    const lsInterval=setInterval(()=>{sb.auth.getSession().then(({data})=>{const uid=data?.session?.user?.id;if(uid)sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",uid);});},60000);
    // Force la mise à jour de last_seen ET le rafraîchissement du token dès que l'app/onglet revient au premier plan
    // (le timer interne de refresh de Supabase peut être throttled/suspendu en arrière-plan, laissant le token expirer silencieusement)
    const onVisible=()=>{
      if(document.visibilityState==="visible"){
        sb.auth.startAutoRefresh();
        sb.auth.getSession().then(({data})=>{
          const uid=data?.session?.user?.id;
          if(uid)sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",uid);
        });
      }else{
        sb.auth.stopAutoRefresh();
      }
    };
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",onVisible);
    return()=>{subscription.unsubscribe();clearInterval(lsInterval);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("focus",onVisible);};
  },[loadMyProfile]);

  // Statut en ligne en temps réel via Supabase Realtime Presence
  useEffect(()=>{
    if(!session?.user?.id)return;
    const presenceChannel=sb.channel("online-users",{config:{presence:{key:session.user.id}}});
    presenceChannel.on("presence",{event:"sync"},()=>{
      const state=presenceChannel.presenceState();
      setOnlinePresenceIds(new Set(Object.keys(state)));
    });
    presenceChannel.subscribe(async status=>{
      if(status==="SUBSCRIBED"&&!myProfile?.hide_online){
        await presenceChannel.track({online_at:new Date().toISOString()});
      }
    });
    return()=>{sb.removeChannel(presenceChannel);};
  },[session?.user?.id,myProfile?.hide_online]);
  useEffect(()=>{
    setMembers(prev=>prev.map(m=>({...m,isOnline:!m.hide_online&&onlinePresenceIds.has(m.id),online:!m.hide_online&&onlinePresenceIds.has(m.id)})));
  },[onlinePresenceIds]);

  const loadMembers=useCallback(async()=>{
  const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse,status,last_seen,country,account_type,latitude,longitude,no_messages,screenshot_protection,hide_online,joined_at,links").neq("status","pending").neq("status","suspended");
  if(data){
    const{data:conns}=await sb.from("connections").select("to_id");
    const counts={};
    (conns||[]).forEach(c=>{counts[c.to_id]=(counts[c.to_id]||0)+1;});
    const normed=data.map(p=>normProfile({...p,followersCount:counts[p.id]||0}));window.__celesteMembers=normed;setMembers(normed);
  }
},[]);

  const loadBlockedUsers=useCallback(async()=>{
    if(!session?.user?.id)return[];
    const[{data:iBlocked},{data:blockedMe}]=await Promise.all([
      sb.from("blocks").select("blocked_id").eq("blocker_id",session.user.id),
      sb.from("blocks").select("blocker_id").eq("blocked_id",session.user.id),
    ]);
    const ids=[...new Set([...(iBlocked||[]).map(b=>b.blocked_id),...(blockedMe||[]).map(b=>b.blocker_id)])];
    setBlockedUserIds(ids);
    return ids;
  },[session?.user?.id]);
  const loadMutedAuthors=useCallback(async()=>{
    if(!session?.user?.id)return[];
    const{data}=await sb.from("muted_authors").select("muted_id").eq("muter_id",session.user.id);
    const ids=(data||[]).map(m=>m.muted_id);
    setMutedAuthorIds(ids);
    return ids;
  },[session?.user?.id]);
  useEffect(()=>{
    const handler=()=>{loadBlockedUsers();loadMutedAuthors();};
    window.addEventListener("celeste_mutes_blocks_changed",handler);
    return()=>window.removeEventListener("celeste_mutes_blocks_changed",handler);
  },[loadBlockedUsers,loadMutedAuthors]);

  const seenPostIdsRef = useRef(new Set());
  const postOrderRef=useRef([]);
  const lastPostCursorRef=useRef(null); // curseur {createdAt,id} du dernier post chargé — created_at seul n'est pas fiable comme curseur car plusieurs posts peuvent partager exactement le même timestamp (import groupé, tests…) ; Postgres ne garantit alors pas un ordre stable entre deux requêtes, ce qui provoquait des posts sautés ou répétés en scroll infini. id (clé unique) sert de départage.
  const sessionAffinityRef=useRef(createSessionAffinity()); // signal d'affinité "chaud" côté client, voir sessionAffinity.js — reset() au login, jamais recréé sinon
 const loadPosts=useCallback(async(page=1,overrideBlockedIds=null)=>{
  if(page===1)lastPostCursorRef.current=null;
  let postsQuery=sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,profile_pinned,post_phase,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,visibility,phase_views,poll_multiple,price,stock,deal_type,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(count),saved_posts(count)`).or("expires_at.is.null,expires_at.gt."+new Date().toISOString())
.or("visibility.is.null,visibility.in.(testing,phase2,phase3,viral,background)")
.not("visibility","eq","hidden").order("created_at",{ascending:false}).order("id",{ascending:false});
  if(lastPostCursorRef.current){
    const{createdAt,id}=lastPostCursorRef.current;
    postsQuery=postsQuery.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }
  const{data,error}=await postsQuery.limit(PAGE_SIZE);
  if(error){console.error("loadPosts ERROR:",error);notify("Erreur chargement fil: "+error.message);}
  if(data&&data.length>0){const last=data[data.length-1];lastPostCursorRef.current={createdAt:last.created_at,id:last.id};}
  if(data){
    const followedIds=new Set(myConnections||[]);
   const mapped=data.map(p=>mapDbPost(p,followedIds));
   if(page===1){
     const{data:pinnedData}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,profile_pinned,post_phase,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,visibility,phase_views,poll_multiple,price,stock,deal_type,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(count),saved_posts(count)`).eq("pinned",true).or("expires_at.is.null,expires_at.gt."+new Date().toISOString()).not("visibility","eq","hidden").order("created_at",{ascending:false}).limit(20);
     const existingIds=new Set(mapped.map(p=>p.id));
     (pinnedData||[]).forEach(p=>{if(!existingIds.has(p.id))mapped.push(mapDbPost(p,followedIds));});
   }
   const blockedSet=new Set([...blockedUserIds,...mutedAuthorIds]);
const myId=session?.user?.id;
const myCountry=myProfile?.country||"CG";
const{data:completedRows}=myId?await sb.from("video_engagement_events").select("post_id").eq("viewer_id",myId).eq("completed",true).in("post_id",mapped.map(p=>p.id)):{data:[]};
const completedIds=new Set((completedRows||[]).map(r=>r.post_id));
const{data:collabRows}=await sb.from("post_collaborators").select("post_id,collaborator_id,profiles:collaborator_id(id,prenom,nom,avatar_url,badge)").in("post_id",mapped.map(p=>p.id));
const collaboratorsByPost=new Map();
const collabProfilesByPost=new Map();
(collabRows||[]).forEach(r=>{
  if(!collaboratorsByPost.has(r.post_id))collaboratorsByPost.set(r.post_id,[]);
  collaboratorsByPost.get(r.post_id).push(r.collaborator_id);
  if(!collabProfilesByPost.has(r.post_id))collabProfilesByPost.set(r.post_id,[]);
  if(r.profiles)collabProfilesByPost.get(r.post_id).push(r.profiles);
});
mapped.forEach(p=>{p.collaboratorIds=collaboratorsByPost.get(p.id)||[];p.collaboratorProfiles=collabProfilesByPost.get(p.id)||[];});

const visible=mapped.filter(p=>{
  if(blockedSet.has(p.by))return false;
  if((collaboratorsByPost.get(p.id)||[]).some(id=>blockedSet.has(id)))return false;
  if(p.author?.status==="suspended")return false;
  if(completedIds.has(p.id)&&!p.pinned&&p.type!=="event"&&p.type!=="poll")return false; // déjà vu en entier → exclu du feed (sondages/événements exemptés : à revoir jusqu'à expiration, pas "consommés" comme une vidéo)
  if(p.pinned)return true;
if(p.visibility==="testing"&&p.by!==myId&&!followedIds.has(p.by)&&!(collaboratorsByPost.get(p.id)||[]).some(id=>followedIds.has(id)))return false;
  return true;
}).sort((a,b)=>{
  const aLocal=a.is_for_sale&&(a.author?.country||"CG")===myCountry;
  const bLocal=b.is_for_sale&&(b.author?.country||"CG")===myCountry;
  if(aLocal&&!bLocal)return -1;
  if(bLocal&&!aLocal)return 1;
  return 0;
});
    
  // ── ALGORITHME MIX PREMIUM SANS FILE INDIENNE ──
const pinned=visible.filter(p=>p.pinned);
const viral=visible.filter(p=>!p.pinned&&p.author?.badge&&p.visibility==="viral");
const withBadge=visible.filter(p=>!p.pinned&&p.author?.badge&&p.visibility!=="viral");
const noBadge=visible.filter(p=>!p.pinned&&!p.author?.badge);
const seenIds=new Set(JSON.parse(localStorage.getItem(celesteScopedKey("celeste_seen_posts"))||"[]"));
const viewerLocation=(myProfile?.latitude!=null&&myProfile?.longitude!=null)?{lat:myProfile.latitude,lon:myProfile.longitude}:null;
const[rankingData,communityIds,frequentIds]=await Promise.all([
  fetchRankingData(sb,{postIds:visible.map(p=>p.id),viewerId:session?.user?.id}),
  fetchCommunityIds(sb,session?.user?.id),
  fetchFrequentlyVisitedIds(sb,session?.user?.id)
]);
// Attache les catégories à chaque post — nécessaire pour le futur mode
// "session" du Reel (réordonner la file selon la vidéo tapée). visible/pinned/
// viral/withBadge/noBadge pointent tous vers les mêmes objets, donc muter ici
// suffit à propager la donnée partout où ces posts sont ensuite utilisés.
visible.forEach(p=>{p.categories=rankingData.categories[p.id]||[];});
// Fusionne l'affinité serveur (cron aggregate-engagement, à retardement) avec
// le signal de session en cours (voir sessionAffinity.js) — bornée, additive.
const rankingDataBoosted={...rankingData,affinity:sessionAffinityRef.current.applyTo(rankingData.affinity)};
const viralShuffled=rankPosts(viral,rankingDataBoosted,viewerLocation,communityIds,frequentIds,followedIds);
const badgeShuffled=rankPosts(withBadge,rankingDataBoosted,viewerLocation,communityIds,frequentIds,followedIds);
const noBadgeShuffled=rankPosts(noBadge,rankingDataBoosted,viewerLocation,communityIds,frequentIds,followedIds);
const feed=[];
let vi=0,bi=0,ni=0;
while(vi<viralShuffled.length||bi<badgeShuffled.length||ni<noBadgeShuffled.length){
  if(vi<viralShuffled.length){feed.push(viralShuffled[vi++]);}
  if(bi<badgeShuffled.length){feed.push(badgeShuffled[bi++]);}
  if(bi<badgeShuffled.length){feed.push(badgeShuffled[bi++]);}
  if(ni<noBadgeShuffled.length){feed.push(noBadgeShuffled[ni++]);}
}

const mixed=[];
let pi=0,fi=0;
// Mettre le premier post épinglé tout en haut
if(pinned.length>0){mixed.push(pinned[pi++]);}
while(fi<feed.length){
  mixed.push(feed[fi++]);
  // Intercaler un épinglé toutes les 5 posts normaux
  if(pi<pinned.length&&fi%5===0){mixed.push(pinned[pi++]);}
}
// Ajouter les épinglés restants
while(pi<pinned.length){mixed.push(pinned[pi++]);}


if(page===1){
  const unseen=mixed.filter(p=>!seenIds.has(p.id));
  const seen=mixed.filter(p=>seenIds.has(p.id));
  const mixed2=[...unseen,...seen];
  seenPostIdsRef.current=new Set(mixed2.map(p=>p.id));
  const order=mixed2.map(p=>p.id);
  postOrderRef.current=order;
  setPosts(mixed2);
  
  try{localStorage.setItem(celesteScopedKey("celeste_posts_cache"),JSON.stringify(mixed2.slice(0,20)));}catch(e){}
}else{
 
  const filtered=mixed.filter(p=>!seenPostIdsRef.current.has(p.id));
  filtered.forEach(p=>seenPostIdsRef.current.add(p.id));
  setPosts(prev=>[...(prev||[]),...filtered]);
}
setHasMorePosts(data.length===PAGE_SIZE);setPostPage(page);
  }
},[session?.user?.id,blockedUserIds,mutedAuthorIds,myConnections]);

  const loadMorePosts=useCallback(async()=>{
    if(loadingMoreRef.current||!hasMorePosts)return;
    loadingMoreRef.current=true;
    setLoadingMore(true);
    try{
      await loadPosts(postPage+1);
    }finally{
      loadingMoreRef.current=false;
      setLoadingMore(false);
    }
  },[hasMorePosts,postPage,loadPosts]);

  // Callbacks stables pour le fil d'actu — évite de les recréer à chaque
  // rendu de CelesteApp, ce qui cassait le React.memo sur PostCard et
  // forçait tous les posts visibles à se re-rendre à chaque changement
  // d'état ailleurs dans l'app (notif, message…), même sans rien de
  // changé côté post. C'est la cause la plus probable de la lenteur.
  const handleFeedOpenUser=useCallback(id=>{pushNav(()=>setOpenUserId(null));setOpenUserId(id);},[pushNav]);
  const handleFeedConnect=useCallback(async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");},[session?.user?.id,loadConnections,notify]);
  const handleFeedMuteAuthor=useCallback(authorId=>setMutedAuthorIds(prev=>[...new Set([...prev,authorId])]),[]);

  const refreshPost=useCallback(async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_time,event_loc,pinned,profile_pinned,post_phase,visibility,text_background,text_font,is_for_sale,is_ai_generated,is_private,comments_disabled,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),event_participants(user_id),poll_options(id,label,position),poll_votes(option_id,voter_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    const updated={id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventTime:data.event_time||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),participants:(data.event_participants||[]).map(x=>x.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],ts:new Date(data.created_at).getTime(),text_background:data.text_background||null,text_font:data.text_font||null,is_for_sale:data.is_for_sale||false,is_ai_generated:data.is_ai_generated||false,is_private:data.is_private||false,comments_disabled:data.comments_disabled||false,whatsapp_contact:data.whatsapp_contact||null,contact_link:data.contact_link||null,expires_at:data.expires_at||null,pinned:data.pinned||false,profile_pinned:data.profile_pinned||false,post_phase:data.post_phase||null,visibility:data.visibility||null,sound:data.sound?{id:data.sound.id,title:data.sound.title,url:data.sound.url,owner_avatar:data.sound.owner?.avatar_url||null}:null};
    setPosts(prev=>(prev||[]).map(p=>p.id===pid?updated:p));
return updated;
  },[]);

  const MSG_PAGE_SIZE=60;
  const mapMsgRow=(m,myId)=>({id:m.id,f:m.sender_id===myId?"me":m.sender_id,type:m.type,text:m.text||"",img:m.file_url,fileName:m.file_name,read:m.is_read,ts:new Date(m.created_at).getTime(),reply_metadata:typeof m.reply_metadata==="string"?JSON.parse(m.reply_metadata):m.reply_metadata||null,reply_to_id:m.reply_to_id||null,reply_to_text:m.reply_to_text||null,reply_to_author:m.reply_to_author||null,reactions:m.reactions||null,edited_at:m.edited_at||null,sticker_id:m.sticker_id||null,shared_post_id:m.shared_post_id||null,view_once:!!m.view_once,viewed_at:m.viewed_at||null});
  const MSG_COLUMNS="id,sender_id,type,text,file_url,file_name,is_read,created_at,reply_metadata,reply_to_id,reply_to_text,reply_to_author,reactions,edited_at,sticker_id,shared_post_id,view_once,viewed_at";
  const loadConvs=useCallback(async myId=>{
    if(!myId)return;
    const[{data},{data:blockedData},{data:blockedMeData}]=await Promise.all([
      sb.from("conversations").select(`*,messages(${MSG_COLUMNS})`).or(`user1_id.eq.${myId},user2_id.eq.${myId}`).order("created_at",{ascending:false}).order("created_at",{ascending:false,foreignTable:"messages"}).limit(MSG_PAGE_SIZE,{foreignTable:"messages"}),
      sb.from("blocks").select("blocked_id").eq("blocker_id",myId),
      sb.from("blocks").select("blocker_id").eq("blocked_id",myId)
    ]);
    if(data){
      const blocked=new Set([...(blockedData||[]).map(b=>b.blocked_id),...(blockedMeData||[]).map(b=>b.blocker_id)]);
       const mapped=data.map(c=>({id:c.id,uid:c.user1_id===myId?c.user2_id:c.user1_id,user1_id:c.user1_id,user2_id:c.user2_id,muted_by_user1:c.muted_by_user1,muted_by_user2:c.muted_by_user2,secure_mode:!!c.secure_mode,secure_mode_by:c.secure_mode_by||null,ephemeral_ttl_seconds:c.ephemeral_ttl_seconds||null,hasMoreMsgs:(c.messages||[]).length===MSG_PAGE_SIZE,msgs:(c.messages||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(m=>mapMsgRow(m,myId))}));
      const filtered=mapped.filter(c=>!blocked.has(c.uid));
      setConvs(filtered);
      try{localStorage.setItem(celesteScopedKey("celeste_convs_cache"),JSON.stringify(filtered));}catch(e){}
      return filtered;
    }return null;
  },[]);
  const loadOlderMessages=useCallback(async(convId,myId)=>{
    const conv=convsRef.current.find(c=>c.id===convId);
    if(!conv||!conv.msgs?.length||!conv.hasMoreMsgs)return;
    const oldest=conv.msgs[0];
    const{data}=await sb.from("messages").select(MSG_COLUMNS).eq("conv_id",convId).lt("created_at",new Date(oldest.ts).toISOString()).order("created_at",{ascending:false}).limit(MSG_PAGE_SIZE);
    if(!data)return;
    const older=data.map(m=>mapMsgRow(m,myId)).sort((a,b)=>a.ts-b.ts);
    setConvs(prev=>prev.map(c=>c.id===convId?{...c,msgs:[...older,...c.msgs],hasMoreMsgs:data.length===MSG_PAGE_SIZE}:c));
  },[]);
  useEffect(()=>{
  if(session===null||(session&&isPending))setFeedPreloaded(true);
},[session,isPending]);
useEffect(()=>{
  if(session?.user?.id&&myProfile?.id&&!isPending){
    sessionAffinityRef.current.reset(); // nouvelle session = on repart sans signal résiduel de la précédente
    loadMembers();
    loadConnections(session.user.id);
    loadUnreadNotifs(session.user.id);
    loadBlockedUsers().then(ids=>{loadPosts(1,ids).finally(()=>setFeedPreloaded(true));loadConvs(session.user.id);});
    loadMutedAuthors();
    const loadUnreadStatuses=async()=>{
      const since=new Date(Date.now()-24*60*60*1000).toISOString();
      const{data:conns}=await sb.from("connections").select("to_id").eq("from_id",session.user.id);
      const followedIds=(conns||[]).map(c=>c.to_id);
      if(!followedIds.length){setUnreadStatuses(0);_setUnseenStatusMap(new Map());return;}
      const{data:statuses}=await sb.from("statuses").select("id,user_id").in("user_id",followedIds).gte("created_at",since);
      if(!statuses?.length){setUnreadStatuses(0);_setUnseenStatusMap(new Map());return;}
      const statusIds=statuses.map(s=>s.id);
      const{data:views}=await sb.from("status_views").select("status_id").eq("viewer_id",session.user.id).in("status_id",statusIds);
      const viewedIds=new Set((views||[]).map(v=>v.status_id));
      const unseen=statuses.filter(s=>!viewedIds.has(s.id));
      setUnreadStatuses(unseen.length);
      const byUser=new Map();
      unseen.forEach(s=>{if(!byUser.has(s.user_id))byUser.set(s.user_id,s.id);});
      _setUnseenStatusMap(byUser);
    };
    loadUnreadStatuses();
    const onlineInterval=setInterval(()=>{loadMembers();loadUnreadStatuses();},120000);
    return()=>clearInterval(onlineInterval);
  }
},[session?.user?.id,myProfile?.id,isPending]);
  // Realtime
  useEffect(()=>{
    if(!session?.user)return;
    const myId=session.user.id;
    const handleOpenUser=e=>{pushNav(()=>setOpenUserId(null));setOpenUserId(e.detail.uid);};
window.addEventListener("celeste_open_user",handleOpenUser);
    const handleOpenConv=e=>{
      const convId=e.detail?.convId;
      if(!convId)return;
      loadConvs(session?.user?.id).then(()=>{
        pushNav(()=>setOpenConvId(null));
        setTab("messages");
        setOpenConvId(convId);
      });
    };
    window.addEventListener("celeste_open_conv",handleOpenConv);
    const isUserMuted=uid=>{const c=convsRef.current.find(cv=>cv.user1_id===uid||cv.user2_id===uid||cv.uid===uid);return c?isConvMuted(c,myId):false;};
    const ch=sb.channel("celeste_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},async payload=>{
        const nm=payload.new;
        setConvs(prev=>(prev||[]).map(cv=>{
          if(cv.id!==nm.conv_id)return cv;
          const alreadyExists=(cv.msgs||[]).some(m=>m.id===nm.id);
          if(alreadyExists)return cv;
          const newMsg={id:nm.id,f:nm.sender_id===myId?"me":nm.sender_id,type:nm.type,text:nm.text||"",img:nm.file_url,fileName:nm.file_name,read:nm.is_read,ts:new Date(nm.created_at).getTime(),reply_metadata:typeof nm.reply_metadata==="string"?JSON.parse(nm.reply_metadata):nm.reply_metadata||null,reply_to_id:nm.reply_to_id||null,reply_to_text:nm.reply_to_text||null,reply_to_author:nm.reply_to_author||null,reactions:nm.reactions||null,edited_at:nm.edited_at||null,sticker_id:nm.sticker_id||null,shared_post_id:nm.shared_post_id||null,view_once:!!nm.view_once,viewed_at:nm.viewed_at||null};
          return{...cv,msgs:[...(cv.msgs||[]),newMsg]};
        }));
        if(nm.sender_id===myId)return;
        const updated=await loadConvs(myId);
        if(updated){
          const totalNew=(updated||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
          if(totalNew>prevMsgCount.current){const conv=(updated||[]).find(c=>(c.msgs||[]).some(m=>m.id===nm.id));if(!conv||!isConvMuted(conv,myId)){const sender=(members||[]).find(m=>m.id===nm.sender_id);const preview=nm.type==="photo"?"📷 Photo":nm.type==="file"?"📎 Fichier":nm.text||"";addInAppNotif("✉",sender?.name||"Message",preview,()=>{setTab("messages");setTimeout(()=>{if(conv?.id){setOpenConvId(conv.id);}},100);});}}
          prevMsgCount.current=totalNew;
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},payload=>{
        const updated=payload.new;
        setConvs(prev=>(prev||[]).map(c=>({
          ...c,
          msgs:(c.msgs||[]).map(m=>m.id===updated.id?{...m,text:updated.text??m.text,read:updated.is_read,reactions:updated.reactions||null,edited_at:updated.edited_at||null,view_once:!!updated.view_once,viewed_at:updated.viewed_at||null}:m)
        })));
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"posts"},payload=>{
        const pid=payload.old?.id;
        if(pid){setPosts(prev=>(prev||[]).filter(p=>p.id!==pid));setUserPostsVersion(v=>v+1);}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"posts"},()=>{
        setUserPostsVersion(v=>v+1);
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"likes"},async payload=>{
        
        const pid=payload.new?.post_id;if(!pid)return;
        const updated=await refreshPost(pid);
        if(updated&&updated.by===myId&&payload.new?.user_id!==myId&&!isUserMuted(payload.new.user_id)){const liker=(members||[]).find(m=>m.id===payload.new.user_id);addInAppNotif("❤️",`${liker?.name||"Quelqu'un"} a aimé`,updated.text||updated.title||"ta publication",()=>{setTab("home");setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:payload.new.post_id}})),300);});}
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"likes"},payload=>{if(payload.old?.post_id)refreshPost(payload.old.post_id);})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comments"},async payload=>{
        const cmt=payload.new;if(!cmt?.post_id)return;
        const updated=await refreshPost(cmt.post_id);
       if(updated&&updated.by===myId&&cmt.author_id!==myId&&!isUserMuted(cmt.author_id)){const commenter=(members||[]).find(m=>m.id===cmt.author_id);addInAppNotif("💬",`${commenter?.name||"Quelqu'un"} a commenté`,cmt.text||"…",()=>{setTab("home");setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:cmt.post_id}})),300);});}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comment_likes"},async payload=>{
        // Notification pour likes de commentaires
        const cl=payload.new;if(!cl||cl.user_id===myId||isUserMuted(cl.user_id))return;
        addInAppNotif("💛","Commentaire aimé","Quelqu'un a aimé votre commentaire",()=>{setTab("home");});
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${myId}`},()=>{
        loadUnreadNotifs(myId);
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},payload=>{
  if(payload.new?.id===myId){
    loadMyProfile(myId);
    if(payload.new?.status==="active")setIsPending(false);
    loadMembers();
  }
})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"connections"},async payload=>{
       if(payload.new?.to_id===myId){await loadConnections(myId);if(!isUserMuted(payload.new.from_id)){const follower=(members||[]).find(m=>m.id===payload.new.from_id);addInAppNotif("✦",`${follower?.name||"Quelqu'un"} s'est connecté`,"Nouvelle connexion !",()=>setTab("discover"));}}
        else if(payload.new?.from_id===myId)loadConnections(myId);
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"connections"},async payload=>{
        loadConnections(myId);
       if(payload.old?.to_id===myId&&!isUserMuted(payload.old.from_id)){const who=(members||[]).find(m=>m.id===payload.old.from_id);addInAppNotif("👋",`${who?.name||"Quelqu'un"} s'est désabonné`,"",()=>setTab("discover"));}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"statuses"},async payload=>{
        const{data:conn}=await sb.from("connections").select("id").eq("from_id",myId).eq("to_id",payload.new?.user_id).maybeSingle();
        if(conn)setUnreadStatuses(n=>n+1);
      })
      .subscribe();
   return()=>{
      window.removeEventListener("celeste_open_user",handleOpenUser);
      window.removeEventListener("celeste_open_conv",handleOpenConv);
      sb.removeChannel(ch);
    };
  },[session?.user?.id,members]);

  const goTab=t=>{
 if(t==="home"&&tab==="home"){
   feedScrollRef.current=0;
   document.querySelector("[data-feed-scroll]")?.scrollTo({top:0,behavior:"smooth"});
   setFeedRefreshing(true);
   const refreshStart=Date.now();
   loadPosts(1,null,true).finally(()=>{
     const elapsed=Date.now()-refreshStart;
     setTimeout(()=>setFeedRefreshing(false),Math.max(0,500-elapsed));
   });
 }
 if(t!=="home")feedScrollRef.current=document.querySelector("[data-feed-scroll]")?.scrollTop||feedScrollRef.current;
setTab(t);setOpenConvId(null);setOpenUserId(null);setShowNotifs(false);setHideNav(false);
};
  const unread=(convs||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
  const pending=(members||[]).filter(m=>m.status==="pending").length;
  const getM=useCallback(id=>{if(id==="me"||id===session?.user?.id)return myProfile;return(members||[]).find(m=>m.id===id)||{id:"?",initials:"?",color:"#888",name:"Inconnu",badge:null};},[session?.user?.id,myProfile,members]);
  const openConv=(convs||[]).find(c=>c.id===openConvId);
  const [pendingUnlockConvId,setPendingUnlockConvId]=useState(null);
  const [unlockedConvIds,setUnlockedConvIds]=useState(()=>new Set());
  const openConvChecked=id=>{
    if(isConvLocked(id)&&!unlockedConvIds.has(id)){setPendingUnlockConvId(id);return;}
    pushNav(()=>setOpenConvId(null));setOpenConvId(id);
  };
  const openChat=uid=>{setOpenUserId(null);let c=(convs||[]).find(x=>x.uid===uid);if(!c){c={id:"cv"+Date.now(),uid,msgs:[]};setConvs(p=>[...(p||[]),c]);}if(isConvLocked(c.id)&&!unlockedConvIds.has(c.id)){setPendingUnlockConvId(c.id);setTab("messages");return;}pushNav(()=>setOpenConvId(null));setOpenConvId(c.id);setTab("messages");};
  useEffect(()=>{
    const h=e=>{if(e.detail)openChat(e.detail);};
    window.addEventListener("celeste_open_chat_with",h);
    return()=>window.removeEventListener("celeste_open_chat_with",h);
  },[openChat]);

  // AppContext value
  const appCtx={
    session,myProfile,setMyProfile,
    setTab,members,posts,convs,
    notify,
    chatDrafts,setChatDrafts,
    hideNav,setHideNav,
    onlinePresenceIds,
  };

  // Splash screen
  if(session===undefined||(session&&!isPending&&!feedPreloaded)) return(<SplashScreen/>);

  if(!session) return(<><style>{getGS()}</style><AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={state=>{if(state==="pending")setIsPending(true);}} pushNav={pushNav} popNav={popNav}/></>);

  if(myProfile?.status==="suspended") return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{getGS()}</style>
      <div style={{maxWidth:400,width:"100%",textAlign:"center",animation:"fadeUp .5s ease"}}>
        <div style={{fontSize:60,marginBottom:20}}>
          🚫</div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:T.err,marginBottom:12}}>Compte suspendu</h2>
        <p style={{color:T.sub,fontSize:14,lineHeight:1.8,marginBottom:28}}>Votre compte a été suspendu par un administrateur.<br/>Pour toute question, contactez le support de la communauté.</p>
        <Btn onClick={async()=>{if(await confirmAction("Se déconnecter ?",{confirmLabel:"Se déconnecter"}))sb.auth.signOut();}} style={{padding:"13px 30px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>
      </div>
    </div>
  );

  if(isPending) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{getGS()}</style>
      <div style={{maxWidth:400,width:"100%",textAlign:"center",animation:"fadeUp .5s ease"}}>
        <div style={{fontSize:60,marginBottom:20,animation:"float 3s ease infinite"}}>⏳</div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:T.text,marginBottom:12}}>Compte en attente</h2>
        <p style={{color:T.sub,fontSize:14,lineHeight:1.8,marginBottom:28}}>Bonjour <strong style={{color:T.goldL}}>{myProfile?.name}</strong> !<br/>Un administrateur vérifiera votre profil sous 24–48h.</p>
        <Btn onClick={async()=>{if(await confirmAction("Se déconnecter ?",{confirmLabel:"Se déconnecter"}))sb.auth.signOut();}} style={{padding:"13px 30px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>

<VerificationInfoModal pushNav={pushNav} popNav={popNav}/>
      </div>
    </div>
  );
  if(myProfile&&!myProfile.quiz_completed) return(
    <ContentQuizModal sb={sb} T={T} Av={Av} userId={session.user.id} onDone={()=>setMyProfile(p=>({...p,quiz_completed:true}))}/>
  );
  return(
    <CallProvider sb={sb} currentUser={{ id: session?.user?.id, name: myProfile?.name, avatar_url: myProfile?.avatar_url }} T={T}>
    <AppContext.Provider value={appCtx}>
      <div style={{display:"flex",flexDirection:"column",width:"100%",height:"calc(var(--app-vh, 1vh) * 100)",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}}>
        <style>{getGS()}</style>
        {toast&&<Toast msg={toast}/>}
        {!isOnline&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,background:"#1a1a1a",borderTop:"2px solid #FF6432",padding:"8px 16px",display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
          <WifiOff size={14} color="#FF6432"/>
          <span style={{fontSize:12,color:"#FF6432",fontWeight:600}}>Pas de connexion — certaines fonctionnalités sont limitées</span>
        </div>}
        {isOnline&&wasOffline&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,background:"#1a1a1a",borderTop:"2px solid #3DB654",padding:"8px 16px",display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
          <Wifi size={14} color="#3DB654"/>
          <span style={{fontSize:12,color:"#3DB654",fontWeight:600}}>Connexion rétablie</span>
        </div>}
        {viewImg&&<ImageViewer url={viewImg} onClose={()=>setViewImg(null)}/>}
        <NotifBanner notifs={inAppNotifs} onDismiss={dismissNotif} onTap={n=>{n.action?.();dismissNotif(n.id);}}/>
          {sharedMedia&&<div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
  <p style={{color:"#fff",fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300}}>Partager sur Céleste</p>
  <div style={{display:"flex",gap:16}}>
    <button onClick={()=>{setSharedMedia(null);pushNav(()=>setShowNewPost(false));setShowNewPost(true);window.__celesteSharedFile=sharedMedia;}} style={{padding:"12px 24px",background:T.gradGold,border:"none",borderRadius:16,color:"#000",fontWeight:700,fontSize:15,cursor:"pointer"}}>📸 Post</button>
    <button onClick={()=>{setSharedMedia(null);window.__celesteSharedFile=sharedMedia;window.__celesteOpenStatus=true;}} style={{padding:"12px 24px",background:"rgba(255,255,255,0.08)",border:`1px solid ${T.border}`,borderRadius:16,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>⭕ Statut</button>
  </div>
  <button onClick={()=>setSharedMedia(null)} style={{color:T.muted,background:"none",border:"none",fontSize:13,cursor:"pointer"}}>Annuler</button>
</div>}
        {showNewPost&&<NewPostModal myProfile={myProfile} session={session} initialSound={pendingSound} onClose={()=>{popNav();setShowNewPost(false);setPendingSound(null);}} onPost={()=>{loadPosts(1);setShowNewPost(false);setPendingSound(null);notify("Publié ✦");}} notify={notify}/>}
        {showAdmin&&myProfile?.is_admin&&<AdminPanel onClose={()=>{popNav();setShowAdmin(false);}} notify={notify} reload={loadMembers} reloadPosts={()=>loadPosts(1)} session={session} myProfile={myProfile} initialFilter={adminOpenSection}/>}
{openCeleste&&<CelesteChatScreen msgs={celesteMsgs} setMsgs={setCelesteMsgs} onClose={()=>{popNav();setOpenCeleste(false);}} myProfile={myProfile} session={session}/>}
{showCreateGroup&&(
  <CreateGroupModal sb={sb} T={T} Av={Av} Btn={Btn} session={session} members={members} myConnections={myConnections} myFollowers={myFollowers}
    onClose={()=>{popNav();setShowCreateGroup(false);}}
    onCreated={()=>{}}
    notify={notify}/>
)}
{openGroup&&(
  <GroupChatScreen sb={sb} T={T} Av={Av} Btn={Btn} group={openGroup} session={session}
    members={members} myConnections={myConnections} myFollowers={myFollowers}
    notify={notify} onBack={()=>{popNav();setOpenGroup(null);}}
    onOpenProfile={uid=>{setOpenGroup(null);pushNav(()=>setOpenUserId(null));setOpenUserId(uid);}}
    pushNav={pushNav} popNav={popNav}/>
)}
        <div style={{height:"calc(64px + max(env(safe-area-inset-top,0px), 24px))",background:T.bg2,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,display:(hideNav||openConvId||(tab==="home"&&!openUserId))?"none":"flex",alignItems:"center",padding:"max(env(safe-area-inset-top,0px), 24px) 16px 0",gap:12,flexShrink:0,zIndex:30,boxSizing:"border-box"}}>
          {(openConvId||openUserId)
            ?<>
              <Btn onClick={()=>{setOpenConvId(null);setOpenUserId(null);}} style={{color:T.gold,padding:"0 8px 0 0",display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text}}>{openConvId?getM(openConv?.uid)?.name:openUser?.name}</span>
            </>
            :<>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                <span style={{fontFamily:logoFont,fontSize:32,color:T.gold,filter:"drop-shadow(0 0 10px rgba(201,149,42,0.5))"}}>✦</span>
                <span key={logoFont} style={{position:"relative",display:"inline-block"}}>
                  <span style={{fontFamily:logoFont,fontSize:38,lineHeight:1.5,fontWeight:400,letterSpacing:0,color:T.text,display:"inline-block",animation:"writeIn 1.1s cubic-bezier(.65,0,.35,1) both"}}>Céleste</span>
                  <span style={{position:"absolute",top:2,bottom:2,left:0,width:2,borderRadius:1,background:T.gold,boxShadow:`0 0 6px ${T.gold}`,animation:"penMove 1.1s cubic-bezier(.65,0,.35,1) both"}}/>
                </span>
              </div>
    
             <Btn onClick={()=>{if(!showNotifs){pushNav(()=>setShowNotifs(false));}else{popNav();}setShowNotifs(s=>!s);}} style={{position:"relative",width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",background:showNotifs?T.goldBg:"rgba(255,255,255,0.04)",border:`1px solid ${showNotifs?T.gold+"55":T.border}`,borderRadius:"50%",color:showNotifs?T.goldL:T.muted,transition:"all .2s"}}>
                <Bell size={18}/>
                {unreadNotifs>0&&<span style={{position:"absolute",top:4,right:4,minWidth:16,height:16,borderRadius:8,background:T.err,color:"#fff",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",boxShadow:"0 2px 8px rgba(200,64,64,0.6)"}}>{unreadNotifs>99?"99+":unreadNotifs}</span>}
              </Btn>
              {myProfile?.is_admin&&(
                <Btn onClick={()=>{pushNav(()=>setShowAdmin(false));setShowAdmin(true);}} style={{position:"relative",padding:"6px 12px",borderRadius:10,border:`1px solid ${pending>0?T.err+"55":T.border}`,background:pending>0?"rgba(200,64,64,0.06)":T.glass,color:pending>0?T.err:T.muted,fontSize:12,fontWeight:600}}>
                  🛡{pending>0&&<span style={{background:T.err,color:"#fff",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,marginLeft:4}}>{pending}</span>}
                </Btn>
              )}
            </>
          }
        </div>

        {/* Notifications panel overlay */}
        {showNotifs&&!openConvId&&!openUserId&&(
          <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}} onClick={()=>{popNav();setShowNotifs(false);}}>
            <div style={{position:"absolute",top:"calc(64px + env(safe-area-inset-top,0px))",left:0,right:0,background:T.bg3,borderBottom:`1px solid ${T.border}`,maxHeight:"70vh",overflowY:"auto",animation:"slideDown .25s ease"}} onClick={e=>e.stopPropagation()}>
              <NotifsScreen myProfile={myProfile} session={session} members={members}/>
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          {openUserId&&openUser&&(
            openUser.account_type==="organisation"
              ?<OrgView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>{popNav();setOpenUserId(null);}} onChat={openChat} notify={notify} myConnections={myConnections} pushNav={pushNav} popNav={popNav} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers().then(async ids=>{
  setPosts(prev=>(prev||[]).filter(p=>!ids.includes(p.by)));
  if(ids.length){
    const{data}=await sb.from("post_collaborators").select("post_id").in("collaborator_id",ids);
    const collabPostIds=new Set((data||[]).map(r=>r.post_id));
    if(collabPostIds.size)setPosts(prev=>(prev||[]).filter(p=>!collabPostIds.has(p.id)));
  }
});}} onImageView={setViewImg} userPostsVersion={userPostsVersion} toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}} toggleSave={async pid=>{const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});}}/>
              :<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>{popNav();setOpenUserId(null);}} onChat={openChat} notify={notify} myConnections={myConnections} myFollowers={myFollowers} pushNav={pushNav} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers().then(async ids=>{
});}} onImageView={setViewImg} popNav={popNav} userPostsVersion={userPostsVersion} toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}} toggleSave={async pid=>{const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});}}/>
          )}
          {!openUserId&&openConvId&&openConv&&!openConvInfoUid&&(
            <ChatScreen conv={openConv} myProfile={myProfile} session={session} members={members} reload={()=>loadConvs(session?.user?.id)} patchConv={patchConvMessages} onLoadOlder={()=>loadOlderMessages(openConv?.id,session?.user?.id)} notify={notify} onImageView={setViewImg} onOpenProfile={uid=>{setOpenConvId(null);pushNav(()=>setOpenUserId(null));setOpenUserId(uid);}} onOpenConvInfo={uid=>{pushNav(()=>setOpenConvInfoUid(null));setOpenConvInfoUid(uid);}} onBack={()=>{popNav();setOpenConvId(null);}} onConvCreated={id=>{setConvs(p=>(p||[]).map(c=>c.id===openConv?.id?{...c,id}:c));setOpenConvId(id);}} pushNav={pushNav} popNav={popNav}/>
          )}
          {openConvInfoUid&&(
            <ConversationInfoScreen
              T={T} Av={Av} Btn={Btn}
              user={(members||[]).find(m=>m.id===openConvInfoUid)}
              conv={openConv}
              sb={sb}
              myId={session?.user?.id}
              onBack={()=>{popNav();setOpenConvInfoUid(null);}}
              onOpenProfile={uid=>{setOpenConvInfoUid(null);setOpenConvId(null);pushNav(()=>setOpenUserId(null));setOpenUserId(uid);}}
              onCreateGroup={()=>{setOpenConvInfoUid(null);pushNav(()=>setShowCreateGroup(false));setShowCreateGroup(true);}}
              notify={notify}
              reload={()=>loadConvs(session?.user?.id)}
            />
          )}
          {pendingUnlockConvId&&(
            <ConvPinGateScreen
              T={T} Btn={Btn}
              convId={pendingUnlockConvId}
              userName={getM((convs||[]).find(c=>c.id===pendingUnlockConvId)?.uid)?.name}
              onBack={()=>setPendingUnlockConvId(null)}
              onUnlocked={()=>{
                const id=pendingUnlockConvId;
                setUnlockedConvIds(prev=>new Set([...prev,id]));
                setPendingUnlockConvId(null);
                pushNav(()=>setOpenConvId(null));
                setOpenConvId(id);
              }}
              onForgotPin={async()=>{
                const id=pendingUnlockConvId;
                await sb.from("messages").delete().eq("conv_id",id);
                await sb.from("conversations").delete().eq("id",id);
                removeConvLock(id);
                setConvs(p=>(p||[]).filter(c=>c.id!==id));
                setPendingUnlockConvId(null);
                notify("Conversation supprimée");
              }}
            />
          )}
          <div style={{display:openUserId||openConvId||openConvInfoUid?"none":"flex",flexDirection:"column",width:"100%",flex:1,minHeight:0,paddingBottom:(tab!=="home"&&!openConvId&&!openUserId&&!hideNav)?"calc(66px + max(env(safe-area-inset-bottom,0px), 4px))":0}}>
              <div style={{display:tab==="home"?"flex":"none",flexDirection:"column",flex:1,minHeight:0}}>
  <HomeTab posts={posts} setPosts={setPosts} myProfile={myProfile} session={session} getM={getM} onNewPost={()=>{pushNav(()=>setShowNewPost(false));setShowNewPost(true);}} onUseSoundForPost={(sound)=>{setPendingSound(sound);pushNav(()=>setShowNewPost(false));setShowNewPost(true);}} onUser={handleFeedOpenUser} notify={notify} reload={()=>loadPosts(1)} loadMore={loadMorePosts} hasMore={hasMorePosts} loadingMore={loadingMore} refreshPost={refreshPost} onImageView={setViewImg} myConnections={myConnections} onConnect={handleFeedConnect} initialScroll={feedScrollRef.current} onScrollChange={pos=>feedScrollRef.current=pos} pushNav={pushNav} popNav={popNav} onMuteAuthor={handleFeedMuteAuthor} viewedPostIdsRef={viewedPostIdsRef} refreshing={feedRefreshing} onFeedNavVisibility={setFeedNavVisible} sessionAffinity={sessionAffinityRef.current} isVisible={tab==="home"}/>
</div>
              <div style={{display:tab==="statuses"?"flex":"none",flexDirection:"column",flex:1,minHeight:0}}>
                <StatusesTab myProfile={myProfile} session={session} members={members} myConnections={myConnections} myFollowers={myFollowers} notify={notify} blockedUserIds={blockedUserIds} pushNav={pushNav} popNav={popNav}/>
              </div>
              {tab==="discover"&&<DiscoverTab members={members} myProfile={myProfile} session={session} onUser={id=>{pushNav(()=>setOpenUserId(null));setOpenUserId(id);}} notify={notify} myConnections={myConnections} myFollowers={myFollowers} onConnectionChange={()=>loadConnections(session?.user?.id)} openChat={openChat} blockedUserIds={blockedUserIds}/>}
              <div style={{display:tab==="messages"?"flex":"none",flexDirection:"column",flex:1,minHeight:0}}>
                <MsgsTab convs={convs} getM={getM} session={session} sb={sb} T={T} Av={Av} members={members} notify={notify} myProfile={myProfile} myConnections={myConnections} myFollowers={myFollowers} onOpen={openConvChecked} onDeleteConv={async id=>{await sb.from("messages").delete().eq("conv_id",id);await sb.from("conversations").delete().eq("id",id);setConvs(p=>(p||[]).filter(c=>c.id!==id));}} onOpenCeleste={()=>{pushNav(()=>setOpenCeleste(false));setOpenCeleste(true);}} onCreateGroup={()=>{pushNav(()=>setShowCreateGroup(false));setShowCreateGroup(true);}} onOpenGroup={g=>{pushNav(()=>setOpenGroup(null));setOpenGroup(g);}} pushNav={pushNav} popNav={popNav}/>
              </div>
             {tab==="profile"&&<ProfileTab myProfile={myProfile} session={session} posts={posts} onNewPost={()=>{pushNav(()=>setShowNewPost(false));setShowNewPost(true);}} userPostsVersion={userPostsVersion} notify={notify} onLogout={()=>sb.auth.signOut()} reload={()=>{loadPosts(1);loadMyProfile(session?.user?.id);}} myConnections={myConnections} myFollowers={myFollowers} onImageView={setViewImg} getM={getM} toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}} toggleSave={async pid=>{const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});}} onConnect={async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");}} pushNav={pushNav} popNav={popNav}/>}
<ParametresModal myProfile={myProfile} session={session} onLogout={()=>sb.auth.signOut()} notify={notify} navTheme={navTheme} onChooseNavTheme={chooseNavTheme} pushNav={pushNav} popNav={popNav}/>
            </div>
        </div>
        {detailPost&&<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={getM} onClose={()=>{popNav();setDetailPost(null);}} onLike={async pid=>{await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});const u=await refreshPost(pid);if(u)setDetailPost(u);}} onParticipate={async pid=>{const uid=session?.user?.id;const participating=(detailPost.participants||[]).includes(uid);if(participating)await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});const u=await refreshPost(pid);if(u)setDetailPost(u);}} onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}} notify={notify}/>}
        {buyingPost&&<ProductBuyModal sb={sb} T={T} Btn={Btn} post={buyingPost} notify={notify} onClose={()=>{popNav();setBuyingPost(null);}} onDone={()=>{}}/>}
{globalViewerPost&&(
  <FeedViewer
    onOpenComments={(p,cb)=>{pushNav(()=>{setGlobalCommentPost(null);setGlobalCloseCallback(null);});setGlobalCommentPost(p);setGlobalCloseCallback(()=>cb);}}
    posts={[globalViewerPost]} sb={sb} T={T} Av={Av} startIndex={0}
    session={session} myProfile={myProfile} notify={notify}
    toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}}
    toggleSave={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("saved_posts").insert({post_id:pid,user_id:uid});}}
    onUser={id=>{setGlobalViewerPost(null);pushNav(()=>setOpenUserId(null));setOpenUserId(id);}}
    myConnections={myConnections}
    onConnect={async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");}}
    onParticipate={async pid=>{
      const post=globalViewerPost;
      if(!post||post.id!==pid)return;
      const uid=session?.user?.id;
      const participating=(post.participants||[]).some(x=>(x.user_id||x)===uid);
      setGlobalViewerPost(prev=>prev?{...prev,participants:participating?(prev.participants||[]).filter(x=>(x.user_id||x)!==uid):[...(prev.participants||[]),uid]}:prev);
      try{
        if(participating){
          await sb.from("event_participants").delete().eq("post_id",pid).eq("user_id",uid);
        }else{
          await sb.from("event_participants").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
        }
      }catch(e){console.warn("toggleParticipate error:",e);}
    }}
    onClose={()=>{popNav();setGlobalViewerPost(null);}}
  />
)}
{globalCommentPost&&(
  <CommentsOnlyModal
    post={globalCommentPost}
    session={session}
    getM={getM}
    onCountChange={setGlobalCommentLiveCount}
     onClose={()=>{
    popNav();
    setGlobalCommentPost(null);
    if(globalCloseCallback){globalCloseCallback(globalCommentLiveCount);setGlobalCloseCallback(null);}
  }}
  />
)}
{/* Bottom nav premium */}
       {!openConvId&&!openUserId&&!openGroup&&!hideNav&&(
          <div style={{...(tab==="home"?{height:"calc(66px + max(env(safe-area-inset-bottom,0px), 4px))",paddingBottom:"max(env(safe-area-inset-bottom,0px), 4px)",position:"fixed",left:0,right:0,bottom:0,overflow:"hidden",zIndex:1350,boxSizing:"border-box",transform:feedNavVisible?"translateY(0)":"translateY(100%)",transition:"transform .25s ease"}:{height:"calc(66px + max(env(safe-area-inset-bottom,0px), 4px))",paddingBottom:"max(env(safe-area-inset-bottom,0px), 4px)",position:"fixed",left:0,right:0,bottom:0,overflow:"hidden",zIndex:1350,boxSizing:"border-box"}),display:openCeleste?"none":undefined}}>
            <NavScenery theme={navTheme}/>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.78) 100%)",pointerEvents:"none"}}/>
            <div style={{position:"relative",zIndex:2,display:"flex",height:"100%"}}>
            {[
              {id:"home",ic:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,lb:"Accueil"},
              {id:"statuses",ic:<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>,lb:"Statuts",badge:unreadStatuses},
              {id:"discover",ic:<span style={{fontSize:19,lineHeight:1}}>✦</span>,lb:"Découvrir"},
              {id:"messages",ic:<Mail size={21} strokeWidth={1.8}/>,lb:"Messages",badge:unread},
              {id:"profile",ic:<User size={21} strokeWidth={1.8}/>,lb:"Profil"},
            ].map(t=>(
              <Btn key={t.id} onClick={()=>goTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,color:tab===t.id?T.goldL:T.muted,position:"relative",transition:"color .25s"}}>
                <span style={{lineHeight:1,filter:tab===t.id?`drop-shadow(0 0 10px ${T.gold}99)`:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"filter .25s",transform:tab===t.id?"scale(1.1)":"scale(1)",transformOrigin:"center bottom"}}>{t.ic}</span>
                <span style={{fontSize:9,fontWeight:tab===t.id?700:400,letterSpacing:.5,transition:"all .25s"}}>{t.lb}</span>
                {(t.badge||0)>0&&<span style={{position:"absolute",top:10,right:"calc(50% - 20px)",background:T.err,color:"#fff",borderRadius:10,minWidth:15,height:15,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,padding:"0 3px",boxShadow:"0 2px 8px rgba(200,64,64,0.5)"}}>{t.badge}</span>}
                {tab===t.id&&<div style={{position:"absolute",bottom:0,width:20,height:2,borderRadius:2,background:T.gradGold,boxShadow:T.glowGold}}/>}
              </Btn>
            ))}
            </div>
          </div>
        )}
     </div>

      {/* RIDEAU ANTI-CAPTURE */}
      {isAppBlurred&&(
        <div style={{
          position:"fixed",top:0,left:0,width:"100vw",height:"100vh",
          backgroundColor:"rgba(0,0,0,0.85)",
          backdropFilter:"blur(30px)",
          WebkitBackdropFilter:"blur(30px)",
          zIndex:999999,
          display:"flex",alignItems:"center",justifyContent:"center",
          flexDirection:"column",gap:12,
          pointerEvents:"none"
        }}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:48,color:T.gold,filter:`drop-shadow(0 0 20px ${T.gold})`}}>✦</span>
          <p style={{fontSize:16,fontWeight:700,color:T.text,margin:0}}>Contenu Protégé</p>
          <p style={{fontSize:12,color:T.muted,margin:0}}>Céleste est masqué par mesure de sécurité</p>
        </div>
      )}
      <GlobalConfirmModal/>
    </AppContext.Provider>
    </CallProvider>
  );
}

export default function App(){
  return(<ErrorBoundary><CelesteApp/></ErrorBoundary>);
}