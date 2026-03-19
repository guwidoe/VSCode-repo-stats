import * as crypto from 'crypto';
import type { AnalysisTarget, EvolutionTargetHead } from '../types/index.js';

export function createTargetCacheKey(targetId: string): string {
  return crypto.createHash('md5').update(targetId).digest('hex').slice(0, 12);
}

export function createTargetRevisionHash(
  target: AnalysisTarget,
  revisions: Array<{ repositoryId: string; branch: string; headSha: string }>
): string {
  const payload = JSON.stringify({
    targetId: target.id,
    members: revisions
      .map((revision) => ({
        repositoryId: revision.repositoryId,
        branch: revision.branch,
        headSha: revision.headSha,
      }))
      .sort((a, b) => a.repositoryId.localeCompare(b.repositoryId)),
  });

  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

export function createEvolutionRevisionHash(memberHeads: EvolutionTargetHead[]): string {
  const payload = JSON.stringify(
    memberHeads
      .map((member) => ({
        repositoryId: member.repositoryId,
        branch: member.branch,
        headSha: member.headSha,
      }))
      .sort((a, b) => a.repositoryId.localeCompare(b.repositoryId))
  );

  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}
