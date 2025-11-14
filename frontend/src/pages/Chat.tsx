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
  PromptInputActiveModeWebsearch,
} from '@/components/ai-elements/prompt-input';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, CopyIcon, PanelLeftIcon, MoreVertical, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

// Remove model-internal tool code blocks like ```tool_code ... ``` while preserving normal code
function sanitizeAssistantText(input: string): string {
  if (!input) return input;
  // Remove any fenced code blocks whose language tag is tool_code (case-insensitive)
  // This handles partial/incomplete fences by applying on the whole buffer each tick
  return input.replace(/```\s*tool_code[\s\S]*?```/gi, '').replace(/\n{3,}/g, '\n\n');
}

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
  const [provider, setProvider] = useState<'gemini' | 'openrouter' | 'groq'>('gemini');
  const [openModelDialog, setOpenModelDialog] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<{ id: string; name?: string }[]>([]);
  const [groqModels, setGroqModels] = useState<{ id: string; name?: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>('openrouter/auto');
  const [webSearch, setWebSearch] = useState<boolean>(false);
  const [openSources, setOpenSources] = useState(false);
  const [selectedSources, setSelectedSources] = useState<WebSource[] | null>(null);

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
      const saved = localStorage.getItem('aiProvider') as 'gemini' | 'openrouter' | 'groq' | null;
      if (saved === 'gemini' || saved === 'openrouter' || saved === 'groq') setProvider(saved);
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
          // OpenRouter free models via backend proxy
          try {
            const { models } = await api.ai.modelsOpenRouter();
            setOpenRouterModels(models);
          } catch {
            setOpenRouterModels([]);
          }
          // Groq models via backend proxy
          try {
            const { models } = await api.ai.modelsGroq();
            setGroqModels(models);
          } catch {
            setGroqModels([]);
          }
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

  async function onSend(userText: string, images?: { url: string; mediaType?: string; filename?: string }[]) {
    if (!userText.trim() || streaming) return;
    setMessages((m) => [...m, { role: 'user', content: userText }]);
    setStreaming(true);
    setPhase(null);
    assistantBuffer.current = '';
    setAutoScroll(true);
    let convId = activeId || undefined;
    try {
      // If images provided, call image analysis endpoint and bypass chat streaming
      if (images && images.length > 0) {
        try {
          const { text } = await api.ai.analyzeImage({ prompt: userText, images });
          setMessages((m) => [...m, { role: 'assistant', content: text }]);
        } finally {
          setStreaming(false);
          setTimeout(() => setPhase(null), 500);
        }
        return;
      }
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
            const sanitized = sanitizeAssistantText(assistantBuffer.current);
            setMessages((m) => {
              const last = m[m.length - 1];
              if (last && last.role === 'assistant') {
                return [...m.slice(0, -1), { ...last, content: sanitized }];
              }
              return [...m, { role: 'assistant', content: sanitized }];
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
      const isAtTop = window.scrollY <= 8;
      setAtTop(isAtTop);
      const doc = document.documentElement;
      const isAtBottom = window.innerHeight + window.scrollY >= (doc.scrollHeight - 8);
      setAtBottom(isAtBottom);
    };
    const handleWheel = (e: WheelEvent) => {
      // If the user scrolls upward, disable autoscroll until they click "Get to latest"
      if (e.deltaY < 0) setAutoScroll(false);
    };
    window.addEventListener('scroll', checkPosition, { passive: true });
    window.addEventListener('resize', checkPosition, { passive: true } as any);
    window.addEventListener('wheel', handleWheel, { passive: true });
    checkPosition();
    return () => {
      window.removeEventListener('scroll', checkPosition);
      window.removeEventListener('resize', checkPosition as any);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streaming, autoScroll]);

  // Use IntersectionObserver to more reliably detect when we're at the very bottom
  // of the page (i.e., when the invisible bottomRef is visible). This is more robust
  // than comparing window scroll coordinates, especially when the prompt input grows
  // or sticky elements affect layout.
  useEffect(() => {
    const target = bottomRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const atBottomNow = entry.isIntersecting;
        // When the anchor comes into view, we can safely re-enable autoscroll.
        if (atBottomNow) setAutoScroll(true);
      },
      {
        root: null,
        threshold: 0,
        // Account for sticky composer height so the anchor only intersects
        // when near the real bottom of the scrollable document.
        rootMargin: '0px 0px -160px 0px',
      }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Chat no longer manages the sidebar list; creation/selection is handled in layout.

  function NavHeader() {
    const { toggleSidebar, state, isMobile } = useSidebar();
    return (
      <header className="sticky top-0 z-20 h-12 border-b px-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          {(isMobile || state === 'collapsed') && (
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
                  {provider === 'openrouter' ? selectedOpenRouterModel : provider === 'groq' ? 'Groq' : 'Gemini'}
                </span>
                <span className="ml-2 inline-flex items-center justify-center h-7 w-7">
                  <Settings className="size-4" />
                </span>
              </DropdownMenuItem>
              {null}
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
                <ModelSelectorGroup heading="Gemini (Direct)">
                  <ModelSelectorItem
                    value="gemini-2.0-flash"
                    onSelect={() => {
                      setProvider('gemini');
                      setOpenModelDialog(false);
                    }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <ModelSelectorLogo provider={"google" as any} className="size-4" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">Gemini 2.0 Flash</span>
                        <span className="text-xs text-muted-foreground truncate">gemini-2.0-flash</span>
                      </div>
                    </div>
                  </ModelSelectorItem>
                </ModelSelectorGroup>
                <ModelSelectorGroup heading="OpenRouter (Free)">
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
                <ModelSelectorGroup heading="Groq">
                  {groqModels.map((m) => (
                    <ModelSelectorItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => {
                        setProvider('groq');
                        setOpenModelDialog(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <ModelSelectorLogo provider={"groq" as any} className="size-4" />
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
                  onSubmit={async ({ text, files }) => {
                    if (!text) return;
                    const images = (files || []).map((f) => ({ url: f.url, mediaType: (f as any).mediaType, filename: (f as any).filename }));
                    await onSend(text, images.length ? images : undefined);
                  }}
                  groupClassName={`${webSearch ? 'rounded-md' : 'rounded-3xl'} bg-card px-3 py-2 border border-input shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-input`}
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
                    {webSearch && (
                      <PromptInputActiveModeWebsearch
                        active={webSearch}
                        onClick={() => setWebSearch(false)}
                      />
                    )}
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
                    forceMultilineLayout={webSearch}
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
                    <Message from="assistant">
                      <MessageContent variant="flat">
                        <AIResponse className="prose dark:prose-invert max-w-none">
                          {m.content}
                        </AIResponse>
                      </MessageContent>
                    </Message>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        {Array.isArray(m.sources) && m.sources.length > 0 && (
                          <button
                            type="button"
                            className="flex items-center gap-2 px-2 py-1 rounded-full bg-secondary border border-border hover:bg-secondary/80"
                            onClick={() => {
                              setSelectedSources(m.sources || []);
                              setOpenSources(true);
                            }}
                          >
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
                                  <span
                                    key={s.id}
                                    title={s.source || s.title}
                                    className="inline-flex h-5 w-5 rounded-full overflow-hidden ring-1 ring-border bg-muted"
                                  >
                                    <img
                                      src={(s.favicon && s.favicon.length > 0) ? s.favicon : (() => { try { const host = new URL(s.link).hostname; return `https://icons.duckduckgo.com/ip3/${host}.ico`; } catch { return ''; } })()}
                                      alt={s.source || 'source'}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  </span>
                                ));
                              })()}
                            </div>
                          </button>
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
                onSubmit={async ({ text, files }) => {
                  if (!text) return;
                  const images = (files || []).map((f) => ({ url: f.url, mediaType: (f as any).mediaType, filename: (f as any).filename }));
                  await onSend(text, images.length ? images : undefined);
                }}
                groupClassName={`${webSearch ? 'rounded-md' : 'rounded-3xl'} bg-card px-3 py-2 border border-input shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-input`}
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
                  {webSearch && (
                    <PromptInputActiveModeWebsearch
                      active={webSearch}
                      onClick={() => setWebSearch(false)}
                    />
                  )}
                </PromptInputLeftAddon>
                <PromptInputTextarea
                  placeholder="Send a message"
                  suggestions={[]}
                  className="py-2"
                  forceMultilineLayout={webSearch}
                />
                <PromptInputFooter>
                  <div />
                  <PromptInputSubmit status={streaming ? 'streaming' : undefined} />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        )}
      {/* Sources Sheet */}
      <Sheet open={openSources} onOpenChange={setOpenSources}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Sources</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3">
            {Array.isArray(selectedSources) && selectedSources.length > 0 ? (
              selectedSources.map((s) => {
                let host = '';
                try { host = new URL(s.link).hostname; } catch {}
                const favicon = (s.favicon && s.favicon.length > 0) ? s.favicon : (host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : '');
                return (
                  <a
                    key={s.id}
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 rounded-md border p-3 hover:bg-accent"
                  >
                    <span className="inline-flex h-6 w-6 rounded-sm overflow-hidden ring-1 ring-border bg-muted mt-0.5">
                      <img
                        src={favicon}
                        alt={s.source || 'source'}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-sm truncate">{s.title || s.source || s.link}</span>
                      <span className="block text-muted-foreground text-xs truncate">{host}</span>
                      {s.snippet && (
                        <span className="block text-muted-foreground text-xs line-clamp-2 mt-1">{s.snippet}</span>
                      )}
                    </span>
                  </a>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground">No sources available.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}


