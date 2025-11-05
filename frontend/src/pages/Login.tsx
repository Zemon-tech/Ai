import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Login</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <Input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Signing in…' : 'Login'}</Button>
        <div className="text-sm text-center">
          No account? <a className="underline" href="/register">Register</a>
        </div>
      </form>
    </div>
  );
}


