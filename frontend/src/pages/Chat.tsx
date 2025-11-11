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
  PromptInputActionToggleWebSearch,
} from '@/components/ai-elements/prompt-input';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, CopyIcon, PanelLeftIcon, MoreVertical, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorEmpty,
  ModelSelectorLogo,
} from '@/components/ai-elements/model-selector';
import { useNavigate, useParams } from 'react-router-dom';
import { Actions, Action } from '@/components/ai-elements/actions';
import { Task, TaskContent, TaskItem, TaskTrigger } from '@/components/ai-elements/task';
import { useSidebar } from '@/components/ui/sidebar';

type WebSource = { id: number; title: string; link: string; source?: string; favicon?: string; date?: string; snippet?: string };
type Message = { _id?: string; role: 'user' | 'assistant'; content: string; sources?: WebSource[]; webSummary?: string };

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [phase, setPhase] = useState<'planning' | 'searching' | 'fetching' | 'summarizing' | 'answering' | 'complete' | null>(null);
  const assistantBuffer = useRef('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [openModelDialog, setOpenModelDialog] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<{ id: string; name?: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>('openrouter/auto');
  const [webSearch, setWebSearch] = useState<boolean>(false);

  const displayName = (user?.name || user?.email || 'there').split(' ')[0].split('@')[0];
  const salutation = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // React to URL path `/c/:id`; if none, pick first and navigate
  useEffect(() => {
    const id = routeId || null;
    if (id && id !== activeId) {
      selectConversation(id);
    } else if (!id) {
      (async () => {
        try {
          const { conversations } = await api.conversations.list();
          if (conversations[0]?._id) {
            const first = conversations[0]._id as string;
            navigate(`/c/${first}`, { replace: true });
            await selectConversation(first);
          } else {
            setActiveId(null);
            setMessages([]);
          }
        } catch {}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Load saved provider on mount and persist changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aiProvider') as 'gemini' | 'openrouter' | null;
      if (saved === 'gemini' || saved === 'openrouter') setProvider(saved);
      const savedModel = localStorage.getItem('openrouterModel');
      if (savedModel) setSelectedOpenRouterModel(savedModel);
      const ws = localStorage.getItem('webSearch');
      if (ws === '1') setWebSearch(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('aiProvider', provider);
    } catch {}
  }, [provider]);
  useEffect(() => {
    try {
      if (selectedOpenRouterModel) localStorage.setItem('openrouterModel', selectedOpenRouterModel);
    } catch {}
  }, [selectedOpenRouterModel]);
  useEffect(() => {
    try {
      localStorage.setItem('webSearch', webSearch ? '1' : '0');
    } catch {}
  }, [webSearch]);

  useEffect(() => {
    if (openModelDialog) {
      (async () => {
        try {
          setModelsLoading(true);
          const res = await fetch('https://openrouter.ai/api/v1/models');
          const data = await res.json();
          const list = Array.isArray(data?.data) ? data.data as any[] : [];
          const models = list.map((m) => ({ id: m.id as string, name: (m.name as string) || (m.id as string) }));
          setOpenRouterModels(models);
        } catch {
          setOpenRouterModels([]);
        } finally {
          setModelsLoading(false);
        }
      })();
    }
  }, [openModelDialog]);

  async function selectConversation(id: string) {
    setActiveId(id);
    const { messages } = await api.conversations.messages(id, 1, 200);
    setMessages(messages as any);
  }

  async function onSend(userText: string) {
    if (!userText.trim() || streaming) return;
    setMessages((m) => [...m, { role: 'user', content: userText }]);
    setStreaming(true);
    setPhase(null);
    assistantBuffer.current = '';
    setAutoScroll(true);
    let convId = activeId || undefined;
    try {
      let finalConvId: string | undefined = convId;
      // Build locale-aware web options
      const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en-US') || 'en-US';
      const [hlPart, glPart] = lang.split('-');
      const hl = (hlPart || 'en').toLowerCase();
      const gl = (glPart || 'US').toLowerCase();
      await api.ai.stream(
        { conversationId: convId, message: userText, provider, webSearch, web: webSearch ? { hl, gl } : undefined },
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
          onStatus: (p) => {
            setPhase(p);
          },
          onSources: (sources) => {
            setMessages((m) => {
              const last = m[m.length - 1];
              if (last && last.role === 'assistant') {
                return [...m.slice(0, -1), { ...last, sources }];
              }
              return [...m, { role: 'assistant', content: '', sources }];
            });
          },
          onWebSummary: (summary) => {
            setMessages((m) => {
              const last = m[m.length - 1];
              if (last && last.role === 'assistant') {
                return [...m.slice(0, -1), { ...last, webSummary: summary }];
              }
              return [...m, { role: 'assistant', content: '', webSummary: summary }];
            });
          },
          onDone: ({ conversationId }) => {
            if (conversationId) finalConvId = conversationId;
            setPhase('complete');
          },
        }
      );

      // Ensure we have the conversation id for newly created chats
      if (!finalConvId && activeId) finalConvId = activeId;

      // Generate/update concise title and refresh sidebar list
      if (finalConvId) {
        try {
          await api.ai.title(finalConvId, provider);
          window.dispatchEvent(new CustomEvent('conversations:refresh'));
        } catch {}
      }

      if (!activeId && finalConvId) {
        setActiveId(finalConvId);
        navigate(`/c/${finalConvId}`, { replace: true });
      }
    } catch (e) {
      // noop
    } finally {
      setStreaming(false);
      setTimeout(() => setPhase(null), 500);
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
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Menu" className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="justify-between cursor-pointer"
                onClick={() => setOpenModelDialog(true)}
              >
                <span className="truncate">
                  {provider === 'openrouter' ? selectedOpenRouterModel : 'Gemini'}
                </span>
                <span className="ml-2 inline-flex items-center justify-center h-7 w-7">
                  <Settings className="size-4" />
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="justify-between cursor-pointer"
                onClick={() => setWebSearch((v) => !v)}
              >
                <span className="truncate">Use web search (SerpAPI)</span>
                <input
                  type="checkbox"
                  checked={webSearch}
                  readOnly
                  className="ml-2 pointer-events-none"
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    );
  }

  return (
    <>
      <ModelSelector open={openModelDialog} onOpenChange={setOpenModelDialog}>
        <ModelSelectorContent title="Select Model" className="sm:max-w-xl">
          <ModelSelectorInput placeholder="Search models…" />
          <ModelSelectorList>
            {modelsLoading && (
              <div className="p-3 text-sm text-muted-foreground">Loading models…</div>
            )}
            {!modelsLoading && (
              <>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                <ModelSelectorGroup heading="OpenRouter">
                  {openRouterModels.map((m) => (
                    <ModelSelectorItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => {
                        setSelectedOpenRouterModel(m.id);
                        setProvider('openrouter');
                        setOpenModelDialog(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        {(() => {
                          const provider = (m.id.split('/')[0] || 'openrouter') as any;
                          return <ModelSelectorLogo provider={provider} className="size-4" />;
                        })()}
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{m.name || m.id}</span>
                          <span className="text-xs text-muted-foreground truncate">{m.id}</span>
                        </div>
                      </div>
                    </ModelSelectorItem>
                  ))}
                </ModelSelectorGroup>
              </>
            )}
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
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
                        <PromptInputActionToggleWebSearch
                          checked={webSearch}
                          onCheckedChange={setWebSearch}
                        />
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
                    {/* Optional web findings summary */}
                    {m.webSummary && (
                      <div className="mb-3">
                        <Task defaultOpen={false}>
                          <TaskTrigger title="Research summary" />
                          <TaskContent>
                            <TaskItem>
                              <AIResponse>{m.webSummary}</AIResponse>
                            </TaskItem>
                          </TaskContent>
                        </Task>
                      </div>
                    )}
                    <AIResponse className="prose dark:prose-invert max-w-none">
                      {m.content}
                    </AIResponse>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        {Array.isArray(m.sources) && m.sources.length > 0 && (
                          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-secondary border border-border">
                            <span className="text-xs text-muted-foreground">Sources</span>
                            <div className="flex items-center -space-x-1">
                              {(() => {
                                const unique: WebSource[] = [];
                                const seenDomains = new Set<string>();
                                for (const s of m.sources!) {
                                  try {
                                    const host = new URL(s.link).hostname;
                                    if (seenDomains.has(host)) continue;
                                    seenDomains.add(host);
                                    unique.push(s);
                                  } catch { continue; }
                                }
                                return unique.slice(0, 4).map((s) => (
                                <a
                                  key={s.id}
                                  href={s.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={s.source || s.title}
                                  className="inline-flex h-5 w-5 rounded-full overflow-hidden ring-1 ring-border bg-muted"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={(s.favicon && s.favicon.length > 0) ? s.favicon : (() => { try { const host = new URL(s.link).hostname; return `https://icons.duckduckgo.com/ip3/${host}.ico`; } catch { return ''; } })()}
                                    alt={s.source || 'source'}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </a>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                      <Actions className="mt-0">
                        <Action
                          tooltip="Copy"
                          label="Copy"
                          onClick={() => navigator.clipboard?.writeText(m.content)}
                        >
                          <CopyIcon className="size-4" />
                        </Action>
                      </Actions>
                    </div>
                  </div>
                ) : (
                  <Message key={idx} from={m.role}>
                    <MessageContent>{m.content}</MessageContent>
                  </Message>
                )
              ))}
              {streaming && (
                <div className="w-full">
                  <Shimmer className="text-base">
                    {(() => {
                      switch (phase) {
                        case 'planning':
                          return 'Planning searches…';
                        case 'searching':
                          return 'Searching the web…';
                        case 'fetching':
                          return 'Fetching articles…';
                        case 'summarizing':
                          return 'Summarizing findings…';
                        case 'answering':
                          return assistantBuffer.current ? 'Answering…' : 'Preparing answer…';
                        default:
                          return assistantBuffer.current ? 'Answering…' : 'Thinking…';
                      }
                    })()}
                  </Shimmer>
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
                      <PromptInputActionToggleWebSearch
                        checked={webSearch}
                        onCheckedChange={setWebSearch}
                      />
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


