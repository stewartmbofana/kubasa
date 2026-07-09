import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';

export default function Login() {
  useDocumentMetadata("Admin Access | Kubasa", "Authorized login for Kubasa platform managers and administrators.");
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser && userDoc) {
      if (userDoc.role === 'candidate') navigate({ to: '/candidates/profile' });
      else if (userDoc.role === 'employer') navigate({ to: '/employers/candidates' });
      else if (userDoc.role === 'admin') navigate({ to: '/admin/dashboard' });
    }
  }, [currentUser, userDoc, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    if (!email || !password) {
      showToast('Please fill out all fields', 'error');
      return;
    }

    setLoading(true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
      showToast('Admin logged in');
      navigate({ to: '/admin/dashboard' });
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: 'linear-gradient(135deg, #EDE7F6 0%, white 50%, #F3E5F5 100%)' }}>
      <div className="auth-box" style={{ borderTop: '5px solid #7B1FA2' }}>
        <div className="auth-box__logo">
          <div className="auth-box__logo-icon" style={{ background: 'linear-gradient(135deg, #4A148C, #7B1FA2)' }}>K</div>
          <div className="auth-box__logo-text" style={{ color: '#4A148C' }}>Kubasa Admin</div>
        </div>
        <h1 className="auth-box__title">Portal Admin</h1>
        <p className="auth-box__sub">Access restricted to platform managers</p>

        <form onSubmit={handleSubmit} className="form-section">
          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <input name="email" type="email" required className="form-input" placeholder="admin@kubasa.com" />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input name="password" type="password" required className="form-input" placeholder="Password" />
          </div>

          <button type="submit" disabled={loading} className="btn w-full btn--lg" style={{ background: 'linear-gradient(135deg, #4A148C, #7B1FA2)', color: 'white' }}>
            {loading ? 'Verifying...' : 'Access Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );
}
