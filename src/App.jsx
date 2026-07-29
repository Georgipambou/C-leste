/**
 * Céleste — Version Premium 6.0 (FUSION)
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
  SwipeToReply, useLongPress, InlineReactionPicker
} from "./ChatExtras";
import { enqueueMessage, getQueueForConv, getConvStatuses, subscribeQueue, processQueue, retryMessage } from "./lib/messageQueue";


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
  Eye, Paperclip, LogOut, Sparkles, FileText, Video, EyeOff, Smartphone, ExternalLink, ShoppingBag, AlertTriangle, Wifi, WifiOff, MapPin, Languages, Flag, Lock, Ban, BellOff, XCircle, PartyPopper, Grid,  Music2, UserCheck

} from "lucide-react";

import { ProfileViewsCard, DiscoverPeopleSection, logProfileView, ProfileHeader } from "./ProfileDashboard";
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
import { Geolocation } from '@capacitor/geolocation';
import { App as CapApp } from '@capacitor/app';
import EasyCrop from "react-easy-crop";
import ReelsViewer from "./ReelsViewer";
import PhotoViewer from "./PhotoViewer";
import SearchExplorer from "./SearchExplorer";
import CameraStudioModal from "./CameraStudioModal";
import SharePostModal from "./SharePostModal";
import ContentQuizModal from "./components/ContentQuizModal";
import { pauseOtherVideos as __pauseOtherPostVideos, releaseActiveVideo as __releaseActivePostVideo } from "./videoRegistry";
import { fetchRankingData, rankPosts, fetchCommunityIds, fetchFrequentlyVisitedIds } from "./lib/recommendation/useFeedRanking";
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
import previewDark from "./assets/preview.webp";
import previewLight from "./assets/preview-light.webp";

// ── SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON;
if(!SUPABASE_URL||!SUPABASE_ANON)console.error("Variables Supabase manquantes !");
const sb = createClient(SUPABASE_URL||"",SUPABASE_ANON||"");

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
  is_discoverable:p.is_discoverable!==false,
  whatsapp:p.whatsapp||p.raw_user_meta_data?.whatsapp||null,
  account_type:p.account_type||"membre",screenshot_protection:p.screenshot_protection||false,
  org_name:p.org_name||null, org_type:p.org_type||null,
  org_country:p.org_country||null, org_desc:p.org_desc||null,
});

function mapDbPost(p, followedIds) {
  return {id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,eventDate:p.event_date||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime(),repliesCount:(c.replies||[]).length})),saved:[],savesCount:p.saved_posts?.[0]?.count||0,ts:new Date(p.created_at).getTime(),isFollowed:followedIds.has(p.author_id),pinned:p.pinned||false,profile_pinned:p.profile_pinned||false,post_phase:p.post_phase||1,text_background:p.text_background||null,is_for_sale:p.is_for_sale||false,is_private:p.is_private||false,whatsapp_contact:p.whatsapp_contact||null,contact_link:p.contact_link||null,expires_at:p.expires_at||null,phase_views:p.phase_views||0,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null};
}

// Recherche intelligente : insensible à la casse et aux accents, partout dans le texte
const normalizeSearch = s => (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const matchQuery = (text,query) => !query || normalizeSearch(text).includes(normalizeSearch(query));

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
  @font-face{font-family:'Cormorant Garamond';src:url('/fonts/cormorant.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:block;}
@font-face{font-family:'DM Sans';src:url('/fonts/dmsans.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:block;}
@font-face{font-family:'Space Grotesk';src:url('/fonts/spacegrotesk.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:block;}
@font-face{font-family:'Sora';src:url('/fonts/sora.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:block;}
@media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
  
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    touch-action: manipulation; /* Protège le comportement tactile natif */
  }

 html, body, #root {
    height: 100%;
    background: ${T.bg};
    overscroll-behavior: contain;
  }

  input, textarea {
    font-size: 16px !important;
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
  @keyframes shimmer{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}v
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
  @keyframes notifIn{from{opacity:0;transform:translateY(-24px) scale(0.94);}to{opacity:1;transform:none;}}
  @keyframes ripple{0%{transform:scale(0);opacity:0.4;}100%{transform:scale(2.5);opacity:0;}}
  @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
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
const Av = memo(function Av({u,size=40,online=false,ring=false,onClick}){
  const [,_forceTick]=useState(0);
  useEffect(()=>{const fn=()=>_forceTick(t=>t+1);_statusListeners.add(fn);return()=>_statusListeners.delete(fn);},[]);
  const _statusId=u?.id?_unseenStatusMap.get(u.id):null;
  const showRing=ring||!!_statusId;
  const handleStatusCapture=e=>{
    if(!showRing||!_statusId)return;
    e.stopPropagation();
    window.__celesteSetTab?.("statuses");
    setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_status",{detail:{statusId:_statusId}})),400);
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
            onClick={e=>{e.stopPropagation();window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url:u.avatar_url}}));}}/>
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

// Déclaré HORS de AuthScreen pour éviter la recréation à chaque frappe (fermeture clavier mobile)
const AuthField=memo(function AuthField({val,set,placeholder,type="text",showPw,setShowPw}){
  return(
    <div style={{position:"relative"}}>
      <input type={type==="password"?(showPw?"text":"password"):type} value={val} onChange={e=>set(e.target.value)}
        placeholder={placeholder} autoComplete={type==="password"?"current-password":"on"}
        style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:T.text,fontSize:13,outline:"none",transition:"border .2s"}}/>
      {type==="password"&&<Btn onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:11}}>{showPw?<EyeOff size={14}/>:<Eye size={14}/>}</Btn>}
    </div>
  );
});

// ── MEDIA PLAYER ─────────────────────────────────────────
const PostVideoPlayer = memo(function PostVideoPlayer({ url, style = {}, onVideoClick }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimer = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const seekDuration = useRef(0);
  const progressBarRef = useRef(null);
  const progressTimeRef = useRef(null);
  const pausedRef = useRef(false);
  const fullscreenRef = useRef(false);

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

    const obs = new IntersectionObserver(([entry]) => {
      if (!isMounted || fullscreenRef.current) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!pausedRef.current) { __pauseOtherPostVideos(el); el.play().catch(() => {}); setPlaying(true); }
      } else { el.pause(); setPlaying(false); __releaseActivePostVideo(el); }
    }, { threshold: 0.5 });

    obs.observe(el);

    return () => {
      isMounted = false;
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
      setTimeout(()=>{if(ref.current)ref.current.play().catch(()=>{});},300);
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
      <Btn onClick={e => { e.stopPropagation(); setMuted(m => !m); }} style={{ background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
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
        ref.current.currentTime = Math.max(0, Math.min(seekDuration.current, ref.current.currentTime + diff));
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={() => { touchStartX.current = null; }}
    >
      <video
        ref={ref} src={url} playsInline webkit-playsinline="true"
        muted={muted} loop preload="metadata"
        style={{ width: "100%", borderRadius: 14, display: "block", background: "#000", height: 360, objectFit: "cover", ...style }}
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
      {!playing && (
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
  if(!url) return null;
  const isVideo=/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(url)||url.includes("video");
  if(isVideo) return <PostVideoPlayer url={url} style={style} onVideoClick={onVideoClick}/>;
  return(
    <img src={url} loading="lazy" alt="" onClick={()=>onImageClick?.(url)}
      style={{width:"100%",borderRadius:14,display:"block",objectFit:"cover",maxHeight:500,cursor:onImageClick?"pointer":"default",...style}}/>
  );
});



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
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"#000",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"12px 16px",paddingTop:"calc(12px + env(safe-area-inset-top,0px))",background:"rgba(0,0,0,0.95)",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
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
    <div style={{position:"fixed",top:72,left:"50%",transform:"translateX(-50%)",zIndex:999,background:T.bg2,border:`1px solid ${T.border}`,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:20,padding:"10px 20px",color:T.text,fontSize:13,fontWeight:500,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"notifIn .3s ease"}}>
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
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:560,padding:"20px 18px calc(24px + env(safe-area-inset-bottom,0px))",animation:"slideUp .2s ease"}}>
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

// ── AUTH SCREEN ───────────────────────────────────────────
function AuthScreen({mode,setMode,onSuccess}){
  const [accountType,setAccountType]=useState("membre");
  const [prenom,setPrenom]=useState(""); const [nom,setNom]=useState("");
  const [paroisse,setParoisse]=useState(""); const [phone,setPhone]=useState("");
  const [whatsapp,setWhatsapp]=useState(""); const [country,setCountry]=useState("CG");
  const [orgName,setOrgName]=useState(""); const [orgType,setOrgType]=useState("");
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
        const{error}=await sb.auth.signInWithPassword({email,password:pw});
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
    <div style={{minHeight:"100svh",background:T.bg,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"20px 20px env(safe-area-inset-bottom,20px)",position:"relative",overflow:"auto"}}>
      <div style={{position:"absolute",top:"-30%",left:"-20%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(201,149,42,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-30%",right:"-20%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(58,106,154,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${T.border} 1px,transparent 1px)`,backgroundSize:"40px 40px",opacity:.3,pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:400,animation:"titleReveal .6s ease"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:76,height:76,borderRadius:"50%",background:"rgba(201,149,42,0.08)",border:`1px solid ${T.gold}33`,marginBottom:22,animation:"glow 3s ease infinite",boxShadow:`0 0 40px rgba(201,149,42,0.15)`}}>
            <span style={{fontSize:34,fontFamily:"'Cormorant Garamond',serif",color:T.gold}}>✦</span>
          </div>
          <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:48,fontWeight:300,color:T.text,letterSpacing:5,marginBottom:6}}>Céleste</h1>
          <p style={{color:T.muted,fontSize:12,letterSpacing:2,textTransform:"uppercase"}}>Exprime ta vrai personnalitée</p>
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
  <input value={whatsapp} onChange={e=>setWhatsapp(e.target.value.replace(/\D/g,""))} placeholder="WhatsApp (si différent)" style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:14,outline:"none",padding:"8px 4px"}}/>
</div>
                  </>
                ):(
                  <>
                    <AuthField val={orgName} set={setOrgName} placeholder="Nom de l'organisation *"/>
                    <select value={orgType} onChange={e=>setOrgType(e.target.value)} style={{width:"100%",padding:"13px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,color:orgType?T.text:T.sub,fontSize:13,outline:"none",appearance:"none"}}>
                      <option value="">Type *</option>
<option value="restaurant">🍽️ Restaurant / Bar</option>
<option value="hotel">🏨 Hôtel / Hébergement</option>
<option value="musique">🎵 Musique / Artiste</option>
<option value="entreprise">💼 Entreprise / Commerce</option>
<option value="association">🤝 Association / ONG</option>
<option value="ecole">🎓 École / Université</option>
<option value="sante">🩺 Santé / Clinique</option>
<option value="beaute">💇 Beauté / Coiffure</option>
<option value="mode">👗 Mode / Boutique</option>
<option value="tech">💻 Tech / Services numériques</option>
<option value="transport">🚖 Transport / Livraison</option>
<option value="immobilier">🏠 Immobilier</option>
<option value="evenementiel">🎉 Événementiel</option>
<option value="media">🎬 Média / Production</option>
<option value="ong">⛪ Église / Communauté religieuse</option>
<option value="ong2">🌱 ONG / Humanitaire</option>
<option value="sport">⚽ Sport / Fitness</option>
<option value="alimentation">🥘 Alimentation / Traiteur</option>
<option value="autre">📌 Autre</option>
                    </select>
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
  <input value={whatsapp} onChange={e=>setWhatsapp(e.target.value.replace(/\D/g,""))} placeholder="WhatsApp (si différent)" style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:14,outline:"none",padding:"8px 4px"}}/>
</div>
                  </>
                )}
              </>
            )}
            <AuthField val={email} set={setEmail} placeholder="Email *" type="email"/>
            <AuthField val={pw} set={setPw} placeholder="Mot de passe *" type="password" showPw={showPw} setShowPw={setShowPw}/>
            {err&&<div style={{background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:12,padding:"10px 14px",color:T.err,fontSize:12,display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={14}/> {err}</div>}
            <Btn onClick={submit} disabled={busy} style={{padding:"16px",background:busy?T.goldBg:T.gradGold,color:"#000",borderRadius:14,fontSize:14,fontWeight:700,boxShadow:busy?"none":"0 8px 32px rgba(201,149,42,0.3), 0 0 0 1px rgba(201,149,42,0.1)",opacity:busy?.6:1,transition:"all .25s",marginTop:4,letterSpacing:.3}}>
              {busy?"⏳ Chargement…":mode==="login"?"Se connecter ✦":"Créer mon compte ✦"}
            </Btn>
          </div>
        </div>
      </div>
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
    status_like:"a aimé ton statut",
    status_view:"a vu ton statut",
    post_deleted:n.text||"Une de tes publications a été supprimée",
    warning:n.text||"Avertissement de l'équipe Céleste",
    approved:"Ton compte a été validé ✦",
    earning:n.text||"Nouveau gain",
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
    new_post_favorite:"✦",
    friend_online:"🟢",
  }[n.type]||"🔔");

  const SYSTEM_TYPES=["post_deleted","warning","approved","earning"];
  const GROUPABLE_TYPES=["like","comment","comment_like","reply","mention"];
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
    {id:"tous",l:"Tous"},
    {id:"mentions",l:"Mentions"},
    {id:"likes",l:"Likes"},
    {id:"commentaires",l:"Commentaires"},
    {id:"abonnements",l:"Abonnements"},
    {id:"systeme",l:"Système"},
  ];
