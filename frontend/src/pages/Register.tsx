import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
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
      await register(email, password, name);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create account</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div>
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <Input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full">{loading ? 'Creating…' : 'Register'}</Button>
        <div className="text-sm text-center">
          Have an account? <a className="underline" href="/login">Login</a>
        </div>
      </form>
    </div>
  );
}


