import React, { useState, useEffect } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Link,
  useNavigate,
  RouterProvider,
} from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { auth, db, storage, firebase } from './firebase';

// ================================================================
// Toast & Alert Notification Context/System
// ================================================================
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

let addGlobalToast: (message: string, type?: Toast['type']) => void = () => {};

export function showToast(message: string, type: Toast['type'] = 'success') {
  addGlobalToast(message, type);
}

// ================================================================
// Type definitions
// ================================================================
interface UserDoc {
  uid: string;
  email: string;
  role: 'candidate' | 'employer' | 'admin';
  createdAt: any;
}

interface CandidateDoc {
  uid: string;
  kubasaId: string;
  fullName: string;
  email: string;
  phone?: string;
  bio?: string;
  skills?: string[];
  education?: Array<{ institution: string; degree: string; year: string }>;
  workExperience?: Array<{ company: string; role: string; startYear: string; endYear?: string; description?: string }>;
  cvUrl?: string;
  cvPath?: string;
  isLookingForWork: boolean;
  createdAt: any;
  updatedAt: any;
}

interface EmployerDoc {
  uid: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  industry?: string;
  website?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  shortlist?: string[];
  createdAt: any;
}

interface JobDoc {
  id: string;
  employerUid: string;
  companyName: string;
  title: string;
  description: string;
  location: string;
  salaryRange?: string;
  requirements?: string[];
  createdAt: any;
}

// ================================================================
// Auth Observer Hook
// ================================================================
function useAuthStatus() {
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [roleDoc, setRoleDoc] = useState<CandidateDoc | EmployerDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const uSnap = await db.collection('users').doc(user.uid).get();
          if (uSnap.exists) {
            const uData = uSnap.data() as UserDoc;
            setUserDoc(uData);

            if (uData.role === 'candidate') {
              const cSnap = await db.collection('candidates').doc(user.uid).get();
              if (cSnap.exists) setRoleDoc(cSnap.data() as CandidateDoc);
            } else if (uData.role === 'employer') {
              const eSnap = await db.collection('employers').doc(user.uid).get();
              if (eSnap.exists) setRoleDoc(eSnap.data() as EmployerDoc);
            }
          }
        } catch (err) {
          console.error('Error fetching auth user documents:', err);
        }
      } else {
        setUserDoc(null);
        setRoleDoc(null);
      }
      setLoading(false);
    });
  }, []);

  return { currentUser, userDoc, roleDoc, loading, refetchRoleDoc: async () => {
    if (!currentUser || !userDoc) return;
    if (userDoc.role === 'candidate') {
      const cSnap = await db.collection('candidates').doc(currentUser.uid).get();
      if (cSnap.exists) setRoleDoc(cSnap.data() as CandidateDoc);
    } else if (userDoc.role === 'employer') {
      const eSnap = await db.collection('employers').doc(currentUser.uid).get();
      if (eSnap.exists) setRoleDoc(eSnap.data() as EmployerDoc);
    }
  }};
}

const AuthContext = React.createContext<ReturnType<typeof useAuthStatus> | null>(null);

function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// ================================================================
// SEO / Document Metadata Hook
// ================================================================
function useDocumentMetadata(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    }
  }, [title, description]);
}

// ================================================================
// Sequential Kubasa ID Generator Transaction
// ================================================================
async function generateKubasaId(): Promise<string> {
  const counterRef = db.collection('counters').doc('kubasaId');
  let newId = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? snap.data()?.current || 0 : 0;
    newId = current + 1;
    tx.set(counterRef, { current: newId });
  });
  return `KBS-${String(newId).padStart(5, '0')}`;
}

