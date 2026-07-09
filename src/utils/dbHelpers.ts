import { auth, db, firebase } from '../firebase';
import { showToast } from './toast';
import { UserDoc, CandidateDoc, EmployerDoc } from '../types';

export async function generateKubasaId(): Promise<string> {
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

export async function seedMockData() {
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

  // Initialize sequential counter (now authenticated, passes rule)
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
