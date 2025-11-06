import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../components/ui/button';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Response as AIResponse } from '@/components/ai-elements/response';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, Trash2Icon, CopyIcon } from 'lucide-react';
import { Actions, Action } from '@/components/ai-elements/actions';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  SidebarUserButton,
} from '@/components/ui/sidebar';

type Conversation = { _id: string; title: string };
type Message = { _id?: string; role: 'user' | 'assistant'; content: string };

export default function Chat() {
  const { logout, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const assistantBuffer = useRef('');

  useEffect(() => {
    (async () => {
      try {
        const { conversations } = await api.conversations.list();
        setConversations(conversations as any);
        if (conversations[0]?._id) {
          selectConversation(conversations[0]._id);
        }
      } catch {}
    })();
  }, []);

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
    let convId = activeId || undefined;
    try {
      await api.ai.stream({ conversationId: convId, message: userText }, (delta) => {
        assistantBuffer.current += delta;
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last && last.role === 'assistant') {
            return [...m.slice(0, -1), { ...last, content: assistantBuffer.current }];
          }
          return [...m, { role: 'assistant', content: assistantBuffer.current }];
        });
      });
      if (!activeId) {
        const { conversations } = await api.conversations.list();
        setConversations(conversations as any);
        const newest = conversations[0]?._id;
        if (newest) setActiveId(newest);
      }
    } catch (e) {
      // noop
    } finally {
      setStreaming(false);
    }
  }

  async function newChat() {
    const res = await api.conversations.create('New Chat');
    setConversations((c) => [res.conversation, ...c]);
    setActiveId(res.conversation._id);
    setMessages([]);
  }

  async function removeChat(id: string) {
    await api.conversations.remove(id);
    setConversations((c) => c.filter((x) => x._id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <Button onClick={newChat} className="w-full justify-start" variant="default">
            <PlusIcon className="mr-2 size-4" /> New Chat
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.map((c) => (
                  <SidebarMenuItem key={c._id}>
                    <SidebarMenuButton
                      isActive={activeId === c._id}
                      onClick={() => selectConversation(c._id)}
                    >
                      <span>{c.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      aria-label="Delete"
                      onClick={(e) => { e.preventDefault(); removeChat(c._id); }}
                    >
                      <Trash2Icon className="size-4" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUserButton
            email={user?.email || 'user@example.com'}
            name={user?.name}
            onLogout={logout}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 h-14 border-b px-4 flex items-center justify-between bg-background">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <div className="font-semibold">Quild AI Studio</div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="hidden sm:block">{user?.email}</div>
          </div>
        </header>
        <div className="flex-1 overflow-visible">
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
          </div>
        </div>
        <div className="sticky bottom-0 z-20 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 pointer-events-auto">
            <PromptInput
              onSubmit={async ({ text }) => {
                if (text) await onSend(text);
              }}
              groupClassName="rounded-2xl bg-card px-3 py-2 border border-input shadow-xs"
            >
              <PromptInputTextarea placeholder="Send a message" />
              <PromptInputFooter>
                <div />
                <PromptInputSubmit status={streaming ? 'streaming' : undefined} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}


