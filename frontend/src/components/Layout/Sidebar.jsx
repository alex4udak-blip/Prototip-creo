import { useState } from 'react';
import { MessageSquarePlus, Trash2, Edit2, Check, X, Sparkles, History } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { useAuthStore } from '../../hooks/useAuth';

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

  // Создать новый чат
  const handleNewChat = async () => {
    try {
      const chat = await createChat();
      selectChat(chat.id);
    } catch (error) {
      console.error('Create chat error:', error);
    }
  };

  // Начать редактирование
  const startEditing = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  // Сохранить название
  const saveTitle = async (chatId) => {
    if (editTitle.trim()) {
      await renameChat(chatId, editTitle.trim());
    }
    setEditingId(null);
  };

  // Удалить чат
  const handleDelete = async (chatId, e) => {
    e.stopPropagation();
    if (window.confirm('Удалить этот чат?')) {
      await deleteChat(chatId);
    }
  };

  return (
    <aside className={`flex flex-col bg-bg-secondary border-r border-border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6 text-accent" />
          <span className="font-bold text-lg text-gradient">BannerGen</span>
        </div>

        <button
          onClick={handleNewChat}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <MessageSquarePlus className="w-4 h-4" />
          Новый чат
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center gap-2 px-2 py-1 text-text-muted text-xs uppercase tracking-wider">
          <History className="w-3 h-3" />
          История
        </div>

        {chatsLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 shimmer rounded-lg" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center text-text-muted py-8 px-4">
            <p className="text-sm">Нет чатов</p>
            <p className="text-xs mt-1">Создайте первый чат</p>
          </div>
        ) : (
          <div className="space-y-1 mt-2">
            {chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  currentChat?.id === chat.id
                    ? 'bg-accent/20 text-text-primary'
                    : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
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
                      className="flex-1 bg-bg-input px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                      autoFocus
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveTitle(chat.id); }}
                      className="p-1 hover:bg-success/20 rounded"
                    >
                      <Check className="w-3 h-3 text-success" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="p-1 hover:bg-error/20 rounded"
                    >
                      <X className="w-3 h-3 text-error" />
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
                    <span className="flex-1 truncate text-sm">
                      {chat.title}
                    </span>

                    {/* Actions (показываются при hover) */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startEditing(chat, e)}
                        className="p-1 hover:bg-bg-primary rounded"
                        title="Переименовать"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(chat.id, e)}
                        className="p-1 hover:bg-error/20 rounded"
                        title="Удалить"
                      >
                        <Trash2 className="w-3 h-3 text-error" />
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
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="text-sm text-text-secondary truncate max-w-[120px]">
              {user?.name || 'Пользователь'}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-text-muted hover:text-error transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
