export type ProblemResponse = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
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

  return { type, title, status, detail, code };
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

export async function readApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return `Request failed (${response.status})`;
  }

  try {
    return formatApiProblemMessage(JSON.parse(text) as unknown);
  } catch {
    return text;
  }
}
