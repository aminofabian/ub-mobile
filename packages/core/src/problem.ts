export type ProblemResponse = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  /** For a `setup_required` answer: what has to be set up first (branch, shift, till, dispensing). */
  requirement?: string;
  /** Narrows `requirement` (for a branch: none, pick or assign). */
  hint?: string;
};

const GENERIC_PROBLEM_TITLES = new Set([
  '',
  'Bad Request',
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Internal Server Error',
]);

export function parseProblem(payload: unknown): ProblemResponse | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  let title = typeof record.title === 'string' ? record.title.trim() : '';
  const springMessage = typeof record.message === 'string' ? record.message.trim() : '';
  if (!title && springMessage) {
    title = springMessage;
  }
  if (!title && typeof record.error === 'string') {
    title = record.error.trim();
  }
  const type = typeof record.type === 'string' ? record.type : 'about:blank';
  const status =
    typeof record.status === 'number' && Number.isFinite(record.status) ? record.status : 500;
  const detail = typeof record.detail === 'string' ? record.detail : undefined;
  const code = typeof record.code === 'string' ? record.code : undefined;
  const requirement = typeof record.requirement === 'string' ? record.requirement : undefined;
  const hint = typeof record.hint === 'string' ? record.hint : undefined;

  return {
    type,
    title,
    status,
    detail,
    code,
    ...(requirement !== undefined ? { requirement } : {}),
    ...(hint !== undefined ? { hint } : {}),
  };
}

export function formatApiProblemMessage(payload: unknown): string {
  const problem = parseProblem(payload);
  const title =
    problem != null && problem.title.trim().length > 0 ? problem.title.trim() : 'Request failed';

  const detail = problem?.detail?.trim();
  if (detail && detail.length > 0) {
    if (GENERIC_PROBLEM_TITLES.has(title)) {
      return detail;
    }
    return `${title}: ${detail}`;
  }

  return title.length > 0 ? title : 'Request failed';
}

/**
 * An error the server answered, with what it said kept: the HTTP status and the machine-readable
 * `code`, `requirement` and `hint`. The message is the same sentence the app showed before this type
 * existed, so anything that only reads `message` is unchanged. Code that has to decide something
 * reads `code`, never the English.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requirement?: string;
  readonly hint?: string;
  /**
   * Set when the answer was not the app's own: a web page or nothing at all, which is what a firewall, a proxy or a
   * login page in the way sends. Absent for anything the app wrote. Code that has to decide whether the server really
   * turned a request down reads this, never the words.
   */
  readonly foreign?: true;
  /**
   * The problem's machine name as the server wrote it (`urn:problem:data-integrity`), when it gave one. Code that has
   * to tell one kind of "no" from another reads this, never the words.
   */
  readonly type?: string;

  constructor(
    message: string,
    info: { status: number; code?: string; requirement?: string; hint?: string; foreign?: boolean; type?: string }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = info.status;
    if (info.code !== undefined) this.code = info.code;
    if (info.requirement !== undefined) this.requirement = info.requirement;
    if (info.hint !== undefined) this.hint = info.hint;
    if (info.foreign) this.foreign = true;
    if (typeof info.type === 'string' && info.type !== '' && info.type !== 'about:blank') this.type = info.type;
  }
}

/** True for an `ApiError`, including one made by another copy of this module. */
export function isApiError(error: unknown): error is ApiError {
  if (error instanceof ApiError) {
    return true;
  }
  return (
    error instanceof Error &&
    error.name === 'ApiError' &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

export async function readApiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return new ApiError(`Request failed (${response.status})`, { status: response.status, foreign: true });
  }

  try {
    const payload = JSON.parse(text) as unknown;
    const problem = parseProblem(payload);
    return new ApiError(formatApiProblemMessage(payload), {
      status: response.status,
      code: problem?.code,
      requirement: problem?.requirement,
      hint: problem?.hint,
      type: problem?.type,
    });
  } catch {
    return new ApiError(text, { status: response.status, foreign: true });
  }
}

export async function readApiErrorMessage(response: Response): Promise<string> {
  return (await readApiError(response)).message;
}
