import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useAuth } from '../context/AuthContext';
import { useDocumentMetadata } from '../hooks/useDocumentMetadata';
import { showToast } from '../utils/toast';
import { seedMockData } from '../utils/dbHelpers';

export default function Home() {
  useDocumentMetadata("Kubasa | Africa's Premier HR Platform", "Kubasa connects job seekers with verified employers across Africa. Get your unique Kubasa ID and stand out from the crowd.");
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedMockData();
    } catch (err: any) {
      showToast('Seed failed: ' + err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    if (currentUser && userDoc) {
      if (userDoc.role === 'candidate') navigate({ to: '/candidates/profile' });
      else if (userDoc.role === 'employer') navigate({ to: '/employers/candidates' });
      else if (userDoc.role === 'admin') navigate({ to: '/admin/dashboard' });
    }
  }, [currentUser, userDoc, navigate]);

  return (
    <div>
      {isLocal && (
        <div style={{ background: 'var(--clr-accent-100)', borderBottom: '1px solid var(--clr-accent-300)', padding: 'var(--space-3) 0', textAlign: 'center' }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--clr-accent-600)' }}>
              🛠️ Dev Mode: Populate mock candidates, employers, and admin accounts instantly.
            </span>
            <button onClick={handleSeed} disabled={seeding} className="btn btn--accent btn--sm" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
              {seeding ? 'Seeding...' : '⚡ Seed Mock Data'}
            </button>
          </div>
        </div>
      )}
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero__content">
            <div className="hero__eyebrow">
              <span>🌍</span> Africa's Premier HR Platform
            </div>
            <h1 className="hero__title">
              Where <span>Talent</span> Meets<br />Opportunity
            </h1>
            <p className="hero__subtitle">
              Kubasa connects job seekers with verified employers across Africa.
              Get your unique Kubasa ID and stand out from the crowd.
            </p>
            <div className="hero__cta">
              <Link to="/candidates/register" className="btn btn--accent btn--lg">🎓 I'm Looking for Work</Link>
              <Link to="/employers/register" className="btn btn--outline btn--lg" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.6)' }}>🏢 I'm Hiring</Link>
            </div>
            <div className="hero__stats">
              <div className="hero__stat">
                <div className="hero__stat-num">∞</div>
                <div className="hero__stat-label">Opportunities</div>
              </div>
              <div className="hero__stat">
                <div className="hero__stat-num">1</div>
                <div className="hero__stat-label">Unique Kubasa ID</div>
              </div>
              <div className="hero__stat">
                <div className="hero__stat-num">🔒</div>
                <div className="hero__stat-label">Verified Employers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portal choice section */}
      <section style={{ padding: 'var(--space-20) 0', background: 'white' }}>
        <div className="container">
          <div className="section-header" style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
            <span className="section-header__eyebrow" style={{ display: 'block', color: 'var(--clr-primary-600)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' }}>Two specialized portals</span>
            <h2 className="section-header__title">Built for Everyone</h2>
            <p className="section-header__sub" style={{ color: 'var(--clr-neutral-500)' }}>Join as a candidate to get hired, or as an employer to search Africa's talent.</p>
          </div>

          <div className="grid-2" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="portal-card portal-card--candidate">
              <div className="portal-card__icon">🎓</div>
              <h3 className="portal-card__title" style={{ marginBottom: 'var(--space-2)' }}>Candidates</h3>
              <p className="portal-card__desc" style={{ fontSize: '0.9rem', color: 'var(--clr-neutral-500)', marginBottom: 'var(--space-6)' }}>
                Create your profile, upload your CV, and receive a lifetime <strong>Kubasa ID</strong>.
                Toggle search visibility so approved employers can discover you.
              </p>
              <Link to="/candidates/register" className="btn btn--primary" style={{ width: '100%' }}>Create Candidate Account →</Link>
            </div>

            <div className="portal-card portal-card--employer">
              <div className="portal-card__icon">🏢</div>
              <h3 className="portal-card__title" style={{ marginBottom: 'var(--space-2)' }}>Employers</h3>
              <p className="portal-card__desc" style={{ fontSize: '0.9rem', color: 'var(--clr-neutral-500)', marginBottom: 'var(--space-6)' }}>
                Submit details of your organization for review. Once verified by our admin panel, search
                approved candidates sorted by their lifetime Kubasa ID.
              </p>
              <Link to="/employers/register" className="btn btn--accent" style={{ width: '100%' }}>Register Organization →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="footer__brand">Kubasa</div>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', maxWidth: '500px', marginTop: 'var(--space-2)' }}>
            Connecting the brightest talent with industry-leading organizations across Africa.
          </p>
          <div className="footer__copy">
            © {new Date().getFullYear()} Kubasa. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
