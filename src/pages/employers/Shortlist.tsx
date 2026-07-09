import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { CandidateDoc, EmployerDoc } from '../../types';
import CandidateDetailModal from '../../components/CandidateDetailModal';

export default function Shortlist() {
  useDocumentMetadata("Shortlisted Candidates | Kubasa", "Review profiles of shortlisted candidates and view their resume attachments.");
  const { currentUser, roleDoc, refetchRoleDoc } = useAuth();
  const navigate = useNavigate();
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDoc | null>(null);

  const emp = roleDoc as EmployerDoc;

  useEffect(() => {
    if (!currentUser) navigate({ to: '/employers/login' });
  }, [currentUser, navigate]);

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
