import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { UserSummary } from '../../types';
import { StatusBadge } from '../../components/Badge';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  UserPlus,
  Edit,
  UserX,
  UserCheck,
  Lock,
  Mail,
  Shield,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', email: '', password: '', role: 'ANALYST' as 'ADMIN' | 'ANALYST' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', role: 'ANALYST' as 'ADMIN' | 'ANALYST' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getUsers({ pageSize: 50 });
      setUsers(res.items);
    } catch (err: any) {
      setError(err?.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Lock size={40} style={{ color: '#DC2626', margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 8px' }}>
          Access Restricted
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Only platform Administrators can manage user accounts and permissions.
        </p>
      </div>
    );
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setCreateError(null);
      await api.createUser(createForm);
      setShowCreateModal(false);
      setCreateForm({ fullName: '', email: '', password: '', role: 'ANALYST' });
      await loadUsers();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditOpen = (u: UserSummary) => {
    setEditingUser(u);
    setEditForm({ fullName: u.fullName, email: u.email, role: u.role });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setSavingEdit(true);
      setEditError(null);
      await api.updateUser(editingUser.id, editForm);
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update user.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (u: UserSummary) => {
    if (currentUser && u.id === currentUser.id) {
      addToast('You cannot deactivate your own administrative account.', 'error');
      return;
    }

    try {
      if (u.isActive) {
        await api.deactivateUser(u.id);
        addToast(`User ${u.fullName} deactivated.`, 'warning');
      } else {
        await api.activateUser(u.id);
        addToast(`User ${u.fullName} activated.`, 'success');
      }
      await loadUsers();
    } catch (err: any) {
      addToast(err?.message || 'Failed to change user status.', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Configure enterprise operator accounts and Role-Based Access Control (RBAC)
          </span>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
        >
          <UserPlus size={16} />
          <span>Create User</span>
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
            System Users ({users.length})
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '20px' }}>
            <LoadingSkeleton rows={6} height="44px" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Users Registered"
            description="Create an account to grant access to analysts or additional administrators."
            actionText="Create First User"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Work Email</th>
                  <th>Assigned Role</th>
                  <th>Account Status</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                    <td style={{ fontSize: '13px', color: '#475569' }}>{u.email}</td>
                    <td>
                      <StatusBadge status={u.role} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748B' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => handleEditOpen(u)}
                          title="Edit User"
                        >
                          <Edit size={14} />
                        </button>

                        {currentUser && u.id !== currentUser.id && (
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              color: u.isActive ? '#DC2626' : '#16A34A',
                              borderColor: u.isActive ? '#FECACA' : '#BBF7D0',
                            }}
                            onClick={() => handleToggleActive(u)}
                            title={u.isActive ? 'Deactivate User' : 'Activate User'}
                          >
                            {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal (S17) */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User Account"
        description="Provision access credentials and define RBAC roles for an internal employee."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateSubmit} disabled={creating}>
              {creating ? 'Creating User...' : 'Create Account'}
            </button>
          </>
        }
      >
        {createError && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {createError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Jane Doe"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Work Email Address
            </label>
            <input
              type="email"
              className="form-control"
              placeholder="jane.doe@lendguard.internal"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Initial Password (minimum 8 characters)
            </label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••••••"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              System Role
            </label>
            <select
              className="form-control"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
            >
              <option value="ANALYST">Analyst (Reconciliation & Investigation)</option>
              <option value="ADMIN">Administrator (Full Access & User Management)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User Information"
        description="Modify permitted user profile properties and role assignment."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditingUser(null)} disabled={savingEdit}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleEditSubmit} disabled={savingEdit}>
              {savingEdit ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </>
        }
      >
        {editError && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {editError}
          </div>
        )}

        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              type="text"
              className="form-control"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              className="form-control"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
              System Role
            </label>
            <select
              className="form-control"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
              disabled={currentUser?.id === editingUser?.id}
            >
              <option value="ANALYST">Analyst</option>
              <option value="ADMIN">Administrator</option>
            </select>
            {currentUser?.id === editingUser?.id && (
              <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                You cannot modify your own administrative role.
              </span>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};
