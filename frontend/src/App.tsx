import { Route, Routes, Navigate } from 'react-router-dom'
import Chat from './pages/Chat'
import Home from './pages/Home'
import { useAuth } from './context/AuthContext'
import Auth from './pages/Auth'
import AppLayout from './layouts/AppLayout'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/" element={<Chat />} />
        <Route path="/c/:id" element={<Chat />} />
        <Route path="/home" element={<Home />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
