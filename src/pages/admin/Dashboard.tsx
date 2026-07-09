import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { showToast } from '../../utils/toast';
import { EmployerDoc } from '../../types';

export default function Dashboard() {
  useDocumentMetadata("Admin Dashboard | Kubasa", "Overview platform statistics, verify employer registration requests, and manage access privileges.");
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate({ to: '/admin/login' });
  }, [currentUser, navigate]);

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
