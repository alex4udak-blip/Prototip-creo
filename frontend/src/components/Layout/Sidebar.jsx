import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, History } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { useAuthStore } from '../../hooks/useAuth';
import { Logo } from '../UI/Logo';

/**
 * Sidebar Component
 * Claude.ai inspired design
 */
export function Sidebar({ className = '' }) {
  const { user, logout } = useAuthStore();
  const {
    chats,
    chatsLoading,
    currentChat,
    createChat,
    selectChat,
    deleteChat,
    renameChat
  } = useChatStore();

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleNewChat = async () => {
    try {
      const chat = await createChat();
      selectChat(chat.id);
    } catch (error) {
      console.error('Create chat error:', error);
    }
  };

  const startEditing = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const saveTitle = async (chatId) => {
    if (editTitle.trim()) {
      await renameChat(chatId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleDelete = async (chatId, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this chat?')) {
      await deleteChat(chatId);
    }
  };

  return (
    <aside className={`flex flex-col bg-[var(--bg-secondary)]
      border-r border-[var(--border)] ${className}`}>

      {/* Header with Logo */}
      <div className="p-4 border-b border-[var(--border)]">
        <Logo size="md" className="mb-4" />

        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5
            bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl
            text-[var(--text-primary)] font-sans text-sm font-medium
            hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <div className="flex items-center gap-2 px-3 py-2
          text-xs font-sans font-medium text-[var(--text-muted)]
          uppercase tracking-wider">
          <History className="w-3 h-3" />
          History
        </div>

        {chatsLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 shimmer rounded-lg" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm font-sans text-[var(--text-muted)]">No chats yet</p>
            <p className="text-xs font-sans text-[var(--text-muted)] mt-1">
              Create your first chat
            </p>
          </div>
        ) : (
          <div className="space-y-1 mt-2">
            {chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg
                  cursor-pointer transition-colors ${
                  currentChat?.id === chat.id
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {editingId === chat.id ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle(chat.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-[var(--bg-input)] px-2 py-1 rounded
                        text-sm font-sans text-[var(--text-primary)]
                        focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      autoFocus
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveTitle(chat.id); }}
                      className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30"
                    >
                      <Check className="w-3 h-3 text-green-600" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </>
                ) : (
                  <>
                    {/* Preview image */}
                    {chat.lastImage && (
                      <img
                        src={chat.lastImage}
                        alt=""
                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                      />
                    )}

                    {/* Title */}
                    <span className="flex-1 truncate text-sm font-sans">
                      {chat.title}
                    </span>

                    {/* Actions on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startEditing(chat, e)}
                        className="p-1 rounded hover:bg-[var(--bg-primary)]"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3 text-[var(--text-muted)]" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(chat.id, e)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User info */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-light)]
              flex items-center justify-center text-[var(--accent)] font-sans font-medium">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-sm font-sans text-[var(--text-secondary)]
              truncate max-w-[120px]">
              {user?.name || 'User'}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-xs font-sans text-[var(--text-muted)]
              hover:text-red-500 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
