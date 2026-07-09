import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { db, firebase } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { JobDoc } from '../../types';

export default function Jobs() {
  useDocumentMetadata("Browse Jobs | Kubasa", "Explore available job vacancies from verified employers on Kubasa and express your interest.");
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const [selectedJob, setSelectedJob] = useState<JobDoc | null>(null);

  useEffect(() => {
    if (!currentUser) navigate({ to: '/candidates/login' });
  }, [currentUser, navigate]);

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
