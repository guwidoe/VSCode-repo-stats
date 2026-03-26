export interface ParsedBlameHunk {
  commit: string;
  lines: number;
  author: string;
  email: string;
  authorTime: number;
}

interface CommitMeta {
  author: string;
  email: string;
  authorTime: number;
}

interface BlameHunkState extends ParsedBlameHunk {
  applied: boolean;
}

interface ParseBlameStreamOptions {
  defaultAuthor: string;
  defaultEmail: string;
  defaultAuthorTime: number;
}

export function parseBlameStream(
  blameOutput: string,
  options: ParseBlameStreamOptions
): ParsedBlameHunk[] {
  const { defaultAuthor, defaultEmail, defaultAuthorTime } = options;
  const commitMetadata = new Map<string, CommitMeta>();
  const hunks: ParsedBlameHunk[] = [];
  let current: BlameHunkState | null = null;

  const applyCurrent = () => {
    if (!current || current.applied) {
      return;
    }

    const author = current.author || defaultAuthor;
    const email = current.email || defaultEmail;
    const authorTime = current.authorTime > 0 ? current.authorTime : defaultAuthorTime;

    commitMetadata.set(current.commit, {
      author,
      email,
      authorTime,
    });

    hunks.push({
      commit: current.commit,
      lines: current.lines,
      author,
      email,
      authorTime,
    });

    current.applied = true;
  };

  for (const line of blameOutput.split('\n')) {
    const headerMatch = line.match(/^(\^?[0-9a-f]{40})\s+\d+\s+\d+\s+(\d+)$/i);
    if (headerMatch) {
      applyCurrent();
      const commit = headerMatch[1].replace(/^\^/, '').toLowerCase();
      const cachedMeta = commitMetadata.get(commit);
      current = {
        commit,
        lines: parseInt(headerMatch[2], 10),
        author: cachedMeta?.author || defaultAuthor,
        email: cachedMeta?.email || defaultEmail,
        authorTime: cachedMeta?.authorTime ?? defaultAuthorTime,
        applied: false,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith('author ')) {
      current.author = line.slice(7).trim() || defaultAuthor;
      continue;
    }

    if (line.startsWith('author-mail ')) {
      const rawEmail = line.slice(12).trim();
      current.email = rawEmail.replace(/^</, '').replace(/>$/, '') || defaultEmail;
      continue;
    }

    if (line.startsWith('author-time ')) {
      const timestamp = parseInt(line.slice(12).trim(), 10);
      if (Number.isFinite(timestamp)) {
        current.authorTime = timestamp;
      }
      continue;
    }

    if (line.startsWith('filename ') || line.startsWith('\t')) {
      applyCurrent();
    }
  }

  applyCurrent();
  return hunks;
}
