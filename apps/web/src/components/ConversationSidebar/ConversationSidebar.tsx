import { useState, useEffect } from 'react';
import type { Conversation } from '@monorepo/shared';
import { agentService } from '../../services/agent.service';
import './ConversationSidebar.css';

interface ConversationSidebarProps {
  currentSessionId: string;
  onSelectConversation: (sessionId: string, messages: any[]) => void;
  onDeleteConversation: (sessionId: string) => void;
  onListLoaded: (conversations: { sessionId: string }[]) => void;
  refreshKey?: number;
}

export const ConversationSidebar = ({ currentSessionId, onSelectConversation, onDeleteConversation, onListLoaded, refreshKey }: ConversationSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const data = await agentService.getConversations();
      setConversations(data);

      if (data.length > 0 && !currentSessionId) {
        const firstConversation = data[0];
        const detail = await agentService.getConversation(firstConversation.sessionId);
        if (detail.success) {
          onSelectConversation(firstConversation.sessionId, detail.messages);
        }
      }

      onListLoaded(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      onListLoaded([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [refreshKey]);

  const handleSelectConversation = async (sessionId: string) => {
    try {
      const data = await agentService.getConversation(sessionId);
      if (data.success) {
        onSelectConversation(sessionId, data.messages);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      const data = await agentService.deleteConversation(sessionId);
      if (data.success) {
        setConversations(prev => prev.filter(c => c.sessionId !== sessionId));
        onDeleteConversation(sessionId);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getPreview = (conversation: Conversation) => {
    if (conversation.title) {
      return conversation.title;
    }
    if (conversation.summary) {
      return conversation.summary.length > 50
        ? conversation.summary.substring(0, 50) + '...'
        : conversation.summary;
    }
    return '无标题对话';
  };

  return (
    <div className="conversation-sidebar">
      <div className="sidebar-header">
        <h2>历史对话</h2>
      </div>

      <div className="sidebar-content">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : conversations.length === 0 ? (
          <div className="empty">暂无历史对话</div>
        ) : (
          <ul className="conversation-list">
            {conversations.map((conv) => (
              <li
                key={conv.sessionId}
                className={`conversation-item ${currentSessionId === conv.sessionId ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conv.sessionId)}
              >
                <div className="conversation-preview">{getPreview(conv)}</div>
                <div className="conversation-meta">
                  <span className="conversation-date">{formatDate(conv.updatedAt)}</span>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(e, conv.sessionId)}
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