// Regroupe likes/commentaires/mentions/réponses par publication,
  // pour éviter une liste de centaines de lignes identiques
  const feedItems=useMemo(()=>{
    const groups={};
    const standalone=[];
    filtered.forEach(n=>{
      if(n.post_id&&GROUPABLE_TYPES.includes(n.type)){
        if(!groups[n.post_id]){
          groups[n.post_id]={key:`post-${n.post_id}`,isGroup:true,post_id:n.post_id,post:n.post||null,items:[],latest:n.created_at};
        }
        groups[n.post_id].items.push(n);
        if(n.created_at>groups[n.post_id].latest)groups[n.post_id].latest=n.created_at;
      }else{
        standalone.push({key:n.id,isGroup:false,n,latest:n.created_at});
      }
    });
    const groupList=Object.values(groups).map(g=>({...g,items:g.items.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}));
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
                    if(n.type==="status_like"||n.type==="status_view"){
                      if(!n.status_id){alert("Ce statut n'existe plus.");return;}
                      const{data}=await sb.from("statuses").select("id").eq("id",n.status_id).maybeSingle();
                      if(!data){alert("Ce statut n'existe plus.");return;}
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      setTab("statuses");
                      setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_status",{detail:{statusId:n.status_id}})),400);
                      return;
                    }
                    if(n.post_id){
                      const{data}=await sb.from("posts").select("id,author_id").eq("id",n.post_id).maybeSingle();
                      if(!data){alert("Cette publication n'existe plus.");return;}
                      setTab("home");
                      window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                      setTimeout(()=>{window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:n.post_id,commentId:n.comment_id||null}}));},600);
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
                  {!n.read&&(<div style={{width:8,height:8,borderRadius:"50%",background:T.gold,flexShrink:0,boxShadow:T.glowGold}}/>)}
                </div>
              );
            }

            // ── Carte groupée par publication ──────────────
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

            return(
              <div key={g.key} style={{borderBottom:`1px solid ${T.border}`,background:hasUnread?"rgba(201,149,42,0.03)":"transparent",animation:"fadeUp .3s ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer"}}
                  onClick={async()=>{
                    const{data}=await sb.from("posts").select("id,author_id").eq("id",g.post_id).maybeSingle();
                    if(!data){alert("Cette publication n'existe plus.");return;}
                    setTab("home");
                    window.dispatchEvent(new CustomEvent("celeste_close_notifs",{}));
                    setTimeout(()=>{window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:g.post_id}}));},600);
                  }}>
                  <div style={{display:"flex",flexShrink:0}}>
                    {uniqueFroms.slice(0,3).map((f,i)=>(
                      <div key={f.id} style={{marginLeft:i===0?0:-14,border:`2px solid ${T.bg}`,borderRadius:"50%"}}>
                        <Av u={f} size={40}/>
                      </div>
                    ))}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:"0 0 2px",fontSize:13,color:T.text,lineHeight:1.5}}>
                      <strong>{uniqueFroms[0]?.name||"Quelqu'un"}</strong>
                      {uniqueFroms.length>1&&<span style={{color:T.sub}}> et {g.items.length-1} autre{g.items.length>2?"s":""}</span>}
                      {" "}<span style={{color:T.sub}}>ont interagi avec ta publication</span>
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
function CommentsSection({postId,sessionUserId,getM,onCountChange,targetCommentId,standalone=false,notify}){
 const {setHideNav,members}=useApp();
 const [comments,setComments]=useState([]);
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
      .select("id,post_id,author_id,text,mentions,media_url,sticker_id,created_at,author:profiles!comments_author_id_fkey(id,prenom,nom,avatar_url,badge)")
      .eq("post_id",postId)
      .order("created_at",{ascending:true})
      .range(from,to);
    if(page===1)setComments(data||[]);
    else setComments(prev=>[...prev,...(data||[])]);
    onCountChange?.((data||[]).length);
    setLoadingCmts(false);
    setHasMoreCmts((data||[]).length===(to-from+1));
  },[postId,onCountChange]);

  useEffect(()=>{
    (async()=>{
      if(targetCommentId){
        const{data:tc}=await sb.from("comments").select("created_at").eq("id",targetCommentId).maybeSingle();
        if(tc){
          const{count}=await sb.from("comments").select("*",{count:"exact",head:true}).eq("post_id",postId).lte("created_at",tc.created_at);
          setCmtPage(1);
          load(1,count||30);
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
    const ch=sb.channel(`comments-${postId}-${Math.random()}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"comments",filter:`post_id=eq.${postId}`},()=>load(1,visibleCountRef.current+1))
      .subscribe();
    return()=>sb.removeChannel(ch);
  },[postId,load]);

  const submit=async()=>{
    if((!text.trim()&&!mediaFile&&!pendingSticker)||posting)return;
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
      load(1,visibleCountRef.current+1);
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
  <div key={c.id} ref={targetCommentId===c.id?targetRef:null}
    style={{borderRadius:12,transition:"background .5s",
      background:targetCommentId===c.id?"rgba(201,149,42,0.12)":"transparent"}}>
    <CommentItem comment={c} sessionUserId={sessionUserId} getM={getM} onChange={()=>load(1,visibleCountRef.current-1)} members={members}/>
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
      )}*
      {hasMoreCmts&&<div ref={bottomRef} style={{display:"flex",justifyContent:"center",padding:"10px 0"}}>{cmtPage>1&&loadingCmts&&<div style={{width:16,height:16,border:`2px solid ${T.border}`,borderTopColor:T.gold,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>}</div>}
      </>
    );

    const composerBar=(active)=>(
      <div style={{display:"flex",alignItems:"flex-end",gap:8,padding:"8px 12px",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:24,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:active==="sticky"?"0 4px 20px rgba(0,0,0,0.2)":"0 -4px 20px rgba(0,0,0,0.25)",position:active==="sticky"?"sticky":"relative",bottom:active==="sticky"?0:"auto",zIndex:active==="sticky"?10:"auto",flexShrink:0,marginTop:active==="sticky"?0:8}}>
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
function CommentItem({comment,sessionUserId,getM,onChange,members}){
  const [likes,setLikes]=useState(0);
  const [liked,setLiked]=useState(false);
  const [replies,setReplies]=useState([]);
  const [showReplies,setShowReplies]=useState(false);
  const [replyText,setReplyText]=useState("");
  const [replying,setReplying]=useState(false);
  const isMine=comment.author_id===sessionUserId;
  const author=comment.author?normProfile(comment.author):getM(comment.author_id);

  const isPending=typeof comment.id==="string"&&comment.id.startsWith("tmp_");

  const loadMeta=useCallback(async()=>{
    if(isPending)return;
    const[{count:lc},{data:ml},{data:rep}]=await Promise.all([
      sb.from("comment_likes").select("*",{count:"exact",head:true}).eq("comment_id",comment.id),
      sb.from("comment_likes").select("id").eq("comment_id",comment.id).eq("user_id",sessionUserId).maybeSingle(),
      sb.from("comment_replies").select("*, author:profiles(*)").eq("parent_comment_id",comment.id).order("created_at"),
    ]);
    setLikes(lc||0);setLiked(!!ml);setReplies(rep||[]);
  },[comment.id,sessionUserId,isPending]);

  useEffect(()=>{loadMeta();},[loadMeta]);

  const toggleLike=async()=>{
    if(liked){
      await sb.from("comment_likes").delete().eq("comment_id",comment.id).eq("user_id",sessionUserId);
      setLiked(false);setLikes(l=>l-1);
    } else {
      await sb.from("comment_likes").insert({comment_id:comment.id,user_id:sessionUserId});
      setLiked(true);setLikes(l=>l+1);
      // Notifier l'auteur du commentaire
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

  const submitReply=async()=>{
    if(!replyText.trim())return;
    const text=replyText.trim();
    setReplyText("");setReplying(false);
    await sb.from("comment_replies").insert({parent_comment_id:comment.id,author_id:sessionUserId,text});
    // Notifier l'auteur du commentaire
    if(comment.author_id&&comment.author_id!==sessionUserId){
      await sb.from("notifications").insert({
        user_id:comment.author_id,
        from_id:sessionUserId,
        type:"reply",
        post_id:comment.post_id||null,
        comment_id:comment.id,
        read:false
      });
    }
    loadMeta();setShowReplies(true);
  };

  const [showCmtMenu,setShowCmtMenu]=useState(false);
  const del=async()=>{
    setShowCmtMenu(false);
    if(!window.confirm("Supprimer ?"))return;
    await sb.from("comments").delete().eq("id",comment.id);
    onChange?.("delete");
  };
  const copy=()=>{
    navigator.clipboard?.writeText(comment.text||"");
    setShowCmtMenu(false);
  };

  return(
    <div style={{display:"flex",gap:10,paddingBottom:4}}>
      {/* Colonne gauche : avatar + ligne verticale */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
        <Av u={author} size={36} onClick={()=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:author?.id}}))}/>
        {(replies.length>0||replying)&&(
          <div style={{width:2,flex:1,minHeight:16,background:"rgba(255,255,255,0.1)",borderRadius:2,marginTop:4}}/>
        )}
      </div>

      {/* Colonne droite : contenu */}
      <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:12,fontWeight:600,color:T.muted}}>{author?.name||"?"}</span>
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

       {/* Texte + média, côte à côte quand les deux existent */}
        {(comment.text||comment.media_url)&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
            {comment.media_url&&(
              comment.sticker_id
                ?<img src={comment.media_url} alt="" onClick={()=>setOpenStickerDetail(comment.sticker_id)} style={{width:64,height:64,objectFit:"contain",flexShrink:0,cursor:"pointer"}}/>
                :<div style={{borderRadius:10,overflow:"hidden",width:64,height:64,flexShrink:0}}>
                    <MediaPlayer url={comment.media_url} style={{width:"100%",height:"100%",maxHeight:"none",objectFit:"cover"}} onImageClick={url=>window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url}}))}/>
                  </div>
            )}
            {comment.text&&(
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",overflowWrap:"break-word",textAlign:"left"}}>{renderTextWithMentions(comment.text,comment.mentions)}</p>
                <TranslateBtn text={comment.text}/>
              </div>
            )}
          </div>
        )}

        {/* Actions : date + Répondre + like */}
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
          <span style={{fontSize:11,color:T.muted}}>{ago(comment.created_at)}</span>
          <Btn onClick={()=>setReplying(r=>!r)} style={{color:T.muted,fontSize:12,fontWeight:700}}>Répondre</Btn>
          <Btn onClick={toggleLike} style={{display:"flex",alignItems:"center",gap:5,color:liked?T.err:T.muted,fontSize:12,marginLeft:"auto"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={liked?"currentColor":"none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {likes>0&&<span>{likes}</span>}
          </Btn>
        </div>

        {/* Champ réponse */}
        {replying&&(
          <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10}}>
            <textarea autoFocus rows={1} value={replyText}
              onChange={e=>{setReplyText(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
              placeholder={`Répondre à ${author?.name||""}…`}
              style={{flex:1,background:"rgba(255,255,255,0.05)",border:`1px solid ${T.border}`,borderRadius:16,padding:"8px 14px",color:T.text,fontSize:13,outline:"none",resize:"none",lineHeight:1.4,maxHeight:100,fontFamily:"inherit"}}/>
            <Btn onClick={submitReply} disabled={!replyText.trim()} style={{background:replyText.trim()?T.gradGold:"rgba(255,255,255,0.05)",borderRadius:"50%",width:32,height:32,color:replyText.trim()?"#000":T.muted,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Send size={13}/>
            </Btn>
          </div>
        )}

        {/* Réponses */}
        {replies.length>0&&(
          <Btn onClick={()=>setShowReplies(s=>!s)} style={{fontSize:12,color:T.muted,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:16,height:1,background:T.muted,borderRadius:1}}/>
            {showReplies?`Masquer les réponses`:`Afficher ${replies.length} réponse${replies.length>1?"s":""}`}
            <ChevronDown size={13} style={{transform:showReplies?"rotate(180deg)":"none",transition:"transform .2s"}}/>
          </Btn>
        )}

        {showReplies&&(
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:8}}>
            {replies.map(r=>{
              const ra=r.author?normProfile(r.author):{initials:"?",color:"#888",name:"?"};
              const isMyReply=r.author_id===sessionUserId;
              return(
                <div key={r.id} style={{display:"flex",gap:10}}>
                  <Av u={ra} size={28}/>
                  <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                      <span style={{fontSize:12,fontWeight:600,color:T.muted}}>{ra.name}</span>
                      {isMyReply&&<Btn onClick={async()=>{if(!window.confirm("Supprimer ?"))return;await sb.from("comment_replies").delete().eq("id",r.id);loadMeta();}} style={{color:T.muted,padding:2,marginLeft:"auto",display:"flex"}}><MoreHorizontal size={14}/></Btn>}
                    </div>
                    <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:T.text,lineHeight:1.6,wordBreak:"break-word",overflowWrap:"break-word",textAlign:"left"}}>{r.text}</p>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <span style={{fontSize:11,color:T.muted}}>{ago(r.created_at)}</span>
                      <Btn onClick={()=>{setReplyText(`@${ra.name} `);setReplying(true);}} style={{color:T.muted,fontSize:11,fontWeight:700}}>Répondre</Btn>
                      <TranslateBtn text={r.text}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── POST DETAIL MODAL (ENRICHI) ───────────────────────────
function PostDetailModal({post,myProfile,session,getM,onClose,onLike,onComment,notify,zIndex=800,fromReel=false,onPhotoView}){
  
const {members,convs}=useApp();
useEffect(()=>{
  if(post?.author?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
  const ch=sb.channel(`privacy_post_${post?.by}-${Math.random()}`)
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${post?.by}`},payload=>{
      if(payload.new?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
    })
    .subscribe();
  return()=>{sb.removeChannel(ch);disableScreenProtection();};
},[post?.by]);
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
  if(!post?.id||post.type!=="text")return;
  sb.from("post_shares").select("*",{count:"exact",head:true}).eq("post_id",post.id)
    .then(({count})=>setShareCount(count||0));
},[post?.id,post.type]);
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
            {post.type==="event"
              ?<div style={{margin:"12px 0",background:T.goldBg,borderRadius:16,padding:16,border:`1px solid ${T.gold}22`}}>
                <p style={{margin:"0 0 6px",fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:600,color:T.text}}>{post.title}</p>
                {post.text&&<p style={{margin:"0 0 8px",fontSize:13,color:T.sub,lineHeight:1.7}}>{post.text}</p>}
                {post.eventDate&&<p style={{margin:"0 0 3px",fontSize:12,color:T.gold}}>🗓 {post.eventDate}</p>}
                {post.eventLoc&&<p style={{margin:0,fontSize:12,color:T.sub,display:"flex",alignItems:"center",gap:3}}><MapPin size={12}/>{post.eventLoc}</p>}
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
          <div key={i} onClick={e=>{e.stopPropagation();if(url.match(/\.(mp4|mov|webm)/i))onDetail?.(post);}}
            style={{flex:allMedia.length>1?"0 0 88%":"0 0 100%",scrollSnapAlign:"center",aspectRatio:"4/5",borderRadius:16,overflow:"hidden",position:"relative",background:T.card}}>
            <MediaPlayer url={url} style={{width:"100%",height:"100%",maxHeight:"none",objectFit:"cover"}} onImageClick={()=>{if(onPhotoView){onPhotoView(post,url);}else{window.dispatchEvent(new CustomEvent("celeste_open_photo_viewer",{detail:{post,url}}));}}} onVideoClick={()=>onDetail?.(post)}/>
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
  {(post.likes||[]).length}
</Btn>
<span style={{color:T.sub,fontSize:13}}>💬 {cmtCount}</span>
{(myProfile?.badge==="confirmed"||myProfile?.badge==="friend")&&(
  <span style={{color:T.sub,fontSize:13,display:"flex",alignItems:"center",gap:4}}>
    <Eye size={14}/>{views}
  </span>
)}
              <div style={{flex:1}}/>
              <Btn onClick={()=>setShowShareModal(true)} style={{display:"flex",alignItems:"center",gap:6,color:T.sub,fontSize:13,fontWeight:600}}>
                <Share2 size={18}/>
                {post.type==="text"&&shareCount>0&&<span>{shareCount}</span>}
              </Btn>
            </div>
            <CommentsSection
  postId={post.id}
  sessionUserId={session?.user?.id}
  getM={getM}
  onCountChange={setCmtCount}
  targetCommentId={post._targetCommentId||null}
  notify={notify}
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
function CommentsOnlyModal({post,session,getM,onClose,zIndex=1300,notify}){
  const [cmtCount,setCmtCount]=useState(0);
  return(
    <div style={{position:"fixed",inset:0,zIndex,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onMouseDown={e=>{if(e.target===e.currentTarget)e.preventDefault();}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,height:"85vh",display:"flex",flexDirection:"column",animation:"slideUp .3s cubic-bezier(0.34,1.1,0.64,1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>{cmtCount>0?`${cmtCount} commentaire${cmtCount>1?"s":""}`:"Commentaires"}</p>
          <Btn onMouseDown={e=>e.preventDefault()} onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
        </div>
        <div style={{flex:1,minHeight:0,overflow:"visible",display:"flex",flexDirection:"column",padding:"0 16px 16px"}}>
          <CommentsSection postId={post.id} sessionUserId={session?.user?.id} getM={getM} onCountChange={setCmtCount} targetCommentId={null} standalone notify={notify}/>
        </div>
      </div>
    </div>
  );
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
const [busy,setBusy]=useState(false);
const [textBg,setTextBg]=useState(null);
const [selectedCategories,setSelectedCategories]=useState([]);
const [selectedSound,setSelectedSound]=useState(initialSound);
const [showDrafts, setShowDrafts] = useState(false);
const [resumeDraft, setResumeDraft] = useState(null);
const [isForSale,setIsForSale]=useState(false);
const [isPrivate,setIsPrivate]=useState(false);
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
    const files=Array.from(e.target.files).slice(0,10-previews.length);
    if(!files.length)return;
    for(const f of files){
      let file=f;
      if(f.type.startsWith("image/")){
        const reader=new FileReader();
        const src=await new Promise(res=>{reader.onload=ev=>res(ev.target.result);reader.readAsDataURL(f);});
        const croppedFile=await cropImage(src);
        file=croppedFile||await compressImage(f);
      }
      if(f.type.startsWith("video/")&&f.size>75*1024*1024){alert("Vidéo trop volumineuse (max 75MB)");continue;}
      if(f.type.startsWith("video/")&&f._fromCamera){
        const src=URL.createObjectURL(f);
        setPreviews(p=>[...p,{url:src,type:"video"}]);
        setType("photo");
        setUploading(true);setUploadPct(0);
lastVideoFileRef.current=f;
try{const publicUrl=await uploadToR2(f,"posts",pct=>setUploadPct(pct));setMediaUrls(p=>[...p,publicUrl]);}
catch(err){console.error(err);}
finally{setUploading(false);setUploadPct(0);}
continue;
      }
      if(f.type.startsWith("video/")){
        const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
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
} finally {
  setUploading(false);setUploadPct(0);
}
    }
    e.target.value="";
  };

  const removeMedia=idx=>{
    setPreviews(p=>p.filter((_,i)=>i!==idx));
    setMediaUrls(p=>p.filter((_,i)=>i!==idx));
    setCarouselIdx(i=>Math.max(0,i-1));
  };

  const submit=async()=>{
    if(busy)return;
    const{count}=await sb.from("posts").select("id",{count:"exact",head:true}).eq("author_id",session?.user?.id);
    const hasBadge=myProfile?.badge==="confirmed"||myProfile?.badge==="friend";
    if(!hasBadge&&count>=50){
      notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Lock size={14}/>Limite de 50 posts atteinte — Obtenez le badge certifié pour publier en illimité ✦</span>);
      return;
    }
    setBusy(true);
   const{error}=await sb.from("posts").insert({
      author_id:session?.user?.id,type,
      visibility:"testing",
      text:text.trim()||"",
      img_url:mediaUrls.length===1?(mediaUrls[0]||null):null,
      media_urls:mediaUrls.length>1?mediaUrls:null,
      event_title:type==="event"?evTitle.trim():null,
      event_date:type==="event"?evDate:null,
      event_loc:type==="event"?evLoc:null,
      text_background:textBg||null,
      is_for_sale:isForSale||false,
      is_private:isPrivate||false,
whatsapp_contact:isForSale&&contactType==="whatsapp"?(whatsappNum.trim()?`${whatsappIndicatif}${whatsappNum.trim()}`:null):null,
contact_link:isForSale&&contactType==="link"?(contactLink.trim()||null):null,
expires_at:isForSale&&saleExpiry!=="0"?(new Date(Date.now()+parseInt(saleExpiry)*24*60*60*1000).toISOString()):null,
      mentions:extractMentions(text.trim(),mentionNameMapRef.current)
    });
    setBusy(false);
if(!error){
  const uid=session?.user?.id;
  const{data:postData}=await sb.from("posts").select("id").eq("author_id",uid).order("created_at",{ascending:false}).limit(1).single();
  const postId=postData?.id;
  if(postId){
    if(selectedCategories.length>0){
      await sb.from("post_categories").insert(selectedCategories.map(category=>({post_id:postId,category,source:"manual"})));
    }
    if(!selectedSound&&lastVideoFileRef.current){
      autoExtractAndAttachSound({sb,uploadToR2,videoFile:lastVideoFileRef.current,postId,uid,authorName:myProfile?.prenom||myProfile?.fullName});
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
    const uniqueIds=[...new Set(mentionedIdsRef.current)].filter(id=>id!==uid);
    for(const mentionedId of uniqueIds){
      await sb.from("notifications").insert({user_id:mentionedId,from_id:uid,type:"mention",post_id:postId,read:false});
      sb.functions.invoke('send-push',{body:{targetUserId:mentionedId,title:"✦ Mention",body:`${myProfile?.prenom||"Quelqu'un"} t'a mentionné dans un post`}});
    }
    const{data:frequentViewers}=await sb.from("profile_views").select("viewer_id").eq("viewed_id",uid).gte("created_at",new Date(Date.now()-30*86400000).toISOString()).limit(500);
    const viewCounts=new Map();
    (frequentViewers||[]).forEach(r=>viewCounts.set(r.viewer_id,(viewCounts.get(r.viewer_id)||0)+1));
    const favIds=[...viewCounts.entries()].filter(([id,c])=>c>=3&&id!==uid).map(([id])=>id);
    for(const targetId of favIds){
      await sb.from("notifications").insert({user_id:targetId,from_id:uid,type:"new_post_favorite",post_id:postId,read:false});
      sb.functions.invoke('send-push',{body:{targetUserId:targetId,title:"✦ Nouvelle publication",body:`${myProfile?.prenom||"Quelqu'un"} vient de publier`}});
    }
    mentionedIdsRef.current=[];
    mentionNameMapRef.current=new Map();
  }
  onPost();
}
  };

  const canSell=!!myProfile?.badge;
const [saleExpiry,setSaleExpiry]=useState("30");
const ok=type==="text"?text.trim().length>0:type==="photo"?mediaUrls.length>0:evTitle.trim().length>0;

  return(
    <>
{videoTrimSrc&&<VideoTrimModal
  videoSrc={videoTrimSrc.src}
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
/>}<div style={{position:"fixed",inset:0,zIndex:400,background:T.bg,display:"flex",flexDirection:"column"}}>

      <input ref={fRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handlePick}/>
<input ref={vRef} type="file" accept="video/*" multiple style={{display:"none"}} onChange={handlePick}/>

      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"52px 20px 16px",borderBottom:`1px solid ${T.border}`}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.text,fontSize:15,fontWeight:500,cursor:"pointer",padding:"8px 4px",letterSpacing:.2}}>
          Annuler
        </button>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:T.text,letterSpacing:2,fontWeight:600}}>
          Nouveau post
        </span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
  <button onClick={()=>setShowDrafts(true)} style={{background:"none",border:"none",color:T.muted,fontSize:13,fontWeight:500,cursor:"pointer"}}>
    Brouillons
  </button>
  <button onClick={submit} disabled={!ok||busy||uploading}
    style={{background:ok&&!busy&&!uploading?T.gradGold:"rgba(255,255,255,0.08)",border:"none",borderRadius:20,padding:"8px 18px",color:ok&&!busy&&!uploading?"#000":T.muted,fontSize:14,fontWeight:700,cursor:ok&&!busy&&!uploading?"pointer":"default",transition:"all .2s",boxShadow:ok&&!busy&&!uploading?"0 4px 16px rgba(201,149,42,0.3)":"none"}}>
    {busy?"…":uploading?"↑":"Publier"}
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
  placeholder="Quoi de neuf ?"
  rows={4}
  members={members||[]}
  style={{width:"100%",background:"transparent",border:"none",color:T.text,fontSize:16,outline:"none",resize:"none",lineHeight:1.7,fontFamily:"inherit",padding:0,
    ...(textBg?{background:{bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[textBg],borderRadius:14,padding:"12px",color:"#fff",fontSize:18,fontWeight:700,textAlign:"center"}:{})
  }}
/>

            <div style={{ margin: "10px 0", display: "flex", flexDirection: "column", gap: 10 }}>
              <CategoryPicker selected={selectedCategories} onChange={setSelectedCategories} T={T}/>
              <SoundPickerButton sb={sb} value={selectedSound} onChange={setSelectedSound} userId={session?.user?.id} T={T}/>
            </div>

            {/* Option vente (badge doré + Congo uniquement) */}
            {canSell&&(
              <div onClick={()=>setIsForSale(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
                <ShoppingBag size={14} color={isForSale?T.goldL:T.muted}/>
                <span style={{fontSize:12,color:isForSale?T.goldL:T.muted,flex:1}}>Article à vendre</span>
                <div style={{width:28,height:16,borderRadius:8,background:isForSale?T.gold:"rgba(255,255,255,0.1)",position:"relative",transition:"background .3s",flexShrink:0}}>
                  <div style={{position:"absolute",top:2,left:isForSale?12:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left .3s"}}/>
                </div>
              </div>
            )}
            <div onClick={()=>setIsPrivate(s=>!s)} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
              <Lock size={14} color={isPrivate?T.goldL:T.muted}/>
              <span style={{fontSize:12,color:isPrivate?T.goldL:T.muted,flex:1}}>Publication privée (visible uniquement dans l'app)</span>
              <div style={{width:28,height:16,borderRadius:8,background:isPrivate?T.gold:"rgba(255,255,255,0.1)",position:"relative",transition:"background .3s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:isPrivate?12:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left .3s"}}/>
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
                    <input value={whatsappNum} onChange={e=>setWhatsappNum(e.target.value.replace(/\D/g,""))} placeholder="Numéro WhatsApp" maxLength={9} style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:13,outline:"none"}}/>
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
                <input type="date" value={evDate} onChange={e=>setEvDate(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none",colorScheme:"dark"}}/>
                <input value={evLoc} onChange={e=>setEvLoc(e.target.value)} placeholder="📍 Lieu" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"11px 14px",color:T.text,fontSize:13,outline:"none"}}/>
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
const [cropSrc,setCropSrc]=useState(null);
const [cropResolve,setCropResolve]=useState(null);
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
      if(f.size>200*1024*1024){alert("Vidéo max 200MB");return;}
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
    await sb.from("statuses").insert({user_id:session?.user?.id,type,text:text.trim()||null,media_url:mediaUrl||null,text_background:textBg||null,sound_id:selectedSound?.id||null});
    setBusy(false);onDone();
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
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,padding:"22px 20px 44px",maxHeight:"92vh",overflowY:"auto",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}}>
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
{type==="text"
  ?<>
    <textarea value={text} onChange={e=>{const v=e.target.value;const wc=v.trim()?v.trim().split(/\s+/).length:0;if(wc<=40||v.length<text.length)setText(v);}} placeholder="Partagez votre statut… (40 mots max)" maxLength={280} rows={4}
      style={{width:"100%",background:textBg?({bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[textBg]||"rgba(255,255,255,0.04)"):"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px",color:textBg?"#fff":T.text,fontSize:textBg?22:14,fontWeight:textBg?700:400,textAlign:textBg?"center":"left",outline:"none",resize:"none",lineHeight:1.7,marginBottom:2,transition:"all .3s"}}/>
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
function StatusViewer({statuses,author,isMe,onDelete,onClose,onNextGroup,onPrevGroup,session}){
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
    if(hasSound&&soundDuration===null)return;
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
        <Av u={author} size={38} ring/>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:14,fontWeight:600,color:T.text}}>{author?.prenom} {author?.nom?.[0]?author.nom[0]+".":""}</p>
          <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.5)"}}>{ago(current.ts)}{paused&&" · ⏸ Pause"}</p>
        </div>
        {isMe&&<Btn onClick={()=>{if(window.confirm("Voulez-vous vraiment supprimer ce statut ?")){onDelete(current.id);idx>0?setIdx(idx-1):onClose();}}} style={{background:"rgba(200,64,64,0.2)",border:`1px solid rgba(200,64,64,0.3)`,borderRadius:8,padding:"5px 10px",color:"#ff6060",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Trash2 size={12}/>Suppr.</Btn>}
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
      <p style={{margin:0,maxWidth:"100%",maxHeight:"100%",overflow:"hidden",fontSize:current.text?.length>140?20:(current.text?.length>70?24:28),fontWeight:800,color:T.text,lineHeight:1.5,fontFamily:"'Space Grotesk',sans-serif",textAlign:"center",whiteSpace:"pre-wrap",wordBreak:"break-word",overflowWrap:"anywhere"}}>{current.text}</p>
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
            <p style={{color:T.goldL,fontWeight:700,fontSize:13,margin:0}}>👁 {currentViews.length} vue{currentViews.length!==1?"s":""} · ❤️ {currentLikes.length} like{currentLikes.length!==1?"s":""}</p>
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
  const [myStatuses,setMyStatuses]=useState(()=>{try{const c=localStorage.getItem("celeste_mystatuts_cache");return c?JSON.parse(c):[];}catch(e){return[];}});
  const [groups,setGroups]=useState(()=>{try{const c=localStorage.getItem("celeste_statuts_cache");return c?JSON.parse(c):[];}catch(e){return[];}});
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
    .select("id,user_id,type,text,media_url,text_background,expires_at,created_at,sound_id,sound:sounds!statuses_sound_id_fkey(id,title,url),author:profiles!statuses_user_id_fkey(id,prenom,nom,avatar_url,badge,paroisse)")
    .gt("expires_at",new Date().toISOString())
    .in("user_id",relevantIds)
    .order("created_at",{ascending:false});
    const me=(data||[]).filter(s=>s.user_id===session?.user?.id);
    setMyStatuses(me);
    try{localStorage.setItem("celeste_mystatuts_cache",JSON.stringify(me));}catch(e){}
   const blockedSet=new Set(blockedUserIds);
    const followingSet=new Set((myConnections||[]));
    const map=new Map();
    (data||[]).filter(s=>s.user_id!==session?.user?.id&&!blockedSet.has(s.user_id)&&followingSet.has(s.user_id)).forEach(s=>{
      const key=s.user_id;
      if(!map.has(key))map.set(key,{author:s.author?normProfile(s.author):null,statuses:[]});
     const mapped={id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime(),text_background:s.text_background||null,sound:s.sound||null};
      map.get(key).statuses.push(mapped);
    });
    const freshGroups=Array.from(map.values());
    setGroups(prev=>freshGroups.length>0?freshGroups:prev);
    try{localStorage.setItem("celeste_statuts_cache",JSON.stringify(freshGroups));}catch(e){}
    return{me,groups:freshGroups};
  },[session?.user?.id,myConnections,blockedUserIds]);

  const goToGroupOffset=useCallback(offset=>{
    const ni=viewingIdx+offset;
    if(ni>=0&&ni<groups.length){setViewing(groups[ni]);setViewingIdx(ni);}
    else{popNav();setViewing(null);setViewingIdx(-1);load();setHideNav(false);}
  },[viewingIdx,groups,popNav,load]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{const iv=setInterval(()=>{load();},60000);return()=>clearInterval(iv);},[load]);
  useEffect(()=>{if(!viewing&&!creating)setHideNav(false);},[viewing,creating]);

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
      const myMappedNow=me.map(s=>({id:s.id,type:s.type,text:s.text||null,mediaUrl:s.media_url||null,ts:new Date(s.created_at).getTime(),text_background:s.text_background||null,sound:s.sound||null}));
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
          onClose={()=>{popNav();setViewing(null);setViewingIdx(-1);load();setHideNav(false);}}
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
      <div style={{position:"sticky",top:0,zIndex:10,background:"${T.bg2}",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px"}}>
        <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.text}}>Statuts</h2>
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
                  <Av u={g.author} size={52} ring/>
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
  try{const pos=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:8000});lat=pos.coords.latitude;lng=pos.coords.longitude;await sb.from("profiles").update({latitude:lat,longitude:lng}).eq("id",session?.user?.id);}
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
      <div style={{padding:"calc(env(safe-area-inset-top,0px) + 16px) 20px 0",flexShrink:0}}>
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
  if(!open) return(
    <button onClick={()=>{setOpen(true);onWriteOpen?.(true);}} style={{flexShrink:0,padding:"8px 14px",background:T.gradGold,border:"none",borderRadius:12,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 3px 12px rgba(201,149,42,0.3)"}}>
      Écrire ✦
    </button>
  );
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:99999,background:T.bg,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 16px",paddingTop:"calc(60px + env(safe-area-inset-top,0px))",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
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

function MatchSuggestions({myProfile,session,members,onUser,onChat,notify,onWriteOpen}){
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
        // Charger les profils des autres membres
        const otherIds=members.filter(m=>m.id!==session.user.id).map(m=>m.id);
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
  },[session?.user?.id,members?.length]);

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
        const otherIds=members.filter(m=>m.id!==session.user.id).map(m=>m.id);
        sb.from("match_profiles").select("*").in("user_id",otherIds).eq("is_active",true).then(({data:others})=>{
          if(!others)return;
          const scored=others.map(op=>{const score=computeMatchScore(myData,op);const member=members.find(m=>m.id===op.user_id);return{...op,score,member};}).filter(s=>s.score>=50&&s.member).sort((a,b)=>b.score-a.score).slice(0,20);
          setSuggestions(scored);
        });
      });
    }).subscribe();
    return()=>sb.removeChannel(sub);
  },[session?.user?.id,members?.length]);

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

function DiscoverTab({members,myProfile,session,onUser,notify,myConnections,myFollowers,onConnectionChange,openChat}){
  const [q,setQ]=useState("");
  const [filter,setFilter]=useState("tous");
  const [matchWriting,setMatchWriting]=useState(false);

  const toggle=async id=>{
    if((myConnections||[]).includes(id)){await sb.from("connections").delete().eq("from_id",session?.user?.id).eq("to_id",id);notify("Connexion retirée");}
    else{await sb.from("connections").insert({from_id:session?.user?.id,to_id:id});notify("Connecté ✦");}
    onConnectionChange();
  };

  const active=(members||[]).filter(m=>m.id!==session?.user?.id&&m.is_discoverable!==false&&(matchQuery(m.fullName,q)||matchQuery(m.paroisse,q)));

  let filtered;
if(filter==="populaires") filtered=[...active].sort((a,b)=>(b.followersCount||0)-(a.followersCount||0));
else if(filter==="recents") filtered=[...active].sort((a,b)=>new Date(b.joined_at||0)-new Date(a.joined_at||0));
else if(filter==="proximite"){
  if(!myProfile?.latitude) filtered=[];
  else filtered=[...active].filter(m=>m.latitude&&m.longitude&&distKm(myProfile.latitude,myProfile.longitude,m.latitude,m.longitude)<50).sort((a,b)=>distKm(myProfile.latitude,myProfile.longitude,a.latitude,a.longitude)-distKm(myProfile.latitude,myProfile.longitude,b.latitude,b.longitude));
}
else if(filter==="abonnes") filtered=(myFollowers||[]).length===0?[]:[...active].filter(m=>(myFollowers||[]).includes(m.id));
else if(filter==="abonnements") filtered=(myConnections||[]).length===0?[]:[...active].filter(m=>(myConnections||[]).includes(m.id));
else filtered=active;

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {myProfile?.account_type!=="organisation"&&(
        <MatchSuggestions myProfile={myProfile} session={session} members={members} onUser={onUser} notify={notify} onWriteOpen={setMatchWriting}
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
  const stars=[{x:10,y:20,d:0},{x:45,y:5,d:.3},{x:80,y:25,d:.6},{x:20,y:55,d:.15},{x:55,y:45,d:.45},{x:88,y:60,d:.75},{x:35,y:80,d:.25},{x:70,y:85,d:.55}];
  return(
    <div style={{position:"relative",width:size,height:size*0.6}}>
      {stars.map((s,i)=>(
        <span key={i} style={{position:"absolute",left:`${s.x}%`,top:`${s.y}%`,fontSize:size*0.14,color:T.gold,animation:`starPulse 1.6s ease-in-out ${s.d}s infinite`}}>✦</span>
      ))}
    </div>
  );
}

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

function HomeTab({posts,setPosts,myProfile,session,getM,onNewPost,onUseSoundForPost,onUser,notify,reload,loadMore,hasMore,loadingMore,refreshPost,onImageView,myConnections,onConnect,initialScroll,onScrollChange,pushNav,popNav,onMuteAuthor,viewedPostIdsRef}){

const [detailPost,setDetailPost]=useState(null);
const [reelsIndex,setReelsIndex]=useState(null);
const [reelsCommentPost,setReelsCommentPost]=useState(null);
const [reelsCloseCallback,setReelsCloseCallback]=useState(null);
const videoPosts=posts.filter(p=>(p.img||"").match(/\.(mp4|mov|webm)/i)||(p.media_urls||[]).some(u=>(u||"").match(/\.(mp4|mov|webm)/i)));
const [photoIndex,setPhotoIndex]=useState(null);
const [photoStartMedia,setPhotoStartMedia]=useState(0);
const [photoViewerPosts,setPhotoViewerPosts]=useState(null);
const [reelsViewerPosts,setReelsViewerPosts]=useState(null);
const [openSoundId,setOpenSoundId]=useState(null);

const [mysteryRevealed,setMysteryRevealed]=useState(()=>{
  try{return localStorage.getItem("celeste_mystery_"+new Date().toDateString())==="1";}catch{return false;}
});
const [mysteryDrag,setMysteryDrag]=useState(0);
const mysteryDragRef=useRef(null);
const mysteryPost=useMemo(()=>{
  if(!posts||posts.length===0)return null;
  const dayKey=new Date().toDateString();
  let seed=0;for(let i=0;i<dayKey.length;i++)seed=(seed*31+dayKey.charCodeAt(i))>>>0;
  const withContent=posts.filter(p=>p.img||p.media_urls?.[0]||p.text);
  const pool=withContent.length>0?withContent:posts;
  return pool[seed%pool.length];
},[posts]);
const revealMystery=()=>{
  setMysteryRevealed(true);
  try{localStorage.setItem("celeste_mystery_"+new Date().toDateString(),"1");}catch{}
};

const [photoCommentPost,setPhotoCommentPost]=useState(null);
const [photoCloseCallback,setPhotoCloseCallback]=useState(null);
const photoPosts=posts.filter(p=>{
  const allMedia=p.media_urls?.length>0?p.media_urls:(p.img?[p.img]:[]);
  return allMedia.some(u=>!/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u||""));
});
const openPhotoViewer=(post,url)=>{
  let idx=photoPosts.findIndex(p=>p.id===post.id);
  if(idx<0){
    // Post hors de la page Actuellement chargée (profil, recherche, admin, notification…)
    // → on ouvre quand même le viewer avec juste ce post
    setPhotoViewerPosts([post]);
    idx=0;
  }else{
    setPhotoViewerPosts(null);
  }
  const allMedia=post.media_urls?.length>0?post.media_urls:(post.img?[post.img]:[]);
  const photosOnly=allMedia.filter(u=>!/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(u||""));
  const mIdx=Math.max(0,photosOnly.indexOf(url));
  setPhotoStartMedia(mIdx);
  if(detailPost){popNav();setDetailPost(null);} // ferme le post modal sous-jacent ET nettoie sa trace dans la pile de nav
  pushNav(()=>setPhotoIndex(null));
  setPhotoIndex(idx);
};

const openPost=useCallback(p=>{
  const isVid=(p.img||"").match(/\.(mp4|mov|webm)/i)||(p.media_urls||[]).some(u=>(u||"").match(/\.(mp4|mov|webm)/i));
  if(isVid&&!p._forceComments){
    const idx=videoPosts.findIndex(v=>v.id===p.id);
    pushNav(()=>setReelsIndex(null));
    setReelsIndex(idx>=0?idx:0);
  }else if(p._forceComments){
    setDetailPost(p);
  }else{
    const allMedia=p.media_urls?.length>0?p.media_urls:(p.img?[p.img]:[]);
    const firstPhoto=allMedia.find(u=>!(u||"").match(/\.(mp4|mov|webm|ogg|avi)/i));
    if(firstPhoto)openPhotoViewer(p,firstPhoto);else setDetailPost(p);
  }
},[videoPosts]);

const openPostFromSound=(post,soundPosts)=>{
  const list=soundPosts||[post];
  const isVideoFn=p=>(p.img||"").match(/\.(mp4|mov|webm|ogg|avi)/i)||(p.media_urls||[]).some(u=>(u||"").match(/\.(mp4|mov|webm|ogg|avi)/i));
  if(isVideoFn(post)){
    const vids=list.filter(isVideoFn);
    const idx=vids.findIndex(v=>v.id===post.id);
    setReelsViewerPosts(vids);
    if(reelsIndex===null)pushNav(()=>setReelsIndex(null));
    setReelsIndex(idx>=0?idx:0);
  }else{
    const photos=list.filter(p=>!isVideoFn(p));
    const idx=photos.findIndex(p=>p.id===post.id);
    setPhotoViewerPosts(photos);
    setPhotoStartMedia(0);
    if(detailPost){popNav();setDetailPost(null);}
    if(photoIndex===null)pushNav(()=>setPhotoIndex(null));
    setPhotoIndex(idx>=0?idx:0);
  }
};

useEffect(()=>{
  const handler=(e)=>{
    const{post,url}=e.detail||{};
    if(post)openPhotoViewer(post,url);
  };
  window.addEventListener("celeste_open_photo_viewer",handler);
  return()=>window.removeEventListener("celeste_open_photo_viewer",handler);
},[photoPosts]);
const [searchOpen,setSearchOpen]=useState(false);
const bottomRef=useRef();
const observer=useRef();

useEffect(()=>{if(scrollRef.current&&initialScroll>0){scrollRef.current.scrollTop=initialScroll;}},[]);
const scrollRef=useRef();
const savedScroll=useRef(initialScroll);
const viewedPostIds=viewedPostIdsRef||useRef(new Set());
const postsRef=useRef(posts);
useEffect(()=>{postsRef.current=posts;},[posts]);
useEffect(()=>{
  if(!posts||posts.length===0)return;
  const timer=setTimeout(()=>{
    posts.slice(0,8).forEach(p=>{
      const allMedia=p.media_urls?.length>0?p.media_urls:(p.img?[p.img]:[]);
      allMedia.forEach(url=>{
        if(!url)return;
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

useEffect(()=>{
  const timer=setTimeout(()=>{
    const viewObserver=new IntersectionObserver(entries=>{
      entries.forEach(async entry=>{
        if(!entry.isIntersecting)return;
        const postId=entry.target.dataset.postId;
        if(!postId||viewedPostIds.current.has(postId))return;
viewedPostIds.current.add(postId);
const prev=JSON.parse(localStorage.getItem("celeste_seen_posts")||"[]");
const updated=[...new Set([...prev,postId])].slice(-500);
localStorage.setItem("celeste_seen_posts",JSON.stringify(updated));
        viewObserver.unobserve(entry.target);
        await sb.rpc("increment_phase_views",{post_id:postId});
      });
    },{threshold:0.6});
    document.querySelectorAll("[data-post-id]").forEach(el=>viewObserver.observe(el));
    return()=>viewObserver.disconnect();
  },300);
  return()=>clearTimeout(timer);
},[posts.length]);
const feedScrollRef=useRef(initialScroll);

useEffect(()=>{
    if(!bottomRef.current||!hasMore)return;
    observer.current=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)loadMore();},{threshold:.5});
    observer.current.observe(bottomRef.current);
    return()=>observer.current?.disconnect();
  },[hasMore,loadMore]);

  const toggleLike=async pid=>{
   
    const post=(posts||[]).find(p=>p.id===pid);
    
    if(!post)return;
    const uid=session?.user?.id;
    const liked=(post.likes||[]).some(l=>(l.user_id||l)===uid);
    setPosts(prev=>(prev||[]).map(p=>p.id!==pid?p:{...p,likes:liked?(p.likes||[]).filter(l=>(l.user_id||l)!==uid):[...(p.likes||[]),uid]}));
    if(!liked)playLikeSound();
    try{
      if(liked){
        await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);
        await sb.from("valid_likes").delete().eq("post_id",pid).eq("liker_id",uid);
      }else{
        await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});
        await sb.rpc("increment_phase_interactions",{post_id:pid});
        // Vérifier si le post a moins de 24h
        const postAge=Date.now()-post.ts;
        const isValid=postAge<86400000; // 24h en ms
        const authorHasBadge=post.author?.badge==="confirmed"||post.author?.badge==="friend";
        if(isValid&&authorHasBadge&&post.by!==uid){
          const month=new Date().toISOString().slice(0,7);
          await sb.from("valid_likes").upsert({
            post_id:pid,
            liker_id:uid,
            author_id:post.by,
            month
          },{onConflict:"post_id,liker_id",ignoreDuplicates:true});
        }
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
  };

  const toggleSave=async pid=>{
    const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();
    if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);
    else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});
    notify(ex?"Retiré des sauvegardes":"Sauvegardé ✦");
  };

  return(
    <>
{reelsIndex!==null&&<ReelsViewer
  posts={reelsViewerPosts||videoPosts}
  sb={sb}
  startIndex={reelsIndex}
  onClose={()=>{popNav();setReelsIndex(null);}}
  toggleLike={toggleLike}
  toggleSave={toggleSave}
  session={session}
  myProfile={myProfile}
  notify={notify}
  onUser={onUser}
  onOpenComments={(p,onReelsCb)=>{setReelsCommentPost(p);setReelsCloseCallback(()=>onReelsCb);}}
  myConnections={myConnections}
  onConnect={onConnect}
  onOpenSound={setOpenSoundId}
/>}
{photoIndex!==null&&<PhotoViewer
 onOpenSound={setOpenSoundId}
  posts={photoViewerPosts||photoPosts}
  sb={sb}
  startIndex={photoIndex}
  startMediaIndex={photoStartMedia}
  onClose={()=>{popNav();setPhotoIndex(null);}}
  toggleLike={toggleLike}
  toggleSave={toggleSave}
  session={session}
  myProfile={myProfile}
  notify={notify}
  onUser={onUser}
  onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}
  myConnections={myConnections}
  onConnect={onConnect}
/>}
{openSoundId&&<SoundDetailModal sb={sb} soundId={openSoundId} onClose={()=>setOpenSoundId(null)}
  onUseSound={(sound)=>{setOpenSoundId(null); onUseSoundForPost?.(sound);}}
  onOpenPost={openPostFromSound}
/>}
{(reelsCommentPost||photoCommentPost)&&(
  <CommentsOnlyModal
    post={reelsCommentPost||photoCommentPost}
    session={session}
    getM={getM}
    onClose={()=>{
      setReelsCommentPost(null);
      setPhotoCommentPost(null);
      if(reelsCloseCallback){reelsCloseCallback();setReelsCloseCallback(null);}
      if(photoCloseCallback){photoCloseCallback();setPhotoCloseCallback(null);}
    }}
  />
)}
      

    <div ref={scrollRef} data-feed-scroll style={{flex:1,overflowY:"auto",background:T.bg}}
      onScroll={e=>{savedScroll.current=e.currentTarget.scrollTop;onScrollChange?.(e.currentTarget.scrollTop);}}>

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"${T.bg2}",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
    <div onClick={()=>{pushNav(()=>setSearchOpen(false));setSearchOpen(true);}} style={{display:"flex",alignItems:"center",gap:10,flex:1,cursor:"pointer"}}>
  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T.gold,filter:"drop-shadow(0 0 10px rgba(201,149,42,0.5))",letterSpacing:2}}>✦</span>
  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:Math.max(13,21-Math.max(0,(myProfile?.prenom?.length||0)-8)*0.7),fontWeight:300,letterSpacing:3,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0,flexShrink:1}}>Actu, <span style={{color:T.goldL}}>{myProfile?.prenom||""}</span></span>
  <Search size={16} color={T.muted} style={{marginLeft:4,flexShrink:0}}/>
