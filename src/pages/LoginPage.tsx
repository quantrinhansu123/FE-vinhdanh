import { FormEvent, useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';

import backgroundImg from '../assets/background.png';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('upedu2024@gmail.com');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await onLogin(email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center px-4 font-sans antialiased">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${backgroundImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div className="absolute inset-0 bg-black/55" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-black/55 backdrop-blur-xl p-6 text-white shadow-2xl"
      >
        <h1 className="text-2xl font-black tracking-wide text-yellow-300">Đăng Nhập Hệ Thống</h1>
        <p className="text-white/60 text-sm mt-1">Vui lòng đăng nhập để truy cập bảng xếp hạng và báo cáo.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/35 px-3 py-2.5 outline-none focus:border-yellow-400/60"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/35 px-3 py-2.5 outline-none focus:border-yellow-400/60"
              placeholder="Nhập mật khẩu"
            />
          </div>
        </div>

        {errorMessage && <p className="mt-3 text-sm text-red-300">{errorMessage}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 w-full rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black font-bold py-2.5 flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
          Đăng nhập
        </button>
      </form>
    </div>
  );
}