// ================================================================
// Layout Template (Root Route)
// ================================================================
const rootRoute = createRootRoute({
  component: () => {
    const { currentUser, userDoc, loading } = useAuth();
    const navigate = useNavigate();
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
      addGlobalToast = (message, type = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
      };
    }, []);

    const handleSignOut = async () => {
      await auth.signOut();
      showToast('Signed out successfully');
      navigate({ to: '/' });
    };

    const getInitials = () => {
      if (!currentUser) return '?';
      return (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
    };

    return (
      <div className="flex flex-col min-h-screen">
        {/* Navbar */}
        <nav className="navbar" role="navigation" aria-label="Main navigation">
          <div className="container">
            <div className="navbar__inner">
              <Link to="/" className="navbar__brand">
                <div className="navbar__brand-icon">K</div>
                Kubasa
              </Link>

              {/* Navigation Links */}
              <div className="navbar__nav">
                {!currentUser && (
                  <>
                    <Link to="/candidates/login" className="navbar__link">For Candidates</Link>
                    <Link to="/employers/login" className="navbar__link">For Employers</Link>
                    <Link to="/admin/login" className="navbar__link" style={{ fontSize: '0.82rem', opacity: 0.6 }}>Admin</Link>
                  </>
                )}
                {currentUser && userDoc && (
                  <>
                    {userDoc.role === 'candidate' && (
                      <>
                        <Link to="/candidates/profile" className="navbar__link">My Profile</Link>
                        <Link to="/candidates/jobs" className="navbar__link">Browse Jobs</Link>
                      </>
                    )}
                    {userDoc.role === 'employer' && (
                      <>
                        <Link to="/employers/candidates" className="navbar__link">Candidates</Link>
                        <Link to="/employers/shortlist" className="navbar__link">Shortlist</Link>
                        <Link to="/employers/jobs" className="navbar__link">My Jobs</Link>
                      </>
                    )}
                    {userDoc.role === 'admin' && (
                      <Link to="/admin/dashboard" className="navbar__link">Dashboard</Link>
                    )}
                  </>
                )}
              </div>

              {/* Actions / User Profile */}
              <div className="navbar__actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                {!currentUser ? (
                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <Link to="/candidates/register" className="btn btn--outline btn--sm">Join as Candidate</Link>
                    <Link to="/employers/register" className="btn btn--accent btn--sm">Post Jobs</Link>
                  </div>
                ) : (
                  <>
                    <div className="navbar__user-chip">
                      <div className="navbar__avatar">{getInitials()}</div>
                      <span>{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                    </div>
                    <button onClick={handleSignOut} className="btn btn--ghost btn--sm">Sign out</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <main style={{ flex: 1 }}>
          {loading ? (
            <div className="page-loader">
              <div className="spinner"></div>
              <p>Authenticating...</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Toast Container */}
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <span className="toast__icon">
                {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : '⚠️'}
              </span>
              <span className="toast__message">{t.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
});

// ================================================================
// Seeding helper to build out mock candidate, employer, and admin records in development.
async function seedMockData() {
  showToast('Seeding database... Please wait.', 'info');

  const seedUser = async (email: string, role: 'candidate' | 'employer' | 'admin', firestoreData: any): Promise<string> => {
    let uid = '';
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, 'password123');
      if (cred.user) uid = cred.user.uid;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const cred = await auth.signInWithEmailAndPassword(email, 'password123');
          if (cred.user) uid = cred.user.uid;
        } catch (signInErr) {
          console.error('Failed to resolve existing mock credentials:', signInErr);
          return '';
        }
      } else {
        console.error('Seeding credentials failed:', err);
        return '';
      }
    }

    if (!uid) return '';

    const userDocRef = db.collection('users').doc(uid);
    const userSnap = await userDocRef.get();
    if (!userSnap.exists) {
      await userDocRef.set({
        uid,
        email,
        role,
        createdAt: firebase.firestore.Timestamp.now()
      });
    }

    if (role === 'candidate') {
      const cDocRef = db.collection('candidates').doc(uid);
      const cSnap = await cDocRef.get();
      if (!cSnap.exists) {
        await cDocRef.set({
          uid,
          email,
          ...firestoreData,
          createdAt: firebase.firestore.Timestamp.now(),
          updatedAt: firebase.firestore.Timestamp.now()
        });
      }
    } else if (role === 'employer') {
      const eDocRef = db.collection('employers').doc(uid);
      const eSnap = await eDocRef.get();
      if (!eSnap.exists) {
        await eDocRef.set({
          uid,
          email,
          ...firestoreData,
          createdAt: firebase.firestore.Timestamp.now()
        });
      }
    }
    return uid;
  };

  // Seed Admin first (authenticates client SDK as admin@kubasa.com)
  await seedUser('admin@kubasa.com', 'admin', {});

  // Initialize sequential counter (now authenticated, passes rule at L199)
  await db.collection('counters').doc('kubasaId').set({ current: 5 });

  // Seed Approved Employer
  const employerUid = await seedUser('employer@acme.com', 'employer', {
    companyName: 'Acme Solutions',
    contactName: 'John Doe',
    phone: '+254 711 111 222',
    industry: 'Technology',
    website: 'https://acmesolutions.co',
    approvalStatus: 'approved',
    shortlist: []
  });

  // Seed Pending Employer
  await seedUser('pending@startup.com', 'employer', {
    companyName: 'Balozi Startups',
    contactName: 'Mwangi Kamau',
    phone: '+254 722 333 444',
    industry: 'Fintech',
    website: 'https://balozi.co.ke',
    approvalStatus: 'pending',
    shortlist: []
  });

  // Seed Rejected Employer
  await seedUser('rejected@spam.com', 'employer', {
    companyName: 'Spam Ads Inc',
    contactName: 'Fake User',
    phone: '+1 555 0199',
    industry: 'Ads',
    website: 'http://spammy.xyz',
    approvalStatus: 'rejected',
    shortlist: []
  });

  // Seed Candidates
  const c1Uid = await seedUser('candidate1@gmail.com', 'candidate', {
    kubasaId: 'KBS-00001',
    fullName: 'Jane Wambui',
    phone: '+254 720 000 001',
    bio: 'Experienced React & TypeScript engineer with a passion for building user-friendly frontends. 4 years of experience working with remote tech startups.',
    skills: ['React', 'TypeScript', 'Vite', 'CSS', 'Firebase'],
    isLookingForWork: true,
    education: [
      { institution: 'Strathmore University', degree: 'B.Sc. Informatics', year: '2022' }
    ],
    workExperience: [
      { company: 'Kona Solutions', role: 'Frontend Engineer', startYear: '2023', endYear: 'Present', description: 'Developed React web dashboards and optimized bundle sizes by 35%.' }
    ]
  });

  const c2Uid = await seedUser('candidate2@gmail.com', 'candidate', {
    kubasaId: 'KBS-00002',
    fullName: 'David Ochieng',
    phone: '+254 731 000 002',
    bio: 'Backend developer specializing in Node.js, Python, and SQL database design. I build secure, scaleable REST APIs and cloud infrastructure.',
    skills: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'Python'],
    isLookingForWork: true,
    education: [
      { institution: 'Jomo Kenyatta University', degree: 'B.Sc. Computer Technology', year: '2021' }
    ],
    workExperience: [
      { company: 'Unga Tech', role: 'Node.js Developer', startYear: '2022', endYear: '2024', description: 'Designed core APIs handling 10k concurrent requests. Set up Docker deployments.' }
    ]
  });

  await seedUser('candidate3@gmail.com', 'candidate', {
    kubasaId: 'KBS-00003',
    fullName: 'Fatuma Hassan',
    phone: '+254 701 000 003',
    bio: 'Product Designer (UI/UX) focused on creating delightful mobile and web experiences. Skilled in Figma design systems, wireframing, and user testing.',
    skills: ['Figma', 'UI/UX Design', 'Wireframing', 'User Research', 'HTML/CSS'],
    isLookingForWork: true,
    education: [
      { institution: 'University of Nairobi', degree: 'B.A. Design', year: '2023' }
    ],
    workExperience: [
      { company: 'Manga Labs', role: 'UI/UX Intern', startYear: '2023', endYear: '2023', description: 'Redesigned user onboarding flow which increased registration conversions by 15%.' }
    ]
  });

  await seedUser('candidate4@gmail.com', 'candidate', {
    kubasaId: 'KBS-00004',
    fullName: 'Kofi Mensah',
    phone: '+233 24 000 0004',
    bio: 'Project Manager certified in Agile/Scrum. Excellent at coordinating cross-functional teams, managing sprint scopes, and communicating project statuses.',
    skills: ['Agile', 'Scrum', 'Jira', 'Product Roadmap', 'Communication'],
    isLookingForWork: true,
    education: [
      { institution: 'Ashesi University', degree: 'B.Sc. Management Information Systems', year: '2020' }
    ],
    workExperience: [
      { company: 'FinPay Ghana', role: 'Agile Project Lead', startYear: '2021', endYear: '2023', description: 'Led 3 product sprints and coordinated delivery of key client integrations on-schedule.' }
    ]
  });

  await seedUser('candidate5@gmail.com', 'candidate', {
    kubasaId: 'KBS-00005',
    fullName: 'Zola Dlamini',
    phone: '+27 82 000 0005',
    bio: 'Data Scientist with a background in statistical modeling, machine learning algorithms, and Python data pipelines. Experienced with Pandas, NumPy, Scikit-Learn.',
    skills: ['Python', 'SQL', 'Machine Learning', 'Pandas', 'Data Visualization'],
    isLookingForWork: false,
    education: [
      { institution: 'University of Cape Town', degree: 'M.Sc. Data Science', year: '2022' }
    ],
    workExperience: [
      { company: 'Cape Analytics', role: 'Junior Data Scientist', startYear: '2022', endYear: '2024', description: 'Developed predictive customer churn models with 87% accuracy.' }
    ]
  });

  // Seed Mock Jobs and Applications (requires active employer session)
  try {
    await auth.signInWithEmailAndPassword('employer@acme.com', 'password123');

    const job1Ref = db.collection('jobs').doc('job-react-developer');
    const job1Snap = await job1Ref.get();
    if (!job1Snap.exists) {
      await job1Ref.set({
        id: 'job-react-developer',
        employerUid: employerUid || 'mock-employer-uid',
        companyName: 'Acme Solutions',
        title: 'Senior React Developer',
        description: 'We are seeking a highly skilled Senior React Developer to join our growing product team. You will lead frontend architecture, implement complex UI interactions, and collaborate with backend engineers.',
        location: 'Nairobi, Kenya (Hybrid)',
        salaryRange: '$2,000 - $3,500 / month',
        requirements: ['React', 'TypeScript', 'Vite', 'Firebase', 'State Management'],
        createdAt: firebase.firestore.Timestamp.now()
      });

      if (c1Uid) {
        await job1Ref.collection('applications').doc(c1Uid).set({
          candidateUid: c1Uid,
          appliedAt: firebase.firestore.Timestamp.now()
        });
      }
      if (c2Uid) {
        await job1Ref.collection('applications').doc(c2Uid).set({
          candidateUid: c2Uid,
          appliedAt: firebase.firestore.Timestamp.now()
        });
      }
    }

    const job2Ref = db.collection('jobs').doc('job-backend-node');
    const job2Snap = await job2Ref.get();
    if (!job2Snap.exists) {
      await job2Ref.set({
        id: 'job-backend-node',
        employerUid: employerUid || 'mock-employer-uid',
        companyName: 'Acme Solutions',
        title: 'Backend Node.js Engineer',
        description: 'Join our backend systems team to scale our server-side microservices. Responsible for designing robust APIs, database migrations, and configuring CI/CD pipelines.',
        location: 'Remote (Africa)',
        salaryRange: '$1,800 - $3,000 / month',
        requirements: ['Node.js', 'Express', 'PostgreSQL', 'Docker', 'REST APIs'],
        createdAt: firebase.firestore.Timestamp.now()
      });
    }

    const job3Ref = db.collection('jobs').doc('job-product-designer');
    const job3Snap = await job3Ref.get();
    if (!job3Snap.exists) {
      await job3Ref.set({
        id: 'job-product-designer',
        employerUid: employerUid || 'mock-employer-uid',
        companyName: 'Acme Solutions',
        title: 'Product Designer (UI/UX)',
        description: 'Seeking a UI/UX Product Designer to design beautiful interfaces. You will create user personas, layout interactive wireframes, and craft polished UI designs in Figma.',
        location: 'Nairobi, Kenya',
        salaryRange: '$1,500 - $2,500 / month',
        requirements: ['Figma', 'UI/UX Design', 'Wireframing', 'User Research'],
        createdAt: firebase.firestore.Timestamp.now()
      });
    }
  } catch (err) {
    console.error('Job seeding failed:', err);
  }

  // Sign out the last user so client is back in guest state
  await auth.signOut();
  showToast('Mock database seeded! Test with password "password123".', 'success');
}

