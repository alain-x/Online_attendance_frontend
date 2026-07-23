import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import {
  listChatRooms, createChatRoom, createOrGetDirectChat, getChatMessages,
  sendMessage, uploadChatFile, searchChatUsers, getChatParticipants,
  deleteChatMessage,
} from '../../api/sports';
import type { ChatRoom, ChatMessage, ChatParticipant, SendMessageRequest } from '../../api/types';
import { getApiErrorMessage } from '../../utils/error';

const EMOJI_LIST = [
  "\u{1F600}","\u{1F602}","\u{1F60D}","\u{1F929}","\u{1F60E}","\u{1F914}","\u{1F622}","\u{1F621}",
  "\u{1F44D}","\u{1F44E}","\u{1F44F}","\u{1F64F}","\u{1F525}","\u{1F4AF}","\u2764\uFE0F","\u{1F494}",
  "\u{1F389}","\u{1F680}","\u2705","\u274C","\u2B50","\u{1F4A1}","\u{1F4CC}","\u{1F3AF}",
  "\u{1F4B0}","\u{1F4AA}","\u{1F91D}","\u{1F64B}","\u{1F3B6}","\u{1F4AD}"
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function isImageFile(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

type ChatPageProps = {
  onUnreadCleared?: () => void;
};

export default function ChatPage({ onUnreadCleared }: ChatPageProps) {
  const { toast, showToast, hideToast } = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; username: string; email: string | null; role: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupMembers, setGroupMembers] = useState<{ id: number; username: string }[]>([]);
  const [groupSearchResults, setGroupSearchResults] = useState<{ id: number; username: string; email: string | null; role: string }[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<ChatMessage | null>(null);
  const [deletingFor, setDeletingFor] = useState<'everyone' | 'me' | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCaption, setPreviewCaption] = useState('');
  const [lightboxMsg, setLightboxMsg] = useState<ChatMessage | null>(null);
  const seenTimestamps = useRef<Map<number, string>>(new Map());
  const prevRoomsRef = useRef<ChatRoom[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const refresh = useCallback(async (checkNew = true) => {
    try {
      const r = await listChatRooms();
      const prevRooms = prevRoomsRef.current;
      if (checkNew && prevRooms.length > 0) {
        setUnreadCounts(prevCounts => {
          const next = { ...prevCounts };
          for (const room of r) {
            if (room.lastMessageAt && room.id !== selectedRoom?.id) {
              const seen = seenTimestamps.current.get(room.id);
              if (seen && room.lastMessageAt > seen) {
                next[room.id] = (next[room.id] || 0) + 1;
              }
            }
            if (room.lastMessageAt) {
              seenTimestamps.current.set(room.id, room.lastMessageAt);
            }
          }
          return next;
        });
      } else {
        for (const room of r) {
          if (room.lastMessageAt) {
            seenTimestamps.current.set(room.id, room.lastMessageAt);
          }
        }
      }
      prevRoomsRef.current = r;
      setRooms(r);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load chats'), 'error');
    } finally {
      setInitialLoaded(true);
    }
  }, [showToast, selectedRoom?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedRoom) {
        getChatMessages(selectedRoom.id).then(setMessages).catch(() => {});
      }
      refresh(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedRoom, refresh]);

  const loadMessages = useCallback(async (roomId: number) => {
    setMessagesLoading(true);
    try {
      const data = await getChatMessages(roomId);
      setMessages(data);
      const myId = data.find(m => m.senderId > 0)?.senderId;
      if (myId && !currentUserId) setCurrentUserId(myId);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load messages'), 'error');
    } finally {
      setMessagesLoading(false);
    }
  }, [showToast, currentUserId]);

  const loadParticipants = useCallback(async (roomId: number) => {
    try {
      const data = await getChatParticipants(roomId);
      setParticipants(data);
      if (data.length > 0 && !currentUserId) {
        setCurrentUserId(data[0].userId);
      }
    } catch { setParticipants([]); }
  }, [currentUserId]);

  async function openRoom(room: ChatRoom) {
    setSelectedRoom(room);
    setMessages([]);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[room.id]; return n; });
    onUnreadCleared?.();
    await Promise.all([loadMessages(room.id), loadParticipants(room.id)]);
  }

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return sortedRooms;
    const q = searchQuery.toLowerCase();
    return sortedRooms.filter(r => r.name.toLowerCase().includes(q));
  }, [sortedRooms, searchQuery]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !selectedRoom || sending) return;
    setSending(true);
    try {
      const payload: SendMessageRequest = { content: messageInput.trim() };
      if (replyingTo) {
        payload.parentMessageId = replyingTo.id;
      }
      await sendMessage(selectedRoom.id, payload);
      setMessageInput('');
      setReplyingTo(null);
      await loadMessages(selectedRoom.id);
      await refresh();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to send'), 'error');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  function insertEmoji(emoji: string) {
    setMessageInput(p => p + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;
    if (isImageFile(file.type)) {
      const url = URL.createObjectURL(file);
      setPreviewFile(file);
      setPreviewUrl(url);
      setPreviewCaption('');
    } else {
      setSending(true);
      try {
        const uploaded = await uploadChatFile(file);
        await sendMessage(selectedRoom.id, {
          messageType: 'FILE',
          fileUrl: uploaded.fileUrl,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
        });
        await loadMessages(selectedRoom.id);
        await refresh();
      } catch (err) {
        showToast(getApiErrorMessage(err, 'Failed to upload file'), 'error');
      } finally {
        setSending(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSendImageWithCaption() {
    if (!previewFile || !selectedRoom) return;
    setSending(true);
    try {
      const uploaded = await uploadChatFile(previewFile);
      await sendMessage(selectedRoom.id, {
        content: previewCaption.trim() || undefined,
        messageType: 'IMAGE',
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
      });
      setPreviewFile(null);
      setPreviewUrl(null);
      setPreviewCaption('');
      await loadMessages(selectedRoom.id);
      await refresh();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to upload'), 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleNewDirectChat(targetUserId: number) {
    try {
      const room = await createOrGetDirectChat(targetUserId);
      setShowNewChat(false);
      setUserSearchQuery('');
      setSearchResults([]);
      await refresh();
      openRoom(room);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to start chat'), 'error');
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || groupMembers.length === 0) {
      showToast('Group name and at least one member required', 'warning');
      return;
    }
    setCreating(true);
    try {
      const room = await createChatRoom({
        name: groupName.trim(),
        type: 'GROUP',
        isGroup: true,
        participantIds: groupMembers.map(m => m.id),
      });
      setShowCreateGroup(false);
      setGroupName('');
      setGroupMembers([]);
      await refresh();
      openRoom(room);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to create group'), 'error');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!showNewChat) return;
    const timer = setTimeout(async () => {
      if (!userSearchQuery.trim()) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const results = await searchChatUsers(userSearchQuery);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, showNewChat]);

  useEffect(() => {
    if (!showCreateGroup) return;
    const timer = setTimeout(async () => {
      if (!groupSearch.trim()) { setGroupSearchResults([]); return; }
      try {
        const results = await searchChatUsers(groupSearch);
        setGroupSearchResults(results);
      } catch { setGroupSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [groupSearch, showCreateGroup]);

  function isOwnMessage(msg: ChatMessage): boolean {
    if (!currentUserId) return false;
    return participants.some(p => p.userId === msg.senderId && p.userId === currentUserId)
      || msg.senderId === currentUserId;
  }

  function getSenderName(msg: ChatMessage): string {
    const p = participants.find(p => p.userId === msg.senderId);
    return p?.username || msg.senderName;
  }

  function renderMessage(msg: ChatMessage) {
    const own = isOwnMessage(msg);
    return (
      <div key={msg.id} className={`group flex ${own ? 'justify-end' : 'justify-start'} mb-2 relative animate-fade-in`}>
        <div className="max-w-[75%]">
          {!own && (selectedRoom?.isGroup || selectedRoom?.type === 'GROUP') && (
            <p className="text-[11px] text-slate-400 mb-0.5 px-1 font-medium">{getSenderName(msg)}</p>
          )}
          <div className={`rounded-2xl px-4 py-2.5 break-words shadow-sm ${own ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-white border border-slate-200 rounded-bl-sm'}`}>
            {msg.parentMessageId && msg.parentContent && (
              <div className={`mb-2 px-3 py-1.5 rounded-lg text-xs border-l-4 ${own ? 'bg-blue-600/70 border-blue-300' : 'bg-slate-100 border-slate-400'}`}>
                <p className={`font-semibold ${own ? 'text-blue-200' : 'text-slate-500'}`}>{msg.parentSenderName || 'Unknown'}</p>
                <p className={`truncate ${own ? 'text-blue-100' : 'text-slate-600'}`}>{msg.parentContent}</p>
              </div>
            )}
            {(msg.messageType === 'IMAGE' || (isImageFile(msg.mimeType) && msg.fileUrl)) && msg.fileUrl && (
              <div className="mb-2">
                <div className="relative group/img rounded-lg overflow-hidden border border-black/5">
                  <img src={msg.fileUrl} alt="Shared"
                    className="max-w-full max-h-72 w-full object-cover cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
                    onClick={() => setLightboxMsg(msg)}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <button type="button" onClick={() => setLightboxMsg(msg)}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors">
                    <svg className="w-8 h-8 text-white opacity-0 group-hover/img:opacity-100 drop-shadow-lg transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </button>
                </div>
                {msg.fileSize != null && (
                  <p className={`text-[10px] mt-1 ${own ? 'text-blue-200' : 'text-slate-400'}`}>{formatFileSize(msg.fileSize)}</p>
                )}
              </div>
            )}
            {msg.messageType === 'FILE' && msg.fileUrl && (
              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-2 mb-1 px-3 py-2 rounded-lg ${own ? 'bg-blue-600' : 'bg-slate-100'} hover:opacity-80 transition`}>
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${own ? 'text-white' : 'text-slate-900'}`}>{msg.fileName || 'File'}</p>
                  {msg.fileSize != null && <p className={`text-[11px] ${own ? 'text-blue-200' : 'text-slate-400'}`}>{formatFileSize(msg.fileSize)}</p>}
                </div>
              </a>
            )}
            {msg.content && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
            <p className={`text-[10px] mt-1.5 text-right font-medium ${own ? 'text-blue-200' : 'text-slate-400'}`}>{formatTime(msg.createdAt)}</p>
          </div>
        </div>
        <div className={`absolute ${own ? 'left-0 -translate-x-full pl-1' : 'right-0 translate-x-full pr-1'} top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
          <button type="button" onClick={() => setReplyingTo(msg)}
            className="h-7 w-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all text-xs" title="Reply">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
          </button>
          <button type="button" onClick={() => { setForwardMsg(msg); setShowForwardModal(true); }}
            className="h-7 w-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-green-500 hover:border-green-300 transition-all text-xs" title="Forward">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
          {own && (
            <button type="button" onClick={() => setDeleteConfirmMsg(msg)}
              className="h-7 w-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-all text-xs" title="Delete">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
          {!own && (
            <button type="button" onClick={() => setDeleteConfirmMsg(msg)}
              className="h-7 w-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-all text-xs" title="Hide">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!initialLoaded) {
    return <div className="flex items-center justify-center h-[calc(100vh-12rem)]"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] -mx-6 -mb-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Left sidebar - conversation list */}
      <div className={`${selectedRoom ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r bg-white flex-shrink-0`}>
        <div className="px-4 py-4 border-b bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <h2 className="text-lg font-bold text-slate-900">Chats</h2>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setShowNewChat(true)}
                className="h-9 w-9 rounded-full hover:bg-blue-100 flex items-center justify-center text-blue-600 transition-colors" title="New Chat">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
              <button type="button" onClick={() => setShowCreateGroup(true)}
                className="h-9 w-9 rounded-full hover:bg-green-100 flex items-center justify-center text-green-600 transition-colors" title="New Group">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations..." className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="py-12"><EmptyState title="No conversations" description="Start a new chat or create a group." /></div>
          ) : (
            filteredRooms.map(room => (
              <button key={room.id} type="button" onClick={() => openRoom(room)}
                className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-all border-b border-slate-100 ${selectedRoom?.id === room.id ? 'bg-blue-50/60 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}`}>
                <div className={`h-11 w-11 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm ${room.isGroup ? 'bg-gradient-to-br from-green-400 to-green-600' : room.type === 'DIRECT' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-purple-400 to-purple-600'}`}>
                  {room.isGroup ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  ) : room.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 truncate">{room.name}</h3>
                      {unreadCounts[room.id] > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-sm">{unreadCounts[room.id] > 99 ? '99+' : unreadCounts[room.id]}</span>
                      )}
                    </div>
                    {room.lastMessageAt && <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2 font-medium">{formatTime(room.lastMessageAt)}</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {room.lastMessageContent ? (
                      <>{room.lastMessageSenderName && <span className="font-medium text-slate-600">{room.lastMessageSenderName}: </span>}{room.lastMessageContent}</>
                    ) : (
                      <span className="italic text-slate-400">No messages yet</span>
                    )}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel - message area */}
      <div className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-gradient-to-b from-slate-50 to-slate-100`}>
        {selectedRoom ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200/80">
              <button type="button" onClick={() => setSelectedRoom(null)}
                className="md:hidden h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className={`h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm ring-2 ring-white ${selectedRoom.isGroup ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                {selectedRoom.isGroup ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                ) : selectedRoom.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-slate-900 truncate">{selectedRoom.name}</h3>
                  {selectedRoom.isGroup && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Group</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedRoom.isGroup
                    ? `${selectedRoom.participantCount || participants.length} member${(selectedRoom.participantCount || participants.length) !== 1 ? 's' : ''}`
                    : 'Direct Message'}
                </p>
              </div>
              <button type="button" onClick={() => { loadParticipants(selectedRoom.id); setShowParticipants(true); }}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors" title="Info">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {messagesLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-5xl mb-3 opacity-60">{'\u{1F4AC}'}</div>
                    <p className="text-slate-400 text-sm font-medium">No messages yet</p>
                    <p className="text-slate-400 text-xs mt-1">Send a message to start the conversation</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(renderMessage)}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Reply bar */}
            {replyingTo && (
              <div className="bg-blue-50 border-t border-blue-200 px-4 py-2.5 flex items-center gap-3 text-sm">
                <div className="w-0.5 h-8 bg-blue-400 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-600">Replying to {replyingTo.senderName}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{replyingTo.content || (replyingTo.fileName ? 'Shared a file' : (replyingTo.messageType === 'IMAGE' ? 'Shared an image' : ''))}</p>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)}
                  className="h-6 w-6 rounded-full hover:bg-blue-100 flex items-center justify-center text-slate-400 flex-shrink-0 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Message input */}
            <form onSubmit={handleSend} className="bg-white border-t px-4 py-3 flex items-end gap-2 shadow-sm">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0 transition-colors" title="Attach file">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              <div className="relative flex-1">
                <input ref={messageInputRef} type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown} placeholder="Type a message..." disabled={sending}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 transition-shadow" />
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="absolute bottom-12 right-0 bg-white border rounded-xl shadow-xl p-3 z-10 w-72">
                    <div className="grid grid-cols-6 gap-1">
                      {EMOJI_LIST.map(emoji => (
                        <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}
                          className="h-9 w-9 rounded-lg hover:bg-slate-100 text-lg flex items-center justify-center transition-colors">{emoji}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={!messageInput.trim() || sending}
                className="h-9 w-9 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 flex items-center justify-center text-white disabled:opacity-50 flex-shrink-0 transition-colors shadow-sm">
                {sending ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-7-9-7v14z" /></svg>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-5">
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-1">Sports Club Chat</h3>
              <p className="text-slate-400 text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-16" onClick={() => setShowNewChat(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New Chat</h2>
                <p className="text-xs text-slate-400">Search for a user to start a direct conversation</p>
              </div>
            </div>
            <div className="relative mb-4">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Search users..." autoFocus
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" />
            </div>
            {searching && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Searching...
              </div>
            )}
            {!searching && searchResults.length === 0 && userSearchQuery.trim() && (
              <div className="text-center py-6">
                <div className="text-3xl mb-2 opacity-50">{'\u{1F50D}'}</div>
                <p className="text-sm text-slate-400">No users found</p>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {searchResults.map(u => (
                <button key={u.id} type="button" onClick={() => handleNewDirectChat(u.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 hover:border-blue-200 border border-transparent flex items-center gap-3 transition-all">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{u.username}</p>
                    <p className="text-xs text-slate-400">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setShowNewChat(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-16" onClick={() => setShowCreateGroup(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create Group</h2>
                <p className="text-xs text-slate-400">Create a group conversation</p>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Group Name</label>
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="Enter group name..." autoFocus
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Add Members</label>
              <div className="relative">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                  placeholder="Search users..." className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow" />
              </div>
            </div>
            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {groupMembers.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {m.username}
                    <button type="button" onClick={() => setGroupMembers(p => p.filter(x => x.id !== m.id))} className="ml-0.5 hover:text-green-900 transition-colors">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-1">
              {groupSearchResults.filter(u => !groupMembers.some(m => m.id === u.id)).length === 0 && groupSearch.trim() ? (
                <div className="text-center py-4 text-sm text-slate-400">No users found</div>
              ) : null}
              {groupSearchResults.filter(u => !groupMembers.some(m => m.id === u.id)).map(u => (
                <button key={u.id} type="button" onClick={() => setGroupMembers(p => [...p, { id: u.id, username: u.username }])}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 hover:border-green-200 border border-transparent flex items-center gap-3 transition-all">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{u.username}</p>
                    <p className="text-xs text-slate-400">{u.role}</p>
                  </div>
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateGroup(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="button" onClick={handleCreateGroup} disabled={creating || !groupName.trim() || groupMembers.length === 0}
                className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-5 py-2 text-sm font-medium text-white hover:from-green-600 hover:to-green-700 disabled:opacity-50 transition-all shadow-sm">
                {creating ? (
                  <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating...</span>
                ) : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-16" onClick={() => { setShowForwardModal(false); setForwardMsg(null); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Forward Message</h2>
                <p className="text-xs text-slate-500 truncate max-w-80">{forwardMsg.content || (forwardMsg.fileName ? `📎 ${forwardMsg.fileName}` : forwardMsg.messageType === 'IMAGE' ? '🖼 Image' : 'File')}</p>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 mb-4">
              {rooms.filter(r => r.id !== selectedRoom?.id).map(room => (
                <button key={room.id} type="button" disabled={forwarding}
                  onClick={async () => {
                    setForwarding(true);
                    try {
                      await sendMessage(room.id, {
                        content: forwardMsg.content || undefined,
                        messageType: forwardMsg.messageType,
                        fileUrl: forwardMsg.fileUrl || undefined,
                        fileName: forwardMsg.fileName || undefined,
                        fileSize: forwardMsg.fileSize || undefined,
                        mimeType: forwardMsg.mimeType || undefined,
                      });
                      showToast('Message forwarded', 'success');
                      setShowForwardModal(false);
                      setForwardMsg(null);
                    } catch {
                      showToast('Failed to forward', 'error');
                    } finally {
                      setForwarding(false);
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 hover:border-blue-200 border border-transparent flex items-center gap-3 disabled:opacity-50 transition-all">
                  <div className={`h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-sm ${room.isGroup ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                    {room.isGroup ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    ) : room.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{room.name}</p>
                    <p className="text-xs text-slate-400">{room.type === 'DIRECT' ? 'Direct Message' : 'Group'}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
              {rooms.filter(r => r.id !== selectedRoom?.id).length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2 opacity-50">{'\u{1F4E6}'}</div>
                  <p className="text-sm text-slate-400">No other chats available</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => { setShowForwardModal(false); setForwardMsg(null); }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirmMsg(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete message</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>
            <div className="space-y-2">
              {isOwnMessage(deleteConfirmMsg) && (
                <button type="button" disabled={deletingFor !== null}
                  onClick={async () => {
                    setDeletingFor('everyone');
                    try {
                      await deleteChatMessage(deleteConfirmMsg.roomId, deleteConfirmMsg.id, 'everyone');
                      await loadMessages(deleteConfirmMsg.roomId);
                      setDeleteConfirmMsg(null);
                      showToast('Message deleted for everyone', 'success');
                    } catch { showToast('Failed to delete', 'error'); }
                    finally { setDeletingFor(null); }
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 flex items-center gap-3 transition-colors disabled:opacity-50">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700">Delete for everyone</p>
                    <p className="text-xs text-red-500">Remove for all participants</p>
                  </div>
                  {deletingFor === 'everyone' && <svg className="animate-spin h-4 w-4 ml-auto text-red-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                </button>
              )}
              <button type="button" disabled={deletingFor !== null}
                onClick={async () => {
                  setDeletingFor('me');
                  try {
                    await deleteChatMessage(deleteConfirmMsg.roomId, deleteConfirmMsg.id, 'me');
                    await loadMessages(deleteConfirmMsg.roomId);
                    setDeleteConfirmMsg(null);
                    showToast('Message hidden', 'success');
                  } catch { showToast('Failed to hide', 'error'); }
                  finally { setDeletingFor(null); }
                }}
                className="w-full text-left px-4 py-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-3 transition-colors disabled:opacity-50">
                <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Delete for me</p>
                  <p className="text-xs text-slate-400">Hide from your view only</p>
                </div>
                {deletingFor === 'me' && <svg className="animate-spin h-4 w-4 ml-auto text-slate-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setDeleteConfirmMsg(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Participants Modal */}
      {showParticipants && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-16" onClick={() => setShowParticipants(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedRoom.name}</h2>
                <p className="text-xs text-slate-400">{participants.length} member{participants.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="space-y-1">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{p.username}</p>
                    <p className="text-xs text-slate-400">Joined {new Date(p.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setShowParticipants(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewUrl && previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => { setPreviewFile(null); setPreviewUrl(null); setPreviewCaption(''); }}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-sm font-semibold text-slate-900">Send Image</span>
              </div>
              <button type="button" onClick={() => { setPreviewFile(null); setPreviewUrl(null); setPreviewCaption(''); }}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-3">
              <img src={previewUrl} alt="Preview" className="w-full max-h-72 object-contain rounded-xl bg-slate-100" />
            </div>
            <div className="px-5 pb-4">
              <div className="flex gap-3">
                <input type="text" value={previewCaption} onChange={e => setPreviewCaption(e.target.value)}
                  placeholder="Add a caption..." className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendImageWithCaption(); } }} />
                <button type="button" onClick={handleSendImageWithCaption} disabled={sending}
                  className="rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2">
                  {sending ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-7-9-7v14z" /></svg> Send</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for full-size image */}
      {lightboxMsg && lightboxMsg.fileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setLightboxMsg(null)}>
          <button type="button" onClick={() => setLightboxMsg(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxMsg.fileUrl} alt="Full size"
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            {lightboxMsg.content && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-5 rounded-b-2xl">
                <p className="text-white text-sm">{lightboxMsg.content}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
