'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUIPreferences } from '@/components/providers/app-providers';
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
import { TUTOR_STYLE_OPTIONS } from '@/config/learning-materials-catalog';
import type { ExplanationDepth, SupportedLanguage } from '@/types/domain';

interface TopicOption {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  topicId?: string;
  language: SupportedLanguage;
  explanationDepth: ExplanationDepth;
  messageCount: number;
  updatedAt: string;
}

interface SourceReference {
  title: string;
  locator?: string;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId?: string;
  isDocumentGrounded: boolean;
  sourceReferences: SourceReference[];
  feedbackRating?: 'helpful' | 'unhelpful' | 'flagged';
  createdAt: string;
}

export default function StudentAITutorPage() {
  const { language: uiLanguage } = useUIPreferences();

  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);

  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [chatLanguage, setChatLanguage] = useState<SupportedLanguage>('en');
  const [depth, setDepth] = useState<ExplanationDepth>('intermediate');
  const [responseStyle, setResponseStyle] = useState<string>('explanation');
  const [promptInput, setPromptInput] = useState<string>('');
  const [renameTitle, setRenameTitle] = useState<string>('');

  const [sending, setSending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [currRes, convRes] = await Promise.all([
        fetch('/api/v1/curriculum?limit=50', { credentials: 'include' }),
        fetch('/api/v1/tutor/conversations', { credentials: 'include' }),
      ]);
      const currJson = await currRes.json();
      if (currRes.ok && currJson.success) {
        const loadedTopics: TopicOption[] = currJson.data.topics ?? [];
        setTopics(loadedTopics);
        if (loadedTopics[0]) {
          setSelectedTopicId((prev) => prev || loadedTopics[0]!.id);
        }
      }

      const convJson = await convRes.json();
      if (convRes.ok && convJson.success) {
        const convList: ConversationItem[] = convJson.data.conversations ?? [];
        setConversations(convList);
        if (convList[0]) {
          setActiveConversationId((prev) => prev || convList[0]!.id);
        }
      }
    } catch {
      setErrorMessage('Unable to load tutor workspace data');
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const loadConversationMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/v1/tutor/conversations/${convId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMessages(json.data.messages ?? []);
        setRenameTitle(json.data.conversation.title ?? '');
        setChatLanguage(json.data.conversation.language ?? 'en');
        setDepth(json.data.conversation.explanationDepth ?? 'intermediate');
      }
    } catch {
      setErrorMessage('Failed to load conversation messages');
    }
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      void loadConversationMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadConversationMessages]);

  async function handleStartNewConversation() {
    setErrorMessage(null);
    const topic = topics.find((t) => t.id === selectedTopicId);
    const res = await fetch('/api/v1/tutor/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        topicId: selectedTopicId || undefined,
        subjectId: topic?.subjectId,
        chapterId: topic?.chapterId,
        language: chatLanguage,
        explanationDepth: depth,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setErrorMessage(json?.error?.message ?? 'Could not create conversation');
      return;
    }
    const created: ConversationItem = json.data.conversation;
    setConversations((prev) => [created, ...prev]);
    setActiveConversationId(created.id);
    setMessages([]);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!promptInput.trim() || sending) return;
    setSending(true);
    setErrorMessage(null);

    try {
      let targetConvId = activeConversationId;
      if (!targetConvId) {
        const topic = topics.find((t) => t.id === selectedTopicId);
        const createRes = await fetch('/api/v1/tutor/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            topicId: selectedTopicId || undefined,
            subjectId: topic?.subjectId,
            chapterId: topic?.chapterId,
            language: chatLanguage,
            explanationDepth: depth,
            initialMessage: promptInput.trim(),
            responseStyle,
          }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok || !createJson.success) {
          setErrorMessage(createJson?.error?.message ?? 'Failed to send tutor question');
          return;
        }
        const createdConv: ConversationItem = createJson.data.conversation;
        setConversations((prev) => [createdConv, ...prev]);
        setActiveConversationId(createdConv.id);
        setMessages(createJson.data.messages ?? []);
        setPromptInput('');
        return;
      }

      const res = await fetch(`/api/v1/tutor/conversations/${targetConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: promptInput.trim(),
          language: chatLanguage,
          explanationDepth: depth,
          responseStyle,
          stream: false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json?.error?.message ?? 'Failed to receive AI Tutor response');
        return;
      }

      setMessages((prev) => [...prev, json.data.userMessage, json.data.assistantMessage]);
      setPromptInput('');
    } finally {
      setSending(false);
    }
  }

  async function handleRenameConversation() {
    if (!activeConversationId || !renameTitle.trim()) return;
    const res = await fetch(`/api/v1/tutor/conversations/${activeConversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: renameTitle.trim() }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? json.data.conversation : c)),
      );
    }
  }

  async function handleDeleteConversation(convId: string) {
    const res = await fetch(`/api/v1/tutor/conversations/${convId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConversationId === convId) {
        setActiveConversationId(remaining[0]?.id ?? null);
      }
    }
  }

  async function handleRateMessage(
    messageId: string,
    feedbackRating: 'helpful' | 'unhelpful' | 'flagged',
  ) {
    const res = await fetch(`/api/v1/tutor/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ feedbackRating }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedbackRating } : m)),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="default" className="mb-2">
            {uiLanguage === 'bn'
              ? 'প্রেক্ষাপটভিত্তিক এআই টিউটর'
              : 'Curriculum-Grounded AI Subject Tutor'}
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {uiLanguage === 'bn' ? 'এআই সাবজেক্ট টিউটর (AI Tutor)' : 'AI Subject Tutor'}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {uiLanguage === 'bn'
              ? 'নির্বাচিত টপিকের আলোকে বাংলা বা ইংরেজিতে ধারণা ব্যাখ্যা, ধাপে ধাপে সমাধান এবং উদাহরণ পান।'
              : 'Ask questions grounded in your selected topic with configurable depth, Bangla/English mode, and pedagogical style.'}
          </p>
        </div>
        <Button onClick={() => void handleStartNewConversation()}>
          {uiLanguage === 'bn' ? '+ নতুন আলোচনা শুরু করুন' : '+ New Tutor Session'}
        </Button>
      </div>

      {/* Tutor Context & Mode Controls */}
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500">
              {uiLanguage === 'bn' ? 'টপিক প্রেক্ষাপট' : 'Curriculum Topic Context'}
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {uiLanguage === 'bn' && t.titleBn ? t.titleBn : t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500">
              {uiLanguage === 'bn' ? 'উত্তরের ভাষা' : 'Response Language'}
            </label>
            <select
              value={chatLanguage}
              onChange={(e) => setChatLanguage(e.target.value as SupportedLanguage)}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="en">English</option>
              <option value="bn">বাংলা (Bangla)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500">
              {uiLanguage === 'bn' ? 'ব্যাখ্যার গভীরতা' : 'Explanation Depth'}
            </label>
            <select
              value={depth}
              onChange={(e) => setDepth(e.target.value as ExplanationDepth)}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="beginner">Beginner (Simple & Intuitive)</option>
              <option value="intermediate">Intermediate (Board Standard)</option>
              <option value="advanced">Advanced (Rigorous & Competitive)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500">
              {uiLanguage === 'bn' ? 'উত্তরের ধরন (FR-TUTOR-004)' : 'Pedagogical Style'}
            </label>
            <select
              value={responseStyle}
              onChange={(e) => setResponseStyle(e.target.value)}
              className="h-9 w-full rounded-xl border border-zinc-300 bg-white px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              {TUTOR_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {uiLanguage === 'bn' ? opt.labelBn : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Conversation History Sidebar */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">
              {uiLanguage === 'bn'
                ? `সংরক্ষিত কথোপকথন (${conversations.length})`
                : `Saved Conversations (${conversations.length})`}
            </CardTitle>
            <CardDescription>
              {uiLanguage === 'bn'
                ? 'পূর্ববর্তী সেশন পুনরায় খুলুন, নাম পরিবর্তন করুন বা মুছে ফেলুন।'
                : 'Resume, rename, or delete previous study sessions.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {activeConversationId ? (
              <div className="flex gap-1.5 pb-2">
                <Input
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  placeholder="Rename conversation..."
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={() => void handleRenameConversation()}>
                  Rename
                </Button>
              </div>
            ) : null}

            {conversations.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                {uiLanguage === 'bn'
                  ? 'এখনো কোনো কথোপকথন নেই। নিচে প্রশ্ন লিখে শুরু করুন।'
                  : 'No conversations yet. Ask your first question to start.'}
              </p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-colors ${
                    conv.id === activeConversationId
                      ? 'border-indigo-600 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-950/30'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="truncate font-semibold">{conv.title}</p>
                    <p className="text-[11px] text-zinc-500">
                      {conv.language.toUpperCase()} · {conv.explanationDepth} · {conv.messageCount}{' '}
                      msgs
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteConversation(conv.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Active Chat Timeline */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {uiLanguage === 'bn' ? 'টিউটর আলোচনা' : 'Interactive Tutor Timeline'}
              </CardTitle>
              <Badge variant="outline">
                AI-Generated Educational Guidance · Verify Critical Exam Rules (FR-TUTOR-012)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
                  {uiLanguage === 'bn'
                    ? 'নির্বাচিত টপিক সম্পর্কে যেকোনো গাণিতিক বা তাত্ত্বিক প্রশ্ন জিজ্ঞাসা করুন।'
                    : 'Ask any conceptual, mathematical, or exam-preparation question about the selected topic.'}
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl border p-4 text-sm ${
                      msg.role === 'user'
                        ? 'ml-8 border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/50 dark:bg-indigo-950/30'
                        : 'mr-4 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                    }`}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="font-semibold">
                        {msg.role === 'user' ? 'Student' : 'LearnMate AI Tutor'}
                      </span>
                      {msg.modelId ? <Badge variant="outline">{msg.modelId}</Badge> : null}
                    </div>

                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {msg.sourceReferences?.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800">
                        <span>Sources:</span>
                        {msg.sourceReferences.map((ref, idx) => (
                          <Badge key={idx} variant="secondary">
                            {ref.title}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    {msg.role === 'assistant' ? (
                      <div className="mt-2.5 flex items-center gap-2 pt-1 text-xs">
                        {(['helpful', 'unhelpful', 'flagged'] as const).map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => void handleRateMessage(msg.id, rating)}
                            className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              msg.feedbackRating === rating
                                ? 'bg-indigo-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <Separator />

            <form onSubmit={(e) => void handleSendMessage(e)} className="flex gap-2">
              <Input
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder={
                  uiLanguage === 'bn'
                    ? 'আপনার প্রশ্ন লিখুন (যেমন: নিউটনের ২য় সূত্র থেকে F=ma প্রতিপাদন করো)...'
                    : 'Ask your tutor (e.g., Derive F = ma from rate of change of momentum)...'
                }
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !promptInput.trim()}>
                {sending
                  ? uiLanguage === 'bn'
                    ? 'পাঠানো হচ্ছে...'
                    : 'Thinking...'
                  : uiLanguage === 'bn'
                    ? 'প্রশ্ন পাঠান'
                    : 'Send'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
