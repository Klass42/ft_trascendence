/**
 * DashboardPage Component
 * 
 * The main landing page after login.
 * Shows different content based on user role.
 */

import { BookOpen, FileText, Bell, Users } from 'lucide-react';
import { useAuth } from '@/lib/api';
import { Card } from '@/components/ui';
import styles from './DashboardPage.module.css';

// =============================================================================
// Types
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'accent' | 'success' | 'warning' | 'info';
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <Card hoverable className={styles.statCard}>
      <div className={`${styles.statIcon} ${styles[color]}`}>{icon}</div>
      <div className={styles.statInfo}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </Card>
  );
}

// =============================================================================
// Component
// =============================================================================

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.greeting}>
          Welcome back, <strong>{user.name}</strong>!
        </p>
      </header>

      {/* Stats Grid */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Overview</h2>
        <div className={styles.statsGrid}>
          <StatCard
            icon={<BookOpen size={24} />}
            label="My Courses"
            value={3}
            color="accent"
          />
          <StatCard
            icon={<FileText size={24} />}
            label="Pending Assignments"
            value={5}
            color="warning"
          />
          <StatCard
            icon={<Bell size={24} />}
            label="Notifications"
            value={12}
            color="info"
          />
          {(user.role === 'ADMIN' || user.role === 'TEACHER') && (
            <StatCard
              icon={<Users size={24} />}
              label="Students"
              value={48}
              color="success"
            />
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Activity</h2>
        <Card>
          <ul className={styles.activityList}>
            <li className={styles.activityItem}>
              <span className={styles.activityDot} />
              <div className={styles.activityContent}>
                <p className={styles.activityText}>
                  You completed <strong>Lesson 3: Introduction to React</strong>
                </p>
                <time className={styles.activityTime}>2 hours ago</time>
              </div>
            </li>
            <li className={styles.activityItem}>
              <span className={styles.activityDot} />
              <div className={styles.activityContent}>
                <p className={styles.activityText}>
                  New assignment posted in <strong>Web Development 101</strong>
                </p>
                <time className={styles.activityTime}>5 hours ago</time>
              </div>
            </li>
            <li className={styles.activityItem}>
              <span className={styles.activityDot} />
              <div className={styles.activityContent}>
                <p className={styles.activityText}>
                  You enrolled in <strong>Advanced TypeScript</strong>
                </p>
                <time className={styles.activityTime}>Yesterday</time>
              </div>
            </li>
          </ul>
        </Card>
      </section>

      {/* Quick Actions - Teachers/Admins */}
      {(user.role === 'ADMIN' || user.role === 'TEACHER') && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actionsGrid}>
            <Card hoverable className={styles.actionCard}>
              <BookOpen size={32} className={styles.actionIcon} />
              <h3 className={styles.actionTitle}>Create Course</h3>
              <p className={styles.actionDescription}>
                Start a new course and add content
              </p>
            </Card>
            <Card hoverable className={styles.actionCard}>
              <FileText size={32} className={styles.actionIcon} />
              <h3 className={styles.actionTitle}>Create Assignment</h3>
              <p className={styles.actionDescription}>
                Add a new assignment to your course
              </p>
            </Card>
            <Card hoverable className={styles.actionCard}>
              <Users size={32} className={styles.actionIcon} />
              <h3 className={styles.actionTitle}>Manage Students</h3>
              <p className={styles.actionDescription}>
                View and manage enrolled students
              </p>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}
