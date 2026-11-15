'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export type AdminAISection = 'ai-config' | 'prompts' | 'usage-logs';

const TASK_KEYS = [
  'tutor',
  'explanation',
  'summarization',
  'quiz_generation',
  'quiz_evaluation',
  'flashcards',
  'planner',
  'document_qa',
  'recommendations',
] as const;

type TaskKey = (typeof TASK_KEYS)[number];

interface AIConfigState {
  defaultModel: string;
  taskModels: Record<TaskKey, string>;
  fallbackModels: string[];
  dailyRequestLimitPerStudent: number;
  dailyTokenLimitPerStudent: number;
  enableResponseCaching: boolean;
}

interface PromptTemplateItem {
  id: string;
  taskType: TaskKey;
  name: string;
  version: number;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  maxOutputTokens: number;
  isActive: boolean;
}

interface AIUsageLogItem {
  id: string;
  userId?: string;
  taskType: TaskKey;
  modelId: string;
  fallbackUsed: boolean;
  status: 'success' | 'validation_failed' | 'rate_limited' | 'provider_error' | 'cached';
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  sanitizedError?: string;
  createdAt: string;
}

interface UsageSummary {
  totalRequests: number;
  totalTokens: number;
  averageLatencyMs: number;
  errorCount: number;
  cachedCount: number;
  rateLimitedCount: number;
}

