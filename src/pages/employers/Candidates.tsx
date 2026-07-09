import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { CandidateDoc, EmployerDoc } from '../../types';
import CandidateDetailModal from '../../components/CandidateDetailModal';

export default function Candidates() {
  useDocumentMetadata("Search Candidates | Kubasa", "Search candidate registry sorted ascending by unique lifetime Kubasa IDs.");
  const { currentUser, roleDoc, refetchRoleDoc } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDoc | null>(null);

  const emp = roleDoc as EmployerDoc;

  useEffect(() => {
    if (!currentUser) navigate({ to: '/employers/login' });
  }, [currentUser, navigate]);

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
