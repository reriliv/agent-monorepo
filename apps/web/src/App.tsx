import { useState, useCallback } from "react";
import "./App.css";
import { Chat, ConversationSidebar } from "./components";
import type { Message } from "@monorepo/shared";
import { formatMessages } from "./services/agent.service";

function App() {
  const [sessionId, setSessionId] = useState<string>('');
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleNewConversation = useCallback(() => {
    setSessionId(crypto.randomUUID());
    setInitialMessages([]);
  }, []);

  const handleSelectConversation = useCallback((selectedSessionId: string, messagesData: any[]) => {
    setInitialMessages(formatMessages(messagesData, selectedSessionId));
    setSessionId(selectedSessionId);
  }, []);

  const handleListLoaded = useCallback((conversations: { sessionId: string }[]) => {
    if (conversations.length === 0) {
      handleNewConversation();
    }
  }, [handleNewConversation]);

  const handleDeleteConversation = useCallback((deletedSessionId: string) => {
    if (sessionId === deletedSessionId) {
      handleNewConversation();
    }
  }, [sessionId, handleNewConversation]);

  const handleConversationUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div className="chat-container">
      <ConversationSidebar
        currentSessionId={sessionId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onListLoaded={handleListLoaded}
        refreshKey={refreshKey}
      />
      <Chat
        sessionId={sessionId}
        onSessionChange={handleNewConversation}
        onConversationUpdate={handleConversationUpdate}
        initialMessages={initialMessages}
      />
    </div>
  );
}

export default App;