</div>
    <Btn onClick={onNewPost} style={{background:T.gradGold,borderRadius:14,padding:"9px 16px",color:"#000",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:6,boxShadow:"0 4px 16px rgba(201,149,42,0.3)"}}>
      <Plus size={16}/>Publier
    </Btn>
      </div>
     {searchOpen&&<SearchExplorer sb={sb} T={T} myProfile={myProfile} mapDbPost={mapDbPost} normProfile={normProfile}
        onClose={()=>{popNav();setSearchOpen(false);}}
        onOpenPost={openPostFromSound}
        onUseSound={onUseSoundForPost}
      />}

      <div style={{maxWidth:640,margin:"0 auto"}}>
        {(posts||[]).length===0&&(
          <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
            <div style={{fontSize:40,marginBottom:12,opacity:.3,animation:"float 3s ease infinite"}}>✦</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Aucune publication</p>
            <p style={{fontSize:13,marginTop:8}}>Soyez le premier à partager</p>
          </div>
        )}

       {mysteryPost&&(
        <div style={{margin:"14px 16px 22px",borderRadius:20,overflow:"hidden",position:"relative",background:"linear-gradient(160deg,#150524 0%,#000 70%)",border:`1px solid ${T.gold}33`,animation:"fadeUp .4s ease both",cursor:mysteryRevealed?"pointer":"default"}}
        onClick={()=>{if(mysteryRevealed)openPost(mysteryPost);}}>
          <div style={{padding:"26px 20px",minHeight:150,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:8,textAlign:"center"}}>
            {mysteryPost.img||mysteryPost.media_urls?.[0]
              ?<img src={mysteryPost.img||mysteryPost.media_urls[0]} alt="" style={{width:"100%",maxHeight:170,objectFit:"cover",borderRadius:14}}/>
              :<p style={{margin:0,fontSize:16,color:T.text,lineHeight:1.5,fontFamily:"'Cormorant Garamond',serif"}}>{mysteryPost.text}</p>
            }
            <p style={{margin:"6px 0 0",fontSize:12,color:T.muted}}>— {mysteryPost.author?.name||"Anonyme"}</p>
          </div>
          {!mysteryRevealed&&(
          <div
            onPointerDown={e=>{mysteryDragRef.current=e.clientX;}}
            onPointerMove={e=>{
              if(mysteryDragRef.current==null)return;
              const d=e.clientX-mysteryDragRef.current;
              setMysteryDrag(Math.max(0,Math.min(1,d/140)));
            }}
            onPointerUp={()=>{
              if(mysteryDrag>0.55)revealMystery();
              else setMysteryDrag(0);
              mysteryDragRef.current=null;
            }}
            style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,cursor:"grab",touchAction:"pan-y",
              backdropFilter:`blur(${18-mysteryDrag*18}px)`,WebkitBackdropFilter:`blur(${18-mysteryDrag*18}px)`,
              background:`rgba(0,0,0,${0.6-mysteryDrag*0.6})`,transition:mysteryDrag===0?"backdrop-filter .3s,background .3s":"none"}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,color:T.gold,opacity:1-mysteryDrag}}>✦</span>
            <p style={{margin:0,fontSize:15,fontWeight:600,color:T.text,fontFamily:"'Cormorant Garamond',serif",letterSpacing:1,opacity:1-mysteryDrag}}>Mystère du jour</p>
            <p style={{margin:0,fontSize:12,color:T.muted,opacity:1-mysteryDrag}}>Glisse pour révéler</p>
          </div>
          )}
        </div>
       )}
       {(posts||[]).map((p,i)=>(
          <div key={p.id} data-post-id={p.id}>
<PostCard key={p.id} post={p} myProfile={myProfile} session={session} getM={getM}
onMuteAuthor={onMuteAuthor}
           onDetail={openPost}
            onLike={toggleLike}
            onSave={toggleSave}
            onUser={onUser}
            onImageView={onImageView}
            notify={notify}
            refresh={refreshPost}
            setPosts={setPosts}
            animDelay={0}
            myConnections={myConnections}
            onConnect={onConnect}
          />
</div>
        ))}

        {loadingMore&&(
          <div style={{display:"flex",justifyContent:"center",padding:"24px"}}>
            <StarFieldLoader/>
          </div>
        )}
        <div ref={bottomRef} style={{height:4}}/>
        <div style={{height:80}}/>
      </div>
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


// ── POST CARD (ENRICHI depuis App 9) ─────────────────────
const POST_REPORT_REASONS=["Contenu inapproprié ou choquant","Nudité ou contenu sexuel","Violence ou contenu dangereux","Discours haineux ou discrimination","Harcèlement ou intimidation","Fausses informations","Spam ou publicité non désirée","Contenu protégé (droits d'auteur)","Autre"];
const ADMIN_DELETE_REASONS=["Contenu inapproprié ou choquant","Nudité ou contenu sexuel","Violence ou contenu dangereux","Discours haineux ou discrimination","Harcèlement ou intimidation","Fausses informations","Spam ou publicité non désirée","Contenu protégé (droits d'auteur)","Contenu réutilisé d'une autre plateforme (filigrane visible)","Signalement non fondé mais retiré pour une autre raison","Autre"];
const PostCard=React.memo(function PostCard({post,myProfile,session,getM,onDetail,onLike,onSave,onUser,onImageView,notify,refresh,setPosts,animDelay=0,myConnections,onConnect,onMuteAuthor}){
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
  const [reactOpen,setReactOpen]=useState(false);
  const [reactDir,setReactDir]=useState(null);
  const reactStartRef=useRef(null);
  const longPressTimerRef=useRef(null);
  const quickReactions=[
    {key:"up",dx:0,dy:-1,emoji:"👏",text:"👏 Bravo, superbe !"},
    {key:"down",dx:0,dy:1,emoji:"🙏",text:"🙏 Merci pour ce partage"},
    {key:"left",dx:-1,dy:0,emoji:"✨",text:"✨ J'ai adoré !"},
    {key:"right",dx:1,dy:0,emoji:"😲",text:"😲 Waouh, incroyable !"}
  ];
  const sendQuickComment=async text=>{
    const uid=session?.user?.id;
    if(!uid)return;
    const{data,error}=await sb.from("comments").insert({post_id:post.id,author_id:uid,text}).select("id,text,created_at,author:profiles(id,prenom,nom,avatar_url)").single();
    if(!error&&data){
      setPosts?.(prev=>prev.map(p=>p.id===post.id?{...p,comments:[...(p.comments||[]),{...data,repliesCount:0}]}:p));
    }
  };
  const startLongPress=e=>{
    reactStartRef.current={x:e.clientX,y:e.clientY};
    longPressTimerRef.current=setTimeout(()=>{setReactOpen(true);setReactDir(null);},380);
  };
  const moveLongPress=e=>{
    if(!reactOpen||!reactStartRef.current)return;
    const dx=e.clientX-reactStartRef.current.x;
    const dy=e.clientY-reactStartRef.current.y;
    const dist=Math.hypot(dx,dy);
    if(dist<24){setReactDir(null);return;}
    const angle=Math.atan2(dy,dx);
    let dir;
    if(angle>-Math.PI/4&&angle<=Math.PI/4)dir="right";
    else if(angle>Math.PI/4&&angle<=3*Math.PI/4)dir="down";
    else if(angle>-3*Math.PI/4&&angle<=-Math.PI/4)dir="up";
    else dir="left";
    setReactDir(dir);
  };
  const endLongPress=()=>{
    clearTimeout(longPressTimerRef.current);
    if(reactOpen&&reactDir){
      const choice=quickReactions.find(q=>q.key===reactDir);
      if(choice)sendQuickComment(choice.text);
    }
    setReactOpen(false);setReactDir(null);reactStartRef.current=null;
  };
  const cancelLongPress=()=>{clearTimeout(longPressTimerRef.current);};
  const [burstIdx,setBurstIdx]=useState(null);
  const liked=(post.likes||[]).some(l=>(l.user_id||l)===session?.user?.id);
  const isMine=post.by===session?.user?.id;
  const isAdmin=myProfile?.is_admin;
  const isLockedForViewer=post.is_private&&!isNative&&!isMine;

 const [views, setViews] = useState(0);

  useEffect(()=>{
    sb.from("saved_posts").select("id").eq("post_id",post.id).eq("user_id",session?.user?.id).maybeSingle()
      .then(({data})=>setSaved(!!data));
    // Enregistrer la vue
    sb.auth.getUser().then(({data})=>{
  if(data?.user?.id)sb.from("post_views").upsert({post_id:post.id,viewer_id:data.user.id},{onConflict:"post_id,viewer_id",ignoreDuplicates:true})
    .then(()=>sb.from("post_views").select("*",{count:"exact",head:true}).eq("post_id",post.id).then(({count})=>setViews(count||0)));
  
});
    // Charger le nombre de vues
    sb.from("post_views").select("*",{count:"exact",head:true}).eq("post_id",post.id)
      .then(({count})=>setViews(count||0));
  },[post.id,session?.user?.id]);

  useEffect(()=>{
    if(post.type!=="text")return;
    sb.from("post_shares").select("*",{count:"exact",head:true}).eq("post_id",post.id)
      .then(({count})=>setShareCount(count||0));
  },[post.id,post.type]);

  const handleSave=async()=>{
    const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",post.id).eq("user_id",session?.user?.id).maybeSingle();
   if(ex){await sb.from("saved_posts").delete().eq("post_id",post.id).eq("user_id",session?.user?.id);setSaved(false);setSavesCount(c=>Math.max(0,c-1));notify("Retiré des sauvegardes");}
      else{await sb.from("saved_posts").insert({post_id:post.id,user_id:session?.user?.id});setSaved(true);setSavesCount(c=>c+1);notify("Sauvegardé ✦");}
      
  };


const handleDelete=async()=>{
  const byAdmin=myProfile?.is_admin&&post.by!==session?.user?.id;
  if(byAdmin){setShowDeleteReasons(true);return;}
  if(!window.confirm("Supprimer ce post ?"))return;
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
  setPosts?.(prev=>(prev||[]).filter(p=>p.id!==post.id));
  notify("Supprimé");
  await sb.from("posts").delete().eq("id",post.id);
  await sb.from("notifications").insert({
    user_id:post.by,
    from_id:session?.user?.id,
    type:"post_deleted",
    text:`Ta publication a été supprimée par un administrateur (motif : ${reason})`,
    read:false
  });
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
onMuteAuthor?.(post.by);
    notify("Tu ne verras plus les publications de cette personne");
  };
 
  if(isLockedForViewer){
    return(
      <div style={{borderBottom:`1px solid ${T.border}`,padding:"16px",animation:`fadeUp .4s ease ${animDelay}s both`}}>
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
    <div style={{borderBottom:`1px solid ${T.border}`,borderLeft:`2px solid ${post.author?.color||T.border}55`,padding:"16px 16px 16px 14px",animation:`fadeUp .4s ease ${animDelay}s both`,cursor:"pointer"}} onClick={()=>onDetail?.(post)}>
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
              {post.pinned&&<span style={{fontSize:10,color:T.gold,fontWeight:700,background:T.goldBg,padding:"1px 7px",borderRadius:20}}>✦ Sponsorisé</span>}
              {post.profile_pinned&&<span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:T.muted,fontWeight:600}}><Pin size={10} color={T.goldL}/>Épinglé</span>}
              <span style={{fontSize:11,color:T.muted}}>{ago(post.ts)}</span>
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
          {post.type==="event"
            ?<div style={{background:T.goldBg,borderRadius:14,padding:14,border:`1px solid ${T.gold}22`,marginBottom:10}}>
              <p style={{margin:"0 0 5px",fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:600,color:T.text}}>{post.title}</p>
              {post.text&&<p style={{margin:"0 0 6px",fontSize:13,color:T.sub,lineHeight:1.7}}>{post.text}</p>}
              {post.eventDate&&<p style={{margin:"0 0 2px",fontSize:12,color:T.gold}}>🗓 {post.eventDate}</p>}
              {post.eventLoc&&<p style={{margin:0,fontSize:12,color:T.muted,display:"flex",alignItems:"center",gap:3}}><MapPin size={12}/>{post.eventLoc}</p>}
            </div>
            :<>
              {post.text&&(
  post.text_background?(
    <div style={{
      background:{bg_noir:"radial-gradient(circle at 30% 20%,#2b2b2b 0%,#000 70%)",bg_bleu:"linear-gradient(160deg,#0d47a1 0%,#1565C0 45%,#072858 100%)",bg_vert:"linear-gradient(160deg,#0d3d17 0%,#1B5E20 45%,#04240a 100%)",bg_rouge:"linear-gradient(160deg,#7a0d0d 0%,#B71C1C 45%,#3d0505 100%)",bg_or:"linear-gradient(160deg,#4a3600 0%,#7B5A00 45%,#241a00 100%)",bg_violet:"linear-gradient(160deg,#2a0a4a 0%,#4A148C 45%,#150524 100%)"}[post.text_background]||T.card,
      borderRadius:16,padding:"32px 20px",marginBottom:10,minHeight:160,maxHeight:160,overflow:"hidden",
      display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center"
    }}>
      <p style={{margin:0,fontSize:22,fontWeight:700,color:T.text,lineHeight:1.6,fontFamily:"'Space Grotesk',sans-serif",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",textOverflow:"ellipsis"}}>{post.text}</p>
    </div>
  ):(
    <>{expanded?(<p style={{margin:"0 0 4px 0",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{renderTextWithMentions(post.text,post.mentions)}</p>):(<p style={{margin:"0 0 4px 0",fontSize:14,color:T.text,lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{renderTextWithMentions(post.text,post.mentions)}</p>)}{post.text?.length>120&&<Btn onClick={e=>{e.stopPropagation();setExpanded(x=>!x);}} style={{fontSize:12,color:T.goldL,padding:"2px 0",marginBottom:4,display:"block"}}>{expanded?"Voir moins ▲":"Voir plus ▼"}</Btn>}<TranslateBtn text={post.text}/></>
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
        {allMedia.map((url,i)=>(
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
                dtTimeoutRef.current=setTimeout(()=>onDetail?.(post),300);
              }
            }} style={{flex:allMedia.length>1?"0 0 88%":"0 0 100%",scrollSnapAlign:"center",aspectRatio:"4/5",borderRadius:16,overflow:"hidden",position:"relative",background:T.card}}>
            <MediaPlayer url={url} style={{width:"100%",height:"100%",maxHeight:"none",objectFit:"cover"}} onVideoClick={()=>{}}/>
            {burstIdx===i&&(
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                <Heart size={72} fill="#fff" color="#fff" style={{filter:"drop-shadow(0 4px 20px rgba(0,0,0,0.4))",animation:"heartBurst .7s ease"}}/>
              </div>
            )}
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
{post.is_for_sale&&post.expires_at&&(
  <p style={{margin:"0 0 6px",fontSize:11,color:T.muted}}>
    Expire le {new Date(post.expires_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}
  </p>
)}
          {/* Actions */}
          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}} onClick={e=>e.stopPropagation()}>
            <Btn onClick={e=>{e.stopPropagation();onLike(post.id);}} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,background:liked?"rgba(201,149,42,0.08)":"transparent",color:liked?T.gold:T.muted,fontSize:13,fontWeight:liked?700:400,transition:"all .2s",border:liked?`1px solid ${T.gold}22`:"1px solid transparent"}}>
              <Heart size={16} fill={liked?"currentColor":"none"} style={{color:liked?T.gold:T.muted,animation:liked?"pulse .3s ease":"none"}}/>
              {(post.likes||[]).length>0&&<span>{(post.likes||[]).length}</span>}
            </Btn>
            <div style={{position:"relative"}}
              onPointerDown={e=>{e.stopPropagation();startLongPress(e);}}
              onPointerMove={e=>{e.stopPropagation();moveLongPress(e);}}
              onPointerUp={e=>{e.stopPropagation();endLongPress();}}
              onPointerLeave={()=>{if(reactOpen)endLongPress();else cancelLongPress();}}
              style={{touchAction:reactOpen?"none":"auto"}}>
              <Btn onClick={()=>{if(!reactOpen)onDetail?.({...post,_forceComments:true});}} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:20,color:T.muted,fontSize:13,transition:"all .2s"}}>
                <MessageCircle size={16}/>
                {(post.comments||[]).length>0&&<span>{(post.comments||[]).reduce((a,c)=>a+1+(c.repliesCount||0),0)}</span>}
              </Btn>
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
           {(getM(session?.user?.id)?.badge==="confirmed"||getM(session?.user?.id)?.badge==="friend")&&(
  <div style={{display:"flex",alignItems:"center",gap:4,padding:"7px 12px",color:T.muted,fontSize:13}}>
    <Eye size={16}/>
    <span>{views||0}</span>
  </div>
)}
            <div style={{flex:1}}/>
            <Btn onClick={e=>{e.stopPropagation();setShowShareModal(true);}} style={{padding:"7px 10px",borderRadius:20,color:T.muted,transition:"all .2s",display:"flex",alignItems:"center",gap:4}}>
              <Share2 size={16}/>
              {post.type==="text"&&shareCount>0&&<span style={{fontSize:12}}>{shareCount}</span>}
            </Btn>
            <Btn onClick={handleSave} style={{padding:"7px 10px",borderRadius:20,color:saved?T.gold:T.muted,transition:"all .2s",display:"flex",alignItems:"center",gap:4}}>
              <Bookmark size={16} fill={saved?"currentColor":"none"}/>
              {savesCount>0&&<span style={{fontSize:12}}>{savesCount}</span>}
            </Btn>
          </div>
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
);
// ── SAVED POSTS (NOUVEAU depuis App 9) ────────────────────
function SavedPostsTab({myProfile,session,getM,notify,onImageView,toggleLike,toggleSave}){
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [reelsIndex,setReelsIndex]=useState(null);
  const [photoViewerIndex,setPhotoViewerIndex]=useState(null);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [reelsCommentPost,setReelsCommentPost]=useState(null);
  const [reelsCloseCallback,setReelsCloseCallback]=useState(null);
  const [photoCommentPost,setPhotoCommentPost]=useState(null);
  const [photoCloseCallback,setPhotoCloseCallback]=useState(null);
  const [reelsViewerFallback,setReelsViewerFallback]=useState(null);
  const [photoViewerFallback,setPhotoViewerFallback]=useState(null);
  const isVid=p=>(p.img||(p.media_urls||[])[0])&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img||(p.media_urls||[])[0])||(p.img||"").includes("video"));
  const videoPosts=posts.filter(isVid);
  const openPostFromSound=(post,soundPosts)=>{
    const list=soundPosts||[post];
    if(isVid(post)){
      const vids=list.filter(isVid);
      const idx=vids.findIndex(v=>v.id===post.id);
      setReelsViewerFallback(vids);
      setReelsIndex(idx>=0?idx:0);
    }else{
      const photos=list.filter(q=>!isVid(q));
      const idx=photos.findIndex(q=>q.id===post.id);
      setPhotoViewerFallback(photos);
      setPhotoViewerIndex(idx>=0?idx:0);
    }
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
          eventDate:p.event_date||null,eventLoc:p.event_loc||null,
          likes:(p.likes||[]).map(l=>l.user_id)||(p.likes||[]),
          comments:[],ts:new Date(p.created_at).getTime(),pinned:p.pinned||false,is_private:p.is_private||false,
          sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null
        }));
        setPosts(mapped);setLoading(false);
      });
  },[session?.user?.id]);

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:[],is_private:data.is_private||false,ts:new Date(data.created_at).getTime()};
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
          notify={notify}
        />
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
        {reelsIndex!==null&&toggleLike&&toggleSave&&(
          <ReelsViewer posts={reelsViewerFallback||videoPosts} sb={sb} startIndex={reelsIndex} onClose={()=>{setReelsIndex(null);setReelsViewerFallback(null);}}
            toggleLike={localToggleLike} toggleSave={localToggleSave} session={session} myProfile={myProfile} notify={notify}
            onUser={()=>{}} onOpenComments={(p,onReelsCb)=>{setReelsCommentPost(p);setReelsCloseCallback(()=>onReelsCb);}} myConnections={myConnections} onConnect={onConnect} onOpenSound={setOpenSoundId}/>
        )}
        {photoViewerIndex!==null&&toggleLike&&toggleSave&&(
          <PhotoViewer posts={photoViewerFallback||posts.filter(p=>!isVid(p)&&(p.img||(p.media_urls&&p.media_urls.length>0)))} sb={sb} startIndex={photoViewerIndex} onClose={()=>{setPhotoViewerIndex(null);setPhotoViewerFallback(null);}}
            toggleLike={localToggleLike} toggleSave={localToggleSave} session={session} myProfile={myProfile} notify={notify}
            onUser={()=>{}} onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}} myConnections={myConnections} onConnect={onConnect} onOpenSound={setOpenSoundId}/>
        )}
        {(reelsCommentPost||photoCommentPost)&&(
          <CommentsOnlyModal
            post={reelsCommentPost||photoCommentPost}
            session={session}
            getM={getM}
            onClose={()=>{
              setReelsCommentPost(null);
              setPhotoCommentPost(null);
              if(reelsCloseCallback){reelsCloseCallback();setReelsCloseCallback(null);}
              if(photoCloseCallback){photoCloseCallback();setPhotoCloseCallback(null);}
            }}
          />
        )}
        {openSoundId&&<SoundDetailModal sb={sb} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
        {!navigator.onLine&&posts.length===0&&[1,2,3].map(i=><SkeletonPost key={i}/>)}
        {posts.map((p,i)=>(
          <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:p.is_private&&!isNative?"default":"pointer"}}
            onClick={()=>{
              if(p.is_private&&!isNative)return;
              if(isVid(p)){const idx=videoPosts.findIndex(q=>q.id===p.id);setReelsIndex(idx>=0?idx:0);}
              else{
                const hasPhoto=p.img||(p.media_urls&&p.media_urls.length>0);
                if(hasPhoto){
                  const photoPosts=posts.filter(q=>!isVid(q)&&(q.img||(q.media_urls&&q.media_urls.length>0)));
                  const idx=photoPosts.findIndex(q=>q.id===p.id);
                  setPhotoViewerIndex(idx>=0?idx:0);
                }else{
                  setDetailPost(p);
                }
              }
            }}>
            {p.is_private&&!isNative?<PrivateLockedTile T={T}/>:p.img||p.media_urls?.[0]
              ?<img src={p.img||p.media_urls[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:4}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.gold}}>✦</span>
                <p style={{margin:0,fontSize:10,color:T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text||p.title}</p>
              </div>
            }
            {/* Icône vidéo */}
            {p.media_urls?.[0]&&/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.media_urls[0])&&(
              <div style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.6)",borderRadius:6,padding:"2px 6px",fontSize:10,color:"#fff"}}>🎬</div>
            )}
            <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {(p.likes||[]).length}</span>
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
function MsgsTab({convs,getM,onOpen,onDeleteConv,onOpenCeleste,session}){
  const [q,setQ]=useState("");
  const [queueStatuses,setQueueStatuses]=useState(()=>getConvStatuses());
  useEffect(()=>subscribeQueue(()=>setQueueStatuses(getConvStatuses())),[]);
  const [filter,setFilter]=useState("tous");
  const [favorites,setFavorites]=useState(()=>{try{return JSON.parse(localStorage.getItem("celeste_favs")||"[]");}catch{return[];}});
const [pinned,setPinned]=useState(()=>{try{return JSON.parse(localStorage.getItem("celeste_pins")||"[]");}catch{return[];}});
const [menuConvId,setMenuConvId]=useState(null);
const pressTimer=useRef(null);

  const toggleFav=id=>{const next=favorites.includes(id)?favorites.filter(f=>f!==id):[...favorites,id];setFavorites(next);localStorage.setItem("celeste_favs",JSON.stringify(next));};
const togglePin=id=>{const next=pinned.includes(id)?pinned.filter(p=>p!==id):[...pinned,id];setPinned(next);localStorage.setItem("celeste_pins",JSON.stringify(next));};
const openMenu=id=>{setMenuConvId(id);};

  const sorted=useMemo(()=>[...(convs||[])].sort((a,b)=>{
  const aPin=pinned.includes(a.id)?1:0,bPin=pinned.includes(b.id)?1:0;
  if(bPin!==aPin)return bPin-aPin;
  return(b.msgs[b.msgs.length-1]?.ts||0)-(a.msgs[a.msgs.length-1]?.ts||0);
}),[convs,pinned]);

  const convIds=useMemo(()=>(convs||[]).map(c=>c.id),[convs]);
  const typingMap=useTypingIndicatorForConvs(sb,convIds,session?.user?.id);
 

  const filtered=sorted.filter(c=>{
    const u=getM(c.uid);
    if(q&&!matchQuery(u?.fullName,q)&&!matchQuery(u?.paroisse,q))return false;
    if(filter==="nonlus")return(c.msgs||[]).some(m=>m.f!=="me"&&!m.read);
    if(filter==="favoris")return favorites.includes(c.id);
    return true;
  });

  const fmtTime=ts=>{
    if(!ts)return"";
    const d=new Date(ts),now=new Date();
    const diff=now-d;
    if(diff<86400000)return d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    if(diff<172800000)return"Hier";
    return d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","");
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:T.bg,position:"relative"}}>
      <InstallBanner/>
      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:10,background:T.bg,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,padding:"14px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:400,color:T.text,flex:1}}>Messages <span style={{fontSize:18}}>✦</span></h2>
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
        <div style={{display:"flex",gap:8,paddingBottom:12,overflowX:"auto"}}>
          {[{k:"tous",l:"Tous"},{k:"nonlus",l:"Non lus"},{k:"favoris",l:"Favoris"}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{flexShrink:0,padding:"7px 16px",borderRadius:20,border:`1px solid ${filter===f.k?T.gold:T.border}`,background:"transparent",color:filter===f.k?T.goldL:T.muted,fontSize:13,fontWeight:filter===f.k?700:400,cursor:"pointer",transition:"all .2s"}}>
              {f.l}
              {f.k==="nonlus"&&sorted.some(c=>(c.msgs||[]).some(m=>m.f!=="me"&&!m.read))&&<span style={{width:7,height:7,borderRadius:"50%",background:"#4A90D9",display:"inline-block",marginLeft:5,verticalAlign:"middle"}}/>}
            </button>
          ))}
        </div>
      </div>

      {/* Liste conversations */}
      <div style={{maxWidth:640,margin:"0 auto",padding:"8px 0 80px"}}>
        {filtered.length===0&&(
          <div style={{textAlign:"center",padding:"80px 20px",color:T.muted}}>
            <div style={{marginBottom:16,display:"flex",justifyContent:"center",opacity:.3}}><Mail size={48}/></div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>Aucune conversation</p>
            <p style={{fontSize:13,marginTop:8}}>Connectez-vous avec d'autres membres</p>

          </div>
        )}
        {filtered.map(c=>{
          const u=getM(c.uid);
          const last=c.msgs[c.msgs.length-1];
          const unreads=(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length;
          const previewIcon=!last?null:last.type==="photo"?<Image size={13}/>:last.type==="file"?<Paperclip size={13}/>:last.type==="voice"?<Mic size={13}/>:null;
          const prev=!last?"":last.type==="photo"?"Photo":last.type==="file"?(last.fileName||"Fichier"):last.type==="voice"?"Message vocal":last.f==="me"?`Toi : ${last.text||""}`:last.text||"";
          const isFav=favorites.includes(c.id);
          const peerStatus=typingMap[c.id]||null;
          const isTyping=peerStatus==="typing";
          const isRecording=peerStatus==="recording";
          
          return(
  
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",transition:"background .15s",background:"transparent"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              onClick={()=>menuConvId?setMenuConvId(null):onOpen(c.id)}
onContextMenu={e=>{e.preventDefault();openMenu(c.id);}}
onTouchStart={e=>{const startY=e.touches[0].clientY;const startX=e.touches[0].clientX;pressTimer.current=setTimeout(()=>openMenu(c.id),600);e.currentTarget._startY=startY;e.currentTarget._startX=startX;}}
onTouchMove={e=>{const dy=Math.abs(e.touches[0].clientY-(e.currentTarget._startY||0));const dx=Math.abs(e.touches[0].clientX-(e.currentTarget._startX||0));if(dy>10||dx>10)clearTimeout(pressTimer.current);}}
onTouchEnd={()=>clearTimeout(pressTimer.current)}>
              {/* Avatar */}
              <div style={{position:"relative",flexShrink:0}}>
                <Av u={u} size={52}/>
                {u?.isOnline&&<div style={{position:"absolute",bottom:1,right:1,width:12,height:12,borderRadius:"50%",background:"#22c55e",border:"2px solid #000"}}/>}
                {pinned.includes(c.id)&&<Pin size={12} color={T.gold} style={{position:"absolute",top:8,right:36}}/>}
                {queueStatuses[c.id]==="error"&&<div style={{position:"absolute",top:0,right:0,width:12,height:12,borderRadius:"50%",background:"#e05252",border:"2px solid "+T.bg}}/>}
              </div>
              
              {/* Infos */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <p style={{margin:0,fontSize:14,fontWeight:unreads>0?700:500,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u?.name||"?"}</p>
                    {isFav&&<span style={{fontSize:12}}>⭐</span>}
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
              {/* Chevron */}
              <ChevronRight size={16} color={T.muted} style={{flexShrink:0}}/>
            </div>
          );
        })}
      </div>
{menuConvId&&(
  <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setMenuConvId(null)}>
    <div style={{width:"100%",maxWidth:480,background:T.bg2,borderRadius:"24px 24px 0 0",padding:"20px 0 40px"}} onClick={e=>e.stopPropagation()}>
      <div style={{width:36,height:4,borderRadius:2,background:T.border,margin:"0 auto 20px"}}/>
      {[
        {ic:<Star size={20}/>,label:favorites.includes(menuConvId)?"Retirer des favoris":"Ajouter aux favoris",action:()=>{toggleFav(menuConvId);setMenuConvId(null);}},
        {ic:<Pin size={20}/>,label:pinned.includes(menuConvId)?"Désépingler":"Épingler",action:()=>{togglePin(menuConvId);setMenuConvId(null);}},
        {ic:<Trash2 size={20}/>,label:"Supprimer (pour moi)",action:()=>{onDeleteConv(menuConvId);setMenuConvId(null);},danger:true},
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
const DEEPSEEK_KEY=import.meta.env.VITE_DEEPSEEK_KEY;
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
le badge certifié (2000 FCFA / 40 jours), le support 
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
- Coûte  2000 FCFA pour 40 jours
- Donne accès aux thèmes premium, stats de vues, confidentialité avancée, publications prioritaires
- Permet de générer des gains quotidiens grâce à tes posts et likes reçus


LES THÈMES :
- Gratuits : Noir Doré, Blanc Doré
- Premium : WhatsApp, Facebook, TikTok, Snapchat, YouTube, Google, Bleu Nuit, Vert Foncé

COMPTE EN ATTENTE :
- Après inscription, un admin vérifie le profil sous 24–48h
- La vérification se fait via réseaux sociaux ou WhatsApp

CONTACT & SUPPORT :
- Email : mrdesetoiles@gmail.com
- WhatsApp : +242 067 131 327

TON RÔLE :
Réponds aux questions des utilisateurs sur l'app avec simplicité et bienveillance. Si tu ne sais pas quelque chose de précis, invite l'utilisateur à contacter le support.`;

function VoicePlayer({src,mine}){
  const [playing,setPlaying]=useState(false);
  const [progress,setProgress]=useState(0);
  const [duration,setDuration]=useState(0);
  const [speed,setSpeed]=useState(1);
  const audioRef=useRef(null);
  const fmt=s=>{if(!s||isNaN(s))return"0:00";const m=Math.floor(s/60),sec=Math.floor(s%60);return`${m}:${sec.toString().padStart(2,"0")}`;};
  useEffect(()=>{
    const a=new Audio(src);
    a.playbackRate=speed;
    audioRef.current=a;
    a.onloadedmetadata=()=>setDuration(a.duration);
    a.ontimeupdate=()=>setProgress(a.duration?a.currentTime/a.duration*100:0);
    a.onended=()=>{setPlaying(false);setProgress(0);};
    return()=>{a.pause();a.src="";};
  },[src]);
  useEffect(()=>{if(audioRef.current)audioRef.current.playbackRate=speed;},[speed]);
  const toggle=()=>{
    const a=audioRef.current;if(!a)return;
    if(playing){a.pause();setPlaying(false);}
    else{a.play();setPlaying(true);}
  };
  const cycleSpeed=e=>{
    e.stopPropagation();
    setSpeed(s=>s===1?1.5:s===1.5?2:1);
  };
  const seek=e=>{
    const a=audioRef.current;if(!a||!duration)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const pct=(e.clientX-rect.left)/rect.width;
    a.currentTime=pct*duration;
  };
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:180,padding:"4px 0"}}>
      <button onClick={toggle} style={{width:36,height:36,borderRadius:"50%",background:mine?"rgba(0,0,0,0.15)":"rgba(201,149,42,0.15)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:mine?"#000":T.goldL}}>
        {playing
          ?<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          :<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        }
      </button>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
        <div onClick={seek} style={{height:3,background:mine?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.12)",borderRadius:2,cursor:"pointer",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress}%`,background:mine?"rgba(0,0,0,0.5)":T.goldL,borderRadius:2,transition:"width 0.1s linear"}}/>
        </div>
        <span style={{fontSize:10,color:mine?"rgba(0,0,0,0.5)":T.muted}}>{fmt(audioRef.current?.currentTime||0)} / {fmt(duration)}</span>
      </div>
      <button onClick={cycleSpeed} style={{fontSize:11,fontWeight:700,color:mine?"rgba(0,0,0,0.65)":T.goldL,background:mine?"rgba(0,0,0,0.14)":"rgba(201,149,42,0.15)",border:"none",borderRadius:10,padding:"3px 7px",cursor:"pointer",flexShrink:0,lineHeight:1.4}}>{speed}×</button>
    </div>
  );
}

function ChatScreen({conv,myProfile,session,members,reload,notify,onImageView,onOpenProfile,onBack}){
const [selectedMsg,setSelectedMsg]=useState(null);
const [showGemini,setShowGemini]=useState(false);
const [cropSrc,setCropSrc]=useState(null);
const [cropResolve,setCropResolve]=useState(null);
const [videoTrimSrc,setVideoTrimSrc]=useState(null);
const [openStickerDetail,setOpenStickerDetail]=useState(null);
const [geminiMsgs,setGeminiMsgs]=useState(()=>{try{const c=localStorage.getItem("celeste_ia_history");return c?JSON.parse(c):[];}catch(e){return[];}});
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
    const res=await fetch("https://api.deepseek.com/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${DEEPSEEK_KEY}`},
      body:JSON.stringify({
        model:"deepseek-chat",
        messages:formattedMessages
      })
    });
    const data=await res.json();
    const reply=data.choices?.[0]?.message?.content||"Je n'ai pas pu répondre.";
    const updated=[...updatedMsgs,{role:"model",text:reply}];
    setGeminiMsgs(updated);
    try{localStorage.setItem("celeste_ia_history",JSON.stringify(updated.slice(-20)));}catch(e){}
  }catch{
    setGeminiMsgs(p=>[...p,{role:"model",text:"Une erreur est survenue, réessaie."}]);
  }finally{
    setGeminiLoading(false);
  }
};
  const {chatDrafts,setChatDrafts}=useApp();
  const user=(members||[]).find(m=>m.id===conv.uid)||{name:"…",initials:"?",color:"#888"};
  const offline=!navigator.onLine;
  const [inp,setInp]=useState(()=>chatDrafts?.[conv.id]||""); const [attach,setAttach]=useState(false);
  const [recording,setRecording]=useState(false); const [recordSecs,setRecordSecs]=useState(0);
  const [recPaused,setRecPaused]=useState(false);
  const [recInitializing,setRecInitializing]=useState(false);
  const cancelledInitRef=useRef(false);
  const [bgPhoto,setBgPhoto]=useState(null);
  const [sendingMsgs,setSendingMsgs]=useState(()=>getQueueForConv(conv.id).map(q=>({id:q.tempId,...q.payload,f:"me",ts:q.ts,sending:q.status!=="error",error:q.status==="error"})));
