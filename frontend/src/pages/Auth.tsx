import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ShaderBackground } from '../components/ui/wrap-shader';

type AuthProps = {
  initialMode?: 'login' | 'register';
};

export default function Auth({ initialMode = 'login' }: AuthProps) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.message || (mode === 'login' ? 'Login failed' : 'Register failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-5">
      <div className="relative hidden md:block md:col-span-3 overflow-hidden">
        <ShaderBackground />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent" />
      </div>

      <div className="relative col-span-1 md:col-span-2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-2xl font-semibold text-center">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
            {error && <div className="text-red-600 text-sm text-center">{error}</div>}

            {mode === 'register' && (
              <div>
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}

            <div>
              <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <Input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (mode === 'login' ? 'Signing in…' : 'Creating…') : (mode === 'login' ? 'Login' : 'Register')}
            </Button>

            <div className="text-sm text-center">
              {mode === 'login' ? (
                <span>
                  No account?{' '}
                  <button type="button" className="underline" onClick={() => setMode('register')}>Sign up</button>
                </span>
              ) : (
                <span>
                  Have an account?{' '}
                  <button type="button" className="underline" onClick={() => setMode('login')}>Login</button>
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
