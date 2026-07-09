import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { auth, db, firebase } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { generateKubasaId } from '../../utils/dbHelpers';
import { UserDoc } from '../../types';

export default function Register() {
  useDocumentMetadata("Register as Candidate | Kubasa", "Join Kubasa to get your unique lifetime Kubasa ID, build your professional profile, and get discovered by top African employers.");
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await auth.signInWithPopup(provider);
      if (!cred.user) throw new Error('Google Sign-In failed');
      const { uid, email, displayName, phoneNumber } = cred.user;

      const uSnap = await db.collection('users').doc(uid).get();
      if (uSnap.exists) {
        const uData = uSnap.data() as UserDoc;
        if (uData.role !== 'candidate') {
          showToast(`This Google account is registered as ${uData.role === 'employer' ? 'an Employer' : 'an Admin'}. Please use the correct portal.`, 'error');
          await auth.signOut();
          return;
        }
        showToast('Signed in successfully');
        navigate({ to: '/candidates/profile' });
      } else {
        const now = firebase.firestore.Timestamp.now();
        await db.collection('users').doc(uid).set({
          uid,
          email: email || '',
          role: 'candidate',
          createdAt: now
        });
        const kubasaId = await generateKubasaId();
        await db.collection('candidates').doc(uid).set({
          uid,
          kubasaId,
          fullName: displayName || email?.split('@')[0] || 'Google User',
          email: email || '',
          phone: phoneNumber || '',
          bio: '',
          skills: [],
          education: [],
          workExperience: [],
          cvUrl: '',
          cvPath: '',
          isLookingForWork: true,
          createdAt: now,
          updatedAt: now
        });
        showToast(`Account created! Your Kubasa ID: ${kubasaId}`, 'success');
        navigate({ to: '/candidates/profile' });
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Google Sign-In failed', 'error');
    } finally {
      setLoading(false);
    }
  };

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
    const fullName = data.get('fullName') as string;
    const phone = data.get('phone') as string;
    const bio = data.get('bio') as string;
    const looking = data.get('looking') === 'on';

    if (!email || !password || !fullName) {
      showToast('Please fill out all required fields', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters long', 'error');
      return;
    }

    setLoading(true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      if (!cred.user) throw new Error('User creation failed');
      const { uid } = cred.user;
      const kubasaId = await generateKubasaId();
      const now = firebase.firestore.Timestamp.now();

      await db.collection('users').doc(uid).set({
        uid, email, role: 'candidate', createdAt: now
      });

      await db.collection('candidates').doc(uid).set({
        uid, kubasaId, fullName, email,
        phone: phone || '',
        bio: bio || '',
        skills,
        education: [],
        workExperience: [],
        cvUrl: '',
        cvPath: '',
        isLookingForWork: looking,
        createdAt: now,
        updatedAt: now
      });

      showToast(`Account created! Your Kubasa ID: ${kubasaId}`, 'success');
      navigate({ to: '/candidates/profile' });
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
      e.preventDefault();
      const s = skillInput.trim().replace(/,$/, '');
      if (s && !skills.includes(s) && skills.length < 50) {
        setSkills([...skills, s]);
      }
      setSkillInput('');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box" style={{ maxWidth: '560px' }}>
        <div className="auth-box__logo">
          <div className="auth-box__logo-icon">K</div>
          <div className="auth-box__logo-text">Kubasa</div>
        </div>
        <h1 className="auth-box__title">Create Candidate Account</h1>
        <p className="auth-box__sub">Build your profile and get a unique sequential Kubasa ID</p>

        <form onSubmit={handleSubmit} className="form-section">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name <span className="required">*</span></label>
              <input name="fullName" required className="form-input" placeholder="Amani Jones" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input name="phone" className="form-input" placeholder="+254 712 345 678" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address <span className="required">*</span></label>
            <input name="email" type="email" required className="form-input" placeholder="amani@example.com" />
          </div>

          <div className="form-group">
            <label className="form-label">Password <span className="required">*</span></label>
            <input name="password" type="password" required className="form-input" placeholder="Min. 6 characters" />
          </div>

          <div className="form-group">
            <label className="form-label">Bio / Summary</label>
            <textarea name="bio" className="form-textarea" placeholder="Brief statement about your career goal..." rows={3} />
          </div>

          <div className="form-group">
            <label className="form-label">Skills</label>
            <div className="tags-container">
              {skills.map(s => (
                <span key={s} className="tag">
                  {s}
                  <button type="button" className="tag__remove" onClick={() => setSkills(skills.filter(x => x !== s))}>×</button>
                </span>
              ))}
              <input
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={addSkill}
                className="tags-input"
                placeholder="Type skill & press Enter"
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input name="looking" type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
              <span>Actively looking for work (make profile visible to employers)</span>
            </label>
          </div>

          <button type="submit" disabled={loading} className="btn btn--primary w-full btn--lg">
            {loading ? 'Submitting...' : 'Register as Candidate →'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="btn btn--google btn--lg w-full"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '8px' }}>
            <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.25h2.9c1.69-1.55 2.69-3.85 2.69-6.58z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.9-2.25c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.71H.92v2.33C2.42 16.06 5.48 18 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V4.96H.92A8.996 8.996 0 0 0 0 9c0 1.45.35 2.82.92 4.04l3.03-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.42 0 9 0 5.48 0 2.42 1.94.92 4.96l3.03 2.33c.71-2.13 2.7-3.71 5.05-3.71z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-box__footer">
          Already have an account? <Link to="/candidates/login">Sign in here</Link>
        </div>
      </div>
    </div>
  );
}