// Page Component: Home/Landing
// ================================================================
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => {
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
});

// ================================================================
// Page Component: Candidate Registration
// ================================================================
const candidateRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/register',
  component: () => {
    useDocumentMetadata("Register as Candidate | Kubasa", "Join Kubasa to get your unique lifetime Kubasa ID, build your professional profile, and get discovered by top African employers.");
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
    const [skills, setSkills] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState('');

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

          <div className="auth-box__footer">
            Already have an account? <Link to="/candidates/login">Sign in here</Link>
          </div>
        </div>
      </div>
    );
  }
});

// ================================================================
// Page Component: Candidate Login
// ================================================================
const candidateLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/login',
  component: () => {
    useDocumentMetadata("Candidate Login | Kubasa", "Access your Kubasa candidate account to manage your profile, CV, search visibility, and job applications.");
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
        showToast('Please fill out email and password', 'error');
        return;
      }

      setLoading(true);
      try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Signed in successfully');
        navigate({ to: '/candidates/profile' });
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Login failed', 'error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="auth-page">
        <div className="auth-box">
          <div className="auth-box__logo">
            <div className="auth-box__logo-icon">K</div>
            <div className="auth-box__logo-text">Kubasa</div>
          </div>
          <h1 className="auth-box__title">Candidate Sign In</h1>
          <p className="auth-box__sub">Manage your profile & track your status</p>

          <form onSubmit={handleSubmit} className="form-section">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input name="email" type="email" required className="form-input" placeholder="amani@example.com" />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input name="password" type="password" required className="form-input" placeholder="Your password" />
            </div>

            <button type="submit" disabled={loading} className="btn btn--primary w-full btn--lg">
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </form>

          <div className="auth-box__footer">
            New here? <Link to="/candidates/register">Create a candidate profile</Link>
          </div>
        </div>
      </div>
    );
  }
});

