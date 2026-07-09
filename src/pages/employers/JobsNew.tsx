import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { db, firebase } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { EmployerDoc } from '../../types';

export default function JobsNew() {
  useDocumentMetadata("Post a Job | Kubasa", "Publish a new job opening to hire verified professionals on the Kubasa directory.");
  const { currentUser, roleDoc } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const emp = roleDoc as EmployerDoc;

  useEffect(() => {
    if (!currentUser) navigate({ to: '/employers/login' });
  }, [currentUser, navigate]);

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
