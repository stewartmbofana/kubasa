import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { JobDoc, EmployerDoc, CandidateDoc } from '../../types';
import CandidateDetailModal from '../../components/CandidateDetailModal';

export default function Jobs() {
  useDocumentMetadata("My Jobs | Kubasa", "View and manage job vacancies published by your organization and view interested applicants.");
  const { currentUser, roleDoc } = useAuth();
  const navigate = useNavigate();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const emp = roleDoc as EmployerDoc;

  useEffect(() => {
    if (!currentUser) navigate({ to: '/employers/login' });
  }, [currentUser, navigate]);

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
