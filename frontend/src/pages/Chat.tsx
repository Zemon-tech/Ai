import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response as AIResponse } from '@/components/ai-elements/response';
import { Shimmer } from '@/components/ai-elements/shimmer';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputLeftAddon,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionAddAttachments,
} from '@/components/ai-elements/prompt-input';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, CopyIcon, PanelLeftIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Actions, Action } from '@/components/ai-elements/actions';
import { useSidebar } from '@/components/ui/sidebar';

type Message = { _id?: string; role: 'user' | 'assistant'; content: string };

export default function Chat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const assistantBuffer = useRef('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);

  const displayName = (user?.name || user?.email || 'there').split(' ')[0].split('@')[0];
  const salutation = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // React to URL param `c` for active conversation selection
  useEffect(() => {
    const id = searchParams.get('c');
    if (id && id !== activeId) {
      selectConversation(id);
    } else if (!id) {
      // If no conversation specified, pick the first and sync URL
      (async () => {
        try {
          const { conversations } = await api.conversations.list();
          if (conversations[0]?._id) {
            const first = conversations[0]._id as string;
            setSearchParams((sp) => {
              const next = new URLSearchParams(sp);
              next.set('c', first);
              return next;
            });
            await selectConversation(first);
          } else {
            setActiveId(null);
            setMessages([]);
          }
        } catch {}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function selectConversation(id: string) {
    setActiveId(id);
    const { messages } = await api.conversations.messages(id, 1, 200);
    setMessages(messages as any);
  }

  async function onSend(userText: string) {
    if (!userText.trim() || streaming) return;
    setMessages((m) => [...m, { role: 'user', content: userText }]);
    setStreaming(true);
    assistantBuffer.current = '';
    setAutoScroll(true);
    let convId = activeId || undefined;
    try {
      let finalConvId: string | undefined = convId;
      await api.ai.stream(
        { conversationId: convId, message: userText },
        {
          onDelta: (delta: string) => {
            assistantBuffer.current += delta;
            setMessages((m) => {
              const last = m[m.length - 1];
              if (last && last.role === 'assistant') {
                return [...m.slice(0, -1), { ...last, content: assistantBuffer.current }];
              }
              return [...m, { role: 'assistant', content: assistantBuffer.current }];
            });
          },
          onDone: ({ conversationId }) => {
            if (conversationId) finalConvId = conversationId;
          },
        }
      );

      // Ensure we have the conversation id for newly created chats
      if (!finalConvId && activeId) finalConvId = activeId;

      // Generate/update concise title and refresh sidebar list
      if (finalConvId) {
        try {
          await api.ai.title(finalConvId);
          window.dispatchEvent(new CustomEvent('conversations:refresh'));
        } catch {}
      }

      if (!activeId && finalConvId) setActiveId(finalConvId);
    } catch (e) {
      // noop
    } finally {
      setStreaming(false);
    }
  }

  useEffect(() => {
    const checkPosition = () => {
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      const isAtTop = window.scrollY <= 8;
      setAtBottom(isAtBottom);
      setAtTop(isAtTop);
      if (isAtBottom) setAutoScroll(true);
    };
    const handleWheel = () => {
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (!isAtBottom) setAutoScroll(false);
    };
    window.addEventListener('scroll', checkPosition, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    checkPosition();
    return () => {
      window.removeEventListener('scroll', checkPosition);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streaming, autoScroll]);

  // Chat no longer manages the sidebar list; creation/selection is handled in layout.

  function NavHeader() {
    const { toggleSidebar, state } = useSidebar();
    return (
      <header className="sticky top-0 z-20 h-12 border-b px-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          {state === 'collapsed' && (
            <button
              aria-label="Toggle sidebar"
              className="group inline-flex items-center"
              onClick={toggleSidebar}
            >
              <img src="/logo.svg" alt="Quild AI" className="h-6 w-auto dark:invert block group-hover:hidden" />
              <PanelLeftIcon className="size-4 hidden group-hover:block" />
            </button>
          )}
          <div className="font-semibold">Quild AI Studio</div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" />
      </header>
    );
  }

  return (
    <>
      <NavHeader />
      <div className="flex-1 overflow-visible">
          {messages.length === 0 ? (
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(80vh-3rem)] flex flex-col items-center justify-center text-center gap-6">
              <div className="text-muted-foreground text-2xl sm:text-3xl">{salutation}, {displayName}</div>
              <div className="text-3xl sm:text-4xl font-semibold tracking-tight">What's on the agenda today?</div>
              <div className="w-full max-w-4xl">
                <PromptInput
                  onSubmit={async ({ text }) => {
                    if (text) await onSend(text);
                  }}
                  groupClassName="rounded-3xl bg-card px-3 py-2 border border-input shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-input"
                >
                  <PromptInputLeftAddon>
                    <PromptInputActionMenu>
                      <PromptInputActionMenuTrigger>
                        <PlusIcon className="size-4" />
                      </PromptInputActionMenuTrigger>
                      <PromptInputActionMenuContent>
                        <PromptInputActionAddAttachments />
                        <PromptInputActionMenuItem>Create image</PromptInputActionMenuItem>
                        <PromptInputActionMenuItem>Thinking</PromptInputActionMenuItem>
                        <PromptInputActionMenuItem>Deep research</PromptInputActionMenuItem>
                        <PromptInputActionMenuItem>Study and learn</PromptInputActionMenuItem>
                      </PromptInputActionMenuContent>
                    </PromptInputActionMenu>
                  </PromptInputLeftAddon>
                  <PromptInputTextarea
                    placeholder=""
                    suggestions={[
                      'Ask how to structure an essay',
                      'Ask for social media captions',
                      'Summarize this document',
                      'Brainstorm feature ideas',
                    ]}
                    suggestionInterval={3000}
                    className="py-2"
                  />
                  <PromptInputFooter>
                    <div />
                    <PromptInputSubmit status={streaming ? 'streaming' : undefined} />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-6">
              {messages.map((m, idx) => (
                m.role === 'assistant' ? (
                  <div key={idx} className="w-full">
                    <AIResponse className="prose dark:prose-invert max-w-none">
                      {m.content}
                    </AIResponse>
                    <Actions className="mt-2">
                      <Action
                        tooltip="Copy"
                        label="Copy"
                        onClick={() => navigator.clipboard?.writeText(m.content)}
                      >
                        <CopyIcon className="size-4" />
                      </Action>
                    </Actions>
                  </div>
                ) : (
                  <Message key={idx} from={m.role}>
                    <MessageContent>{m.content}</MessageContent>
                  </Message>
                )
              ))}
              {streaming && !assistantBuffer.current && (
                <div className="w-full">
                  <Shimmer className="text-base">Thinking…</Shimmer>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
      </div>
      {((!streaming && !atBottom) || (streaming && atTop)) && (
        <div className="sticky bottom-24 z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
            <button
              aria-label="Get to latest"
              className="px-3 py-1.5 rounded-full bg-background/30 hover:bg-background/40 border border-border/60 shadow-md backdrop-blur-md text-foreground text-xs font-medium"
              onClick={() => {
                setAutoScroll(true);
                window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
              }}
            >
              Get to latest
            </button>
          </div>
        </div>
      )}
      {messages.length > 0 && (
        <div className="sticky bottom-0 z-20 pointer-events-none">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 pointer-events-auto">
              <PromptInput
                onSubmit={async ({ text }) => {
                  if (text) await onSend(text);
                }}
                groupClassName="rounded-3xl bg-card px-3 py-2 border border-input shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-input"
              >
                <PromptInputLeftAddon>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger>
                      <PlusIcon className="size-4" />
                    </PromptInputActionMenuTrigger>
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                </PromptInputLeftAddon>
                <PromptInputTextarea
                  placeholder="Send a message"
                  suggestions={[]}
                  className="py-2"
                />
                <PromptInputFooter>
                  <div />
                  <PromptInputSubmit status={streaming ? 'streaming' : undefined} />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        )}
    </>
  );
}