// ================================================================
// Page Component: Candidate Profile Editor (Auth Protected)
// ================================================================
const candidateProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/profile',
  component: () => {
    useDocumentMetadata("My Profile | Kubasa", "Manage your candidate profile details, work history, education, skill tags, and CV resume document.");
    const { currentUser, roleDoc, refetchRoleDoc } = useAuth();
    const navigate = useNavigate();

    // Redirect guest out
    useEffect(() => {
      if (!currentUser) navigate({ to: '/candidates/login' });
    }, [currentUser]);

    const c = roleDoc as CandidateDoc;

    // Form inputs
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [isLookingForWork, setIsLookingForWork] = useState(true);
    const [skills, setSkills] = useState<string[]>([]);
    const [skillInput, setSkillInput] = useState('');

    // Experience state
    const [workExperience, setWorkExperience] = useState<any[]>([]);
    const [newExp, setNewExp] = useState({ company: '', role: '', startYear: '', endYear: '', description: '' });
    const [showExpForm, setShowExpForm] = useState(false);

    // Education state
    const [education, setEducation] = useState<any[]>([]);
    const [newEdu, setNewEdu] = useState({ institution: '', degree: '', year: '' });
    const [showEduForm, setShowEduForm] = useState(false);

    // CV progress
    const [uploadPct, setUploadPct] = useState<number | null>(null);

    // Initialize values when candidate data loads
    useEffect(() => {
      if (c) {
        setFullName(c.fullName || '');
        setPhone(c.phone || '');
        setBio(c.bio || '');
        setIsLookingForWork(c.isLookingForWork ?? true);
        setSkills(c.skills || []);
        setWorkExperience(c.workExperience || []);
        setEducation(c.education || []);
      }
    }, [c]);

    if (!c) {
      return (
        <div className="page-loader">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      );
    }

    const saveMutation = useMutation({
      mutationFn: async () => {
        const uid = currentUser!.uid;
        const now = firebase.firestore.Timestamp.now();
        await db.collection('candidates').doc(uid).update({
          fullName,
          phone,
          bio,
          skills,
          workExperience,
          education,
          isLookingForWork,
          updatedAt: now,
        });
      },
      onSuccess: () => {
        showToast('Profile saved successfully');
        refetchRoleDoc();
      },
      onError: (err: any) => {
        console.error(err);
        showToast(err.message || 'Failed to save profile', 'error');
      }
    });

    const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type !== 'application/pdf') {
        showToast('Please upload a PDF file', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be under 10MB', 'error');
        return;
      }

      setUploadPct(0);
      const uid = currentUser!.uid;
      const cvPath = `cvs/${uid}/${Date.now()}_${file.name}`;
      const ref = storage.ref(cvPath);

      const task = ref.put(file);
      task.on('state_changed',
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploadPct(pct);
        },
        (err) => {
          console.error(err);
          showToast('Upload failed', 'error');
          setUploadPct(null);
        },
        async () => {
          const cvUrl = await ref.getDownloadURL();
          // Delete old file if exists
          if (c.cvPath) {
            try { await storage.ref(c.cvPath).delete(); } catch {}
          }
          await db.collection('candidates').doc(uid).update({
            cvUrl,
            cvPath,
            updatedAt: firebase.firestore.Timestamp.now()
          });
          showToast('CV uploaded successfully');
          setUploadPct(null);
          refetchRoleDoc();
        }
      );
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

    const addExperience = () => {
      if (!newExp.company || !newExp.role || !newExp.startYear) {
        showToast('Company, role and start year are required', 'warning');
        return;
      }
      setWorkExperience([...workExperience, newExp]);
      setNewExp({ company: '', role: '', startYear: '', endYear: '', description: '' });
      setShowExpForm(false);
    };

    const addEducation = () => {
      if (!newEdu.institution || !newEdu.degree || !newEdu.year) {
        showToast('All education fields are required', 'warning');
        return;
      }
      setEducation([...education, newEdu]);
      setNewEdu({ institution: '', degree: '', year: '' });
      setShowEduForm(false);
    };

    return (
      <div className="profile-page">
        <div className="container--narrow">
          {/* Profile Card Header */}
          <div className="profile-header">
            <div className="profile-header__avatar">
              {(fullName || c.fullName || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="profile-header__id">{c.kubasaId}</div>
              <h1 className="profile-header__name">{c.fullName}</h1>
              <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>{c.email}</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="form-section">
            {/* Basic Info */}
            <div className="card">
              <div className="card__header">
                <h4>📋 Profile Details</h4>
              </div>
              <div className="card__body form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} required className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} className="form-input" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Summary / Bio</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} className="form-textarea" placeholder="Brief statement about your career goals" rows={4} maxLength={2000} />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <input type="checkbox" checked={isLookingForWork} onChange={e => setIsLookingForWork(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                    <span>Actively looking for work (make profile visible to employers)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="card">
              <div className="card__header">
                <h4>⚡ Skills</h4>
              </div>
              <div className="card__body">
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
            </div>

            {/* Work Experience */}
            <div className="card">
              <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>💼 Work Experience</h4>
                {!showExpForm && (
                  <button type="button" onClick={() => setShowExpForm(true)} className="btn btn--outline btn--sm">+ Add</button>
                )}
              </div>
              <div className="card__body">
                {workExperience.map((exp, index) => (
                  <div key={index} className="exp-item">
                    <div className="exp-item__header">
                      <div>
                        <strong>{exp.role}</strong> at <strong>{exp.company}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--clr-neutral-500)' }}>{exp.startYear} - {exp.endYear || 'Present'}</div>
                      </div>
                      <button type="button" className="exp-item__remove" onClick={() => setWorkExperience(workExperience.filter((_, i) => i !== index))}>×</button>
                    </div>
                    {exp.description && <p style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--clr-neutral-600)' }}>{exp.description}</p>}
                  </div>
                ))}

                {showExpForm && (
                  <div style={{ padding: 'var(--space-4)', background: 'var(--clr-neutral-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-neutral-200)' }}>
                    <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
                      <div className="form-group">
                        <label className="form-label">Role</label>
                        <input value={newExp.role} onChange={e => setNewExp({ ...newExp, role: e.target.value })} className="form-input" placeholder="e.g. Developer" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Company</label>
                        <input value={newExp.company} onChange={e => setNewExp({ ...newExp, company: e.target.value })} className="form-input" placeholder="e.g. Acme Inc" />
                      </div>
                    </div>
                    <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
                      <div className="form-group">
                        <label className="form-label">Start Year</label>
                        <input value={newExp.startYear} onChange={e => setNewExp({ ...newExp, startYear: e.target.value })} className="form-input" placeholder="e.g. 2021" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">End Year</label>
                        <input value={newExp.endYear} onChange={e => setNewExp({ ...newExp, endYear: e.target.value })} className="form-input" placeholder="e.g. Present" />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                      <label className="form-label">Description</label>
                      <textarea value={newExp.description} onChange={e => setNewExp({ ...newExp, description: e.target.value })} className="form-textarea" placeholder="Key responsibilities" rows={2} />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                      <button type="button" onClick={addExperience} className="btn btn--primary btn--sm">Add</button>
                      <button type="button" onClick={() => setShowExpForm(false)} className="btn btn--ghost btn--sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Education */}
            <div className="card">
              <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>🎓 Education</h4>
                {!showEduForm && (
                  <button type="button" onClick={() => setShowEduForm(true)} className="btn btn--outline btn--sm">+ Add</button>
                )}
              </div>
              <div className="card__body">
                {education.map((edu, index) => (
                  <div key={index} className="exp-item">
                    <div className="exp-item__header">
                      <div>
                        <strong>{edu.degree}</strong>
                        <div>{edu.institution}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--clr-neutral-500)' }}>Graduation: {edu.year}</div>
                      </div>
                      <button type="button" className="exp-item__remove" onClick={() => setEducation(education.filter((_, i) => i !== index))}>×</button>
                    </div>
                  </div>
                ))}

                {showEduForm && (
                  <div style={{ padding: 'var(--space-4)', background: 'var(--clr-neutral-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-neutral-200)' }}>
                    <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                      <label className="form-label">Institution</label>
                      <input value={newEdu.institution} onChange={e => setNewEdu({ ...newEdu, institution: e.target.value })} className="form-input" placeholder="e.g. University" />
                    </div>
                    <div className="form-row" style={{ marginBottom: 'var(--space-4)' }}>
                      <div className="form-group">
                        <label className="form-label">Degree</label>
                        <input value={newEdu.degree} onChange={e => setNewEdu({ ...newEdu, degree: e.target.value })} className="form-input" placeholder="e.g. Bachelor" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Graduation Year</label>
                        <input value={newEdu.year} onChange={e => setNewEdu({ ...newEdu, year: e.target.value })} className="form-input" placeholder="e.g. 2020" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                      <button type="button" onClick={addEducation} className="btn btn--primary btn--sm">Add</button>
                      <button type="button" onClick={() => setShowEduForm(false)} className="btn btn--ghost btn--sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CV Upload */}
            <div className="card">
              <div className="card__header">
                <h4>📄 CV Document</h4>
              </div>
              <div className="card__body">
                {c.cvUrl ? (
                  <div className="file-upload__selected" style={{ marginBottom: 'var(--space-4)' }}>
                    <span>📄</span>
                    <span style={{ flex: 1 }}>CV Uploaded</span>
                    <a href={c.cvUrl} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm">View CV</a>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--clr-neutral-500)', marginBottom: 'var(--space-4)' }}>No CV uploaded yet.</p>
                )}

                <div className="file-upload" onClick={() => document.getElementById('cv-input')?.click()}>
                  <div className="file-upload__icon">📁</div>
                  <div className="file-upload__text">Click to upload new CV</div>
                  <div className="file-upload__hint">PDF only, max 10MB</div>
                  <input id="cv-input" type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleCVUpload} />
                </div>

                {uploadPct !== null && (
                  <div style={{ width: '100%', background: 'var(--clr-neutral-200)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '12px' }}>
                    <div style={{ width: `${uploadPct}%`, background: 'var(--clr-primary-600)', height: '100%' }}></div>
                  </div>
                )}
              </div>
            </div>

            <button type="submit" disabled={saveMutation.isPending} className="btn btn--primary btn--lg w-full">
              {saveMutation.isPending ? 'Saving...' : '💾 Save Profile'}
            </button>
          </form>
        </div>
      </div>
    );
  }
});

// ================================================================
// Page Component: Employer Registration
// ================================================================
const employerRegisterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/register',
  component: () => {
    useDocumentMetadata("Register as Employer | Kubasa", "Register your company or organization on Kubasa to search for top talent across Africa and publish job listings.");
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
      const companyName = data.get('companyName') as string;
      const contactName = data.get('contactName') as string;
      const phone = data.get('phone') as string;
      const industry = data.get('industry') as string;
      const website = data.get('website') as string;

      if (!email || !password || !companyName || !contactName) {
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
        const now = firebase.firestore.Timestamp.now();

        await db.collection('users').doc(uid).set({
          uid, email, role: 'employer', createdAt: now
        });

        await db.collection('employers').doc(uid).set({
          uid, companyName, contactName, email,
          phone: phone || '',
          industry: industry || '',
          website: website || '',
          approvalStatus: 'pending',
          shortlist: [],
          createdAt: now
        });

        showToast('Employer profile registered! Awaiting admin verification', 'success');
        navigate({ to: '/employers/candidates' });
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Registration failed', 'error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="auth-page">
        <div className="auth-box auth-box--employer" style={{ maxWidth: '560px' }}>
          <div className="auth-box__logo">
            <div className="auth-box__logo-icon" style={{ background: 'var(--gradient-accent)', color: 'var(--clr-neutral-900)' }}>K</div>
            <div className="auth-box__logo-text">Kubasa</div>
          </div>
          <h1 className="auth-box__title">Register Company</h1>
          <p className="auth-box__sub">Submit your details to request employer access</p>

          <form onSubmit={handleSubmit} className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Company Name <span className="required">*</span></label>
                <input name="companyName" required className="form-input" placeholder="e.g. Acme Corp" />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person <span className="required">*</span></label>
                <input name="contactName" required className="form-input" placeholder="e.g. John Doe" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input name="phone" className="form-input" placeholder="e.g. +254 700 000 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Industry</label>
                <input name="industry" className="form-input" placeholder="e.g. Tech, Retail" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Company Website</label>
              <input name="website" type="url" className="form-input" placeholder="e.g. https://acme.org" />
            </div>

            <div className="form-group">
              <label className="form-label">Work Email <span className="required">*</span></label>
              <input name="email" type="email" required className="form-input" placeholder="recruiting@acme.org" />
            </div>

            <div className="form-group">
              <label className="form-label">Password <span className="required">*</span></label>
              <input name="password" type="password" required className="form-input" placeholder="Min. 6 characters" />
            </div>

            <div style={{ background: 'var(--clr-accent-100)', color: 'var(--clr-accent-600)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
              ℹ️ Your registration must be vetted and approved by our administrator before accessing the candidate listings.
            </div>

            <button type="submit" disabled={loading} className="btn btn--accent w-full btn--lg">
              {loading ? 'Submitting...' : 'Register Company →'}
            </button>
          </form>

          <div className="auth-box__footer">
            Already registered? <Link to="/employers/login">Sign in here</Link>
          </div>
        </div>
      </div>
    );
  }
});

// ================================================================
// Page Component: Employer Login
// ================================================================
const employerLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/login',
  component: () => {
    useDocumentMetadata("Employer Login | Kubasa", "Access your employer dashboard on Kubasa to search verified candidates and manage active job listings.");
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
        showToast('Please fill out email and password', 'error');
        return;
      }

      setLoading(true);
      try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Signed in successfully');
        navigate({ to: '/employers/candidates' });
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Login failed', 'error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="auth-page">
        <div className="auth-box auth-box--employer">
          <div className="auth-box__logo">
            <div className="auth-box__logo-icon" style={{ background: 'var(--gradient-accent)', color: 'var(--clr-neutral-900)' }}>K</div>
            <div className="auth-box__logo-text">Kubasa</div>
          </div>
          <h1 className="auth-box__title">Employer Sign In</h1>
          <p className="auth-box__sub">Access candidate directories and shortlists</p>

          <form onSubmit={handleSubmit} className="form-section">
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input name="email" type="email" required className="form-input" placeholder="recruiting@company.com" />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input name="password" type="password" required className="form-input" placeholder="Your password" />
            </div>

            <button type="submit" disabled={loading} className="btn btn--accent w-full btn--lg">
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </form>

          <div className="auth-box__footer">
            New here? <Link to="/employers/register">Register organization</Link>
          </div>
        </div>
      </div>
    );
  }
});

