import { useCallback, useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, CleanEvent } from '@monorepo/shared';
import { agentService } from '../../services/agent.service';
import './chat.css';

interface ChatProps {
  sessionId: string;
  onSessionChange: () => void;
  onConversationUpdate: () => void;
  initialMessages?: Message[];
}

export const Chat = ({ sessionId, onSessionChange, onConversationUpdate, initialMessages = [] }: ChatProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage: React.MouseEventHandler<HTMLButtonElement> =
    useCallback(
      async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setMessage("");

        try {
          const res = await agentService.chatSSE(message.trim(), sessionId);

          if (!res.ok) {
            throw new Error(`请求失败: ${res.status}`);
          }

          const reader = res.body?.getReader();
          if (!reader) {
            throw new Error("浏览器不支持流式读取");
          }

          const decoder = new TextDecoder();
          let buffer = "";
          let currentAssistantMessage: Message | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith("data:")) {
                const dataStr = trimmedLine.slice(5).trim();

                let parsed: unknown;
                try {
                  parsed = JSON.parse(dataStr);
                } catch {
                  continue;
                }

                const event = parsed as CleanEvent;

                switch (event.type) {
                  case 'token':
                    if (!currentAssistantMessage) {
                      const newMsg: Message = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: '',
                      };
                      currentAssistantMessage = newMsg;
                      setMessages(prev => [...prev, newMsg]);
                    }
                    currentAssistantMessage.content += event.content || '';
                    const updatedTokenMsg = currentAssistantMessage;
                    setMessages(prev => prev.map(m =>
                      m.id === updatedTokenMsg.id ? updatedTokenMsg : m
                    ));
                    break;

                  case 'message':
                    if (!currentAssistantMessage) {
                      const newMsg: Message = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: event.content || '',
                      };
                      currentAssistantMessage = newMsg;
                      setMessages(prev => [...prev, newMsg]);
                    } else {
                      if (event.content) {
                        currentAssistantMessage.content = event.content;
                      }
                    }
                    if (event.toolName) {
                      currentAssistantMessage.toolCalls = [{
                        name: event.toolName,
                        args: event.toolArgs!,
                      }];
                    }
                    const updatedMsg = currentAssistantMessage;
                    setMessages(prev => prev.map(m =>
                      m.id === updatedMsg.id ? updatedMsg : m
                    ));
                    break;

                  case 'tool_start':
                    if (!currentAssistantMessage) {
                      const newMsg: Message = {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: '',
                      };
                      currentAssistantMessage = newMsg;
                      setMessages(prev => [...prev, newMsg]);
                    }
                    if (event.toolName) {
                      currentAssistantMessage.toolCalls = [{
                        name: event.toolName,
                        args: event.toolArgs!,
                      }];
                    }
                    const updatedToolMsg = currentAssistantMessage;
                    setMessages(prev => prev.map(m =>
                      m.id === updatedToolMsg.id ? updatedToolMsg : m
                    ));
                    break;

                  case 'tool_end':
                    if (currentAssistantMessage) {
                      if (!currentAssistantMessage.toolResults) {
                        currentAssistantMessage.toolResults = [];
                      }
                      currentAssistantMessage.toolResults.push(event.toolResult || '');
                      const updatedResultMsg = currentAssistantMessage;
                      setMessages(prev => prev.map(m =>
                        m.id === updatedResultMsg.id ? updatedResultMsg : m
                      ));
                    }
                    break;

                  case 'error':
                    const errorMessage: Message = {
                      id: crypto.randomUUID(),
                      role: 'assistant',
                      content: `出错了: ${event.content}`,
                    };
                    setMessages(prev => [...prev, errorMessage]);
                    currentAssistantMessage = null;
                    break;
                }
              }
            }
          }
        } catch (err) {
          console.error(err);
          const errorMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `出错了: ${(err as Error).message}`,
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
          onConversationUpdate();
        }
      },
      [message, sessionId, onConversationUpdate],
    );

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    onSessionChange();
  };

  return (
    <div className='chat-block'>
      <div className="chat-header">
        <h1>AI Chat</h1>
        <button onClick={handleNewChat} className="new-chat-btn">新对话</button>
      </div>

      <div className="message-content">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-body">
              <div className="message-content-text">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="message-tool-calls">
                  {msg.toolCalls.map((tc, i) => (
                    <div key={i} className="tool-call">
                      <span className="tool-name">{tc.name}</span>
                      <span className="tool-args">{JSON.stringify(tc.args)}</span>
                    </div>
                  ))}
                </div>
              )}
              {msg.toolResults && msg.toolResults.length > 0 && (
                <div className="message-tool-results">
                  {msg.toolResults.map((result, i) => (
                    <div key={i} className="tool-result">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-body">
              <div className="typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="user-input">
        <textarea
          className="input-area"
          name="user-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息，按 Enter 发送..."
          disabled={isLoading}
        ></textarea>
        <button onClick={handleSendMessage} className='send-button' disabled={isLoading || !message.trim()}>
          {isLoading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
};
