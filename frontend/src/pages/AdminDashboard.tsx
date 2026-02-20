import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import {
  adminService,
  type AdminAuditLog,
  type AdminChallenge,
  type AdminChallengeDoc,
  type AdminChallengeTestCase,
  type AdminDashboardSummary,
  type AdminFlaggedWorkExperience,
  type AdminJudgeRun,
  type AdminProctoringSession,
  type AdminProctoringSessionDetail,
  type AdminProctoringSettings,
  type AdminProctoringSummary,
  type AdminUser,
} from '@/services/adminService';
import { toast } from 'react-hot-toast';

type PublishStatus = 'draft' | 'published' | 'archived';

const CATEGORY_OPTIONS = [
  'Frontend',
  'Backend',
  'Security',
  'IT Support',
  'DevOps',
  'Cloud Engineering',
  'Data Science',
  'Mobile Development',
  'QA Testing',
] as const;

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const;

const defaultSettings: AdminProctoringSettings = {
  requireCamera: true,
  requireMicrophone: true,
  requireAudio: true,
  strictMode: false,
  allowedViolationsBeforeWarning: 3,
  autoPauseOnViolation: false,
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [runs, setRuns] = useState<AdminJudgeRun[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminProctoringSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [violationSummary, setViolationSummary] = useState<AdminProctoringSummary | null>(null);
  const [settings, setSettings] = useState<AdminProctoringSettings>(defaultSettings);
  const [selectedSession, setSelectedSession] = useState<AdminProctoringSessionDetail | null>(null);
  const [flaggedWorkExperience, setFlaggedWorkExperience] = useState<AdminFlaggedWorkExperience[]>([]);

  const [newChallenge, setNewChallenge] = useState({
    title: '',
    description: '',
    category: 'Backend',
    difficulty: 'medium',
    target_seniority: 'junior' as 'graduate' | 'junior' | 'mid' | 'senior',
    duration_minutes: '45',
    publish_status: 'draft' as PublishStatus,
  });
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [challengeActionState, setChallengeActionState] = useState<Record<string, string>>({});
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [tests, setTests] = useState<AdminChallengeTestCase[]>([]);
  const [challengeDocs, setChallengeDocs] = useState<AdminChallengeDoc[]>([]);
  const [newTest, setNewTest] = useState({
    name: 'Sample test',
    input: '',
    expected_output: '',
    points: 1,
  });
  const [newDoc, setNewDoc] = useState({
    title: 'Reference Guide',
    content: '',
  });
  const [jsBaseline, setJsBaseline] = useState({ runtime_ms: 2000, memory_mb: 256 });
  const [pyBaseline, setPyBaseline] = useState({ runtime_ms: 2000, memory_mb: 256 });

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, c, r, u, s, ps, set, logs, flagged] = await Promise.allSettled([
        adminService.getDashboard(),
        adminService.listChallenges(),
        adminService.listJudgeRuns(30),
        adminService.listUsers(),
        adminService.listProctoringSessions(25),
        adminService.getProctoringSummary(),
        adminService.getProctoringSettings(),
        adminService.getAuditLogs(25),
        adminService.getFlaggedWorkExperience(25),
      ]);

      const pick = <T, F>(
        result: PromiseSettledResult<T>,
        fallback: F,
        label: string,
      ): T | F => {
        if (result.status === 'fulfilled') return result.value;
        toast.error(`Failed to load ${label}`);
        return fallback;
      };

      setSummary(pick(d, null, 'dashboard summary'));
      setChallenges(pick(c, [], 'challenges'));
      setRuns(pick(r, [], 'judge runs'));
      setUsers(pick(u, [], 'users'));
      setSessions(pick(s, [], 'proctoring sessions'));
      setViolationSummary(pick(ps, null, 'proctoring summary'));
      setSettings(pick(set, defaultSettings, 'proctoring settings'));
      setAuditLogs(pick(logs, [], 'audit logs'));
      setFlaggedWorkExperience(pick(flagged, [], 'flagged work experience'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadChallengeConfig = async (challengeId: string) => {
    setChallengeActionState((prev) => ({ ...prev, [challengeId]: 'configure' }));
    try {
      const [testRows, js, py, docs] = await Promise.all([
        adminService.getChallengeTests(challengeId),
        adminService.getChallengeBaseline(challengeId, 'javascript'),
        adminService.getChallengeBaseline(challengeId, 'python'),
        adminService.listChallengeDocs(challengeId),
      ]);
      setTests(testRows);
      setChallengeDocs(docs);
      if (js) setJsBaseline({ runtime_ms: Number(js.runtime_ms), memory_mb: Number(js.memory_mb) });
      if (py) setPyBaseline({ runtime_ms: Number(py.runtime_ms), memory_mb: Number(py.memory_mb) });
      setSelectedChallengeId(challengeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load challenge config');
    } finally {
      setChallengeActionState((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });
    }
  };

  const onCreateChallenge = async () => {
    const parsedDuration = Number(newChallenge.duration_minutes);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 5 || parsedDuration > 300) {
      toast.error('Duration must be between 5 and 300 minutes.');
      return;
    }

    setIsCreatingChallenge(true);
    try {
      await adminService.createChallenge({
        ...newChallenge,
        duration_minutes: Math.round(parsedDuration),
      });
      toast.success('Challenge created');
      setNewChallenge({
        title: '',
        description: '',
        category: 'Backend',
        difficulty: 'medium',
        target_seniority: 'junior',
        duration_minutes: '45',
        publish_status: 'draft',
      });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create challenge');
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  const onSetChallengeStatus = async (challengeId: string, publish_status: PublishStatus) => {
    setChallengeActionState((prev) => ({ ...prev, [challengeId]: publish_status }));
    try {
      await adminService.setChallengeStatus(challengeId, publish_status);
      toast.success(`Challenge set to ${publish_status}`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update challenge status');
    } finally {
      setChallengeActionState((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });
    }
  };

  const onAddTest = async () => {
    if (!selectedChallengeId) return;
    try {
      await adminService.upsertChallengeTest(selectedChallengeId, { ...newTest });
      toast.success('Test added');
      await loadChallengeConfig(selectedChallengeId);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add test');
    }
  };

  const onSaveBaseline = async (language: 'javascript' | 'python') => {
    if (!selectedChallengeId) return;
    const baseline = language === 'javascript' ? jsBaseline : pyBaseline;
    try {
      await adminService.upsertChallengeBaseline(selectedChallengeId, { language, ...baseline });
      toast.success(`${language} baseline saved`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save baseline');
    }
  };

  const onAddDoc = async () => {
    if (!selectedChallengeId) return;
    if (!newDoc.title.trim() || !newDoc.content.trim()) {
      toast.error('Reference document title and content are required');
      return;
    }
    try {
      await adminService.createChallengeDoc(selectedChallengeId, {
        title: newDoc.title.trim(),
        content: newDoc.content.trim(),
      });
      toast.success('Reference document saved');
      setNewDoc({
        title: 'Reference Guide',
        content: '',
      });
      await loadChallengeConfig(selectedChallengeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add challenge document');
    }
  };

  const onRetryRun = async (runId: string) => {
    try {
      await adminService.retryJudgeRun(runId);
      toast.success('Retry queued');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry run');
    }
  };

  const onSelectSession = async (sessionId: string) => {
    try {
      const detail = await adminService.getProctoringSession(sessionId);
      setSelectedSession(detail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load session');
    }
  };

  const onSaveSettings = async () => {
    try {
      const updated = await adminService.updateProctoringSettings(settings);
      setSettings(updated);
      toast.success('Proctoring settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    }
  };

  const onUpdateRole = async (userId: string, role: 'developer' | 'recruiter' | 'admin') => {
    try {
      await adminService.updateUserRole(userId, role);
      toast.success('Role updated');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">Loading admin data...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button onClick={() => void loadData()}>Refresh</Button>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Metric label="Users" value={summary?.users_total ?? 0} />
          <Metric label="Challenges" value={summary?.challenges_total ?? 0} />
          <Metric label="Submissions" value={summary?.submissions_total ?? 0} />
          <Metric label="Judge Pending" value={summary?.judge_pending ?? 0} />
          <Metric label="Judge Failed" value={summary?.judge_failed ?? 0} />
          <Metric label="Violations" value={violationSummary?.totalViolations ?? 0} />
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Create Challenge</h2>
          <input
            className="w-full rounded border px-2 py-1"
            placeholder="Title"
            value={newChallenge.title}
            onChange={(e) => setNewChallenge((p) => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full rounded border px-2 py-1"
            rows={2}
            placeholder="Description"
            value={newChallenge.description}
            onChange={(e) => setNewChallenge((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded border px-2 py-1"
              value={newChallenge.category}
              onChange={(e) =>
                setNewChallenge((p) => ({
                  ...p,
                  category: e.target.value,
                }))
              }
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-1"
              value={newChallenge.difficulty}
              onChange={(e) =>
                setNewChallenge((p) => ({
                  ...p,
                  difficulty: e.target.value as 'easy' | 'medium' | 'hard',
                }))
              }
            >
              {DIFFICULTY_OPTIONS.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-1"
              value={newChallenge.target_seniority}
              onChange={(e) =>
                setNewChallenge((p) => ({
                  ...p,
                  target_seniority: e.target.value as 'graduate' | 'junior' | 'mid' | 'senior',
                }))
              }
            >
              <option value="graduate">graduate</option>
              <option value="junior">junior</option>
              <option value="mid">mid</option>
              <option value="senior">senior</option>
            </select>
            <input
              type="number"
              className="rounded border px-2 py-1 w-28"
              placeholder="Duration"
              value={newChallenge.duration_minutes}
              min={5}
              max={300}
              onChange={(e) =>
                setNewChallenge((p) => ({
                  ...p,
                  duration_minutes: e.target.value,
                }))
              }
            />
            <Button onClick={() => void onCreateChallenge()} disabled={isCreatingChallenge}>
              {isCreatingChallenge ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Challenges</h2>
          {challenges.map((c) => (
            <div key={c.challenge_id} className="rounded border p-3 text-sm">
              {challengeActionState[c.challenge_id] && (
                <p className="text-xs text-primary mb-1">
                  Updating: {challengeActionState[c.challenge_id]}...
                </p>
              )}
              <p className="font-medium">{c.title}</p>
              <p className="text-muted-foreground">
                {c.category} | {String(c.difficulty).toLowerCase()} | {c.target_seniority} | {c.duration_minutes}m | {c.publish_status}
              </p>
              <p className="text-muted-foreground">ready: {c.readiness.is_ready ? 'yes' : 'no'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onSetChallengeStatus(c.challenge_id, 'draft')}
                  disabled={Boolean(challengeActionState[c.challenge_id])}
                >
                  Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => void onSetChallengeStatus(c.challenge_id, 'published')}
                  disabled={!c.readiness.is_ready || Boolean(challengeActionState[c.challenge_id])}
                >
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void onSetChallengeStatus(c.challenge_id, 'archived')}
                  disabled={Boolean(challengeActionState[c.challenge_id])}
                >
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void loadChallengeConfig(c.challenge_id)}
                  disabled={Boolean(challengeActionState[c.challenge_id])}
                >
                  Configure
                </Button>
              </div>
            </div>
          ))}
        </section>

        {selectedChallengeId && (
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold">Challenge Config ({selectedChallengeId})</h2>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded border p-3 space-y-2">
                <p className="font-medium">JavaScript baseline</p>
                <input type="number" className="w-full rounded border px-2 py-1" value={jsBaseline.runtime_ms} onChange={(e) => setJsBaseline((p) => ({ ...p, runtime_ms: Number(e.target.value) || p.runtime_ms }))} />
                <input type="number" className="w-full rounded border px-2 py-1" value={jsBaseline.memory_mb} onChange={(e) => setJsBaseline((p) => ({ ...p, memory_mb: Number(e.target.value) || p.memory_mb }))} />
                <Button size="sm" onClick={() => void onSaveBaseline('javascript')}>Save JS Baseline</Button>
              </div>
              <div className="rounded border p-3 space-y-2">
                <p className="font-medium">Python baseline</p>
                <input type="number" className="w-full rounded border px-2 py-1" value={pyBaseline.runtime_ms} onChange={(e) => setPyBaseline((p) => ({ ...p, runtime_ms: Number(e.target.value) || p.runtime_ms }))} />
                <input type="number" className="w-full rounded border px-2 py-1" value={pyBaseline.memory_mb} onChange={(e) => setPyBaseline((p) => ({ ...p, memory_mb: Number(e.target.value) || p.memory_mb }))} />
                <Button size="sm" onClick={() => void onSaveBaseline('python')}>Save Python Baseline</Button>
              </div>
            </div>
            <div className="rounded border p-3 space-y-2">
              <p className="font-medium">Add test</p>
              <input className="w-full rounded border px-2 py-1" value={newTest.name} onChange={(e) => setNewTest((p) => ({ ...p, name: e.target.value }))} />
              <textarea className="w-full rounded border px-2 py-1" rows={2} value={newTest.input} onChange={(e) => setNewTest((p) => ({ ...p, input: e.target.value }))} />
              <textarea className="w-full rounded border px-2 py-1" rows={2} value={newTest.expected_output} onChange={(e) => setNewTest((p) => ({ ...p, expected_output: e.target.value }))} />
              <input type="number" className="w-full rounded border px-2 py-1" value={newTest.points} onChange={(e) => setNewTest((p) => ({ ...p, points: Number(e.target.value) || p.points }))} />
              <Button size="sm" onClick={() => void onAddTest()}>Add Test</Button>
            </div>
            <div className="space-y-1 text-sm">
              {tests.map((t) => (
                <div key={t.id} className="rounded border px-2 py-1">{t.name} ({t.points} pts)</div>
              ))}
            </div>
            <div className="rounded border p-3 space-y-2">
              <p className="font-medium">Reference docs</p>
              <input
                className="w-full rounded border px-2 py-1"
                value={newDoc.title}
                onChange={(e) => setNewDoc((p) => ({ ...p, title: e.target.value }))}
                placeholder="Doc title"
              />
              <textarea
                className="w-full rounded border px-2 py-1"
                rows={3}
                value={newDoc.content}
                onChange={(e) => setNewDoc((p) => ({ ...p, content: e.target.value }))}
                placeholder="Doc content / instructions"
              />
              <Button size="sm" onClick={() => void onAddDoc()}>Add Doc</Button>
              <div className="space-y-1 text-sm">
                {challengeDocs.map((doc) => (
                  <div key={doc.doc_id} className="rounded border px-2 py-1">
                    {doc.title}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Judge Runs</h2>
          {runs.map((run) => (
            <div key={run.id} className="rounded border p-3 text-sm">
              <p>{run.challenge_title} | {run.user_email}</p>
              <p className="text-muted-foreground">{run.language} | {run.status} | {run.test_passed}/{run.test_total}</p>
              <Button size="sm" variant="outline" onClick={() => void onRetryRun(run.id)} disabled={run.status !== 'failed'}>Retry</Button>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Proctoring Settings</h2>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.requireCamera} onChange={(e) => setSettings((p) => ({ ...p, requireCamera: e.target.checked }))} />Require camera</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.requireMicrophone} onChange={(e) => setSettings((p) => ({ ...p, requireMicrophone: e.target.checked }))} />Require microphone</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.requireAudio} onChange={(e) => setSettings((p) => ({ ...p, requireAudio: e.target.checked }))} />Require audio playback</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.strictMode} onChange={(e) => setSettings((p) => ({ ...p, strictMode: e.target.checked }))} />Strict mode</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={settings.autoPauseOnViolation} onChange={(e) => setSettings((p) => ({ ...p, autoPauseOnViolation: e.target.checked }))} />Auto pause on violation</label>
          <input type="number" className="rounded border px-2 py-1" value={settings.allowedViolationsBeforeWarning} onChange={(e) => setSettings((p) => ({ ...p, allowedViolationsBeforeWarning: Number(e.target.value) || p.allowedViolationsBeforeWarning }))} />
          <Button onClick={() => void onSaveSettings()}>Save Settings</Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Proctoring Sessions</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              {sessions.map((s) => (
                <button key={s.id} type="button" className="w-full rounded border px-2 py-1 text-left text-sm" onClick={() => void onSelectSession(s.id)}>
                  {s.challenge_title ?? 'Challenge'} | {s.user_email ?? 'User'} | {s.status}
                </button>
              ))}
            </div>
            <div className="rounded border p-2 text-sm">
              {selectedSession ? (
                <>
                  <p className="font-medium">Score: {selectedSession.proctoringScore}</p>
                  <p className="text-muted-foreground">Duration: {selectedSession.duration}</p>
                  <p className="text-muted-foreground">Violations: {selectedSession.stats.violations.total}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Select a session</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">User Roles</h2>
          {users.map((u) => (
            <div key={u.user_id} className="rounded border p-2 text-sm">
              <p>{u.name} | {u.email} | {u.role}</p>
              <div className="mt-1 flex gap-2">
                {(['developer', 'recruiter', 'admin'] as const).map((role) => (
                  <Button key={role} size="sm" variant={u.role === role ? 'default' : 'outline'} onClick={() => void onUpdateRole(u.user_id, role)} disabled={u.role === role}>{role}</Button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Audit Logs</h2>
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded border p-2 text-sm">
              <p>{log.action}</p>
              <p className="text-muted-foreground">admin: {log.admin_email ?? 'unknown'} | target: {log.target_email ?? 'n/a'}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-semibold">Flagged Work Experience</h2>
          {flaggedWorkExperience.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flagged records.</p>
          ) : (
            flaggedWorkExperience.map((entry) => (
              <div key={entry.id} className="rounded border p-2 text-sm">
                <p>{entry.user_name} | {entry.user_email}</p>
                <p className="text-muted-foreground">
                  {entry.company_name} - {entry.role} ({entry.duration_months} months)
                </p>
                <p className="text-muted-foreground">
                  status: {entry.verification_status} | risk: {entry.risk_score}
                </p>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
