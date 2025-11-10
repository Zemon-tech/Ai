import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Home as HomeIcon, PlusIcon, BookOpen, FolderPlus, ChevronDown } from 'lucide-react';
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
  SidebarMenuActionsMenu,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  SidebarUserButton,
} from '@/components/ui/sidebar';

// Shared App layout with a single, consistent Sidebar for the whole app
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  type Conversation = { _id: string; title: string };
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatsOpen, setChatsOpen] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { conversations } = await api.conversations.list();
        setConversations(conversations as any);
        const stored = localStorage.getItem('activeConversationId');
        if (stored) setActiveId(stored);
      } catch {}
    })();
  }, []);

  // Refresh sidebar list when chats are updated elsewhere (e.g., title generation)
  useEffect(() => {
    const handler = async () => {
      try {
        const { conversations } = await api.conversations.list();
        setConversations(conversations as any);
      } catch {}
    };
    window.addEventListener('conversations:refresh', handler as EventListener);
    return () => window.removeEventListener('conversations:refresh', handler as EventListener);
  }, []);

  // Redirect legacy query param `?c=` to new path `/c/:id`
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('c');
    if (q) {
      navigate(`/c/${q}`, { replace: true });
    }
  }, [location.search, navigate]);

  // Keep active item in sync with the URL path `/c/:id`
  useEffect(() => {
    const match = location.pathname.match(/^\/c\/([^/?#]+)/);
    const id = match ? match[1] : null;
    if (id && id !== activeId) {
      setActiveId(id);
      localStorage.setItem('activeConversationId', id);
    }
  }, [location.pathname]);

  async function newChat() {
    const res = await api.conversations.create('New Chat');
    setConversations((c) => [res.conversation, ...c]);
    localStorage.setItem('activeConversationId', res.conversation._id);
    setActiveId(res.conversation._id);
    navigate(`/c/${res.conversation._id}`);
  }

  async function removeChat(id: string) {
    await api.conversations.remove(id);
    setConversations((c) => c.filter((x) => x._id !== id));
    if (activeId === id) {
      setActiveId(null);
      localStorage.removeItem('activeConversationId');
    }
  }

  function startEditing(id: string) {
    const current = conversations.find((x) => x._id === id)?.title || '';
    setEditingId(id);
    setEditValue(current);
  }

  async function saveRename(id: string, title: string) {
    const t = title.trim();
    setEditingId(null);
    if (!t) return;
    try {
      const res = await api.conversations.rename(id, t);
      setConversations((c) => c.map((x) => (x._id === id ? res.conversation : x)));
    } catch {}
  }

  function selectConversation(id: string) {
    setActiveId(id);
    localStorage.setItem('activeConversationId', id);
    const currentMatch = location.pathname.match(/^\/c\/([^/?#]+)/);
    const currentId = currentMatch ? currentMatch[1] : null;
    if (currentId !== id) navigate(`/c/${id}`);
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="h-12 items-center">
          <div className="flex items-center gap-2 px-2 h-12">
            <img src="/logo.svg" alt="2 knot" className="h-6 w-auto dark:invert block flex-shrink-0" />
            <div className="flex h-6 items-center">
              <span className="font-gween text-[20px] leading-none">2</span>
              <span className="font-gween text-[20px] leading-none ml-1">knot</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 h-12">
            <SidebarTrigger hideWhenExpanded={false} />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/home'}>
                    <Link to="/home">
                      <HomeIcon />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={newChat}>
                    <PlusIcon />
                    <span>New chat</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <BookOpen />
                    <span>Library</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <FolderPlus />
                    <span>Projects</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between cursor-pointer select-none" asChild>
              <button onClick={() => setChatsOpen((v) => !v)}>
                <div className="flex items-center gap-2">
                  <span>Chats</span>
                </div>
                <ChevronDown className={`transition-transform ${chatsOpen ? '' : '-rotate-90'}`} />
              </button>
            </SidebarGroupLabel>
            {chatsOpen && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {conversations.map((c) => (
                    <SidebarMenuItem key={c._id}>
                      <SidebarMenuButton
                        isActive={activeId === c._id}
                        onClick={() => selectConversation(c._id)}
                      >
                        {editingId === c._id ? (
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={() => saveRename(c._id, editValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                (e.currentTarget as HTMLInputElement).blur();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            className="bg-transparent outline-none border-0 focus:ring-0 w-full truncate"
                          />
                        ) : (
                          <span>{c.title}</span>
                        )}
                      </SidebarMenuButton>
                      <SidebarMenuActionsMenu
                        onRename={() => startEditing(c._id)}
                        onDelete={() => removeChat(c._id)}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUserButton email={user?.email || 'user@example.com'} name={user?.name} onLogout={logout} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
