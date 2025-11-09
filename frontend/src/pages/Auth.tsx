import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
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

  // Ensure Auth page respects system theme when Sidebar (theme manager) isn't mounted
  useEffect(() => {
    const theme = (localStorage.getItem('theme') as 'system' | 'light' | 'dark') || 'system';
    const root = document.documentElement;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const setDark = (on: boolean) => root.classList.toggle('dark', on);
    const apply = (t: 'system' | 'light' | 'dark') => {
      if (t === 'system') setDark(mql.matches);
      else setDark(t === 'dark');
    };

    apply(theme);

    const onSystemChange = () => {
      if (theme === 'system') apply('system');
    };
    mql.addEventListener('change', onSystemChange);
    return () => mql.removeEventListener('change', onSystemChange);
  }, []);

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
        <div className="w-full max-w-sm space-y-1">
          <div className="flex justify-center">
            <div className="flex items-center translate-x-[2px]">
              <span className="font-gween text-6xl leading-none">2</span>
              <span className="font-gween text-6xl leading-none ml-1s">knot</span>
            </div>
          </div>
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
