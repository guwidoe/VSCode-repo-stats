import React from 'react';
import { ContributorStats } from '../../store';

interface Props {
  contributor: ContributorStats;
  rank: number;
}

/**
 * Generate a color from an email address
 */
function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#e74c3c', '#e91e63', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffc107', '#ff9800', '#ff5722', '#795548',
  ];

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from a name
 */
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) {return '?';}
  if (parts.length === 1) {return parts[0].charAt(0).toUpperCase();}
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Format a number with K/M suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export const ContributorCard: React.FC<Props> = ({ contributor, rank }) => {
  const avatarColor = getAvatarColor(contributor.email);
  const initials = getInitials(contributor.name);

  return (
    <div className="contributor-card">
      <div
        className="avatar"
        style={{ backgroundColor: avatarColor }}
        title={contributor.email}
      >
        {initials}
      </div>
      <div className="contributor-info">
        <div className="contributor-name">
          {contributor.name}
          {rank <= 3 && (
            <span className="rank-badge">#{rank}</span>
          )}
        </div>
        <div className="contributor-stats">
          <span>{formatNumber(contributor.commits)} commits</span>
          <span className="stat-added">+{formatNumber(contributor.linesAdded)}</span>
          <span className="stat-deleted">-{formatNumber(contributor.linesDeleted)}</span>
        </div>
      </div>
    </div>
  );
};