useEffect(()=>subscribeQueue(()=>{
  setSendingMsgs(getQueueForConv(conv.id).map(q=>({id:q.tempId,...q.payload,f:"me",ts:q.ts,sending:q.status!=="error",error:q.status==="error"})));
}),[conv.id]);
  const bottomRef=useRef(); const fRef=useRef(); const iRef=useRef(); const bgRef=useRef();
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
          reload();
        })
       .on("postgres_changes",{event:"DELETE",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},()=>reload())
.on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conv_id=eq.${conv.id}`},()=>reload())
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

  const lastMsgId=conv.msgs[conv.msgs.length-1]?.id;
  useEffect(()=>{
    if(isFirstLoad.current){bottomRef.current?.scrollIntoView({behavior:"instant"});isFirstLoad.current=false;}
    else bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[lastMsgId]);
  useEffect(()=>{isFirstLoad.current=true;},[conv.id]);

  useEffect(()=>{
    const unread=(conv.msgs||[]).filter(m=>m.f!=="me"&&m.f!==session?.user?.id&&!m.read);
    if(unread.length===0)return;
    const ids=unread.map(m=>m.id);
    sb.from("messages").update({is_read:true}).in("id",ids).then(()=>reload());
  },[conv.id,conv.msgs?.length]);

  useEffect(()=>{
    sb.from("profiles").select("screenshot_protection").eq("id",conv.uid).single()
      .then(({data})=>{
        if(data?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
      });
    const ch=sb.channel(`privacy_chat_${conv.uid}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles",filter:`id=eq.${conv.uid}`},payload=>{
        if(payload.new?.screenshot_protection)enableScreenProtection();else disableScreenProtection();
      })
      .subscribe();
    return()=>{sb.removeChannel(ch);disableScreenProtection();};
  },[conv.uid]);

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
    const myBadge=myProfile?.badge;
    if(myBadge==="confirmed"||myBadge==="friend"){
      notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><BellOff size={14}/>Cette personne ne souhaite pas recevoir de messages</span>);
    } else {
      notify(<span style={{display:"inline-flex",alignItems:"center",gap:6}}><Lock size={14}/>Cette fonctionnalité est réservée aux membres certifiés ✦</span>);
    }
    return null;
  }
}
    const{data}=await sb.from("conversations").select("id").or(`and(user1_id.eq.${session?.user?.id},user2_id.eq.${conv.uid}),and(user1_id.eq.${conv.uid},user2_id.eq.${session?.user?.id})`).maybeSingle();
    if(data)return data.id;
    const{data:created}=await sb.from("conversations").insert({user1_id:session?.user?.id,user2_id:conv.uid}).select().single();
    return created?.id;
  };

  const sendMsg=async payload=>{
  let convId=conv.id;
  if(navigator.onLine){
    try{ convId=await ensureConv()||conv.id; }catch(e){ convId=conv.id; }
  }
  if(!convId)return;
  enqueueMessage(convId,session?.user?.id,payload);
  setAttach(false);playChatSound("send");
  processQueue(sb,notify).then(reload);
};

  const [sending,setSending]=useState(false);
  const [showStickerPicker,setShowStickerPicker]=useState(false);
  const sendTxt=async()=>{
    if(!inp.trim()||sending)return;
    if(editingMsg){
      const txt=inp.trim();
      setInp(""); setChatDrafts(d=>({...d,[conv.id]:""})); setEditingMsg(null);
      await editMessage(sb,editingMsg.id,txt); reload();
      return;
    }
    const txt=inp.trim();
    setInp("");
    setChatDrafts(d=>({...d,[conv.id]:""}));
    setSending(true);
    const replyPayload=replyTo?{reply_to_id:replyTo.id,reply_to_text:replyTo.text||"",reply_to_author:replyTo.authorName||""}:{};
    try{await sendMsg({type:"text",text:txt,...replyPayload});}finally{setSending(false);setReplyTo(null);}
  };
  const sendSticker=async(sticker)=>{
    setShowStickerPicker(false);
    await sendMsg({type:"sticker",text:"",file_url:sticker.url,sticker_id:sticker.id});
    Promise.resolve(sb.rpc("increment_sticker_usage",{sticker_id:sticker.id})).catch(()=>{});
  };

const cropImage=src=>new Promise(resolve=>{
    setCropSrc(src);
    setCropResolve({fn:resolve});
  });

const handleFile=async(e,isImg)=>{
    let f=e.target.files[0]; if(!f)return;
    const input=e.target;
    if(f.size>50*1024*1024){notify("Fichier trop lourd (max 50MB)");return;}
    // Recadrage image
    if(isImg&&f.type.startsWith("image/")){
      const reader=new FileReader();
      const src=await new Promise(res=>{reader.onload=ev=>res(ev.target.result);reader.readAsDataURL(f);});
      const croppedFile=await cropImage(src);
      if(croppedFile)f=croppedFile;
    }
    // Trimmer vidéo
    if(f.type.startsWith("video/")){
      const src=await new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);});
      const trimData=await new Promise(resolve=>setVideoTrimSrc({src,resolve}));
      setVideoTrimSrc(null);
      if(!trimData){input.value="";return;}
      if(trimData.file)f=trimData.file;
    }
    const tempId="tmp_file_"+Date.now();
    const fileType=f.type.startsWith("video/")?"video":isImg?"photo":"file";
    setSendingMsgs(p=>[...p,{id:tempId,type:fileType,fileName:f.name,f:"me",ts:Date.now(),sending:true,pct:0}]);
    const convId=await ensureConv();
    if(!convId){setSendingMsgs(p=>p.filter(m=>m.id!==tempId));input.value="";return;}
    const senderUid=session?.user?.id;
    const fileName=f.name;
    (async()=>{
      let publicUrl;
      try{
        publicUrl=await uploadToR2(f,"messages",pct=>{setSendingMsgs(p=>p.map(m=>m.id===tempId?{...m,pct}:m));});
      }catch(err){
        notify("Erreur upload: "+err.message);
        setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
        return;
      }
      let error,attempt=0;
      while(attempt<3){
        const res=await sb.from("messages").insert({conv_id:convId,sender_id:senderUid,type:fileType,file_url:publicUrl,file_name:fileName,text:""});
        error=res.error;
        if(!error)break;
        attempt++;
        await new Promise(r=>setTimeout(r,1500*attempt));
      }
      setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
      if(error){notify("❌ Message non envoyé — vérifie ta connexion");return;}
      playChatSound("send");
      reload();
    })();
    input.value="";
  };

  const handleBgPhoto=e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();r.onload=ev=>{setBgPhoto(ev.target.result);try{localStorage.setItem(`chat_bg_${conv.id}`,ev.target.result);}catch(_){}};r.readAsDataURL(f);
  };

  const startRecording=async()=>{
    cancelledInitRef.current=false;
    setRecording(true);setRecordSecs(0);setRecInitializing(true);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(cancelledInitRef.current){stream.getTracks().forEach(t=>t.stop());return;}
      const mimeType=MediaRecorder.isTypeSupported("audio/mp4")?"audio/mp4":MediaRecorder.isTypeSupported("audio/webm;codecs=opus")?"audio/webm;codecs=opus":MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"audio/ogg";
      const recOpts=mimeType?{mimeType}:{};
      const rec=new MediaRecorder(stream,recOpts); const chunks=[];
      rec.ondataavailable=e=>{if(e.data&&e.data.size>0)chunks.push(e.data);};
      rec.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunks,{type:mimeType||"audio/webm"});
        const tempId="tmp_voice_"+Date.now();
        setSendingMsgs(p=>[...p,{id:tempId,type:"voice",f:"me",ts:Date.now(),sending:true,pct:0}]);
        const convId=await ensureConv();
        if(!convId){setSendingMsgs(p=>p.filter(m=>m.id!==tempId));return;}
        const senderUid=session?.user?.id;
        (async()=>{
          let publicUrl;
          try{
            const ext=mimeType.includes("mp4")?"m4a":mimeType.includes("ogg")?"ogg":"webm";
            const audioFile=new File([blob],`voice_${Date.now()}.${ext}`,{type:mimeType});
            publicUrl=await uploadToR2(audioFile,"messages",pct=>{setSendingMsgs(p=>p.map(m=>m.id===tempId?{...m,pct}:m));});
          }catch(e){
            notify("Erreur upload vocal");
            setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
            return;
          }
          const{error}=await sb.from("messages").insert({conv_id:convId,sender_id:senderUid,type:"voice",file_url:publicUrl,text:""});
          setSendingMsgs(p=>p.filter(m=>m.id!==tempId));
          if(error){notify("Erreur d'envoi, réessayez");return;}
          playChatSound("send");
          reload();
        })();
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
    if(mediaRecRef.current){mediaRecRef.current.ondata=null;mediaRecRef.current.onstop=null;mediaRecRef.current.stop();}
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
  const deleteMsg=async msgId=>{if(!window.confirm("Supprimer ?"))return;await sb.from("messages").delete().eq("id",msgId);reload();};

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
    sb={sb}
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
<div style={{position:"relative",zIndex:1,background:"rgba(0,0,0,0.92)",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid rgba(255,255,255,0.08)`,padding:"3px 10px",paddingTop:"calc(3px + env(safe-area-inset-top,0px))",display:"flex",alignItems:"center",gap:6,flexShrink:0,minHeight:0}}>
  <Btn onClick={()=>onBack&&onBack()} style={{color:T.gold,padding:"6px 2px 6px 0",display:"flex",alignItems:"center",flexShrink:0}}><ChevronLeft size={22}/></Btn>
  <div style={{position:"relative",flexShrink:0}}>
    <Av u={user} size={26} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}/>
    {user.online&&<span style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:"#3DB654",border:"2px solid #000"}}/>}
  </div>
  <div style={{flex:1,cursor:"pointer",minWidth:0}} onClick={()=>onOpenProfile&&onOpenProfile(user.id)}>
    <p style={{margin:0,fontSize:14,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.fullName||user.name}</p>
    <p style={{margin:0,fontSize:11,color:user.online?"#3DB654":T.muted}}>
      {user.online?"En ligne ✦":user.paroisse||"Hors ligne"}
    </p>
  </div>
 
  <Btn onClick={()=>bgRef.current.click()} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center"}}><Image size={20}/></Btn>
  <Btn onClick={()=>setSearchOpen(s=>!s)} style={{color:T.muted,padding:"6px",display:"flex",alignItems:"center"}}><Search size={20}/></Btn>
</div>

{searchOpen&&<ChatSearchBar T={T} value={searchQuery} onChange={setSearchQuery} onClose={()=>{setSearchOpen(false);setSearchQuery("");}} resultCount={filterMessagesByQuery(conv.msgs,searchQuery).length}/>}

      {/* Messages */}
      <div style={{position:"relative",zIndex:1,flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
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
<SwipeToReply message={m} mine={mine} onReply={msg=>setReplyTo({id:msg.id,text:msg.text,authorName:(msg.f==="me"||msg.f===session?.user?.id)?"Vous":user.name})}>
<div
  onClick={m.error?()=>retryMessage(sb,m.id,notify).then(reload):doubleTap}
  onMouseDown={e=>{const t=setTimeout(()=>setSelectedMsg(m),500);e.currentTarget._lpm=t;}}
  onMouseUp={e=>{clearTimeout(e.currentTarget._lpm);}}
  onMouseLeave={e=>{clearTimeout(e.currentTarget._lpm);}}
  onContextMenu={e=>{e.preventDefault();setSelectedMsg(m);}}
  onTouchStart={e=>{const startY=e.touches[0].clientY;const t=setTimeout(()=>setSelectedMsg(m),500);e.currentTarget._lpt=t;e.currentTarget._startY=startY;}}
  onTouchMove={e=>{const dy=Math.abs(e.touches[0].clientY-(e.currentTarget._startY||0));if(dy>8)clearTimeout(e.currentTarget._lpt);}}
  onTouchEnd={e=>{clearTimeout(e.currentTarget._lpt);}}>
               <div style={{
  background:m.type==="sticker"?"transparent":(mine?T.gradGold:"rgba(255,255,255,0.09)"),
  borderRadius:m.type==="sticker"?0:(mine?"18px 18px 4px 18px":"18px 18px 18px 4px"),
  padding:m.type==="sticker"?0:"10px 14px",
  border:m.type==="sticker"?"none":(mine?"none":`1px solid ${T.border}`),
  boxShadow:m.type==="sticker"?"none":(mine?"0 4px 20px rgba(201,149,42,0.25)":"0 2px 8px rgba(0,0,0,0.3)")
}}>
                  <HeartBurst show={burstMsgId===m.id}/>
                  <MessageReplyQuote message={m} mine={mine} T={T} onClick={()=>m.reply_to_id&&scrollToMessage(m.reply_to_id)}/>
                  {m.type==="status_reply"&&(
  <div style={{marginBottom:6}}>
    <div onClick={()=>{if(!m.reply_metadata?.statusId)return;window.dispatchEvent(new CustomEvent("celeste_close_conv"));window.__celesteSetTab?.("statuses");setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_status",{detail:{statusId:m.reply_metadata.statusId}})),400);}} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.06)",borderRadius:10,padding:"6px 8px",borderLeft:`3px solid ${mine?"rgba(0,0,0,0.3)":T.goldL}`,marginBottom:4,cursor:m.reply_metadata?.statusId?"pointer":"default"}}>
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
                  {(m.type==="photo"||m.type==="image")&&(m.img||m.file_url)&&<MediaPlayer url={m.img||m.file_url} style={{borderRadius:10,maxHeight:200}} onImageClick={onImageView}/>}
                  {m.type==="sticker"&&(m.img||m.file_url)&&<img src={m.img||m.file_url} alt="" onClick={e=>{e.stopPropagation();m.sticker_id&&setOpenStickerDetail(m.sticker_id);}} style={{width:100,height:100,objectFit:"contain",display:"block",cursor:m.sticker_id?"pointer":"default"}}/>}
                  {m.type==="file"&&(m.img||m.file_url)&&<Btn onClick={()=>window.open(m.img||m.file_url,"_blank")} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
                    <span style={{display:"flex",flexShrink:0}}>{(m.fileName||"").match(/\.pdf$/i)?<FileText size={22} color={T.goldL}/>:(m.fileName||"").match(/\.(doc|docx)$/i)?<FileText size={22} color={T.goldL}/>:<Paperclip size={22} color={T.goldL}/>}</span>
                    <span style={{fontSize:12,fontWeight:600,color:mine?"#000":T.text,wordBreak:"break-all"}}>{m.fileName||"Fichier"}</span>
                  </Btn>}
                  {m.type==="voice"&&(m.img||m.file_url)&&<VoicePlayer src={m.img||m.file_url} mine={mine}/>}
{m.type==="video"&&(m.img||m.file_url)&&<video src={m.img||m.file_url} controls playsInline style={{borderRadius:10,maxWidth:"100%",maxHeight:220,display:"block",background:"#000"}}/>}
                  {m.text&&<><p style={{margin:0,fontSize:14,fontWeight:600,color:mine?"#000":T.text,lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{renderTextWithMentions(m.text)}<EditedBadge message={m} T={T}/></p><TranslateBtn text={m.text} dark={mine}/></>}
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
{mine&&m.error&&<span style={{fontSize:10,color:"#e05252",fontWeight:600}}>⚠️ Réessayer</span>}
{mine&&!isSending&&!m.error&&<CheckCheck size={13} color={isRead?T.gold:T.muted} style={{transition:"color .3s"}}/>}
                  {mine&&!isSending&&<Btn onClick={()=>deleteMsg(m.id)} style={{color:T.muted,opacity:.4,padding:0,display:"flex",alignItems:"center"}}><Trash2 size={10}/></Btn>}
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
      <div style={{position:"relative",zIndex:2,background:T.bg2,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,padding:"10px 12px",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px))",flexShrink:0}}>
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
  <Btn onClick={()=>setShowStickerPicker(v=>!v)} style={{color:showStickerPicker?T.goldL:T.muted,padding:"6px",display:"flex",alignItems:"center",flexShrink:0,background:"rgba(255,255,255,0.06)",borderRadius:"50%",width:36,height:36,justifyContent:"center"}}><StickerIcon size={18}/></Btn>
  {showStickerPicker&&(
    <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,width:300,maxWidth:"90vw",zIndex:20}}>
      <StickerPicker sb={sb} userId={session?.user?.id} T={T} onClose={()=>setShowStickerPicker(false)} onSelect={sendSticker}/>
    </div>
  )}
  <div style={{flex:1,background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.10)`,borderRadius:22,padding:"9px 14px",transition:"border-color .2s"}}>
    <textarea value={inp} onChange={e=>{
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
        <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end"}} onClick={()=>setSelectedMsg(null)}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:"rgba(16,16,16,0.98)",borderRadius:"22px 22px 0 0",paddingBottom:"env(safe-area-inset-bottom,12px)",animation:"slideUp .2s ease"}}>
            <div style={{display:"flex",justifyContent:"center",gap:10,padding:"14px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              {QUICK_REACTIONS.map(e=>(
                <button key={e} onClick={()=>{toggleReaction(sb,selectedMsg.id,session?.user?.id,e,selectedMsg.reactions).then(()=>reload());setSelectedMsg(null);}}
                  style={{background:"none",border:"none",fontSize:26,cursor:"pointer",padding:4}}>
                  {e}
                </button>
              ))}
            </div>
            {selectedMsg.text&&<div style={{padding:"14px 20px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <p style={{margin:0,fontSize:12,color:T.muted,lineHeight:1.5,maxHeight:50,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{selectedMsg.text}</p>
            </div>}
            <Btn onClick={()=>{setReplyTo({id:selectedMsg.id,text:selectedMsg.text,authorName:(selectedMsg.f==="me"||selectedMsg.f===session?.user?.id)?"Vous":user.name});setSelectedMsg(null);}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.text,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <Reply size={18}/><span>Répondre</span>
            </Btn>
            
            {(selectedMsg.f==="me"||selectedMsg.f===session?.user?.id)&&selectedMsg.text&&(
              <Btn onClick={()=>{setEditingMsg(selectedMsg);setInp(selectedMsg.text);setSelectedMsg(null);}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.text,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <Edit2 size={18}/><span>Modifier</span>
              </Btn>
            )}
            <Btn onClick={()=>{navigator.clipboard.writeText(selectedMsg.text||"");setSelectedMsg(null);notify("Copié !");}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.text,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <Copy size={18}/><span>Copier</span>
            </Btn>
            {(selectedMsg.f==="me"||selectedMsg.f===session?.user?.id)&&(
              <Btn onClick={()=>{deleteMsg(selectedMsg.id);setSelectedMsg(null);}} style={{width:"100%",padding:"15px 20px",fontSize:15,color:T.err,textAlign:"left",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <Trash2 size={18}/><span>Supprimer</span>
              </Btn>
            )}
            <Btn onClick={()=>setSelectedMsg(null)} style={{width:"100%",padding:"14px 20px",fontSize:14,color:T.muted,textAlign:"center"}}>Annuler</Btn>
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
      </div>
    </div>
  );
}

// ── USER VIEW ─────────────────────────────────────────────
function UserView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,myFollowers,onConnectionChange,onImageView,userPostsVersion=0,toggleLike,toggleSave,popNav}){
  const conn=(myConnections||[]).includes(user.id);
  const [followersCount,setFollowersCount]=useState("…");
  const [followingCount,setFollowingCount]=useState("…");
  const [blocked,setBlocked]=useState(false);
  const [blockedByOther,setBlockedByOther]=useState(false);
   const [showReport,setShowReport]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
  const [coverUrl,setCoverUrl]=useState(user.cover_url||null);
  const [avatarUrl,setAvatarUrl]=useState(user.avatar_url||null);

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
    if(!window.confirm(blocked?"Débloquer ?":"Bloquer ?"))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");onConnectionChange?.();}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");onConnectionChange?.();}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:[],is_private:data.is_private||false,ts:new Date(data.created_at).getTime()};
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
 const [userReelsIndex,setUserReelsIndex]=useState(null);
  const [photoViewerIndex,setPhotoViewerIndex]=useState(null);
  const [userReelsCommentPost,setUserReelsCommentPost]=useState(null);
  const [userReelsCloseCallback,setUserReelsCloseCallback]=useState(null);
  const [photoCommentPost,setPhotoCommentPost]=useState(null);
  const [photoCloseCallback,setPhotoCloseCallback]=useState(null);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [reelsViewerFallback,setReelsViewerFallback]=useState(null);
  const [photoViewerFallback,setPhotoViewerFallback]=useState(null);
  const loadUPosts=useCallback(async()=>{
    const{data}=await sb.from("posts").select(`*,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse),likes(user_id),comments(id)`).eq("author_id",user.id).order("created_at",{ascending:false});
   if(data){
     const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],is_private:p.is_private||false,likes:(p.likes||[]).map(l=>l.user_id),comments:[],ts:new Date(p.created_at).getTime(),profile_pinned:p.profile_pinned||false,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null}));
     mapped.sort((a,b)=>(b.profile_pinned?1:0)-(a.profile_pinned?1:0));
     setUPosts(mapped);
   }
  },[user.id]);
  useEffect(()=>{
    loadUPosts();
  },[user.id,userPostsVersion]);
