import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import {
  listChatRooms, createChatRoom, createOrGetDirectChat, getChatMessages,
  sendMessage, uploadChatFile, searchChatUsers, getChatParticipants,
} from '../../api/sports';
import type { ChatRoom, ChatMessage, ChatParticipant } from '../../api/types';
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

export default function ChatPage() {
  const { toast, showToast, hideToast } = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listChatRooms();
      setRooms(r);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to load chats'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!selectedRoom) return;
    const interval = setInterval(() => {
      getChatMessages(selectedRoom.id).then(setMessages).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedRoom]);

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
      await sendMessage(selectedRoom.id, { content: messageInput.trim() });
      setMessageInput('');
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
    setSending(true);
    try {
      const uploaded = await uploadChatFile(file);
      await sendMessage(selectedRoom.id, {
        messageType: isImageFile(file.type) ? 'IMAGE' : 'FILE',
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
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      <div key={msg.id} className={`flex ${own ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className="max-w-[75%]">
          {!own && (selectedRoom?.isGroup || selectedRoom?.type === 'GROUP') && (
            <p className="text-[11px] text-slate-400 mb-0.5 px-1">{getSenderName(msg)}</p>
          )}
          <div className={`rounded-2xl px-4 py-2.5 break-words ${own ? 'bg-blue-500 text-white rounded-br-md' : 'bg-white border border-slate-200 rounded-bl-md'}`}>
            {(msg.messageType === 'IMAGE' || (isImageFile(msg.mimeType) && msg.fileUrl)) && msg.fileUrl && (
              <div className="mb-2">
                <img src={msg.fileUrl} alt="Shared" className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer"
                  onClick={() => window.open(msg.fileUrl!, '_blank')} />
              </div>
            )}
            {msg.messageType === 'FILE' && msg.fileUrl && (
              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-2 mb-1 px-3 py-2 rounded-lg ${own ? 'bg-blue-600' : 'bg-slate-100'} hover:opacity-80 transition`}>
                <span className="text-lg">{'\u{1F4CE}'}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${own ? 'text-white' : 'text-slate-900'}`}>{msg.fileName || 'File'}</p>
                  {msg.fileSize != null && <p className={`text-[11px] ${own ? 'text-blue-200' : 'text-slate-400'}`}>{formatFileSize(msg.fileSize)}</p>}
                </div>
              </a>
            )}
            {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
            <p className={`text-[10px] mt-1 text-right ${own ? 'text-blue-200' : 'text-slate-400'}`}>{formatTime(msg.createdAt)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[calc(100vh-12rem)]"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] -mx-6 -mb-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Left sidebar - conversation list */}
      <div className={`${selectedRoom ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r bg-white flex-shrink-0`}>
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Chats</h2>
            <div className="flex gap-1">
              <button type="button" onClick={() => setShowNewChat(true)}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600" title="New Chat">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
              <button type="button" onClick={() => setShowCreateGroup(true)}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600" title="New Group">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..." className="w-full rounded-full bg-slate-100 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="py-8"><EmptyState title="No chats" description="Start a new conversation." /></div>
          ) : (
            filteredRooms.map(room => (
              <button key={room.id} type="button" onClick={() => openRoom(room)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition border-b border-slate-100 ${selectedRoom?.id === room.id ? 'bg-blue-50' : ''}`}>
                <div className={`h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm ${room.isGroup ? 'bg-green-500' : room.type === 'DIRECT' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                  {room.isGroup ? 'G' : room.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold text-sm text-slate-900 truncate">{room.name}</h3>
                    {room.lastMessageAt && <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">{formatTime(room.lastMessageAt)}</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {room.lastMessageContent ? (
                      <>{room.lastMessageSenderName && <span className="font-medium">{room.lastMessageSenderName}: </span>}{room.lastMessageContent}</>
                    ) : (
                      <span className="italic">No messages yet</span>
                    )}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel - message area */}
      <div className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-slate-100`}>
        {selectedRoom ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
              <button type="button" onClick={() => setSelectedRoom(null)}
                className="md:hidden h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className={`h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${selectedRoom.isGroup ? 'bg-green-500' : 'bg-blue-500'}`}>
                {selectedRoom.isGroup ? 'G' : selectedRoom.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-slate-900 truncate">{selectedRoom.name}</h3>
                <p className="text-[11px] text-slate-500">
                  {selectedRoom.isGroup ? `${selectedRoom.participantCount || participants.length} members` : selectedRoom.type}
                </p>
              </div>
              <button type="button" onClick={() => { loadParticipants(selectedRoom.id); setShowParticipants(true); }}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600" title="Info">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messagesLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-5xl mb-3">{'\u{1F4AC}'}</div>
                    <p className="text-slate-500 text-sm">No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(renderMessage)}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message input */}
            <form onSubmit={handleSend} className="bg-white border-t px-4 py-3 flex items-end gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0" title="Attach file">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              <div className="relative flex-1">
                <input ref={messageInputRef} type="text" value={messageInput} onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown} placeholder="Type a message..." disabled={sending}
                  className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 pr-10" />
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                  {'\u{1F60A}'}
                </button>
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="absolute bottom-12 right-0 bg-white border rounded-xl shadow-xl p-3 z-10 w-72">
                    <div className="grid grid-cols-6 gap-1">
                      {EMOJI_LIST.map(emoji => (
                        <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}
                          className="h-9 w-9 rounded-lg hover:bg-slate-100 text-lg flex items-center justify-center">{emoji}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={!messageInput.trim() || sending}
                className="h-9 w-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white disabled:opacity-50 flex-shrink-0">
                {sending ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="text-7xl mb-4">{'\u{1F4AC}'}</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Sports Club Chat</h3>
              <p className="text-slate-400 text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16" onClick={() => setShowNewChat(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">New Chat</h2>
            <div className="relative mb-4">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Search users..." autoFocus
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            {searching && <div className="text-center py-4 text-sm text-slate-400">Searching...</div>}
            {!searching && searchResults.length === 0 && userSearchQuery.trim() && (
              <div className="text-center py-4 text-sm text-slate-400">No users found</div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {searchResults.map(u => (
                <button key={u.id} type="button" onClick={() => handleNewDirectChat(u.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
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
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16" onClick={() => setShowCreateGroup(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">New Group</h2>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="Enter group name..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Add Members</label>
              <input type="text" value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                placeholder="Search users..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {groupMembers.map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    {m.username}
                    <button type="button" onClick={() => setGroupMembers(p => p.filter(x => x.id !== m.id))} className="ml-1 hover:text-blue-900">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto space-y-1">
              {groupSearchResults.filter(u => !groupMembers.some(m => m.id === u.id)).map(u => (
                <button key={u.id} type="button" onClick={() => setGroupMembers(p => [...p, { id: u.id, username: u.username }])}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xs">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-slate-900">{u.username}</p>
                    <p className="text-xs text-slate-400">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateGroup(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleCreateGroup} disabled={creating || !groupName.trim() || groupMembers.length === 0}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants Modal */}
      {showParticipants && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16" onClick={() => setShowParticipants(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{selectedRoom.name} - Members</h2>
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{p.username}</p>
                    <p className="text-xs text-slate-400">Joined {new Date(p.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setShowParticipants(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
