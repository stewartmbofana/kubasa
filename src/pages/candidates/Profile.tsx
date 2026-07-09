import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { auth, db, storage, firebase } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { CandidateDoc } from '../../types';

export default function Profile() {
  useDocumentMetadata("My Profile | Kubasa", "Manage your candidate profile details, work history, education, skill tags, and CV resume document.");
  const { currentUser, roleDoc, refetchRoleDoc } = useAuth();
  const navigate = useNavigate();

  // Redirect guest out
  useEffect(() => {
    if (!currentUser) navigate({ to: '/candidates/login' });
  }, [currentUser, navigate]);

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