// ================================================================
// Shared Component: Candidate Profile Detail Modal
// ================================================================
interface CandidateModalProps {
  candidate: CandidateDoc;
  onClose: () => void;
  isShortlisted: boolean;
  onToggleShortlist: () => void;
}

function CandidateDetailModal({ candidate: c, onClose, isShortlisted, onToggleShortlist }: CandidateModalProps) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Candidate Profile">
        <div className="modal__header">
          <h3>Candidate Profile</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div className="candidate-card__avatar" style={{ width: '64px', height: '64px', fontSize: '1.4rem' }}>
              {c.fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{c.fullName}</h2>
              <div className="candidate-card__id" style={{ fontSize: '0.9rem', marginTop: '2px' }}>{c.kubasaId}</div>
              <span className="badge badge--success" style={{ marginTop: '6px' }}><span className="badge__dot"></span> Actively Looking</span>
            </div>
          </div>

          {c.bio && (
            <div className="modal__section">
              <div className="modal__section-title">About</div>
              <p style={{ fontSize: '0.95rem', color: 'var(--clr-neutral-700)', whiteSpace: 'pre-wrap' }}>{c.bio}</p>
            </div>
          )}

          {c.skills && c.skills.length > 0 && (
            <div className="modal__section">
              <div className="modal__section-title">Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {c.skills.map(s => <span key={s} className="badge badge--primary">{s}</span>)}
              </div>
            </div>
          )}

          {c.workExperience && c.workExperience.length > 0 && (
            <div className="modal__section">
              <div className="modal__section-title">Work Experience</div>
              {c.workExperience.map((exp, i) => (
                <div key={i} className="exp-item" style={{ marginBottom: '10px' }}>
                  <strong>{exp.role}</strong> at <strong>{exp.company}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--clr-neutral-500)' }}>{exp.startYear} - {exp.endYear || 'Present'}</div>
                  {exp.description && <p style={{ fontSize: '0.85rem', marginTop: '4px', color: 'var(--clr-neutral-600)' }}>{exp.description}</p>}
                </div>
              ))}
            </div>
          )}

          {c.education && c.education.length > 0 && (
            <div className="modal__section">
              <div className="modal__section-title">Education</div>
              {c.education.map((edu, i) => (
                <div key={i} className="exp-item" style={{ marginBottom: '10px' }}>
                  <strong>{edu.degree}</strong>
                  <div>{edu.institution}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--clr-neutral-500)' }}>Year: {edu.year}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-4)', borderTop: '1px solid var(--clr-neutral-100)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            {c.cvUrl ? (
              <a href={c.cvUrl} target="_blank" rel="noreferrer" className="btn btn--primary">📄 Download CV</a>
            ) : (
              <span className="badge badge--neutral" style={{ padding: '10px 16px' }}>No CV attached</span>
            )}
            <button onClick={onToggleShortlist} className={`btn ${isShortlisted ? 'btn--accent' : 'btn--outline'}`}>
              {isShortlisted ? '★ Shortlisted' : '☆ Add to Shortlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// Page Component: Candidates Search (Employer Route)
// ================================================================
const employerCandidatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/candidates',
  component: () => {
    useDocumentMetadata("Search Candidates | Kubasa", "Search candidate registry sorted ascending by unique lifetime Kubasa IDs.");
    const { currentUser, roleDoc, refetchRoleDoc } = useAuth();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateDoc | null>(null);

    const emp = roleDoc as EmployerDoc;

    useEffect(() => {
      if (!currentUser) navigate({ to: '/employers/login' });
    }, [currentUser]);

    // Use Query to fetch active candidates sorted by kubasaId
    const { data: candidates, isLoading, error } = useQuery<CandidateDoc[]>({
      queryKey: ['candidates'],
      queryFn: async () => {
        const snap = await db.collection('candidates')
          .where('isLookingForWork', '==', true)
          .orderBy('kubasaId', 'asc')
          .get();
        return snap.docs.map(d => d.data() as CandidateDoc);
      },
      enabled: !!currentUser && !!emp && emp.approvalStatus === 'approved',
    });

    if (!emp) {
      return (
        <div className="page-loader">
          <div className="spinner"></div>
          <p>Verifying profile details...</p>
        </div>
      );
    }

    if (emp.approvalStatus !== 'approved') {
      return (
        <div className="pending-screen">
          <div className="pending-box">
            <div className="pending-box__icon">⏳</div>
            <h2>Awaiting Verification</h2>
            <p style={{ color: 'var(--clr-neutral-600)', margin: '12px 0 24px' }}>
              Your organization account is being vetted. Our admin will check details and authorize search access.
            </p>
            <span className="badge badge--warning"><span className="badge__dot"></span> Pending Approval</span>
          </div>
        </div>
      );
    }

    const shortlist = emp.shortlist || [];

    const handleToggleShortlist = async (candidateUid: string) => {
      const isAlready = shortlist.includes(candidateUid);
      const newShortlist = isAlready
        ? shortlist.filter(uid => uid !== candidateUid)
        : [...shortlist, candidateUid];

      try {
        await db.collection('employers').doc(currentUser!.uid).update({
          shortlist: newShortlist
        });
        showToast(isAlready ? 'Removed from shortlist' : 'Added to shortlist');
        refetchRoleDoc();
      } catch (err: any) {
        showToast('Operation failed: ' + err.message, 'error');
      }
    };

    const filteredCandidates = candidates
      ? candidates.filter(c =>
          c.fullName.toLowerCase().includes(filter.toLowerCase()) ||
          c.kubasaId.toLowerCase().includes(filter.toLowerCase()) ||
          c.skills?.some(s => s.toLowerCase().includes(filter.toLowerCase())) ||
          c.bio?.toLowerCase().includes(filter.toLowerCase())
        )
      : [];

    return (
      <div className="candidates-page">
        <div className="container--wide">
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Explore Candidates</h1>
            <p style={{ color: 'var(--clr-neutral-500)' }}>
              {candidates ? `${candidates.length} candidates available` : 'Retrieving talent pool...'}
            </p>
          </div>

          <div className="candidates-toolbar">
            <div className="search-box">
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Search name, ID, bio, or skills..."
              />
            </div>
            <Link to="/employers/shortlist" className="btn btn--outline btn--sm">
              ★ View Shortlist ({shortlist.length})
            </Link>
          </div>

          {isLoading ? (
            <div className="page-loader">
              <div className="spinner"></div>
              <p>Fetching candidate database...</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <p>Failed to query candidate records. Please verify security rules.</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🔍</div>
              <h3>No candidates match</h3>
              <p>Adjust your search filters.</p>
            </div>
          ) : (
            <div className="grid-3">
              {filteredCandidates.map(c => {
                const isShortlisted = shortlist.includes(c.uid);
                return (
                  <div key={c.uid} onClick={() => setSelectedCandidate(c)} className="candidate-card">
                    <div className="candidate-card__inner">
                      <div className="candidate-card__header">
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                          <div className="candidate-card__avatar">
                            {c.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="candidate-card__name">{c.fullName}</div>
                            <div className="candidate-card__id">{c.kubasaId}</div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleShortlist(c.uid); }}
                          className={`btn btn--sm ${isShortlisted ? 'btn--accent' : 'btn--ghost'}`}
                        >
                          {isShortlisted ? '★ Saved' : '☆ Save'}
                        </button>
                      </div>

                      {c.bio && <p className="candidate-card__bio">{c.bio}</p>}

                      <div className="candidate-card__skills">
                        {c.skills?.slice(0, 3).map(s => <span key={s} className="badge badge--primary">{s}</span>)}
                        {c.skills && c.skills.length > 3 && (
                          <span className="badge badge--neutral">+{c.skills.length - 3}</span>
                        )}
                      </div>

                      <div className="candidate-card__actions" style={{ marginTop: 'auto' }}>
                        <button className="btn btn--outline btn--sm" style={{ flex: 1 }}>Details</button>
                        {c.cvUrl && (
                          <a
                            href={c.cvUrl}
                            onClick={e => e.stopPropagation()}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn--primary btn--sm"
                          >
                            Download CV
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedCandidate && (
          <CandidateDetailModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            isShortlisted={shortlist.includes(selectedCandidate.uid)}
            onToggleShortlist={() => handleToggleShortlist(selectedCandidate.uid)}
          />
        )}
      </div>
    );
  }
});

// ================================================================
// Page Component: Employer Shortlist (Employer Route)
// ================================================================
const employerShortlistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/shortlist',
  component: () => {
    useDocumentMetadata("Shortlisted Candidates | Kubasa", "Review profiles of shortlisted candidates and view their resume attachments.");
    const { currentUser, roleDoc, refetchRoleDoc } = useAuth();
    const navigate = useNavigate();
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateDoc | null>(null);

    const emp = roleDoc as EmployerDoc;

    useEffect(() => {
      if (!currentUser) navigate({ to: '/employers/login' });
    }, [currentUser]);

    const { data: candidates, isLoading } = useQuery<CandidateDoc[]>({
      queryKey: ['candidates'],
      queryFn: async () => {
        const snap = await db.collection('candidates')
          .where('isLookingForWork', '==', true)
          .orderBy('kubasaId', 'asc')
          .get();
        return snap.docs.map(d => d.data() as CandidateDoc);
      },
      enabled: !!currentUser && !!emp && emp.approvalStatus === 'approved',
    });

    if (!emp) return <div className="page-loader"><div className="spinner"></div></div>;

    const shortlist = emp.shortlist || [];
    const shortlistedCandidates = candidates
      ? candidates.filter(c => shortlist.includes(c.uid))
      : [];

    const handleRemoveShortlist = async (candidateUid: string) => {
      try {
        await db.collection('employers').doc(currentUser!.uid).update({
          shortlist: shortlist.filter(uid => uid !== candidateUid)
        });
        showToast('Removed from shortlist');
        refetchRoleDoc();
      } catch (err: any) {
        showToast('Failed to remove: ' + err.message, 'error');
      }
    };

    return (
      <div className="candidates-page">
        <div className="container--wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Saved Profiles</h1>
              <p style={{ color: 'var(--clr-neutral-500)' }}>Candidates shortlisted for roles</p>
            </div>
            <Link to="/employers/candidates" className="btn btn--outline">← Back to Search</Link>
          </div>

          {isLoading ? (
            <div className="page-loader">
              <div className="spinner"></div>
            </div>
          ) : shortlistedCandidates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">⭐</div>
              <h3>Shortlist Empty</h3>
              <p>Keep track of talent by tapping "Save" in the candidate registry.</p>
            </div>
          ) : (
            <div className="grid-3">
              {shortlistedCandidates.map(c => (
                <div key={c.uid} onClick={() => setSelectedCandidate(c)} className="candidate-card">
                  <div className="candidate-card__inner">
                    <div className="candidate-card__header">
                      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <div className="candidate-card__avatar">
                          {c.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="candidate-card__name">{c.fullName}</div>
                          <div className="candidate-card__id">{c.kubasaId}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveShortlist(c.uid); }}
                        className="btn btn--sm btn--danger"
                      >
                        Remove
                      </button>
                    </div>

                    {c.bio && <p className="candidate-card__bio">{c.bio}</p>}

                    <div className="candidate-card__actions" style={{ marginTop: 'auto' }}>
                      <button className="btn btn--outline btn--sm" style={{ flex: 1 }}>Details</button>
                      {c.cvUrl && (
                        <a
                          href={c.cvUrl}
                          onClick={e => e.stopPropagation()}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn--primary btn--sm"
                        >
                          CV
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedCandidate && (
          <CandidateDetailModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            isShortlisted={true}
            onToggleShortlist={() => handleRemoveShortlist(selectedCandidate.uid)}
          />
        )}
      </div>
    );
  }
});

// ================================================================
// Page Component: Admin Login
// ================================================================
const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: () => {
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
});

// ================================================================
// Page Component: Admin Dashboard (Admin Route)
// ================================================================
const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/dashboard',
  component: () => {
    useDocumentMetadata("Admin Dashboard | Kubasa", "Overview platform statistics, verify employer registration requests, and manage access privileges.");
    const { currentUser, userDoc } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
      if (!currentUser) navigate({ to: '/admin/login' });
    }, [currentUser]);

    // Query pending employers
    const { data: pendingEmployers, isLoading: pendingLoading, refetch: refetchPending } = useQuery<EmployerDoc[]>({
      queryKey: ['pendingEmployers'],
      queryFn: async () => {
        const snap = await db.collection('employers')
          .where('approvalStatus', '==', 'pending')
          .orderBy('createdAt', 'asc')
          .get();
        return snap.docs.map(d => d.data() as EmployerDoc);
      },
      enabled: !!currentUser && userDoc?.role === 'admin',
    });

    // Query stats
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
      queryKey: ['adminStats'],
      queryFn: async () => {
        const [candSnap, appEmpSnap, rejEmpSnap] = await Promise.all([
          db.collection('candidates').get(),
          db.collection('employers').where('approvalStatus', '==', 'approved').get(),
          db.collection('employers').where('approvalStatus', '==', 'rejected').get(),
        ]);
        return {
          candidates: candSnap.size,
          approvedEmployers: appEmpSnap.size,
          rejectedEmployers: rejEmpSnap.size
        };
      },
      enabled: !!currentUser && userDoc?.role === 'admin',
    });

    if (userDoc?.role !== 'admin') {
      return (
        <div className="page-loader">
          <p>Access Denied. Admin privileges required.</p>
        </div>
      );
    }

    const handleApprove = async (uid: string) => {
      try {
        await db.collection('employers').doc(uid).update({ approvalStatus: 'approved' });
        showToast('Employer account approved');
        refetchPending();
        refetchStats();
      } catch (err: any) {
        showToast('Approve failed: ' + err.message, 'error');
      }
    };

    const handleReject = async (uid: string) => {
      try {
        await db.collection('employers').doc(uid).update({ approvalStatus: 'rejected' });
        showToast('Employer account rejected', 'warning');
        refetchPending();
        refetchStats();
      } catch (err: any) {
        showToast('Reject failed: ' + err.message, 'error');
      }
    };

    return (
      <div className="admin-page">
        <div className="container">
          <div className="admin-header">
            <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 800 }}>Admin Dashboard</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>Validate registration and oversee directory metrics</p>
          </div>

          {statsLoading ? (
            <p>Gathering statistics...</p>
          ) : stats ? (
            <div className="admin-stat-cards">
              <div className="admin-stat">
                <div className="admin-stat__num">{stats.candidates}</div>
                <div className="admin-stat__label">Total Candidates</div>
              </div>
              <div className="admin-stat">
                <div className="admin-stat__num" style={{ color: 'var(--clr-warning)' }}>
                  {pendingEmployers?.length || 0}
                </div>
                <div className="admin-stat__label">Pending Review</div>
              </div>
              <div className="admin-stat">
                <div className="admin-stat__num" style={{ color: 'var(--clr-success)' }}>
                  {stats.approvedEmployers}
                </div>
                <div className="admin-stat__label">Approved Employers</div>
              </div>
              <div className="admin-stat">
                <div className="admin-stat__num" style={{ color: 'var(--clr-error)' }}>
                  {stats.rejectedEmployers}
                </div>
                <div className="admin-stat__label">Rejected Access</div>
              </div>
            </div>
          ) : null}

          <h3 style={{ margin: 'var(--space-6) 0 var(--space-4)', fontSize: '1.25rem' }}>
            Pending Registration Requests
          </h3>

          {pendingLoading ? (
            <div className="page-loader"><div className="spinner"></div></div>
          ) : !pendingEmployers || pendingEmployers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">✅</div>
              <h3>All clear!</h3>
              <p>No new employer verification requests pending.</p>
            </div>
          ) : (
            <div>
              {pendingEmployers.map(emp => (
                <div key={emp.uid} className="employer-row">
                  <div>
                    <div className="employer-row__name">{emp.companyName}</div>
                    <div className="employer-row__meta">
                      Representative: {emp.contactName} · Email: {emp.email}
                      {emp.phone && ` · Tel: ${emp.phone}`}
                      {emp.industry && ` · Sector: ${emp.industry}`}
                      {emp.website && (
                        <span>
                          {' · '}
                          <a href={emp.website} target="_blank" rel="noreferrer" style={{ color: 'var(--clr-primary-600)' }}>
                            {emp.website}
                          </a>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="employer-row__actions" style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <button onClick={() => handleApprove(emp.uid)} className="btn btn--primary btn--sm">Approve</button>
                    <button onClick={() => handleReject(emp.uid)} className="btn btn--danger btn--sm">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
});

// ================================================================
// Page Component: Candidate Jobs List (Candidate Route)
// ================================================================
const candidateJobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/candidates/jobs',
  component: () => {
    useDocumentMetadata("Browse Jobs | Kubasa", "Explore available job vacancies from verified employers on Kubasa and express your interest.");
    const { currentUser, userDoc } = useAuth();
    const navigate = useNavigate();
    const [selectedJob, setSelectedJob] = useState<JobDoc | null>(null);

    useEffect(() => {
      if (!currentUser) navigate({ to: '/candidates/login' });
    }, [currentUser]);

    // Fetch all jobs
    const { data: jobs, isLoading, error } = useQuery<JobDoc[]>({
      queryKey: ['jobs'],
      queryFn: async () => {
        const snap = await db.collection('jobs').orderBy('createdAt', 'desc').get();
        return snap.docs.map(d => d.data() as JobDoc);
      },
      enabled: !!currentUser,
    });

    if (userDoc?.role !== 'candidate') return <div className="page-loader"><p>Access Denied.</p></div>;

    return (
      <div className="candidates-page">
        <div className="container--wide">
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Available Opportunities</h1>
            <p style={{ color: 'var(--clr-neutral-500)' }}>Explore openings and express interest directly</p>
          </div>

          {isLoading ? (
            <div className="page-loader">
              <div className="spinner"></div>
            </div>
          ) : error ? (
            <div className="empty-state"><p>Error retrieving jobs.</p></div>
          ) : !jobs || jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">💼</div>
              <h3>No jobs posted</h3>
              <p>Check back later for new opportunities.</p>
            </div>
          ) : (
            <div className="grid-3">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  candidateUid={currentUser!.uid}
                  onViewDetails={() => setSelectedJob(job)}
                />
              ))}
            </div>
          )}
        </div>

        {selectedJob && (
          <JobDetailModal
            job={selectedJob}
            candidateUid={currentUser!.uid}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </div>
    );
  }
});

// Helper component for Job Card in Candidates search
function JobCard({ job, candidateUid, onViewDetails }: { job: JobDoc; candidateUid: string; onViewDetails: () => void }) {
  const { data: hasApplied, refetch } = useQuery({
    queryKey: ['job-application', job.id, candidateUid],
    queryFn: async () => {
      const snap = await db.collection('jobs').doc(job.id).collection('applications').doc(candidateUid).get();
      return snap.exists;
    }
  });

  const expressInterestMutation = useMutation({
    mutationFn: async () => {
      const docRef = db.collection('jobs').doc(job.id).collection('applications').doc(candidateUid);
      if (hasApplied) {
        await docRef.delete();
      } else {
        await docRef.set({
          candidateUid,
          appliedAt: firebase.firestore.Timestamp.now()
        });
      }
    },
    onSuccess: () => {
      showToast(hasApplied ? 'Withdrew interest' : 'Expressed interest successfully!');
      refetch();
    },
    onError: (err: any) => {
      showToast('Action failed: ' + err.message, 'error');
    }
  });

  return (
    <div className="candidate-card" onClick={onViewDetails} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="candidate-card__inner" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div className="candidate-card__id">{job.companyName}</div>
          <h3 className="candidate-card__name" style={{ fontSize: '1.2rem', margin: '4px 0' }}>{job.title}</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--clr-neutral-500)', display: 'flex', gap: '8px' }}>
            <span>📍 {job.location}</span>
            {job.salaryRange && <span>💰 {job.salaryRange}</span>}
          </div>
        </div>

        <p className="candidate-card__bio" style={{ fontSize: '0.87rem', flex: 1 }}>{job.description}</p>

        <div className="candidate-card__skills" style={{ margin: 'var(--space-3) 0' }}>
          {job.requirements?.slice(0, 3).map(r => (
            <span key={r} className="badge badge--primary">{r}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'auto' }}>
          <button className="btn btn--outline btn--sm" style={{ flex: 1 }}>View Job</button>
          <button
            onClick={(e) => { e.stopPropagation(); expressInterestMutation.mutate(); }}
            disabled={expressInterestMutation.isPending}
            className={`btn btn--sm ${hasApplied ? 'btn--accent' : 'btn--primary'}`}
          >
            {hasApplied ? '★ Interested' : '☆ Express Interest'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Job detail modal for candidates
function JobDetailModal({ job, candidateUid, onClose }: { job: JobDoc; candidateUid: string; onClose: () => void }) {
  const { data: hasApplied, refetch } = useQuery({
    queryKey: ['job-application', job.id, candidateUid],
    queryFn: async () => {
      const snap = await db.collection('jobs').doc(job.id).collection('applications').doc(candidateUid).get();
      return snap.exists;
    }
  });

  const toggleInterest = async () => {
    try {
      const docRef = db.collection('jobs').doc(job.id).collection('applications').doc(candidateUid);
      if (hasApplied) {
        await docRef.delete();
        showToast('Withdrew interest');
      } else {
        await docRef.set({
          candidateUid,
          appliedAt: firebase.firestore.Timestamp.now()
        });
        showToast('Expressed interest successfully!');
      }
      refetch();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Job details">
        <div className="modal__header">
          <h3>Job Details</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div className="candidate-card__id" style={{ fontSize: '1rem' }}>{job.companyName}</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0' }}>{job.title}</h2>
            <div style={{ display: 'flex', gap: 'var(--space-4)', color: 'var(--clr-neutral-600)', fontSize: '0.9rem' }}>
              <span>📍 {job.location}</span>
              {job.salaryRange && <span>💰 {job.salaryRange}</span>}
            </div>
          </div>

          <div className="modal__section">
            <div className="modal__section-title">Description</div>
            <p style={{ fontSize: '0.95rem', color: 'var(--clr-neutral-700)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{job.description}</p>
          </div>

          {job.requirements && job.requirements.length > 0 && (
            <div className="modal__section">
              <div className="modal__section-title">Requirements &amp; Tech Stack</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {job.requirements.map(r => <span key={r} className="badge badge--primary">{r}</span>)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-4)', borderTop: '1px solid var(--clr-neutral-100)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
            <button onClick={toggleInterest} className={`btn ${hasApplied ? 'btn--accent' : 'btn--primary'}`} style={{ flex: 1 }}>
              {hasApplied ? '★ Interest Expressed' : '☆ Express Interest in this Role'}
            </button>
            <button onClick={onClose} className="btn btn--outline">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// Page Component: Employer Jobs Directory (Employer Route)
// ================================================================
const employerJobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/jobs',
  component: () => {
    useDocumentMetadata("My Jobs | Kubasa", "View and manage job vacancies published by your organization and view interested applicants.");
    const { currentUser, roleDoc } = useAuth();
    const navigate = useNavigate();
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    const emp = roleDoc as EmployerDoc;

    useEffect(() => {
      if (!currentUser) navigate({ to: '/employers/login' });
    }, [currentUser]);

    // Fetch jobs posted by this employer
    const { data: myJobs, isLoading, refetch } = useQuery<JobDoc[]>({
      queryKey: ['my-jobs', currentUser?.uid],
      queryFn: async () => {
        const snap = await db.collection('jobs')
          .where('employerUid', '==', currentUser!.uid)
          .orderBy('createdAt', 'desc')
          .get();
        return snap.docs.map(d => d.data() as JobDoc);
      },
      enabled: !!currentUser && !!emp && emp.approvalStatus === 'approved',
    });

    if (!emp) return <div className="page-loader"><div className="spinner"></div></div>;

    if (emp.approvalStatus !== 'approved') {
      return (
        <div className="pending-screen">
          <div className="pending-box">
            <div className="pending-box__icon">⏳</div>
            <h2>Awaiting Verification</h2>
            <p style={{ color: 'var(--clr-neutral-600)', margin: '12px 0 24px' }}>
              Your account must be approved before you can post jobs.
            </p>
          </div>
        </div>
      );
    }

    const handleDeleteJob = async (jobId: string) => {
      if (!confirm('Are you sure you want to delete this job listing?')) return;
      try {
        await db.collection('jobs').doc(jobId).delete();
        showToast('Job listing deleted successfully.');
        refetch();
      } catch (err: any) {
        showToast('Failed to delete job: ' + err.message, 'error');
      }
    };

    return (
      <div className="candidates-page">
        <div className="container--wide">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Job Postings</h1>
              <p style={{ color: 'var(--clr-neutral-500)' }}>Manage your active vacancies and view candidate interest</p>
            </div>
            <Link to="/employers/jobs/new" className="btn btn--primary">+ Post a Job</Link>
          </div>

          {isLoading ? (
            <div className="page-loader"><div className="spinner"></div></div>
          ) : !myJobs || myJobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">💼</div>
              <h3>No jobs posted yet</h3>
              <p>Get started by creating your first job posting.</p>
              <Link to="/employers/jobs/new" className="btn btn--accent" style={{ marginTop: 'var(--space-4)' }}>Create Job Listing</Link>
            </div>
          ) : (
            <div className="grid-3">
              {myJobs.map(job => (
                <div key={job.id} className="candidate-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div className="candidate-card__inner" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <h3 className="candidate-card__name" style={{ fontSize: '1.25rem' }}>{job.title}</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--clr-neutral-500)', marginTop: '4px' }}>
                        <span>📍 {job.location}</span>
                        {job.salaryRange && <span style={{ marginLeft: '12px' }}>💰 {job.salaryRange}</span>}
                      </div>
                    </div>

                    <p className="candidate-card__bio" style={{ fontSize: '0.87rem', flex: 1 }}>{job.description}</p>

                    <div className="candidate-card__actions" style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                      <button onClick={() => setSelectedJobId(job.id)} className="btn btn--outline btn--sm" style={{ flex: 1 }}>
                        👥 View Applicants
                      </button>
                      <button onClick={() => handleDeleteJob(job.id)} className="btn btn--danger btn--sm" style={{ padding: '6px 12px' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedJobId && (
          <ApplicantsModal
            jobId={selectedJobId}
            onClose={() => setSelectedJobId(null)}
          />
        )}
      </div>
    );
  }
});

// Modal to view candidates who applied to a specific job
function ApplicantsModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDoc | null>(null);

  // Fetch applicant documents
  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['applications', jobId],
    queryFn: async () => {
      const snap = await db.collection('jobs').doc(jobId).collection('applications').get();
      return snap.docs.map(d => d.data());
    }
  });

  // Fetch candidate profiles for those applications
  const { data: profiles, isLoading: profilesLoading } = useQuery<CandidateDoc[]>({
    queryKey: ['applicant-profiles', applications],
    queryFn: async () => {
      if (!applications || applications.length === 0) return [];
      const promises = applications.map(app =>
        db.collection('candidates').doc(app.candidateUid).get()
      );
      const snaps = await Promise.all(promises);
      return snaps.filter(s => s.exists).map(s => s.data() as CandidateDoc);
    },
    enabled: !!applications && applications.length > 0
  });

  const isLoading = appsLoading || (applications && applications.length > 0 && profilesLoading);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Job Applicants">
        <div className="modal__header">
          <h3>Job Applicants</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          {isLoading ? (
            <div className="page-loader"><div className="spinner"></div></div>
          ) : !profiles || profiles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">👥</div>
              <h3>No applications yet</h3>
              <p>Candidates will show up here once they express interest.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {profiles.map(p => (
                <div
                  key={p.uid}
                  className="employer-row"
                  onClick={() => setSelectedCandidate(p)}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div>
                    <div className="employer-row__name">{p.fullName}</div>
                    <div className="employer-row__meta">
                      ID: {p.kubasaId} · Email: {p.email} {p.phone && `· Phone: ${p.phone}`}
                    </div>
                  </div>
                  <button className="btn btn--outline btn--sm">View Profile</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedCandidate && (
          <CandidateDetailModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            isShortlisted={false}
            onToggleShortlist={async () => {
              showToast('You can add this candidate to your shortlist from the candidate tab.');
            }}
          />
        )}
      </div>
    </div>
  );
}

// ================================================================
// Page Component: Post New Job (Employer Route)
// ================================================================
const employerJobsNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/employers/jobs/new',
  component: () => {
    useDocumentMetadata("Post a Job | Kubasa", "Publish a new job opening to hire verified professionals on the Kubasa directory.");
    const { currentUser, roleDoc } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const emp = roleDoc as EmployerDoc;

    useEffect(() => {
      if (!currentUser) navigate({ to: '/employers/login' });
    }, [currentUser]);

    if (!emp) return <div className="page-loader"><div className="spinner"></div></div>;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = new FormData(form);
      const title = data.get('title') as string;
      const location = data.get('location') as string;
      const salaryRange = data.get('salaryRange') as string;
      const description = data.get('description') as string;
      const requirementsRaw = data.get('requirements') as string;

      if (!title || !location || !description) {
        showToast('Please fill in all required fields.', 'error');
        return;
      }

      setLoading(true);
      try {
        const jobId = db.collection('jobs').doc().id; // generate auto-id
        const requirements = requirementsRaw
          ? requirementsRaw.split(',').map(r => r.trim()).filter(Boolean)
          : [];

        await db.collection('jobs').doc(jobId).set({
          id: jobId,
          employerUid: currentUser!.uid,
          companyName: emp.companyName,
          title,
          location,
          salaryRange: salaryRange || '',
          description,
          requirements,
          createdAt: firebase.firestore.Timestamp.now()
        });

        showToast('Job listing published successfully!');
        navigate({ to: '/employers/jobs' });
      } catch (err: any) {
        console.error(err);
        showToast('Failed to post job: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="auth-page">
        <div className="auth-box" style={{ maxWidth: '600px' }}>
          <h1 className="auth-box__title" style={{ textAlign: 'left', marginBottom: 'var(--space-2)' }}>Post a New Job</h1>
          <p className="auth-box__sub" style={{ textAlign: 'left', marginBottom: 'var(--space-6)' }}>Find qualified talent on the Kubasa directory</p>

          <form onSubmit={handleSubmit} className="form-section">
            <div className="form-group">
              <label className="form-label">Job Title <span className="required">*</span></label>
              <input name="title" required className="form-input" placeholder="e.g. Senior Frontend Engineer" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Location <span className="required">*</span></label>
                <input name="location" required className="form-input" placeholder="e.g. Nairobi, Kenya or Remote" />
              </div>
              <div className="form-group">
                <label className="form-label">Salary Range</label>
                <input name="salaryRange" className="form-input" placeholder="e.g. $1,500 - $2,500 / month" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Job Description <span className="required">*</span></label>
              <textarea name="description" required className="form-textarea" placeholder="Detail the role, responsibilities, and benefits..." rows={5} />
            </div>

            <div className="form-group">
              <label className="form-label">Requirements / Skills</label>
              <input name="requirements" className="form-input" placeholder="React, TypeScript, CSS (comma separated)" />
              <span className="form-hint">Provide skills separated by commas</span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
              <button type="submit" disabled={loading} className="btn btn--primary btn--lg" style={{ flex: 1 }}>
                {loading ? 'Publishing...' : 'Publish Job Listing'}
              </button>
              <Link to="/employers/jobs" className="btn btn--outline">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

// ================================================================
// Router Definition
// ================================================================
const routeTree = rootRoute.addChildren([
  homeRoute,
  candidateRegisterRoute,
  candidateLoginRoute,
  candidateProfileRoute,
  candidateJobsRoute,
  employerRegisterRoute,
  employerLoginRoute,
  employerCandidatesRoute,
  employerShortlistRoute,
  employerJobsRoute,
  employerJobsNewRoute,
  adminLoginRoute,
  adminDashboardRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  const authStatus = useAuthStatus();
  return (
    <AuthContext.Provider value={authStatus}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  );
}
