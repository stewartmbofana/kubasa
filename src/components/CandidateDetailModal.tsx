import React from 'react';
import { CandidateDoc } from '../types';

interface CandidateModalProps {
  candidate: CandidateDoc;
  onClose: () => void;
  isShortlisted: boolean;
  onToggleShortlist: () => void;
}

export default function CandidateDetailModal({ candidate: c, onClose, isShortlisted, onToggleShortlist }: CandidateModalProps) {
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