const openPostFromSound=(post,soundPosts)=>{
  const list=soundPosts||[post];
  const isVidFn=q=>q.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(q.img)||q.img.includes("video"));
  if(isVidFn(post)){
    const vids=list.filter(isVidFn);
    const idx=vids.findIndex(q=>q.id===post.id);
    setReelsViewerFallback(vids);
    setUserReelsIndex(idx>=0?idx:0);
  }else{
    const photos=list.filter(q=>!isVidFn(q));
    const idx=photos.findIndex(q=>q.id===post.id);
    setPhotoViewerFallback(photos);
    setPhotoViewerIndex(idx>=0?idx:0);
  }
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
      {userReelsIndex!==null&&toggleLike&&toggleSave&&(
        <ReelsViewer
          posts={reelsViewerFallback||uPosts.filter(p=>p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video")))}
          sb={sb}
          startIndex={userReelsIndex}
          onClose={()=>{setUserReelsIndex(null);setReelsViewerFallback(null);}}
          toggleLike={localToggleLike}
          toggleSave={toggleSave}
          session={session}
          myProfile={myProfile}
          notify={notify}
          onUser={()=>{}}
          onOpenComments={(p,onReelsCb)=>{setUserReelsCommentPost(p);setUserReelsCloseCallback(()=>onReelsCb);}}
          myConnections={myConnections}
          onConnect={()=>toggle()}
          onOpenSound={setOpenSoundId}
        />
      )}
      {photoViewerIndex!==null&&toggleLike&&toggleSave&&(
        <PhotoViewer
          posts={photoViewerFallback||uPosts.filter(p=>!(p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video"))))}
          sb={sb}
          startIndex={photoViewerIndex}
          onClose={()=>{setPhotoViewerIndex(null);setPhotoViewerFallback(null);}}
          toggleLike={localToggleLike}
          toggleSave={toggleSave}
          session={session}
          myProfile={myProfile}
          notify={notify}
          onUser={()=>{}}
          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}
          myConnections={myConnections}
          onConnect={()=>toggle()}
          onOpenSound={setOpenSoundId}
        />
      )}
      {openSoundId&&<SoundDetailModal sb={sb} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
      {(userReelsCommentPost||photoCommentPost)&&(
        <CommentsOnlyModal
          post={userReelsCommentPost||photoCommentPost}
          session={session}
          getM={id=>id===user.id?user:myProfile}
          onClose={()=>{
            setUserReelsCommentPost(null);
            setPhotoCommentPost(null);
            if(userReelsCloseCallback){userReelsCloseCallback();setUserReelsCloseCallback(null);}
            if(photoCloseCallback){photoCloseCallback();setPhotoCloseCallback(null);}
          }}
        />
      )}

      <ProfileHeader
        T={T} Av={Av} Badge={Badge} fmtCount={fmtCount}
        coverUrl={coverUrl} color={user.color} avatarShape="circle"
        avatarUrl={avatarUrl} user={user}
        onAvatarClick={()=>{if(avatarUrl)window.dispatchEvent(new CustomEvent("celeste_view_img",{detail:{url:avatarUrl}}));}}
        title={user.fullName||user.name}
        subtitle={<><MapPin size={11}/> {user.paroisse}</>}
        extraLines={user.bio&&<p style={{margin:0,fontSize:14,color:T.sub,lineHeight:1.7}}>{user.bio.split(/(https?:\/\/[^\s]+)/g).map((part,i)=>
          /^https?:\/\//.test(part)
            ?<a key={i} href={part} target="_blank" rel="noreferrer" style={{color:T.goldL,textDecoration:"underline",wordBreak:"break-all"}}>{part}</a>
            :part
        )}</p>}
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

        <p style={{fontSize:10,color:T.muted,letterSpacing:1.5,marginBottom:12,textTransform:"uppercase"}}>Publications ({uPosts.length})</p>
        {uPosts.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8,animation:"float 3s ease infinite"}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucune publication encore</p></div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
            {uPosts.map(p=>(
              <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:p.is_private&&!isNative?"default":"pointer"}} onClick={()=>{
                if(p.is_private&&!isNative)return;
                const isVid=p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video"));
                if(isVid&&toggleLike&&toggleSave){
                  const vidPosts=uPosts.filter(q=>q.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(q.img)||q.img.includes("video")));
                  const idx=vidPosts.findIndex(q=>q.id===p.id);
                  setUserReelsIndex(idx>=0?idx:0);
                }else{
                  const hasPhoto=p.img||(p.media_urls&&p.media_urls.length>0);
                  if(hasPhoto){
                    const photoPosts=uPosts.filter(q=>!(q.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(q.img)||q.img.includes("video")))&&(q.img||(q.media_urls&&q.media_urls.length>0)));
                    const idx=photoPosts.findIndex(q=>q.id===p.id);
                    setPhotoViewerIndex(idx>=0?idx:0);
                  }else{
                    setDetailPost(p);
                  }
                }
              }}>
                {p.is_private&&!isNative?(
                  <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(255,255,255,0.03)"}}>
                    <Lock size={20} color={T.goldL}/>
                    <p style={{margin:0,fontSize:9,color:T.muted,textAlign:"center",padding:"0 8px"}}>Disponible sur l'app</p>
                  </div>
                ):p.img
                  ?<img src={p.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:8,gap:4}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:T.gold}}>✦</span>
                    <p style={{margin:0,fontSize:10,color:T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text||p.title}</p>
                  </div>
                }
                <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {(p.likes||[]).length}</span>
                </div>
                {p.profile_pinned&&(
                  <div style={{position:"absolute",top:6,left:6,background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
                    <Pin size={11} color={T.goldL}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        }
        <div style={{height:80}}/>
      </div>
    </div>
  );
}

// ── ORG VIEW ──────────────────────────────────────────────
function OrgView({user,myProfile,session,posts,onBack,onChat,notify,myConnections,onConnectionChange,onImageView,toggleLike,toggleSave}){
  const conn=(myConnections||[]).includes(user.id);
  const [followersCount,setFollowersCount]=useState("…");
  const [coverPhoto,setCoverPhoto]=useState(user.cover_url||null);
  const [blocked,setBlocked]=useState(false);
  const [blockedByOther,setBlockedByOther]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [detailPost,setDetailPost]=useState(null);
 const [userReelsIndex,setUserReelsIndex]=useState(null);
  const [photoViewerIndex,setPhotoViewerIndex]=useState(null);
  const [reelsCommentPost,setReelsCommentPost]=useState(null);
  const [reelsCloseCallback,setReelsCloseCallback]=useState(null);
  const [photoCommentPost,setPhotoCommentPost]=useState(null);
  const [photoCloseCallback,setPhotoCloseCallback]=useState(null);
  const [reelsViewerFallback,setReelsViewerFallback]=useState(null);
  const [photoViewerFallback,setPhotoViewerFallback]=useState(null);
  const fileRef=useRef(); const coverRef=useRef();

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
    if(!window.confirm(blocked?"Débloquer ?":"Bloquer ?"))return;
    if(blocked){await sb.from("blocks").delete().eq("blocker_id",session?.user?.id).eq("blocked_id",user.id);setBlocked(false);notify("Débloqué");onConnectionChange?.();}
    else{await sb.from("blocks").insert({blocker_id:session?.user?.id,blocked_id:user.id});setBlocked(true);notify("Bloqué");onConnectionChange?.();}
  };

  const handleReport=async(reason,details)=>{
    await sb.from("reports").insert({reporter_id:session?.user?.id,reported_id:user.id,reason,details});
    setShowReport(false);notify("Signalement envoyé ✦");
  };

  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:[],is_private:data.is_private||false,ts:new Date(data.created_at).getTime()};
  };

 const isMe=session?.user?.id===user.id;
  const uPosts=(posts||[]).filter(p=>p.by===user.id);
  const orgTypeLabel={restaurant:"🍽️ Restaurant",hotel:"🏨 Hôtel",musique:"🎵 Musique / Artiste",entreprise:"💼 Entreprise",association:"🤝 Association",ecole:"🎓 École / Université",autre:"📌 Organisation"}[user.org_type]||"📌 Organisation";
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
  const list=soundPosts||[post];
  const isVidFn=q=>q.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(q.img)||q.img.includes("video"));
  if(isVidFn(post)){
    const vids=list.filter(isVidFn);
    const idx=vids.findIndex(q=>q.id===post.id);
    setReelsViewerFallback(vids);
    setUserReelsIndex(idx>=0?idx:0);
  }else{
    const photos=list.filter(q=>!isVidFn(q));
    const idx=photos.findIndex(q=>q.id===post.id);
    setPhotoViewerFallback(photos);
    setPhotoViewerIndex(idx>=0?idx:0);
  }
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
      {userReelsIndex!==null&&toggleLike&&toggleSave&&(
        <ReelsViewer
          posts={reelsViewerFallback||uPosts.filter(p=>p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video")))}
          sb={sb}
          startIndex={userReelsIndex}
          onClose={()=>{setUserReelsIndex(null);setReelsViewerFallback(null);}}
          toggleLike={toggleLike}
          toggleSave={toggleSave}
          session={session}
          myProfile={myProfile}
          notify={notify}
          onUser={()=>{}}
          onOpenComments={(p,onReelsCb)=>{setReelsCommentPost(p);setReelsCloseCallback(()=>onReelsCb);}}
          myConnections={myConnections}
          onConnect={()=>toggle()}
          onOpenSound={setOpenSoundId}
        />
      )}
      {photoViewerIndex!==null&&toggleLike&&toggleSave&&(
        <PhotoViewer
          posts={photoViewerFallback||uPosts.filter(p=>!(p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video")))&&(p.img||(p.media_urls&&p.media_urls.length>0)))}
          sb={sb}
          startIndex={photoViewerIndex}
          onClose={()=>{setPhotoViewerIndex(null);setPhotoViewerFallback(null);}}
          toggleLike={toggleLike}
          toggleSave={toggleSave}
          session={session}
          myProfile={myProfile}
          notify={notify}
          onUser={()=>{}}
          onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}
          myConnections={myConnections}
          onConnect={()=>toggle()}
          onOpenSound={setOpenSoundId}
        />
      )}
      {openSoundId&&<SoundDetailModal sb={sb} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
      {(reelsCommentPost||photoCommentPost)&&(
        <CommentsOnlyModal
          post={reelsCommentPost||photoCommentPost}
          session={session}
          getM={id=>id===user.id?user:myProfile}
          onClose={()=>{
            setReelsCommentPost(null);
            setPhotoCommentPost(null);
            if(reelsCloseCallback){reelsCloseCallback();setReelsCloseCallback(null);}
            if(photoCloseCallback){photoCloseCallback();setPhotoCloseCallback(null);}
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
        title={user.org_name||user.fullName}
        subtitle={<>{orgTypeLabel} · 🌍 {user.org_country||user.paroisse}</>}
        extraLines={<>
          {user.bio&&<p style={{margin:"0 0 10px",fontSize:14,color:T.sub,lineHeight:1.7}}>{renderTextWithMentions(myProfile.bio)}</p>}
          {user.org_desc&&<p style={{margin:"0 0 4px",fontSize:13,color:T.muted,lineHeight:1.6,fontStyle:"italic"}}>{user.org_desc}</p>}
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
        {uPosts.map(p=>{
          const locked=p.is_private&&!isNative&&!isMe;
          return(
          <div key={p.id} style={{background:T.card,borderRadius:18,overflow:"hidden",marginBottom:10,border:`1px solid ${T.border}`,cursor:locked?"default":"pointer"}}
            onClick={()=>{
  if(locked)return;
  const isVid=p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video"));
  if(isVid&&toggleLike&&toggleSave){
    const vidPosts=posts.filter(q=>q.by===user.id&&q.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(q.img)||q.img.includes("video")));
    const idx=vidPosts.findIndex(q=>q.id===p.id);
    setUserReelsIndex(idx>=0?idx:0);
  }else{
    const hasPhoto=p.img||(p.media_urls&&p.media_urls.length>0);
    if(hasPhoto){
      const photoPosts=uPosts.filter(q=>!(q.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(q.img)||q.img.includes("video")))&&(q.img||(q.media_urls&&q.media_urls.length>0)));
      const idx=photoPosts.findIndex(q=>q.id===p.id);
      setPhotoViewerIndex(idx>=0?idx:0);
    }else{
      setDetailPost(p);
    }
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
                  <span style={{fontSize:11,color:T.muted}}>{ago(p.ts)} · ❤ {(p.likes||[]).length}</span>
                </div>
              </>
            }
          </div>
          );
        })}
        <div style={{height:80}}/>
      </div>
    </div>
  );
}
const Toggle=({active})=>(
    <div style={{width:42,height:24,borderRadius:12,background:active?T.gradGold:"rgba(255,255,255,0.1)",border:`1px solid ${T.border}`,position:"relative",transition:"background .3s",flexShrink:0}}>
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

function ParametresModal({myProfile,onLogout,notify,navTheme,onChooseNavTheme}){
  const {session}=useApp();
  const [open,setOpen]=useState(false);
  const [section,setSection]=useState(null);
  const [dnd,setDnd]=useState(false);
  const [discoverable,setDiscoverable]=useState(true);
const [hideOnline,setHideOnline]=useState(false);
const [screenshotProtection,setScreenshotProtection]=useState(false);
  const [mode,setMode]=useState(()=>localStorage.getItem("celeste_theme")||"dark");
const [showBugReport,setShowBugReport]=useState(false);
const [bugText,setBugText]=useState("");
  useEffect(()=>{
    const handler=()=>{setOpen(true);setSection(null);};
    window.addEventListener("celeste_open_params",handler);
    return()=>window.removeEventListener("celeste_open_params",handler);
  },[]);

  useEffect(()=>{
    if(!open||!session?.user?.id)return;
    sb.from("profiles").select("no_messages,is_discoverable,hide_online,screenshot_protection,badge_payment_ref,badge,badge_expires_at")
      .then(async({data})=>{
        if(data){setDnd(!!data.no_messages);setDiscoverable(data.is_discoverable!==false);setHideOnline(!!data.hide_online);setScreenshotProtection(!!data.screenshot_protection);}
        if(data?.badge_payment_ref&&!data?.badge){
          try{
            const res=await fetch(`https://api.chariow.com/v1/sales/${data.badge_payment_ref}`,{
              headers:{"Authorization":"Bearer sk_20hoymvf_531d0d8326423d81026fa2b4b78d6a46"}
            });
            const payment=await res.json();
            const payStatus=payment?.data?.status||payment?.status;
            if(payStatus==="completed"||payStatus==="paid"){
              const expiresAt=new Date();
              expiresAt.setDate(expiresAt.getDate()+40);
              await sb.from("profiles").update({
                badge:"confirmed",
                badge_expires_at:expiresAt.toISOString(),
                badge_payment_ref:null
              }).eq("id",session.user.id);
              const{data:cfg}=await sb.from("app_settings").select("value").eq("key","platform_cut_percent").maybeSingle();
              const cutPercent=cfg?.value?Number(cfg.value):20;
              const totalAmount=2000;
              const platformCut=Math.round(totalAmount*cutPercent/100);
              const poolShare=totalAmount-platformCut;
              const month=new Date().toISOString().slice(0,7);
const{data:existingPool}=await sb.from("badge_pool").select("*").eq("month",month).maybeSingle();
if(existingPool){
  await sb.from("badge_pool").update({
    total_collected:existingPool.total_collected+totalAmount,
    platform_cut:existingPool.platform_cut+platformCut,
    pool_amount:existingPool.pool_amount+poolShare
  }).eq("month",month);
}else{
  await sb.from("badge_pool").insert({month,total_collected:totalAmount,platform_cut:platformCut,pool_amount:poolShare,distributed:false});
}
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
    notify(next?"🔕 Messages bloqués":"✅ Messages activés");
  };

  const toggleDiscoverable=async()=>{
    const next=!discoverable;
    setDiscoverable(next);
    await sb.from("profiles").update({is_discoverable:next}).eq("id",session.user.id);
    notify(next?"Profil visible":"Profil masqué");
  };
  const toggleHideOnline=async()=>{
    const next=!hideOnline;
    setHideOnline(next);
    await sb.from("profiles").update({hide_online:next}).eq("id",session.user.id);
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
      onClick={()=>{setOpen(false);setSection(null);}}>
      <div
        style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",padding:"28px 20px 48px",animation:"slideUp .35s ease"}}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          {section&&(
            <Btn onClick={()=>setSection(null)} style={{color:T.gold,display:"flex"}}>
              <ChevronLeft size={22}/>
            </Btn>
          )}
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
            <Btn onClick={()=>setShowBugReport(true)} style={{width:"100%",padding:"14px",background:"rgba(255,100,50,0.06)",border:"1px solid rgba(255,100,50,0.2)",borderRadius:14,color:"#FF6432",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}>
              <span>🐛</span>Signaler un bug
            </Btn>
            <Btn onClick={()=>{setOpen(false);setTimeout(()=>{if(window.confirm("Se déconnecter ?"))onLogout();},200);}}
              style={{width:"100%",padding:"14px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <LogOut size={18}/>Se déconnecter
            </Btn>
          </>
        )}
        {showBugReport&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowBugReport(false)}>
  <div style={{background:"#1a1a1a",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:500}} onClick={e=>e.stopPropagation()}>
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
        setShowBugReport(false);
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
    {myProfile?.badge?(
      <Btn onClick={toggleDiscoverable}
        style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
        <Eye size={20} color={T.goldL}/>
        <div style={{flex:1,textAlign:"left"}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Visible dans Découvrir</p>
          <p style={{margin:0,fontSize:11,color:T.muted}}>{discoverable?"Votre profil est visible":"Votre profil est masqué"}</p>
        </div>
        <Toggle active={discoverable}/>
      </Btn>
    ):(
      <div style={{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,opacity:0.5}}>
        <Eye size={20} color={T.muted}/>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Visible dans Découvrir</p>
          <p style={{margin:0,fontSize:11,color:T.gold}}>🔒 Réservé aux membres certifiés</p>
        </div>
        <Toggle active={true}/>
      </div>
    )}

    {/* Bloquer les messages — badge uniquement */}
    {myProfile?.badge?(
      <Btn onClick={toggleDnd}
        style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:20}}>🔕</span>
        <div style={{flex:1,textAlign:"left"}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Bloquer les messages</p>
          <p style={{margin:0,fontSize:11,color:T.muted}}>{dnd?"Personne ne peut vous écrire":"Tout le monde peut vous écrire"}</p>
        </div>
        <Toggle active={dnd}/>
      </Btn>
    ):(
      <div style={{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,opacity:0.5}}>
        <span style={{fontSize:20}}>🔕</span>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Bloquer les messages</p>
          <p style={{margin:0,fontSize:11,color:T.gold}}>🔒 Réservé aux membres certifiés</p>
        </div>
        <Toggle active={false}/>
      </div>
    )}

    {/* Masquer présence en ligne — badge uniquement */}
    {myProfile?.badge?(
      <Btn onClick={toggleHideOnline}
        style={{width:"100%",padding:"14px 16px",background:T.card,border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12}}>
        <Eye size={20} color={T.goldL}/>
        <div style={{flex:1,textAlign:"left"}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Masquer ma présence</p>
          <p style={{margin:0,fontSize:11,color:T.muted}}>{hideOnline?"Personne ne voit votre point vert":"Votre statut en ligne est visible"}</p>
        </div>
        <Toggle active={hideOnline}/>
      </Btn>
    ):(
      <div style={{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,opacity:0.5}}>
        <Eye size={20} color={T.muted}/>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Masquer ma présence</p>
          <p style={{margin:0,fontSize:11,color:T.gold}}>Réservé aux membres certifiés</p>
        </div>
        <Toggle active={false}/>
      </div>
    )}
{/* Protection captures d'écran — badge uniquement */}
{myProfile?.badge?(
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
):(
  <div style={{width:"100%",padding:"14px 16px",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,borderRadius:14,display:"flex",alignItems:"center",gap:12,opacity:0.5}}>
    <Eye size={20} color={T.muted}/>
    <div style={{flex:1}}>
      <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Protéger mon contenu</p>
      <p style={{margin:0,fontSize:11,color:T.gold}}>🔒 Réservé aux membres certifiés</p>
    </div>
    <Toggle active={false}/>
  </div>
)}
    {/* Céleste Match — activer/désactiver */}
    <MatchPrivacyToggle session={session} notify={notify} myProfile={myProfile}/>

    {/* Message d'info pour ceux sans badge */}
    {!myProfile?.badge&&(
      <div style={{background:T.goldBg,border:`1px solid ${T.gold}33`,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:18}}>✦</span>
        <p style={{margin:0,fontSize:12,color:T.goldL,lineHeight:1.6}}>
          Obtiens le badge certifié pour accéder aux fonctionnalités de confidentialité avancées.
        </p>
      </div>
    )}

  </div>
)}

        {section==="compte"&&(
  <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
  <p style={{margin:"0 0 6px",fontSize:11,color:T.muted,textTransform:"uppercase",letterSpacing:1}}>Identifiant Céleste</p>
  {(()=>{
    const prenom=(myProfile?.fullName?.split(" ")[0]||"").toLowerCase();
    const nom=(myProfile?.fullName?.split(" ")[1]||"").toLowerCase();
    const num=(session?.user?.id||"").replace(/\D/g,"").slice(0,4)||"0000";
    const prefix=myProfile?.badge==="confirmed"?"CEL✅":myProfile?.badge==="friend"?"CEL🔵":"CEL#";
    const celesteId=`${prefix}${prenom}.${nom}.${num}`;
    return(
      <>
        <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:T.goldL,letterSpacing:.5}}>{celesteId}</p>
        <Btn onClick={()=>{navigator.clipboard.writeText(celesteId);notify("Identifiant copié ✦");}}
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
          {icon:"👁",text:"Vois combien de personnes ont vu tes posts"},
          {icon:"📈",text:"Tes publications sont prioritaires dans le feed"},
          {icon:"🔕",text:"Active le mode Ne pas recevoir de messages"},
          {icon:"📷",text:"Envoie des photos dans les commentaires"},
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
                  <input id="cel-custom-dial" type="text" placeholder="+XXX" style="display:none;background:#2a2a3e;color:#fff;border:1px solid #444;border-radius:8px;padding:8px;font-size:14px;width:80px;outline:none;" />
                  <input id="cel-phone" type="tel" placeholder="06XXXXXXXX" style="background:#2a2a3e;color:#fff;border:1px solid #444;border-radius:8px;padding:8px;font-size:14px;flex:1;outline:none;" />
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
          const win=window.open("","_blank");
          try{
            const res=await fetch("https://api.chariow.com/v1/checkout",{
  method:"POST",
  headers:{"Authorization":"Bearer sk_20hoymvf_531d0d8326423d81026fa2b4b78d6a46","Content-Type":"application/json"},
  body:JSON.stringify({
    product_id:"prd_h1hcmvq7",
    email:session?.user?.email||"user@celeste.app",
    first_name:myProfile?.fullName?.split(" ")[0]||"User",
    last_name:myProfile?.fullName?.split(" ")[1]||"Celeste",
    phone:{number:phoneInput.number,country_code:phoneInput.country_code},
    redirect_url:`https://ebmijlgkztggcduemeoi.supabase.co/functions/v1/notchpay-webhook?badge_user_id=${session?.user?.id}&sale_id={sale_id}`
  })
});
           const data=await res.json();
console.log("Chariow response:",JSON.stringify(data));
const checkoutUrl=data?.data?.payment?.checkout_url||data?.checkout_url||data?.data?.checkout_url;
const saleId=data?.data?.purchase?.id||null;
if(saleId)await sb.from("profiles").update({badge_payment_ref:saleId}).eq("id",session.user.id);
console.log("checkout_url trouvé:",checkoutUrl);
if(checkoutUrl){
              win.location.href=checkoutUrl;
              notify("Paiement ouvert — ton badge sera activé automatiquement ✦");
            }else{
              win.close();
              notify("Erreur de paiement — réessaie");
            }
          }catch(e){win.close();notify("Erreur de paiement — réessaie");}
        }} style={{width:"100%",padding:"12px",background:T.gradGold,borderRadius:12,color:"#000",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:18}}>✦</span> Obtenir le badge — 2 000 FCFA
        </Btn>
      )}
    </div>

    <div style={{height:1,background:T.border,margin:"4px 0"}}/>
    <Btn onClick={async()=>{if(!window.confirm("Désactiver votre compte ? Cette action est irréversible."))return;await sb.from("profiles").update({status:"suspended"}).eq("id",session?.user?.id);onLogout();}}
      style={{width:"100%",padding:"14px",background:"rgba(200,64,64,0.06)",border:`1px solid ${T.err}33`,borderRadius:14,color:T.err,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      🗑 Désactiver mon compte
    </Btn>
  </div>
)}

        {/* Apparence */}
        {section==="apparence"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {THEMES.map(t=>{
              const locked=t.premium&&!(myProfile?.badge==="confirmed"||myProfile?.badge==="friend");
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
              const locked=t.premium&&!(myProfile?.badge==="confirmed"||myProfile?.badge==="friend");
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
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,color:T.gold,lineHeight:1,marginBottom:10}}>✦</div>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:300,color:T.text,letterSpacing:4,margin:"0 0 4px"}}>Céleste</h2>
      <p style={{color:T.gold,fontSize:11,letterSpacing:2,textTransform:"uppercase",margin:0}}>Réseau privé des jeunes · v4.0</p>
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
      <p style={{margin:"0 0 4px",fontSize:12,color:T.sub}}>Créé par Georgi PAMBOU BIAYANDI</p>
      <p style={{margin:0,fontSize:11,color:T.muted}}>© 2025 · Tous droits réservés</p>
    </div>
  </div>
)}

      </div>
    </div>
  );
  {showBugReport&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowBugReport(false)}>
  <div style={{background:"#1a1a1a",borderRadius:"20px 20px 0 0",padding:"24px 20px 40px",width:"100%",maxWidth:500}} onClick={e=>e.stopPropagation()}>
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
        setShowBugReport(false);
        setBugText("");
      }catch(e){
        alert("Erreur envoi. Réessaie.");
      }
    }} style={{width:"100%",marginTop:12,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,#FF6432,#FF3B6B)",color:"#fff",fontWeight:700,fontSize:14,border:"none"}}>
      Envoyer
    </Btn>
  </div>
</div>}
}

function WalletScreen({session,myProfile,notify,onClose}){
  const [wallet,setWallet]=useState(null);
  const [transactions,setTransactions]=useState([]);
  const [monthStats,setMonthStats]=useState(null);
  const [showWithdraw,setShowWithdraw]=useState(false);
  const cemacCountries=["CG","CM","GA","TD","CF","GQ"];
  const isCemac=cemacCountries.includes(myProfile?.country||"CG");
  const [liveStats,setLiveStats]=useState(null);

useEffect(()=>{
  const loadLive=async()=>{
    const monthStart=new Date().toISOString().slice(0,7)+"-01T00:00:00.000Z";
    const month=new Date().toISOString().slice(0,7);
    
    // Mes likes reçus ce mois
    const{count:myLikesToday}=await sb.from("valid_likes").select("*",{count:"exact",head:true}).eq("author_id",session.user.id).gte("created_at",monthStart);
    
    
    // Mes posts du mois
    const{count:myPostsToday}=await sb.from("posts").select("*",{count:"exact",head:true}).eq("author_id",session.user.id).gte("created_at",monthStart);
    
    // Total likes de tout le monde ce mois
    const{data:allLikes}=await sb.from("valid_likes").select("author_id").gte("created_at",monthStart);
    const{data:allPosts}=await sb.from("posts").select("author_id").gte("created_at",monthStart);
    
    // Pool du mois
    const{data:pool}=await sb.from("badge_pool").select("*").eq("month",month).maybeSingle();

    
    // Calculer les scores
    const likeCounts={};
    (allLikes||[]).forEach(l=>{likeCounts[l.author_id]=(likeCounts[l.author_id]||0)+1;});
    const postCounts={};
    (allPosts||[]).forEach(p=>{postCounts[p.author_id]=(postCounts[p.author_id]||0)+1;});
    
    const scores={};
    const allIds=new Set([...Object.keys(likeCounts),...Object.keys(postCounts)]);
    allIds.forEach(uid=>{
      const l=likeCounts[uid]||0;
      const p=postCounts[uid]||0;
      if(l>0&&p>0)scores[uid]=l*p;
    });
    
    const totalScore=Object.values(scores).reduce((a,b)=>a+b,0);
    const myScore=(myLikesToday||0)*(myPostsToday||0);
    
    // Pool journalier estimé
    const now=new Date();
    const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    const daysLeft=daysInMonth-now.getDate()+1;
    const dailyPool=Math.floor((pool?.pool_amount||0)/daysLeft);
    
    const myEstimate=totalScore>0?Math.floor((myScore/totalScore)*dailyPool):0;
    
    setLiveStats({
      myLikesToday:myLikesToday||0,
      myPostsToday:myPostsToday||0,
      myScore,
      totalScore,
      dailyPool,
      myEstimate,
      poolMonth:pool?.pool_amount||0
    });
  };
  
  loadLive();
  const interval=setInterval(loadLive,30000);
  
  // Realtime — se déclenche dès qu'un like est reçu
  const ch=sb.channel("wallet_live")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"valid_likes",filter:`author_id=eq.${session.user.id}`},()=>{
      loadLive();
    })
    .on("postgres_changes",{event:"DELETE",schema:"public",table:"valid_likes",filter:`author_id=eq.${session.user.id}`},()=>{
      loadLive();
    })
    .subscribe();
  
  return()=>{clearInterval(interval);sb.removeChannel(ch);};
},[session.user.id]);
  const [withdrawAmount,setWithdrawAmount]=useState("");
  const [withdrawPhone,setWithdrawPhone]=useState("");
  const [withdrawName,setWithdrawName]=useState("");
  const [withdrawOp,setWithdrawOp]=useState("mtn");
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
    const{data:pool}=await sb.from("badge_pool").select("*").eq("month",month).maybeSingle();
    const{count:totalLikes}=await sb.from("valid_likes").select("*",{count:"exact",head:true}).eq("month",month);
    // Compter mes posts du mois
    const{count:myPosts}=await sb.from("posts").select("*",{count:"exact",head:true}).eq("author_id",session.user.id).gte("created_at",`${month}-01`);
    // Score estimé
    const myScore=(myLikes||0)*(myPosts||0);
    const{data:allLikes}=await sb.from("valid_likes").select("author_id").eq("month",month);
    const likeCounts={};
    (allLikes||[]).forEach(l=>{likeCounts[l.author_id]=(likeCounts[l.author_id]||0)+1;});
    const{data:allPosts}=await sb.from("posts").select("author_id").gte("created_at",`${month}-01`);
    const postCounts={};
    (allPosts||[]).forEach(p=>{postCounts[p.author_id]=(postCounts[p.author_id]||0)+1;});
    let totalScore=0;
    const allIds=new Set([...Object.keys(likeCounts),...Object.keys(postCounts)]);
    allIds.forEach(uid=>{
      const l=likeCounts[uid]||0;
      const p=postCounts[uid]||0;
      if(l>0&&p>0)totalScore+=l*p;
    });
    const myShare=totalScore>0?Math.floor((myScore/totalScore)*(pool?.pool_amount||0)):0;
    setMonthStats({myLikes:myLikes||0,myPosts:myPosts||0,myShare,pool:pool?.pool_amount||0});
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
    await sb.from("wallets").update({balance:wallet.balance-amount,updated_at:new Date().toISOString()}).eq("user_id",session.user.id);
    const{data:txRow}=await sb.from("wallet_transactions").insert({user_id:session.user.id,type:"withdrawal",amount:-amount,description:`Retrait ${withdrawOp.toUpperCase()} — ${withdrawPhone} (${withdrawName.trim()})`,status:"pending"}).select("id").single();
    await sb.from("withdrawal_requests").insert({user_id:session.user.id,amount,phone:withdrawPhone.trim(),beneficiary_name:withdrawName.trim(),operator:withdrawOp,net_amount:net,status:"pending",transaction_id:txRow?.id});
    setLoading(false);setShowWithdraw(false);setWithdrawAmount("");setWithdrawPhone("");setWithdrawName("");
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
            <div>
              <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.5)"}}>Total gagné</p>
              <p style={{margin:0,fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.9)"}}>{(wallet?.total_earned||0).toLocaleString("fr-FR")} F</p>
            </div>
            <button onClick={()=>setShowWithdraw(true)} style={{background:"rgba(255,255,255,0.15)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Retirer
            </button>
          </div>
        </div>
{liveStats&&(
  <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:20,padding:"20px",marginBottom:16}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <p style={{margin:0,fontSize:13,fontWeight:700,color:T.goldL,letterSpacing:1}}>📊 AUJOURD'HUI EN DIRECT</p>
      <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 6px rgba(34,197,94,0.6)",animation:"pulse 2s infinite"}}/>
    </div>
    
    {/* Stats du jour */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px",textAlign:"center"}}>
        <p style={{margin:"0 0 4px",fontSize:24,fontWeight:800,color:T.goldL}}>❤ {liveStats.myLikesToday}</p>
        <p style={{margin:0,fontSize:11,color:T.muted}}>Likes reçus ce mois</p>
      </div>
      <div style={{background:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px",textAlign:"center"}}>
        <p style={{margin:"0 0 4px",fontSize:24,fontWeight:800,color:T.goldL}}>✦ {liveStats.myPostsToday}</p>
        <p style={{margin:0,fontSize:11,color:T.muted}}>Posts actifs ce mois</p>
      </div>
    </div>

    {/* Barre de progression */}
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <span style={{fontSize:11,color:T.muted}}>Ta part du pool journalier</span>
        <span style={{fontSize:11,color:T.goldL,fontWeight:700}}>{liveStats.totalScore>0?Math.round((liveStats.myScore/liveStats.totalScore)*100):0}%</span>
      </div>
      <div style={{height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:3,background:T.gradGold,width:`${liveStats.totalScore>0?Math.min(100,Math.round((liveStats.myScore/liveStats.totalScore)*100)):0}%`,transition:"width 1s ease"}}/>
      </div>
    </div>

    {/* Estimation */}
    <div style={{background:`linear-gradient(135deg,${T.goldD}22,${T.navy}44)`,border:`1px solid ${T.gold}33`,borderRadius:14,padding:"14px",textAlign:"center"}}>
      <p style={{margin:"0 0 4px",fontSize:11,color:T.muted}}>Estimation de tes gains ce soir</p>
      <p style={{margin:"0 0 2px",fontSize:28,fontWeight:800,color:T.goldL,fontFamily:"'Cormorant Garamond',serif"}}>~{liveStats.myEstimate.toLocaleString("fr-FR")} F</p>
      <p style={{margin:0,fontSize:10,color:T.muted}}> {liveStats.dailyPool.toLocaleString("fr-FR")} : {liveStats.poolMonth.toLocaleString("fr-FR")} F</p>
    </div>
  </div>
)}
        {/* Stats du mois — discret */}
        <div style={{display:"flex",gap:10,marginBottom:24}}>
          <div style={{flex:1,background:T.bg2,borderRadius:16,padding:"14px",border:`1px solid ${T.border}`,textAlign:"center"}}>
            <p style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:T.goldL}}>{monthStats?.myLikes||0}</p>
            <p style={{margin:0,fontSize:11,color:T.muted}}>Likes reçus</p>
          </div>
          <div style={{flex:1,background:T.bg2,borderRadius:16,padding:"14px",border:`1px solid ${T.border}`,textAlign:"center"}}>
            <p style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:T.goldL}}>{monthStats?.myPosts||0}</p>
            <p style={{margin:0,fontSize:11,color:T.muted}}>Posts actifs</p>
          </div>
          <div style={{flex:1,background:T.bg2,borderRadius:16,padding:"14px",border:`1px solid ${T.border}`,textAlign:"center"}}>
            <p style={{margin:"0 0 4px",fontSize:22,fontWeight:800,color:"#4ade80"}}>~{(monthStats?.myShare||0).toLocaleString("fr-FR")}</p>
            <p style={{margin:0,fontSize:11,color:T.muted}}>Gain estimé ce mois(F)</p>
          </div>
        </div>

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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",zIndex:10000,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowWithdraw(false)}>
          <div style={{width:"100%",maxWidth:480,background:T.bg2,borderRadius:"28px 28px 0 0",padding:"28px 20px 48px"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:T.text}}>Retirer mon argent</h3>
              <button onClick={()=>setShowWithdraw(false)} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {["mtn","airtel"].map(op=>(
                <button key={op} onClick={()=>setWithdrawOp(op)} style={{flex:1,height:44,borderRadius:12,border:`1px solid ${withdrawOp===op?T.gold:T.border}`,background:withdrawOp===op?"linear-gradient(135deg,#1a237e,#283593)":"transparent",color:withdrawOp===op?"#fff":T.sub,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {op==="mtn"?"📱 MTN MoMo":"📱 Airtel Money"}
                </button>
              ))}
            </div>
            <input placeholder="Nom complet du titulaire du compte Mobile Money" value={withdrawName} onChange={e=>setWithdrawName(e.target.value)}
              style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 16px",color:T.text,fontSize:14,outline:"none",marginBottom:10}}/>
            <input placeholder="Numéro de téléphone" value={withdrawPhone} onChange={e=>setWithdrawPhone(e.target.value)}
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
function LikedPostsTab({session,notify,onImageView,myProfile,getM,myConnections,onConnect,toggleLike,toggleSave}){
  const [likedPosts,setLikedPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [detailPost,setDetailPost]=useState(null);
  const [reelsIndex,setReelsIndex]=useState(null);
  const [photoViewerIndex,setPhotoViewerIndex]=useState(null);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [reelsCommentPost,setReelsCommentPost]=useState(null);
  const [reelsCloseCallback,setReelsCloseCallback]=useState(null);
  const [photoCommentPost,setPhotoCommentPost]=useState(null);
  const [photoCloseCallback,setPhotoCloseCallback]=useState(null);
  const refreshPost=async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),is_private:data.is_private||false,ts:new Date(data.created_at).getTime()};
  };
  const isVid=p=>(p.img||(p.media_urls||[])[0])&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img||(p.media_urls||[])[0])||(p.img||"").includes("video"));
  const videoPosts=likedPosts.filter(isVid);
  const [reelsViewerFallback,setReelsViewerFallback]=useState(null);
  const [photoViewerFallback,setPhotoViewerFallback]=useState(null);
  const openPostFromSound=(post,soundPosts)=>{
    const list=soundPosts||[post];
    if(isVid(post)){
      const vids=list.filter(isVid);
      const idx=vids.findIndex(v=>v.id===post.id);
      setReelsViewerFallback(vids);
      setReelsIndex(idx>=0?idx:0);
    }else{
      const photos=list.filter(q=>!isVid(q));
      const idx=photos.findIndex(q=>q.id===post.id);
      setPhotoViewerFallback(photos);
      setPhotoViewerIndex(idx>=0?idx:0);
    }
  };
  useEffect(()=>{
    sb.from("likes").select("post_id,posts(*,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url)))").eq("user_id",session?.user?.id).order("created_at",{referencedTable:"posts",ascending:false}).then(({data})=>{
      setLikedPosts((data||[]).map(l=>l.posts).filter(Boolean).map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,eventDate:p.event_date||null,eventLoc:p.event_loc||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],savesCount:0,ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,is_for_sale:p.is_for_sale||false,is_private:p.is_private||false,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null})));
      setLoading(false);
    });
  },[session?.user?.id]);
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
  if(loading)return<div style={{textAlign:"center",padding:40,color:T.muted}}>Chargement…</div>;
  if(!likedPosts.length)return<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8}}>♡</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucun j'aime</p></div>;
  if(detailPost)return<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={getM} onClose={()=>setDetailPost(null)}
    onLike={async pid=>{
      const liked=(detailPost.likes||[]).includes(session?.user?.id);
      if(liked)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",session?.user?.id);
      else await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});
      const u=await refreshPost(pid);if(u)setDetailPost(u);
    }}
    onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}}
    notify={notify}/>;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:2,padding:"0 0 80px"}}>
      {reelsIndex!==null&&toggleLike&&toggleSave&&(
        <ReelsViewer posts={reelsViewerFallback||videoPosts} sb={sb} startIndex={reelsIndex} onClose={()=>{setReelsIndex(null);setReelsViewerFallback(null);}}
          toggleLike={localToggleLike} toggleSave={toggleSave} session={session} myProfile={myProfile} notify={notify}
          onUser={()=>{}} onOpenComments={(p,onReelsCb)=>{setReelsCommentPost(p);setReelsCloseCallback(()=>onReelsCb);}} myConnections={myConnections} onConnect={onConnect} onOpenSound={setOpenSoundId}/>
      )}
      {photoViewerIndex!==null&&toggleLike&&toggleSave&&(
        <PhotoViewer posts={photoViewerFallback||likedPosts.filter(p=>!isVid(p)&&(p.img||(p.media_urls&&p.media_urls.length>0)))} sb={sb} startIndex={photoViewerIndex} onClose={()=>{setPhotoViewerIndex(null);setPhotoViewerFallback(null);}}
          toggleLike={localToggleLike} toggleSave={toggleSave} session={session} myProfile={myProfile} notify={notify}
          onUser={()=>{}} onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}} myConnections={myConnections} onConnect={onConnect} onOpenSound={setOpenSoundId}/>
      )}
      {(reelsCommentPost||photoCommentPost)&&(
        <CommentsOnlyModal
          post={reelsCommentPost||photoCommentPost}
          session={session}
          getM={getM}
          onClose={()=>{
            setReelsCommentPost(null);
            setPhotoCommentPost(null);
            if(reelsCloseCallback){reelsCloseCallback();setReelsCloseCallback(null);}
            if(photoCloseCallback){photoCloseCallback();setPhotoCloseCallback(null);}
          }}
        />
      )}
      {openSoundId&&<SoundDetailModal sb={sb} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
      {likedPosts.map(p=>(
        <div key={p.id} style={{aspectRatio:"1",position:"relative",cursor:p.is_private&&!isNative?"default":"pointer",overflow:"hidden",borderRadius:4}}
          onClick={()=>{
            if(p.is_private&&!isNative)return;
            if(isVid(p)){const idx=videoPosts.findIndex(q=>q.id===p.id);setReelsIndex(idx>=0?idx:0);}
            else{
              const hasPhoto=p.img||(p.media_urls&&p.media_urls.length>0);
              if(hasPhoto){
                const photoPosts=likedPosts.filter(q=>!isVid(q)&&(q.img||(q.media_urls&&q.media_urls.length>0)));
                const idx=photoPosts.findIndex(q=>q.id===p.id);
                setPhotoViewerIndex(idx>=0?idx:0);
              }else{
                setDetailPost(p);
              }
            }
          }}>
          {p.is_private&&!isNative?<PrivateLockedTile T={T}/>:p.img||(p.media_urls||[])[0]
            ?<img src={p.img||(p.media_urls||[])[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            :<div style={{width:"100%",height:"100%",background:p.text_background?({bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[p.text_background]||T.bg2):T.bg2,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:11,color:p.text_background?"#fff":T.muted,padding:8,textAlign:"center",overflow:"hidden"}}>{p.text?.slice(0,40)}</span>
            </div>
          }
          <div style={{position:"absolute",bottom:4,left:4,display:"flex",alignItems:"center",gap:3}}>
            <span style={{fontSize:10,color:"#fff",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>♥ {(p.likes||[]).length}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
// ── PROFILE TAB (ENRICHI - onglet Sauvegardés) ───────────
function ProfileTab({myProfile,session,posts,onNewPost,notify,onLogout,reload,myConnections,myFollowers,onImageView,getM,userPostsVersion=0,toggleLike,toggleSave,onConnect}){
  const [tab,setTab]=useState("posts");
  const [editing,setEditing]=useState(false);
 const [form,setForm]=useState({prenom:myProfile?.fullName?.split(" ")[0]||"",nom:myProfile?.fullName?.split(" ").slice(1).join(" ")||"",bio:myProfile?.bio||"",paroisse:myProfile?.paroisse||"",shop_link:myProfile?.shop_link||""});
  const [saving,setSaving]=useState(false);
  const [unreadNotifs,setUnreadNotifs]=useState(0);
  const [showFollowers,setShowFollowers]=useState(false);
 const [showFollowing,setShowFollowing]=useState(false);
const [showWallet,setShowWallet]=useState(false);
  const [followerProfiles,setFollowerProfiles]=useState([]);
  const [followingProfiles,setFollowingProfiles]=useState([]);
  const avRef=useRef(); const cvRef=useRef();

  useEffect(()=>{
    sb.from("notifications").select("*",{count:"exact",head:true}).eq("user_id",session?.user?.id).eq("read",false).then(({count})=>setUnreadNotifs(count||0));
  },[session?.user?.id]);

  const openFollowers=async()=>{
    const ids=myFollowers||[];
    if(ids.length===0){setFollowerProfiles([]);setShowFollowers(true);return;}
    const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse").in("id",ids);
    setFollowerProfiles((data||[]).map(normProfile));
    setShowFollowers(true);
  };
  const openFollowing=async()=>{
    const ids=myConnections||[];
    if(ids.length===0){setFollowingProfiles([]);setShowFollowing(true);return;}
    const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse").in("id",ids);
    setFollowingProfiles((data||[]).map(normProfile));
    setShowFollowing(true);
  };

  const saveProfile=async()=>{
    setSaving(true);
   await sb.from("profiles").update({prenom:form.prenom,nom:form.nom,bio:form.bio,paroisse:form.paroisse,shop_link:form.shop_link||null,updated_at:new Date().toISOString()}).eq("id",session?.user?.id);
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
  sb.from("posts").select("id,author_id,type,text,mentions,img_url,media_urls,event_title,pinned,profile_pinned,text_background,visibility,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url),likes(user_id),comments(id)").eq("author_id",session.user.id).order("created_at",{ascending:false}).limit(30).then(({data})=>{
    if(data){
      const mapped=data.map(p=>({id:p.id,by:p.author_id,author:normProfile(p.author||{}),type:p.type,text:p.text||"",img:p.img_url||null,media_urls:p.media_urls||[],title:p.event_title||null,likes:(p.likes||[]).map(l=>l.user_id),comments:(p.comments||[]),ts:new Date(p.created_at).getTime(),text_background:p.text_background||null,visibility:p.visibility||null,profile_pinned:p.profile_pinned||false,sound:p.sound?{id:p.sound.id,title:p.sound.title,url:p.sound.url,owner_avatar:p.sound.owner?.avatar_url||null}:null}));
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
const myPhotoPosts=useMemo(()=>myPosts.filter(p=>!isVid(p)&&(p.img||(p.media_urls&&p.media_urls.length>0))),[myPosts]);
const myVideoPosts=useMemo(()=>myPosts.filter(p=>isVid(p)),[myPosts]);
const [reelsViewerFallback,setReelsViewerFallback]=useState(null);
const [photoViewerFallback,setPhotoViewerFallback]=useState(null);
const openPostFromSound=(post,soundPosts)=>{
  const list=soundPosts||[post];
  if(isVid(post)){
    const vids=list.filter(isVid);
    const idx=vids.findIndex(v=>v.id===post.id);
    setReelsViewerFallback(vids);
    setUserReelsIndex(idx>=0?idx:0);
  }else{
    const photos=list.filter(q=>!isVid(q));
    const idx=photos.findIndex(q=>q.id===post.id);
    setPhotoViewerFallback(photos);
    setPhotoViewerIndex(idx>=0?idx:0);
  }
};

  const followersCount=useMemo(()=>(myFollowers||[]).length,[myFollowers]);
  const followingCount=useMemo(()=>(myConnections||[]).length,[myConnections]);
  const [detailPost, setDetailPost] = useState(null);

 const [userReelsIndex,setUserReelsIndex]=useState(null);
  const [photoViewerIndex,setPhotoViewerIndex]=useState(null);
  const [openSoundId,setOpenSoundId]=useState(null);
  const [reelsCommentPost,setReelsCommentPost]=useState(null);
  const [reelsCloseCallback,setReelsCloseCallback]=useState(null);
  const [photoCommentPost,setPhotoCommentPost]=useState(null);
  const [photoCloseCallback,setPhotoCloseCallback]=useState(null);
  const refreshPost=async pid=>{
  const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
  if(!data)return null;
  return{id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:[],is_private:data.is_private||false,ts:new Date(data.created_at).getTime()};
  
};
  return(
    
    <div style={{flex:1,overflowY:"auto",background:T.bg}}>
      {showWallet&&<WalletScreen session={session} myProfile={myProfile} notify={notify} onClose={()=>setShowWallet(false)}/>}
      <input type="file" ref={avRef} accept="image/*" style={{display:"none"}} onChange={e=>uploadImg(e,"avatar_url")}/>
      <input type="file" ref={cvRef} accept="image/*" style={{display:"none"}} onChange={e=>uploadImg(e,"cover_url")}/>
      {userReelsIndex!==null&&toggleLike&&toggleSave&&(
  <ReelsViewer
    posts={reelsViewerFallback||myPosts.filter(p=>p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video")))}
    sb={sb}
    startIndex={userReelsIndex}
    onClose={()=>{setUserReelsIndex(null);setReelsViewerFallback(null);}}
    toggleLike={async pid=>{await toggleLike(pid);loadMyPosts();}}
    toggleSave={async pid=>{await toggleSave(pid);loadMyPosts();}}
    session={session}
    myProfile={myProfile}
    notify={notify}
    onUser={()=>{}}
    onOpenComments={(p,onReelsCb)=>{setReelsCommentPost(p);setReelsCloseCallback(()=>onReelsCb);}}
    myConnections={myConnections}
    onConnect={()=>{}}
    onOpenSound={setOpenSoundId}
  />
)}
{photoViewerIndex!==null&&toggleLike&&toggleSave&&(
  <PhotoViewer
    posts={photoViewerFallback||myPhotoPosts}
    sb={sb}
    startIndex={photoViewerIndex}
    onClose={()=>{setPhotoViewerIndex(null);setPhotoViewerFallback(null);}}
    toggleLike={async pid=>{await toggleLike(pid);loadMyPosts();}}
    toggleSave={async pid=>{await toggleSave(pid);loadMyPosts();}}
    session={session}
    myProfile={myProfile}
    notify={notify}
    onUser={()=>{}}
    onOpenComments={(p,onPhotoCb)=>{setPhotoCommentPost(p);setPhotoCloseCallback(()=>onPhotoCb);}}
    myConnections={myConnections}
    onConnect={()=>{}}
    onOpenSound={setOpenSoundId}
  />
)}

{openSoundId&&<SoundDetailModal sb={sb} soundId={openSoundId} onClose={()=>setOpenSoundId(null)} onUseSound={()=>setOpenSoundId(null)} onOpenPost={openPostFromSound}/>}
  {(reelsCommentPost||photoCommentPost)&&(
  <CommentsOnlyModal
    post={reelsCommentPost||photoCommentPost}
    session={session}
    getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}}
    onClose={()=>{
      setReelsCommentPost(null);
      setPhotoCommentPost(null);
      if(reelsCloseCallback){reelsCloseCallback();setReelsCloseCallback(null);}
      if(photoCloseCallback){photoCloseCallback();setPhotoCloseCallback(null);}
    }}
  />
)}
{detailPost&&<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}}
  zIndex={(reelsCommentPost||photoCommentPost)?1300:800}
  fromReel={!!(reelsCommentPost||photoCommentPost)}
  onClose={()=>{
    setDetailPost(null);
    setReelsCommentPost(null);
    setPhotoCommentPost(null);
    if(reelsCloseCallback){reelsCloseCallback();setReelsCloseCallback(null);}
    if(photoCloseCallback){photoCloseCallback();setPhotoCloseCallback(null);}
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
  <Av u={myProfile} size={92} ring onClick={e=>{e.stopPropagation();avRef.current.click();}}/>
  <div onClick={e=>{e.stopPropagation();avRef.current.click();}} style={{position:"absolute",bottom:-2,right:-2,width:26,height:26,borderRadius:8,background:T.gradGold,display:"flex",alignItems:"center",justifyContent:"center",color:"#000",boxShadow:"0 2px 8px rgba(201,149,42,0.4)",cursor:"pointer"}}>
  <Camera size={12}/>
  </div>
</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
  <Btn onClick={()=>setEditing(e=>!e)} style={{background:editing?T.goldBg:T.glass,border:`1px solid ${editing?T.gold+"55":T.border}`,borderRadius:14,padding:"9px 16px",color:editing?T.goldL:T.sub,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
    <Edit2 size={14}/>{editing?"Annuler":"Modifier"}
  </Btn>
  {(myProfile?.badge==="confirmed"||myProfile?.badge==="friend")&&(
    <button onClick={()=>setShowWallet(true)} style={{height:38,padding:"0 14px",display:"flex",alignItems:"center",gap:6,background:T.goldBg,border:`1px solid ${T.gold}44`,borderRadius:14,color:T.goldL,fontSize:13,fontWeight:600,cursor:"pointer"}}>
      💰 Portefeuille
    </button>
  )}
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
            {(myProfile?.badge==="friend"&&myProfile?.country==="CG")&&(
              <input value={form.shop_link||""} onChange={e=>setForm(f=>({...f,shop_link:e.target.value}))} placeholder="🛍️ Lien boutique (optionnel)" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px",color:T.text,fontSize:13,outline:"none"}}/>
            )}
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

        <ProfileViewsCard sb={sb} T={T} Btn={Btn} Av={Av} Badge={Badge} fmtCount={fmtCount} session={session}/>
        <Btn onClick={()=>{
          const url="https://play.google.com/store/apps/details?id=social.celesteapp";
          if(navigator.share){navigator.share({title:"Céleste",text:"Rejoins-moi sur Céleste ✦",url}).catch(()=>{});}
          else{navigator.clipboard?.writeText(url);notify("Lien copié ✦");}
        }} style={{width:"100%",padding:"12px",marginBottom:20,borderRadius:14,background:T.glass,border:`1px solid ${T.border}`,color:T.sub,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Users size={15}/> Inviter des amis
        </Btn>
        <DiscoverPeopleSection sb={sb} T={T} Btn={Btn} Av={Av} Badge={Badge} session={session} notify={notify} computeMatchScore={computeMatchScore} onUser={id=>window.dispatchEvent(new CustomEvent("celeste_open_user",{detail:{uid:id}}))} onConnectionChange={()=>{/* rafraîchi au prochain rendu */}}/>

        {/* Modal Abonnés */}
        {showFollowers&&(
          <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowFollowers(false)}>
            <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:T.text}}>Abonnés <span style={{color:T.goldL}}>({fmtCount(followersCount)})</span></h3>
                <Btn onClick={()=>setShowFollowers(false)} style={{color:T.muted}}><X size={20}/></Btn>
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
          <div style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowFollowing(false)}>
            <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:520,maxHeight:"75vh",display:"flex",flexDirection:"column",animation:"slideUp .3s ease"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 20px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <h3 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:T.text}}>Abonnements <span style={{color:T.goldL}}>({followingCount})</span></h3>
                <Btn onClick={()=>setShowFollowing(false)} style={{color:T.muted}}><X size={20}/></Btn>
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

        {tab==="posts"&&(
          myPhotoPosts.length===0 
            ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}>
              <div style={{fontSize:40,marginBottom:8,animation:"float 3s ease infinite"}}>✦</div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,marginBottom:12}}>Aucune publication</p>
              <Btn onClick={onNewPost} style={{background:T.gradGold,borderRadius:14,padding:"11px 24px",color:"#000",fontSize:13,fontWeight:700}}>Publier maintenant</Btn>
            </div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
  {myPhotoPosts.map(p=>(
    <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer"}}>
      <div onClick={()=>{
        const isVid=p.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(p.img)||p.img.includes("video"));
      
        if(isVid&&toggleLike&&toggleSave){
          const vidPosts=myPosts.filter(q=>q.img&&(/\.(mp4|mov|webm|ogg|avi)(\?|$)/i.test(q.img)||q.img.includes("video")));
          const idx=vidPosts.findIndex(q=>q.id===p.id);
          setUserReelsIndex(idx>=0?idx:0);
        }else{
          const hasPhoto=p.img||(p.media_urls&&p.media_urls.length>0);
          if(hasPhoto){
            const idx=myPhotoPosts.findIndex(q=>q.id===p.id);
            setPhotoViewerIndex(idx>=0?idx:0);
          }else{
            setDetailPost(p);
          }
        }
      }} style={{width:"100%",height:"100%"}}>
        {p.img
          ?<img src={p.img||(p.media_urls||[])[0]} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:8,background:p.text_background?({bg_noir:"#000000",bg_bleu:"#1565C0",bg_vert:"#1B5E20",bg_rouge:"#B71C1C",bg_or:"#7B5A00",bg_violet:"#4A148C"}[p.text_background]||T.bg2):T.bg2}}>
            <p style={{margin:0,fontSize:11,fontWeight:700,color:p.text_background?"#fff":T.sub,textAlign:"center",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.text}</p>
          </div>
        }
        <div style={{position:"absolute",bottom:4,right:6,display:"flex",gap:5,alignItems:"center"}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {(p.likes||[]).length}</span>
          {p.savesCount>0&&<span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>🔖 {p.savesCount}</span>}
        </div>
        {p.profile_pinned&&(
          <div style={{position:"absolute",top:6,left:6,background:"rgba(0,0,0,0.55)",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
            <Pin size={11} color={T.goldL}/>
          </div>
        )}
      </div>
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
    </div>
  ))}
</div>
        )}
{tab==="reels"&&(
          myVideoPosts.length===0
            ?<div style={{textAlign:"center",padding:"40px 0",color:T.muted}}><div style={{fontSize:40,marginBottom:8}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18}}>Aucun reel encore</p></div>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3,margin:"0 -18px"}}>
              {myVideoPosts.map(p=>(
                <div key={p.id} style={{aspectRatio:"1/1",overflow:"hidden",background:T.card,position:"relative",cursor:"pointer"}}
                  onClick={()=>{const idx=myVideoPosts.findIndex(q=>q.id===p.id);setUserReelsIndex(idx>=0?idx:0);}}>
                  <img src={p.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  <div style={{position:"absolute",bottom:4,right:6}}><span style={{fontSize:9,color:"rgba(255,255,255,0.8)",fontWeight:700,textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>❤ {(p.likes||[]).length}</span></div>
                </div>
              ))}
            </div>
        )}
        {tab==="likes"&&(
          <LikedPostsTab session={session} notify={notify} onImageView={onImageView} myProfile={myProfile} getM={getM} myConnections={myConnections} onConnect={onConnect} toggleLike={toggleLike} toggleSave={toggleSave}/>
        )}
        {tab==="saved"&&(
          <SavedPostsTab myProfile={myProfile} session={session} getM={id=>id===session?.user?.id?myProfile:{initials:"?",color:"#888",name:"?"}} notify={notify} onImageView={onImageView} toggleLike={toggleLike} toggleSave={toggleSave}/>
        )}
        <div style={{height:80}}/>
      </div>
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
function AdminPanel({onClose,notify,reload,reloadPosts,session}){
  const [list,setList]=useState([]);
  const [allReports,setAllReports]=useState([]);
  const [allPosts,setAllPosts]=useState([]);
  const [filter,setFilter]=useState("pending");
  const [showPosts,setShowPosts]=useState(false);
  const [search,setSearch]=useState("");
  const [postSearch,setPostSearch]=useState("");
  const [deletingReportId,setDeletingReportId]=useState(null);

  useEffect(()=>{
    sb.from("profiles").select("*").then(({data})=>setList((data||[]).map(normProfile)));
    sb.from("reports").select(`*,reporter:profiles!reports_reporter_id_fkey(prenom,nom),reported:profiles!reports_reported_id_fkey(prenom,nom),post:posts(id,text,media_urls,img_url),sticker:stickers(id,name,url,type,added_by_admin,author_id)`).order("created_at",{ascending:false}).then(({data})=>setAllReports(data||[]));
    sb.from("posts").select(`*,author:profiles(id,prenom,nom)`).order("created_at",{ascending:false}).limit(50).then(({data})=>setAllPosts(data||[]));
  },[]);

  const approve=async(id)=>{
  const{error}=await sb.from("profiles").update({status:"active"}).eq("id",id);
  if(error){notify("Erreur : "+error.message);console.error(error);return;}
  setList(p=>p.map(m=>m.id===id?{...m,status:"active"}:m));
  await sb.from("notifications").insert({user_id:id,from_id:id,type:"approved",read:false});
  reload();notify("Membre approuvé ✦");
};

  const reject=async id=>{
    if(!window.confirm("Rejeter et supprimer ?"))return;
    await sb.auth.admin?.deleteUser(id);
    await sb.from("profiles").delete().eq("id",id);
    setList(p=>p.filter(m=>m.id!==id));notify("Rejeté");
  };
  const suspend=async(id,status)=>{
    const ns=status==="suspended"?"active":"suspended";
    const{error}=await sb.from("profiles").update({status:ns}).eq("id",id);
    if(error){notify("Erreur : "+error.message);return;}
    // Recharge la liste depuis Supabase pour refléter l'état réel
    const{data}=await sb.from("profiles").select("*").order("joined_at",{ascending:false});
if(data)setList(data.map(normProfile));
    reload?.();
    notify(ns==="suspended"?"🚫 Suspendu":"✓ Réactivé avec succès");
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

  const norm=s=>(s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const stickerReports=(allReports||[]).filter(r=>r.sticker_id);
const otherReports=(allReports||[]).filter(r=>!r.sticker_id);
  const allMembers=(list||[]).filter(m=>m.status!=="pending");
  const pending=(list||[]).filter(m=>m.status==="pending");
  const suspended=(list||[]).filter(m=>m.status==="suspended");
  const baseList=filter==="pending"?pending:filter==="suspended"?suspended:filter==="reports"?[]:(list||[]).filter(m=>m.id);
  const displayList=search.trim()
    ?baseList.filter(m=>norm(m.fullName||m.name).includes(norm(search))||norm(m.prenom).includes(norm(search))||norm(m.nom).includes(norm(search))||norm(m.whatsapp).includes(norm(search)))
    :baseList;
  const filteredPosts=postSearch.trim()
    ?(allPosts||[]).filter(p=>norm(p.text||p.event_title).includes(norm(postSearch))||norm(p.author?.prenom).includes(norm(postSearch))||norm(p.author?.nom).includes(norm(postSearch)))
    :(allPosts||[]);

  return(
    <>
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:T.bg3,border:`1px solid ${T.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"90vh",display:"flex",flexDirection:"column",animation:"slideUp .35s cubic-bezier(0.34,1.1,0.64,1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 16px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:400,color:T.goldL}}>🛡 Administration</h2>
            <p style={{margin:0,fontSize:12,color:T.muted}}>{(list||[]).length} membres · {pending.length} en attente · {allReports.length} signalements</p>
          </div>
          <Btn onMouseDown={e=>e.preventDefault()} onClick={onClose} style={{color:T.muted,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:"50%",border:`1px solid ${T.border}`}}><X size={16}/></Btn>
        </div>
        <div style={{display:"flex",gap:4,padding:"12px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0,overflowX:"auto"}}>
          {[{id:"pending",l:`En attente (${pending.length})`},{id:"all",l:"Tous"},{id:"suspended",l:`Suspendus (${suspended.length})`},{id:"reports",l:`Signalements (${otherReports.length})`},{id:"sticker_reports",l:`Stickers signalés (${stickerReports.length})`},{id:"sons",l:"Sons"},{id:"stickers",l:"Stickers"}].map(f=>(

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
  ?<AdminSoundsPanel sb={sb} notify={notify} T={T} />
  :filter==="stickers"
  ?<AdminStickersPanel sb={sb} notify={notify} T={T} />
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
                        if(!window.confirm(`Supprimer le sticker "${r.sticker.name}" de toute l'application ?`))return;
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
              {(displayList||[]).map(m=>(
                <div key={m.id} style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,background:m.status==="pending"?"rgba(201,149,42,0.03)":m.status==="suspended"?"rgba(200,64,64,0.03)":"none"}}>
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
                </div>
              ))}
            </>
          }
        </div>
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
            if(!window.confirm("Distribuer le pool de ce mois à tous les membres ?"))return;
            const month=new Date().toISOString().slice(0,7);
            // Récupérer tous les likes valides du mois
            const{data:likes}=await sb.from("valid_likes").select("author_id").eq("month",month);
            if(!likes||likes.length===0){notify("Aucun like valide ce mois");return;}
            // Récupérer le pool
            const{data:pool}=await sb.from("badge_pool").select("*").eq("month",month).maybeSingle();
            
            if(!pool||pool.distributed){notify("Pool inexistant ou déjà distribué");return;}
           // Compter les likes par auteur
            const likeCounts={};
            likes.forEach(l=>{likeCounts[l.author_id]=(likeCounts[l.author_id]||0)+1;});

            // Compter les posts actifs du mois (publiés dans le mois)
            const{data:monthPosts}=await sb.from("posts").select("author_id,created_at").gte("created_at",`${month}-01`);
            const postCounts={};
            (monthPosts||[]).forEach(p=>{postCounts[p.author_id]=(postCounts[p.author_id]||0)+1;});

            // Calculer le score = likes × posts
            const scores={};
            const allUserIds=new Set([...Object.keys(likeCounts),...Object.keys(postCounts)]);
            allUserIds.forEach(uid=>{
              const l=likeCounts[uid]||0;
              const p=postCounts[uid]||0;
              if(l>0&&p>0)scores[uid]=l*p;
            });

            const totalScore=Object.values(scores).reduce((a,b)=>a+b,0);
            // Distribuer
            for(const[userId,score] of Object.entries(scores)){
              const share=Math.floor((score/totalScore)*pool.pool_amount);
              if(share<=0)continue;
              // Créer ou mettre à jour le wallet
              const{data:w}=await sb.from("wallets").select("*").eq("user_id",userId).maybeSingle();
              if(w){
                await sb.from("wallets").update({balance:w.balance+share,total_earned:w.total_earned+share,updated_at:new Date().toISOString()}).eq("user_id",userId);
              }else{
                await sb.from("wallets").insert({user_id:userId,balance:share,total_earned:share});
              }
              // Transaction
              await sb.from("wallet_transactions").insert({user_id:userId,type:"earning",amount:share,description:`Gains likes — ${month}`,month,status:"completed"});
              // Notification
              await sb.from("notifications").insert({user_id:userId,from_id:userId,type:"earning",text:`✦ Tu as reçu ${share.toLocaleString("fr-FR")} F CFA pour tes likes du mois de ${month}`,read:false});
            }
            // Marquer comme distribué
            await sb.from("badge_pool").update({distributed:true}).eq("month",month);
            notify(`✦ Distribution effectuée — ${Object.keys(scores).length} membres récompensés`);
          }} style={{width:"100%",padding:"11px",background:"rgba(61,184,116,0.08)",border:"1px solid rgba(61,184,116,0.3)",borderRadius:12,color:"#4ade80",fontSize:13,fontWeight:600}}>
            💰 Distribuer le pool du mois
          </Btn>

          {/* Retraits en attente */}
          <WithdrawalRequests notify={notify}/>
          <WalletComplaints notify={notify}/>
        </div>
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
        const history=updatedMsgs.reduce((acc,m)=>{
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
        const res=await fetch("https://api.deepseek.com/chat/completions",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":`Bearer ${DEEPSEEK_KEY}`},
          body:JSON.stringify({
            model:"deepseek-chat",
            messages:formattedMessages
          })
        });
        if(!res.ok){if(res.status===429){setMsgs(p=>[...p,{role:"model",text:"Je reçois trop de messages en ce moment 😅 Attends 1 minute et réessaie !"}]);return;}if(i<retries-1){await new Promise(r=>setTimeout(r,2500));continue;}throw new Error("503");}
        const data=await res.json();
        const reply=data.choices?.[0]?.message?.content||"Je n'ai pas pu répondre.";
        setMsgs(p=>[...p,{role:"model",text:reply}]);
        if(session?.user?.id)await sb.from("celeste_messages").insert({user_id:session.user.id,role:"model",text:reply});
        return;
      }catch{if(i<retries-1){await new Promise(r=>setTimeout(r,2500));continue;}}
    }
    setMsgs(p=>[...p,{role:"model",text:"Je suis momentanément indisponible, réessaie dans quelques secondes 🙏"}]);
  };
  await tryGemini();
  setLoading(false);
  sendingRef.current=false;
};

  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:T.bg,display:"flex",flexDirection:"column",animation:"slideIn .3s ease"}}>
      {/* Header */}
      <div style={{padding:"12px 16px",paddingTop:"calc(12px + env(safe-area-inset-top,0px))",background:T.bg,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <Btn onClick={onClose} style={{color:T.gold,display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
        <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#4A90D9,#7B2FBE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 16px rgba(123,47,190,0.4)"}}><Sparkles size={46} color="#fff"/></div>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:T.text}}>Céleste IA</p>
          <p style={{margin:0,fontSize:11,color:"#9B6FDE"}}>● En ligne</p>
        </div>
        <Btn onClick={()=>{if(window.confirm("Effacer la conversation ?"))setMsgs([]);}} style={{color:T.muted,fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,0.04)",border:`1px solid ${T.border}`,borderRadius:10}}>Effacer</Btn>
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
      <div style={{padding:"10px 12px",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px))",background:T.bg2,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"flex-end",flexShrink:0}}>
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
      <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:300,color:T.text,letterSpacing:7,margin:"20px 0 8px",animation:"titleReveal .8s ease .3s both"}}>Céleste</h1>
      <p style={{color:T.muted,fontSize:11,letterSpacing:3,textTransform:"uppercase",animation:"titleReveal .8s ease .6s both"}}>Exprime ta vrai personnalitée</p>

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
function VerificationInfoModal(){
  const [open,setOpen]=useState(false);
  return(
    <>
      <Btn onClick={()=>setOpen(true)} style={{marginTop:16,width:"100%",padding:"13px 30px",background:"rgba(255,255,255,0.03)",border:`1px solid ${T.border}`,borderRadius:14,color:T.muted,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <span>ℹ️</span> En savoir plus sur la vérification
      </Btn>
      {open&&(
        <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setOpen(false)}>
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
            <Btn onClick={()=>setOpen(false)} style={{width:"100%",padding:"14px",background:T.gradGold,borderRadius:14,color:"#000",fontSize:14,fontWeight:700}}>J'ai compris ✦</Btn>
          </div>
        </div>
      )}
    </>
  );
}

function CelesteApp(){
  const [userPostsVersion,setUserPostsVersion]=useState(0);
  const [authMode,setAuthMode]=useState("login");
  const [session,setSession]=useState(undefined);
  const [myProfile,setMyProfile]=useState(null);
  const [isPending,setIsPending]=useState(false);
  const [members,setMembers]=useState([]);
  const [posts,setPosts]=useState(()=>{try{const c=localStorage.getItem("celeste_posts_cache");return c?JSON.parse(c):[];}catch(e){return[];}});
  const [convs,setConvs]=useState(()=>{try{const c=localStorage.getItem("celeste_convs_cache");return c?JSON.parse(c):[];}catch(e){return[];}});
  const [myConnections,setMyConnections]=useState([]);
  const [myFollowers,setMyFollowers]=useState([]);
  const [blockedUserIds,setBlockedUserIds]=useState([]);
  const [mutedAuthorIds,setMutedAuthorIds]=useState([]);
  const [feedPreloaded,setFeedPreloaded]=useState(false);
  const [onlinePresenceIds,setOnlinePresenceIds]=useState(()=>new Set());

  const [chatDrafts,setChatDrafts]=useState({});
  const [tab,setTab]=useState("home");
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
      }
    };
    const off=()=>setIsOnline(false);
    window.addEventListener("online",on);
    window.addEventListener("offline",off);
    return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[session?.user?.id]);
  const checkShared=async()=>{
  try{
    const{url}=await CapApp.getLaunchUrl()||{};
    if(!url)return;
    const res=await fetch(url);
    const blob=await res.blob();
    const file=new File([blob],url.split("/").pop()||"media",{type:blob.type});
    setSharedMedia(file);
  }catch(e){}
};
checkShared();
CapApp.addListener("appStateChange",({isActive})=>{if(isActive)checkShared();});
  useEffect(()=>{window.__celesteSetTab=setTab;return()=>{delete window.__celesteSetTab;};},[]);
  useEffect(()=>{
    const h=()=>{setOpenConvId(null);setOpenUserId(null);};
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
    const openResolved=(finalPost,commentId)=>{
      if(finalPost.type==="text"||finalPost.type==="event"){
        pushNav(()=>setDetailPost(null));setDetailPost({...finalPost,_targetCommentId:commentId||null});
        return;
      }
      if(isVideoPost(finalPost)){setGlobalReelsPost(finalPost);return;}
      if(isPhotoPost(finalPost)){setGlobalPhotoPost(finalPost);return;}
      pushNav(()=>setDetailPost(null));setDetailPost({...finalPost,_targetCommentId:commentId||null});
    };
    const handler=async e=>{
      const{postId,commentId}=e.detail||{};
      if(!postId)return;
      const post=(posts||[]).find(p=>p.id===postId);
      if(post){openResolved(post,commentId);return;}
      const{data}=await sb.from("posts").select("id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles!posts_author_id_fkey(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))").eq("id",postId).single();
      if(data){
        const mapped={id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],likes:(data.likes||[]).map(l=>l.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),ts:new Date(data.created_at).getTime(),pinned:data.pinned||false,text_background:data.text_background||null,is_for_sale:data.is_for_sale||false,is_private:data.is_private||false,sound:data.sound?{id:data.sound.id,title:data.sound.title,url:data.sound.url,owner_avatar:data.sound.owner?.avatar_url||null}:null};
        openResolved(mapped,commentId);
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
  const [detailPost,setDetailPost]=useState(null);
  const [openUserId,setOpenUserId]=useState(null);
  const [openUser,setOpenUser]=useState(null);
  const [showNewPost,setShowNewPost]=useState(false);
const [pendingSound,setPendingSound]=useState(null);
  const [showAdmin,setShowAdmin]=useState(false);
  const [showNotifs,setShowNotifs]=useState(false);
  const [toast,setToast]=useState(null);
  const [postPage,setPostPage]=useState(1);
  const [hasMorePosts,setHasMorePosts]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [inAppNotifs,setInAppNotifs]=useState([]);
 const [viewImg,setViewImg]=useState(null);
const [globalReelsPost,setGlobalReelsPost]=useState(null);
const [globalPhotoPost,setGlobalPhotoPost]=useState(null);
const [openCeleste,setOpenCeleste]=useState(false);
const [celesteMsgs,setCelesteMsgs]=useState([]);
const feedScrollRef=useRef(0);
const viewedPostIdsRef=useRef(new Set());
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
const pushNav = useCallback((closeFn) => { navStack.current.push(closeFn); }, []);
const popNav = useCallback(() => { navStack.current.pop(); }, []);

useEffect(() => {
  const handler = CapApp.addListener('backButton', () => {
    if (viewImg) { setViewImg(null); return; }
    if (navStack.current.length > 0) {
      const closeFn = navStack.current.pop();
      closeFn();
      return;
    }
    if (tab !== 'home') { navStack.current=[]; setTab('home'); return; }
    CapApp.minimizeApp();
  });

  return () => { Promise.resolve(handler).then(h=>h?.remove()).catch(()=>{}); };
}, [viewImg, tab]);
  const notify=useCallback(m=>{setToast(m);setTimeout(()=>setToast(null),2800);},[]);
  const myId=session?.user?.id;
  const addInAppNotif=useCallback((icon,title,body,action)=>{
  const id=Date.now()+Math.random();
  setInAppNotifs(p=>[...p,{id,icon,title,body,action}]);
  playNotifSound();
  setTimeout(()=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),5000);
},[myId]);
  const dismissNotif=useCallback(id=>setInAppNotifs(p=>p.filter(n=>n.id!==id)),[]);

  const loadMyProfile=useCallback(async uid=>{const{data}=await sb.from("profiles").select("*").eq("id",uid).single();if(data){
  const hasBadge=data.badge==="confirmed"||data.badge==="friend";
  if(!hasBadge&&(data.hide_online||data.screenshot_protection||data.no_messages)){
    await sb.from("profiles").update({hide_online:false,screenshot_protection:false,no_messages:false}).eq("id",uid);
    data.hide_online=false;data.screenshot_protection=false;data.no_messages=false;
  }
  setMyProfile(normProfile(data));setIsPending(data.status==="pending");}},[]);
  const loadConnections=useCallback(async uid=>{if(!uid)return;const[{data:following},{data:followers}]=await Promise.all([sb.from("connections").select("to_id").eq("from_id",uid),sb.from("connections").select("from_id").eq("to_id",uid)]);if(following)setMyConnections(following.map(d=>d.to_id));if(followers)setMyFollowers(followers.map(d=>d.from_id));},[]);

  // Load unread notifs count
  const loadUnreadNotifs=useCallback(async uid=>{if(!uid)return;const{count}=await sb.from("notifications").select("*",{count:"exact",head:true}).eq("user_id",uid).eq("read",false);setUnreadNotifs(count||0);},[]);

  useEffect(()=>{
    if(!openUserId){setOpenUser(null);return;}
    const found=(members||[]).find(m=>m.id===openUserId);
    if(found){setOpenUser(found);return;}
    sb.from("profiles").select("*").eq("id",openUserId).single().then(({data})=>{if(data)setOpenUser({...normProfile(data),isOnline:onlinePresenceIds.has(data.id),online:onlinePresenceIds.has(data.id)});});
  },[openUserId,members,onlinePresenceIds]);

  useEffect(()=>{
    sb.auth.getSession().then(({data:{session:s}})=>{setSession(s||null);if(s){loadMyProfile(s.user.id);
subscribePush(sb,s.user.id).then(ok=>{if(!ok)console.warn("⚠️ Push non initialisé");});
sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",s.user.id).then(({error})=>{if(error)console.warn("last_seen:",error);});
(async()=>{try{const pos=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:10000});await sb.from("profiles").update({latitude:pos.coords.latitude,longitude:pos.coords.longitude}).eq("id",s.user.id);}catch(e){console.warn("geo:",e);}})();}});
    const{data:{subscription}}=sb.auth.onAuthStateChange((_e,s)=>{setSession(s||null);if(s){loadMyProfile(s.user.id);subscribePush(sb,s.user.id).then(ok=>{if(!ok)console.warn("⚠️ Push non initialisé");});sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",s.user.id);}else{setMyProfile(null);setIsPending(false);}});
    const lsInterval=setInterval(()=>{sb.auth.getUser().then(({data})=>{if(data?.user?.id)sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",data.user.id);});},60000);
    // Force la mise à jour de last_seen dès que l'app/onglet revient au premier plan
    // (le setInterval peut être throttled/suspendu par le mobile en arrière-plan)
    const onVisible=()=>{
      if(document.visibilityState==="visible"){
        sb.auth.getUser().then(({data})=>{
          if(data?.user?.id)sb.from("profiles").update({last_seen:new Date().toISOString()}).eq("id",data.user.id);
        });
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
    setMembers(prev=>prev.map(m=>({...m,isOnline:onlinePresenceIds.has(m.id),online:onlinePresenceIds.has(m.id)})));
  },[onlinePresenceIds]);

  const loadMembers=useCallback(async()=>{
  const{data}=await sb.from("profiles").select("id,prenom,nom,avatar_url,badge,paroisse,status,last_seen,country,account_type,latitude,longitude,no_messages,screenshot_protection,joined_at").neq("status","pending");
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

  const seenPostIdsRef = useRef(new Set());
  const postOrderRef=useRef([]);
 useEffect(()=>{
    const t=setInterval(()=>setPosts(prev=>(prev||[]).slice(-50)),5*60*1000);
    return()=>clearInterval(t);
  },[]);
 const loadPosts=useCallback(async(page=1,overrideBlockedIds=null)=>{
  const from=(page-1)*PAGE_SIZE,to=from+PAGE_SIZE-1;
  const{data,error}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,profile_pinned,post_phase,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,visibility,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url),replies:comment_replies(id)),saved_posts(count)`).or("expires_at.is.null,expires_at.gt."+new Date().toISOString())
.or("visibility.is.null,visibility.in.(testing,phase2,phase3,viral,background)")
.not("visibility","eq","hidden").order("created_at",{ascending:false}).range(from,to);
  if(error){console.error("loadPosts ERROR:",error);notify("Erreur chargement fil: "+error.message);}
  if(data){
    const{data:conns}=await sb.from("connections").select("to_id").eq("from_id",session?.user?.id);
    const followedIds=new Set((conns||[]).map(c=>c.to_id));
   const mapped=data.map(p=>mapDbPost(p,followedIds));
   if(page===1){
     const{data:pinnedData}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,profile_pinned,post_phase,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,visibility,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url),replies:comment_replies(id)),saved_posts(count)`).eq("pinned",true).not("visibility","eq","hidden");
     const existingIds=new Set(mapped.map(p=>p.id));
     (pinnedData||[]).forEach(p=>{if(!existingIds.has(p.id))mapped.push(mapDbPost(p,followedIds));});
   }
   const blockedSet=new Set([...blockedUserIds,...mutedAuthorIds]);
const myId=session?.user?.id;
const myCountry=myProfile?.country||"CG";
const{data:completedRows}=myId?await sb.from("video_engagement_events").select("post_id").eq("viewer_id",myId).eq("completed",true):{data:[]};
const completedIds=new Set((completedRows||[]).map(r=>r.post_id));

const visible=mapped.filter(p=>{
  if(blockedSet.has(p.by))return false;
  if(p.author?.status==="suspended")return false;
  if(completedIds.has(p.id)&&!p.pinned)return false; // déjà vu en entier → exclu du feed
  if(p.pinned)return true;
if(p.visibility==="testing"&&p.by!==myId&&!followedIds.has(p.by))return false;
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
const seenIds=new Set(JSON.parse(localStorage.getItem("celeste_seen_posts")||"[]"));
const rankingData=await fetchRankingData(sb,{postIds:visible.map(p=>p.id),viewerId:session?.user?.id});
const viewerLocation=(myProfile?.latitude!=null&&myProfile?.longitude!=null)?{lat:myProfile.latitude,lon:myProfile.longitude}:null;
const communityIds=await fetchCommunityIds(sb,session?.user?.id);
const frequentIds=await fetchFrequentlyVisitedIds(sb,session?.user?.id);
const viralShuffled=rankPosts(viral,rankingData,viewerLocation,communityIds,frequentIds);
const badgeShuffled=rankPosts(withBadge,rankingData,viewerLocation,communityIds,frequentIds);
const noBadgeShuffled=rankPosts(noBadge,rankingData,viewerLocation,communityIds,frequentIds);
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
  try{localStorage.setItem("celeste_posts_cache",JSON.stringify(mixed2.slice(0,20)));}catch(e){}
}else{
 
  const filtered=mixed.filter(p=>!seenPostIdsRef.current.has(p.id));
  filtered.forEach(p=>seenPostIdsRef.current.add(p.id));
  setPosts(prev=>[...(prev||[]),...filtered]);
}
setHasMorePosts(data.length===PAGE_SIZE);setPostPage(page);
  }
},[session?.user?.id,blockedUserIds,mutedAuthorIds]);

  const loadMorePosts=useCallback(async()=>{if(loadingMore||!hasMorePosts)return;setLoadingMore(true);await loadPosts(postPage+1);setLoadingMore(false);},[loadingMore,hasMorePosts,postPage,loadPosts]);

  const refreshPost=useCallback(async pid=>{
    const{data}=await sb.from("posts").select(`id,author_id,type,text,mentions,img_url,media_urls,event_title,event_date,event_loc,pinned,profile_pinned,post_phase,visibility,text_background,is_for_sale,is_private,whatsapp_contact,contact_link,expires_at,phase_views,created_at,sound_id,sound:sounds!posts_sound_id_fkey(id,title,url,created_by,owner:profiles!created_by(avatar_url)),author:profiles(id,prenom,nom,badge,avatar_url,paroisse,status,screenshot_protection,latitude,longitude),likes(user_id),comments(id,text,created_at,author:profiles(id,prenom,nom,avatar_url))`).eq("id",pid).single();
    if(!data)return null;
    const updated={id:data.id,by:data.author_id,author:normProfile(data.author||{}),type:data.type,text:data.text||"",img:data.img_url||null,media_urls:data.media_urls||[],title:data.event_title||null,eventDate:data.event_date||null,eventLoc:data.event_loc||null,likes:(data.likes||[]).map(l=>l.user_id),comments:(data.comments||[]).map(c=>({id:c.id,by:c.author?.id,author:normProfile(c.author||{}),text:c.text,ts:new Date(c.created_at).getTime()})),saved:[],ts:new Date(data.created_at).getTime(),text_background:data.text_background||null,is_for_sale:data.is_for_sale||false,is_private:data.is_private||false,whatsapp_contact:data.whatsapp_contact||null,contact_link:data.contact_link||null,expires_at:data.expires_at||null,pinned:data.pinned||false,profile_pinned:data.profile_pinned||false,post_phase:data.post_phase||null,visibility:data.visibility||null,sound:data.sound?{id:data.sound.id,title:data.sound.title,url:data.sound.url,owner_avatar:data.sound.owner?.avatar_url||null}:null};
    setPosts(prev=>(prev||[]).map(p=>p.id===pid?updated:p));
return updated;
  },[]);

 const loadConvs=useCallback(async myId=>{
    if(!myId)return;
    const[{data},{data:blockedData},{data:blockedMeData}]=await Promise.all([
      sb.from("conversations").select(`*,messages(id,sender_id,type,text,file_url,file_name,is_read,created_at,reply_metadata,reply_to_id,reply_to_text,reply_to_author,reactions,edited_at,sticker_id,shared_post_id)`).or(`user1_id.eq.${myId},user2_id.eq.${myId}`).order("created_at",{ascending:false}),
      sb.from("blocks").select("blocked_id").eq("blocker_id",myId),
      sb.from("blocks").select("blocker_id").eq("blocked_id",myId)
    ]);
    if(data){
      const blocked=new Set([...(blockedData||[]).map(b=>b.blocked_id),...(blockedMeData||[]).map(b=>b.blocker_id)]);
      const mapped=data.map(c=>({id:c.id,uid:c.user1_id===myId?c.user2_id:c.user1_id,msgs:(c.messages||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(m=>({id:m.id,f:m.sender_id===myId?"me":m.sender_id,type:m.type,text:m.text||"",img:m.file_url,fileName:m.file_name,read:m.is_read,ts:new Date(m.created_at).getTime(),reply_metadata:typeof m.reply_metadata==="string"?JSON.parse(m.reply_metadata):m.reply_metadata||null,reply_to_id:m.reply_to_id||null,reply_to_text:m.reply_to_text||null,reply_to_author:m.reply_to_author||null,reactions:m.reactions||null,edited_at:m.edited_at||null,sticker_id:m.sticker_id||null,shared_post_id:m.shared_post_id||null}))}));
      const filtered=mapped.filter(c=>!blocked.has(c.uid));
      setConvs(filtered);
      try{localStorage.setItem("celeste_convs_cache",JSON.stringify(filtered));}catch(e){}
      return filtered;
    }return null;
  },[]);
  useEffect(()=>{
  if(session===null||(session&&isPending))setFeedPreloaded(true);
},[session,isPending]);
useEffect(()=>{
  if(session?.user?.id&&myProfile?.id&&!isPending){
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
    const ch=sb.channel("celeste_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},async payload=>{
        const nm=payload.new;
        setConvs(prev=>(prev||[]).map(cv=>{
          if(cv.id!==nm.conv_id)return cv;
          const alreadyExists=(cv.msgs||[]).some(m=>m.id===nm.id);
          if(alreadyExists)return cv;
          const newMsg={id:nm.id,f:nm.sender_id===myId?"me":nm.sender_id,type:nm.type,text:nm.text||"",img:nm.file_url,fileName:nm.file_name,read:nm.is_read,ts:new Date(nm.created_at).getTime(),reply_metadata:nm.reply_metadata||null};
          return{...cv,msgs:[...(cv.msgs||[]),newMsg]};
        }));
        if(nm.sender_id===myId)return;
        const updated=await loadConvs(myId);
        if(updated){
          const totalNew=(updated||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
          if(totalNew>prevMsgCount.current){const conv=(updated||[]).find(c=>(c.msgs||[]).some(m=>m.id===nm.id));const sender=(members||[]).find(m=>m.id===nm.sender_id);const preview=nm.type==="photo"?"📷 Photo":nm.type==="file"?"📎 Fichier":nm.text||"";addInAppNotif("✉",sender?.name||"Message",preview,()=>{setTab("messages");setTimeout(()=>{if(conv?.id){setOpenConvId(conv.id);}},100);});}
          prevMsgCount.current=totalNew;
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},payload=>{
        const updated=payload.new;
        setConvs(prev=>(prev||[]).map(c=>({
          ...c,
          msgs:(c.msgs||[]).map(m=>m.id===updated.id?{...m,...updated}:m)
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
        if(updated&&updated.by===myId&&payload.new?.user_id!==myId){const liker=(members||[]).find(m=>m.id===payload.new.user_id);addInAppNotif("❤️",`${liker?.name||"Quelqu'un"} a aimé`,updated.text||updated.title||"ta publication",()=>{setTab("home");setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:payload.new.post_id}})),300);});}
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"likes"},payload=>{if(payload.old?.post_id)refreshPost(payload.old.post_id);})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comments"},async payload=>{
        const cmt=payload.new;if(!cmt?.post_id)return;
        const updated=await refreshPost(cmt.post_id);
        if(updated&&updated.by===myId&&cmt.author_id!==myId){const commenter=(members||[]).find(m=>m.id===cmt.author_id);addInAppNotif("💬",`${commenter?.name||"Quelqu'un"} a commenté`,cmt.text||"…",()=>{setTab("home");setTimeout(()=>window.dispatchEvent(new CustomEvent("celeste_open_post",{detail:{postId:cmt.post_id}})),300);});}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comment_likes"},async payload=>{
        // Notification pour likes de commentaires
        const cl=payload.new;if(!cl||cl.user_id===myId)return;
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
        if(payload.new?.to_id===myId){await loadConnections(myId);const follower=(members||[]).find(m=>m.id===payload.new.from_id);addInAppNotif("✦",`${follower?.name||"Quelqu'un"} s'est connecté`,"Nouvelle connexion !",()=>setTab("discover"));}
        else if(payload.new?.from_id===myId)loadConnections(myId);
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"connections"},async payload=>{
        loadConnections(myId);
        if(payload.old?.to_id===myId){const who=(members||[]).find(m=>m.id===payload.old.from_id);addInAppNotif("👋",`${who?.name||"Quelqu'un"} s'est désabonné`,"",()=>setTab("discover"));}
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
 if(t==="home"){loadPosts(1);feedScrollRef.current=0;document.querySelector("[data-feed-scroll]")?.scrollTo({top:0,behavior:"smooth"});} if(t==="statuses")setUnreadStatuses(0);
if(t!=="home")feedScrollRef.current=document.querySelector("[data-feed-scroll]")?.scrollTop||feedScrollRef.current;
setTab(t);setOpenConvId(null);setOpenUserId(null);setShowNotifs(false);setHideNav(false);
};
  const unread=(convs||[]).reduce((a,c)=>a+(c.msgs||[]).filter(m=>m.f!=="me"&&!m.read).length,0);
  const pending=(members||[]).filter(m=>m.status==="pending").length;
  const getM=id=>{if(id==="me"||id===session?.user?.id)return myProfile;return(members||[]).find(m=>m.id===id)||{id:"?",initials:"?",color:"#888",name:"Inconnu",badge:null};};
  const openConv=(convs||[]).find(c=>c.id===openConvId);
  const openChat=uid=>{setOpenUserId(null);let c=(convs||[]).find(x=>x.uid===uid);if(!c){c={id:"cv"+Date.now(),uid,msgs:[]};setConvs(p=>[...(p||[]),c]);}pushNav(()=>setOpenConvId(null));setOpenConvId(c.id);setTab("messages");};

  // AppContext value
  const appCtx={
    session,myProfile,setMyProfile:()=>{},
    setTab,members,posts,convs,
    notify,
    chatDrafts,setChatDrafts,
    hideNav,setHideNav,
    onlinePresenceIds,
  };

  // Splash screen
  if(session===undefined||(session&&!isPending&&!feedPreloaded)) return(<SplashScreen/>);

  if(!session) return(<><style>{getGS()}</style><AuthScreen mode={authMode} setMode={setAuthMode} onSuccess={state=>{if(state==="pending")setIsPending(true);}}/></>);

  if(myProfile?.status==="suspended") return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{getGS()}</style>
      <div style={{maxWidth:400,width:"100%",textAlign:"center",animation:"fadeUp .5s ease"}}>
        <div style={{fontSize:60,marginBottom:20}}>
          🚫</div>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:300,color:T.err,marginBottom:12}}>Compte suspendu</h2>
        <p style={{color:T.sub,fontSize:14,lineHeight:1.8,marginBottom:28}}>Votre compte a été suspendu par un administrateur.<br/>Pour toute question, contactez le support de la communauté.</p>
        <Btn onClick={()=>{if(window.confirm("Se déconnecter ?"))sb.auth.signOut();}} style={{padding:"13px 30px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>
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
        <Btn onClick={()=>{if(window.confirm("Se déconnecter ?"))sb.auth.signOut();}} style={{padding:"13px 30px",background:"rgba(200,64,64,0.08)",border:`1px solid ${T.err}44`,borderRadius:14,color:T.err,fontSize:14,fontWeight:600}}>Se déconnecter</Btn>

<VerificationInfoModal/>
      </div>
    </div>
  );
  if(myProfile&&!myProfile.quiz_completed) return(
    <ContentQuizModal sb={sb} userId={session.user.id} T={T} onDone={()=>setMyProfile(p=>({...p,quiz_completed:true}))}/>
  );
  return(
    <AppContext.Provider value={appCtx}>
      <div style={{display:"flex",flexDirection:"column",height:"100svh",background:T.bg,color:T.text,fontFamily:"'DM Sans',sans-serif"}}>
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
        {showAdmin&&myProfile?.is_admin&&<AdminPanel onClose={()=>{popNav();setShowAdmin(false);}} notify={notify} reload={loadMembers} reloadPosts={()=>loadPosts(1)} session={session}/>}
{openCeleste&&<CelesteChatScreen msgs={celesteMsgs} setMsgs={setCelesteMsgs} onClose={()=>{popNav();setOpenCeleste(false);}} myProfile={myProfile} session={session}/>}

        <div style={{height:56,background:T.bg2,backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",borderBottom:`1px solid ${T.border}`,display:(hideNav||openConvId)?"none":"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0,zIndex:30}}>
          {(openConvId||openUserId)
            ?<>
              <Btn onClick={()=>{setOpenConvId(null);setOpenUserId(null);}} style={{color:T.gold,padding:"0 8px 0 0",display:"flex",alignItems:"center"}}><ChevronLeft size={24}/></Btn>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:400,color:T.text}}>{openConvId?getM(openConv?.uid)?.name:openUser?.name}</span>
            </>
            :<>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:T.gold,filter:"drop-shadow(0 0 10px rgba(201,149,42,0.5))",letterSpacing:2}}>✦</span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:300,letterSpacing:4,color:T.text}}>Céleste</span>
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
            <div style={{position:"absolute",top:56,left:0,right:0,background:T.bg3,borderBottom:`1px solid ${T.border}`,maxHeight:"70vh",overflowY:"auto",animation:"slideDown .25s ease"}} onClick={e=>e.stopPropagation()}>
              <NotifsScreen myProfile={myProfile} session={session} members={members}/>
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          {openUserId&&openUser&&(
            openUser.account_type==="organisation"
              ?<OrgView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>{popNav();setOpenUserId(null);}} onChat={openChat} notify={notify} myConnections={myConnections} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers().then(ids=>setPosts(prev=>(prev||[]).filter(p=>!ids.includes(p.by))));}} onImageView={setViewImg}/>
              :<UserView user={openUser} myProfile={myProfile} session={session} posts={posts} onBack={()=>{popNav();setOpenUserId(null);}} onChat={openChat} notify={notify} myConnections={myConnections} myFollowers={myFollowers} onConnectionChange={()=>{loadConnections(session?.user?.id);loadBlockedUsers().then(ids=>setPosts(prev=>(prev||[]).filter(p=>!ids.includes(p.by))));}} onImageView={setViewImg} popNav={popNav} userPostsVersion={userPostsVersion} toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}} toggleSave={async pid=>{const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});}}/>
          )}
          {!openUserId&&openConvId&&openConv&&(
            <ChatScreen conv={openConv} myProfile={myProfile} session={session} members={members} reload={()=>loadConvs(session?.user?.id)} notify={notify} onImageView={setViewImg} onOpenProfile={uid=>{setOpenConvId(null);pushNav(()=>setOpenUserId(null));setOpenUserId(uid);}} onBack={()=>{popNav();setOpenConvId(null);}}/>
          )}
          <div style={{display:openUserId||openConvId?"none":"flex",flexDirection:"column",flex:1,minHeight:0}}>
              <div style={{display:tab==="home"?"flex":"none",flexDirection:"column",flex:1,minHeight:0}}>
  <HomeTab posts={posts} setPosts={setPosts} myProfile={myProfile} session={session} getM={getM} onNewPost={()=>{pushNav(()=>setShowNewPost(false));setShowNewPost(true);}} onUseSoundForPost={(sound)=>{setPendingSound(sound);pushNav(()=>setShowNewPost(false));setShowNewPost(true);}} onUser={id=>{pushNav(()=>setOpenUserId(null));setOpenUserId(id);}} notify={notify} reload={()=>loadPosts(1)} loadMore={loadMorePosts} hasMore={hasMorePosts} loadingMore={loadingMore} refreshPost={refreshPost} onImageView={setViewImg} myConnections={myConnections} onConnect={async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");}} initialScroll={feedScrollRef.current} onScrollChange={pos=>feedScrollRef.current=pos} pushNav={pushNav} popNav={popNav} onMuteAuthor={authorId=>setMutedAuthorIds(prev=>[...new Set([...prev,authorId])])} viewedPostIdsRef={viewedPostIdsRef}/>
</div>
              <div style={{display:tab==="statuses"?"flex":"none",flexDirection:"column",flex:1,minHeight:0}}>
                <StatusesTab myProfile={myProfile} session={session} members={members} myConnections={myConnections} myFollowers={myFollowers} notify={notify} blockedUserIds={blockedUserIds} pushNav={pushNav} popNav={popNav}/>
              </div>
              {tab==="discover"&&<DiscoverTab members={members} myProfile={myProfile} session={session} onUser={id=>{pushNav(()=>setOpenUserId(null));setOpenUserId(id);}} notify={notify} myConnections={myConnections} myFollowers={myFollowers} onConnectionChange={()=>loadConnections(session?.user?.id)} openChat={openChat}/>}
              {tab==="messages"&&<MsgsTab convs={convs} getM={getM} session={session} onOpen={id=>{pushNav(()=>setOpenConvId(null));setOpenConvId(id);}} onDeleteConv={async id=>{await sb.from("messages").delete().eq("conv_id",id);await sb.from("conversations").delete().eq("id",id);setConvs(p=>(p||[]).filter(c=>c.id!==id));}} onOpenCeleste={()=>{pushNav(()=>setOpenCeleste(false));setOpenCeleste(true);}}/>}
             {tab==="profile"&&<ProfileTab myProfile={myProfile} session={session} posts={posts} onNewPost={()=>{pushNav(()=>setShowNewPost(false));setShowNewPost(true);}} userPostsVersion={userPostsVersion} notify={notify} onLogout={()=>sb.auth.signOut()} reload={()=>{loadPosts(1);loadMyProfile(session?.user?.id);}} myConnections={myConnections} myFollowers={myFollowers} onImageView={setViewImg} getM={getM} toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}} toggleSave={async pid=>{const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",session?.user?.id).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",session?.user?.id);else await sb.from("saved_posts").insert({post_id:pid,user_id:session?.user?.id});}} onConnect={async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");}}/>}
<ParametresModal myProfile={myProfile} session={session} onLogout={()=>sb.auth.signOut()} notify={notify} navTheme={navTheme} onChooseNavTheme={chooseNavTheme}/>
            </div>
        </div>
        {detailPost&&<PostDetailModal post={detailPost} myProfile={myProfile} session={session} getM={getM} onClose={()=>{popNav();setDetailPost(null);}} onLike={async pid=>{await sb.from("likes").upsert({post_id:pid,user_id:session?.user?.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});const u=await refreshPost(pid);if(u)setDetailPost(u);}} onComment={async()=>{const u=await refreshPost(detailPost.id);if(u)setDetailPost(u);}} notify={notify}/>}
{globalReelsPost&&(
  <ReelsViewer
    posts={[globalReelsPost]} sb={sb} startIndex={0}
    session={session} myProfile={myProfile} notify={notify}
    toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}}
    toggleSave={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("saved_posts").insert({post_id:pid,user_id:uid});}}
    onUser={id=>{setGlobalReelsPost(null);pushNav(()=>setOpenUserId(null));setOpenUserId(id);}}
    myConnections={myConnections}
    onConnect={async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");}}
    onClose={()=>setGlobalReelsPost(null)}
  />
)}
{globalPhotoPost&&(
  <PhotoViewer
    posts={[globalPhotoPost]} sb={sb} startIndex={0}
    session={session} myProfile={myProfile} notify={notify}
    toggleLike={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("likes").select("user_id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("likes").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("likes").upsert({post_id:pid,user_id:uid},{onConflict:"post_id,user_id",ignoreDuplicates:true});}}
    toggleSave={async pid=>{const uid=session?.user?.id;const{data:ex}=await sb.from("saved_posts").select("id").eq("post_id",pid).eq("user_id",uid).maybeSingle();if(ex)await sb.from("saved_posts").delete().eq("post_id",pid).eq("user_id",uid);else await sb.from("saved_posts").insert({post_id:pid,user_id:uid});}}
    onUser={id=>{setGlobalPhotoPost(null);pushNav(()=>setOpenUserId(null));setOpenUserId(id);}}
    myConnections={myConnections}
    onConnect={async id=>{await sb.from("connections").insert({from_id:session.user.id,to_id:id});loadConnections(session.user.id);notify("Connecté ✦");}}
    onClose={()=>setGlobalPhotoPost(null)}
  />
)}
        {/* Bottom nav premium */}
       {!openConvId&&!openUserId&&!hideNav&&(
          <div style={{height:66,position:"relative",overflow:"hidden",flexShrink:0,zIndex:30}}>
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
    </AppContext.Provider>
  );
}

export default function App(){
  return(<ErrorBoundary><CelesteApp/></ErrorBoundary>);
}