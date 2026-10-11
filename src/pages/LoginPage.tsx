import { FormEvent, useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';

import backgroundImg from '../assets/background.png';
import { StitchButton, StitchInput, StitchState } from '../components/ui/StitchUI';

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
    <div className="stitch-system stitch-public-page stitch-login-page">
      <div className="stitch-public-orb stitch-public-orb--one" aria-hidden="true" />
      <div className="stitch-public-orb stitch-public-orb--two" aria-hidden="true" />
      <main className="stitch-login-shell">
        <section className="stitch-login-story">
          <img src={backgroundImg} alt="" aria-hidden="true" />
          <div className="stitch-login-story-overlay" />
          <div className="stitch-login-brand"><span>MAP</span><div><strong>Marketing Analytics Platform</strong><small>Performance management workspace</small></div></div>
          <div className="stitch-login-story-copy">
            <span className="stitch-login-eyebrow">Dữ liệu tập trung · Quyết định rõ ràng</span>
            <h2>Điều hành hiệu suất từ một góc nhìn thống nhất.</h2>
            <p>Theo dõi doanh số, ngân sách, KPI và tiến độ đội ngũ trong cùng một hệ thống.</p>
            <div className="stitch-login-story-stats"><span><strong>Realtime</strong><small>Cập nhật báo cáo</small></span><span><strong>Role based</strong><small>Phân quyền truy cập</small></span></div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="stitch-login-form">
          <div className="stitch-login-mobile-brand"><span>MAP</span><strong>Marketing Analytics Platform</strong></div>
          <div className="stitch-login-heading">
            <span>Chào mừng trở lại</span>
            <h1>Đăng nhập hệ thống</h1>
            <p>Sử dụng tài khoản được cấp để truy cập bảng xếp hạng và báo cáo.</p>
          </div>

          <div className="stitch-login-fields">
            <label>
              <span className="stitch-label">Email</span>
              <StitchInput type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label>
              <span className="stitch-label">Mật khẩu</span>
              <StitchInput type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" />
            </label>
          </div>

          {errorMessage && <StitchState tone="error" role="alert">{errorMessage}</StitchState>}

          <StitchButton type="submit" disabled={isSubmitting} className="stitch-login-submit">
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </StitchButton>
          <p className="stitch-login-support">Cần hỗ trợ tài khoản? Liên hệ quản trị viên của hệ thống.</p>
        </form>
      </main>
    </div>
  );
}