export function AdminAIConsole({ section }: { section: AdminAISection }) {
  const [config, setConfig] = useState<AIConfigState | null>(null);
  const [openRouterKeyConfigured, setOpenRouterKeyConfigured] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplateItem[]>([]);
  const [usageLogs, setUsageLogs] = useState<AIUsageLogItem[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prompt Editor Form
  const [selectedTask, setSelectedTask] = useState<TaskKey>('tutor');
  const [promptName, setPromptName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPromptTemplate, setUserPromptTemplate] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [maxOutputTokens, setMaxOutputTokens] = useState(2000);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (section === 'ai-config') {
        const res = await fetch('/api/v1/admin/ai/config', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json?.error?.message ?? 'Unable to load AI configuration');
        } else {
          setConfig(json.data.config);
          setOpenRouterKeyConfigured(Boolean(json.data.openRouterKeyConfigured));
        }
      } else if (section === 'prompts') {
        const res = await fetch('/api/v1/admin/ai/prompts', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json?.error?.message ?? 'Unable to load prompt templates');
        } else {
          const list: PromptTemplateItem[] = json.data.templates ?? [];
          setPrompts(list);
          const match = list.find((p) => p.taskType === selectedTask) ?? list[0];
          if (match) {
            setPromptName(match.name);
            setSystemPrompt(match.systemPrompt);
            setUserPromptTemplate(match.userPromptTemplate);
            setTemperature(match.temperature);
            setMaxOutputTokens(match.maxOutputTokens);
          }
        }
      } else if (section === 'usage-logs') {
        const res = await fetch('/api/v1/admin/ai/usage?limit=50', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setErrorMessage(json?.error?.message ?? 'Unable to load AI usage logs');
        } else {
          setUsageLogs(json.data.logs ?? []);
          setUsageSummary(json.data.summary ?? null);
        }
      }
    } catch {
      setErrorMessage('Network error communicating with Admin AI API');
    } finally {
      setLoading(false);
    }
  }, [section, selectedTask]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch('/api/v1/admin/ai/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        defaultModel: config.defaultModel,
        taskModels: config.taskModels,
        fallbackModels: config.fallbackModels,
        dailyRequestLimitPerStudent: Number(config.dailyRequestLimitPerStudent),
        dailyTokenLimitPerStudent: Number(config.dailyTokenLimitPerStudent),
        enableResponseCaching: config.enableResponseCaching,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'Failed to update AI configuration');
      return;
    }
    setConfig(json.data.config);
    setStatusMessage('OpenRouter model routing & student quota configuration saved.');
  }

  async function handleSavePrompt(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const res = await fetch('/api/v1/admin/ai/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        taskType: selectedTask,
        name: promptName,
        systemPrompt,
        userPromptTemplate,
        temperature: Number(temperature),
        maxOutputTokens: Number(maxOutputTokens),
        isActive: true,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'Failed to save prompt template version');
      return;
    }
    setStatusMessage(
      `Published new prompt version v${json.data.template.version} for task "${selectedTask}".`,
    );
    await loadData();
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {statusMessage}
        </div>
      ) : null}

      {section === 'ai-config' ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>OpenRouter Gateway & Per-Task Model Routing</CardTitle>
                <CardDescription>
                  Configure permitted OpenRouter model IDs, fallback chains, response caching, and daily student quotas (FR-ADMIN-007, FR-ADMIN-009).
                </CardDescription>
              </div>
              <Badge variant={openRouterKeyConfigured ? 'accent' : 'secondary'}>
                {openRouterKeyConfigured
                  ? 'Server OPENROUTER_API_KEY: Configured'
                  : 'Server OPENROUTER_API_KEY: Missing'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !config ? (
              <p className="text-sm text-zinc-500">Loading OpenRouter configuration...</p>
            ) : (
              <form onSubmit={(e) => void handleSaveConfig(e)} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      Default OpenRouter Model
                    </label>
                    <Input
                      value={config.defaultModel}
                      onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      Daily Request Limit / Student
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={config.dailyRequestLimitPerStudent}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dailyRequestLimitPerStudent: Number(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      Daily Token Limit / Student
                    </label>
                    <Input
                      type="number"
                      min={500}
                      max={2000000}
                      value={config.dailyTokenLimitPerStudent}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dailyTokenLimitPerStudent: Number(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Task-Specific Model Routing (9 AI Tasks)
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {TASK_KEYS.map((taskKey) => (
                      <div key={taskKey} className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {taskKey}
                        </label>
                        <Input
                          value={config.taskModels[taskKey] ?? config.defaultModel}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              taskModels: {
                                ...config.taskModels,
                                [taskKey]: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.enableResponseCaching}
                      onChange={(e) =>
                        setConfig({ ...config, enableResponseCaching: e.target.checked })
                      }
                    />
                    <span>Enable reusable AI output caching (FR-AI-008)</span>
                  </label>
                  <Button type="submit">Save AI Gateway Configuration</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      {section === 'prompts' ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Versioned Prompt Registry ({prompts.length})</CardTitle>
              <CardDescription>
                Select an AI task to inspect or publish a new prompt version (FR-ADMIN-006).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {prompts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedTask(p.taskType);
                    setPromptName(p.name);
                    setSystemPrompt(p.systemPrompt);
                    setUserPromptTemplate(p.userPromptTemplate);
                    setTemperature(p.temperature);
                    setMaxOutputTokens(p.maxOutputTokens);
                  }}
                  className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors ${
                    selectedTask === p.taskType
                      ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-400 dark:bg-indigo-950/30'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{p.taskType}</Badge>
                    <Badge variant="accent">v{p.version}</Badge>
                  </div>
                  <p className="mt-1.5 font-medium">{p.name}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Publish New Prompt Template Version</CardTitle>
              <CardDescription>
                Task: <strong>{selectedTask}</strong> — supports variables like{' '}
                <code>{'{{language}}'}</code>, <code>{'{{depth}}'}</code>,{' '}
                <code>{'{{topicTitle}}'}</code>, and <code>{'{{userPrompt}}'}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleSavePrompt(e)} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    placeholder="Template Name"
                    className="sm:col-span-1"
                    required
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={1.5}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    placeholder="Temperature"
                    required
                  />
                  <Input
                    type="number"
                    min={100}
                    max={8000}
                    value={maxOutputTokens}
                    onChange={(e) => setMaxOutputTokens(Number(e.target.value))}
                    placeholder="Max Tokens"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">System Prompt</label>
                  <textarea
                    rows={4}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">
                    User Prompt Template
                  </label>
                  <textarea
                    rows={4}
                    value={userPromptTemplate}
                    onChange={(e) => setUserPromptTemplate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    required
                  />
                </div>
                <Button type="submit">Publish Versioned Prompt Template</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {section === 'usage-logs' ? (
        <div className="space-y-6">
          {usageSummary ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-zinc-500">Total Logged Requests</p>
                  <p className="mt-1 text-2xl font-bold">{usageSummary.totalRequests}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-zinc-500">Total Tokens Consumed</p>
                  <p className="mt-1 text-2xl font-bold">{usageSummary.totalTokens}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-zinc-500">Average Latency</p>
                  <p className="mt-1 text-2xl font-bold">{usageSummary.averageLatencyMs} ms</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <p className="text-xs text-zinc-500">Cached / Errors / Rate-Limited</p>
                  <p className="mt-1 text-2xl font-bold">
                    {usageSummary.cachedCount} / {usageSummary.errorCount} /{' '}
                    {usageSummary.rateLimitedCount}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>AI Request & Reliability Telemetry ({usageLogs.length})</CardTitle>
              <CardDescription>
                Records task type, model ID, latency, token consumption, cache hits, and sanitized failure status (FR-ADMIN-008, FR-AI-010).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {usageLogs.length === 0 ? (
                <p className="text-sm text-zinc-500">No AI usage logs recorded yet.</p>
              ) : (
                usageLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{log.taskType}</Badge>
                      <Badge
                        variant={
                          log.status === 'success' || log.status === 'cached'
                            ? 'accent'
                            : log.status === 'rate_limited'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {log.status}
                      </Badge>
                      <span className="font-mono text-zinc-600 dark:text-zinc-300">
                        {log.modelId}
                      </span>
                      {log.fallbackUsed ? <Badge variant="secondary">fallback</Badge> : null}
                      <span className="text-zinc-500">
                        {log.latencyMs}ms · {log.totalTokens} tokens
                      </span>
                    </div>
                    {log.sanitizedError ? (
                      <span className="text-red-600 dark:text-red-400">{log.sanitizedError}</span>
                    ) : (
                      <span className="text-zinc-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
