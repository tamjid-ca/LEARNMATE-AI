'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  Flag,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { useUIPreferences } from '@/components/providers/app-providers';
import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TUTOR_STYLE_OPTIONS } from '@/config/learning-materials-catalog';
import { cn } from '@/lib/utils';
import type { ExplanationDepth, SupportedLanguage } from '@/types/domain';

interface SubjectOption {
  id: string;
  code: string;
  name: string;
  nameBn?: string;
}

interface ChapterOption {
  id: string;
  subjectId: string;
  chapterNumber: number;
  title: string;
  titleBn?: string;
}

interface TopicOption {
  id: string;
  subjectId: string;
  chapterId: string;
  code: string;
  title: string;
  titleBn?: string;
  description?: string;
  learningObjectives?: string[];
  keyConcepts?: string[];
}

interface ConversationItem {
  id: string;
  title: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  language: SupportedLanguage;
  explanationDepth: ExplanationDepth;
  customSystemPrompt?: string;
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

interface ApiBannerError {
  status: number;
  code?: string;
  message: string;
}

const TUTOR_PERSONA_PRESETS = [
  {
    id: 'socratic',
    labelEn: 'Socratic Tutor',
    labelBn: 'সক্রেটিক টিউটর',
    prompt:
      'Act as a Socratic academic tutor. Break explanations into intuitive steps, ask brief guiding questions to check understanding, and verify formulas clearly.',
  },
  {
    id: 'board_coach',
    labelEn: 'HSC / SSC Board Coach',
    labelBn: 'বোর্ড পরীক্ষা কোচ',
    prompt:
      'Structure every answer for maximum HSC/SSC Board exam marks: start with an exact textbook definition, provide step-by-step derivations, highlight Creative Question (CQ) points, and list common pitfalls.',
  },
  {
    id: 'admission',
    labelEn: 'Admission / BUET Solver',
    labelBn: 'অ্যাডমিশন সলভার',
    prompt:
      'Act as a competitive university admission & BCS coach. Focus on rigorous mathematical derivations, fast problem-solving shortcuts, edge cases, and high-yield conceptual traps.',
  },
  {
    id: 'revision',
    labelEn: 'Quick Revision Mentor',
    labelBn: 'দ্রুত রিভিশন মেন্টর',
    prompt:
      'Act as a concise exam revision mentor. Prioritize crisp bullet points, key equations, comparison tables, and 2 quick self-check recall prompts at the end.',
  },
] as const;

async function parseApiErrorResponse(
  res: Response,
  fallbackMessage: string,
): Promise<ApiBannerError> {
  try {
    const json = (await res.json()) as {
      error?: { code?: string; message?: string };
    };
    if (res.status === 401) {
      return {
        status: 401,
        code: json.error?.code ?? 'UNAUTHORIZED',
        message: 'Your session has expired or you are not signed in. Please sign in to continue.',
      };
    }
    return {
      status: res.status,
      code: json.error?.code,
      message: json.error?.message || fallbackMessage,
    };
  } catch {
    return {
      status: res.status,
      message:
        res.status === 401
          ? 'Please sign in to access the AI Subject Tutor.'
          : res.status === 503
            ? 'The AI or database service is temporarily unavailable. Please retry in a moment.'
            : fallbackMessage,
    };
  }
}

export default function StudentAITutorPage() {
  const { language: uiLanguage } = useUIPreferences();
  const isBn = uiLanguage === 'bn';

  // Curriculum hierarchy state
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);

  // Conversations & messages state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Tutor context & custom persona controls
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [chatLanguage, setChatLanguage] = useState<SupportedLanguage>('en');
  const [depth, setDepth] = useState<ExplanationDepth>('intermediate');
  const [responseStyle, setResponseStyle] = useState<string>('explanation');
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>('');

  // UI chrome state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [savingContext, setSavingContext] = useState(false);
  const [contextSavedBanner, setContextSavedBanner] = useState<string | null>(null);

  // Composer & network state
  const [promptInput, setPromptInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiBannerError | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filteredChapters = useMemo(() => {
    if (!selectedSubjectId) return chapters;
    return chapters.filter((c) => c.subjectId === selectedSubjectId);
  }, [chapters, selectedSubjectId]);

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      if (selectedSubjectId && t.subjectId !== selectedSubjectId) return false;
      if (selectedChapterId && t.chapterId !== selectedChapterId) return false;
      return true;
    });
  }, [topics, selectedSubjectId, selectedChapterId]);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  );

  const activeSubject = useMemo(() => {
    const sid = activeTopic?.subjectId ?? selectedSubjectId;
    return subjects.find((s) => s.id === sid) ?? null;
  }, [subjects, activeTopic, selectedSubjectId]);

  const activeChapter = useMemo(() => {
    const cid = activeTopic?.chapterId ?? selectedChapterId;
    return chapters.find((c) => c.id === cid) ?? null;
  }, [chapters, activeTopic, selectedChapterId]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    setApiError(null);
    try {
      const [currRes, convRes] = await Promise.all([
        fetch('/api/v1/curriculum?limit=100', { credentials: 'include' }),
        fetch('/api/v1/tutor/conversations', { credentials: 'include' }),
      ]);

      if (!currRes.ok) {
        setApiError(
          await parseApiErrorResponse(currRes, 'Unable to load curriculum syllabus context.'),
        );
      } else {
        const currJson = await currRes.json();
        if (currJson.success) {
          const loadedSubjects: SubjectOption[] = currJson.data.subjects ?? [];
          const loadedChapters: ChapterOption[] = currJson.data.chapters ?? [];
          const loadedTopics: TopicOption[] = currJson.data.topics ?? [];
          setSubjects(loadedSubjects);
          setChapters(loadedChapters);
          setTopics(loadedTopics);

          // Pre-bind first syllabus topic when no active conversation is loaded
          if (loadedTopics[0]) {
            setSelectedTopicId((prev) => prev || loadedTopics[0]!.id);
            setSelectedSubjectId((prev) => prev || loadedTopics[0]!.subjectId);
            setSelectedChapterId((prev) => prev || loadedTopics[0]!.chapterId);
          }
        }
      }

      if (!convRes.ok) {
        if (currRes.ok) {
          setApiError(
            await parseApiErrorResponse(convRes, 'Unable to load saved tutor conversations.'),
          );
        }
      } else {
        const convJson = await convRes.json();
        if (convJson.success) {
          const convList: ConversationItem[] = convJson.data.conversations ?? [];
          setConversations(convList);
          // Cleanly handle empty DB (0 conversations) without showing any error
          if (convList[0]) {
            setActiveConversationId((prev) => prev ?? convList[0]!.id);
          }
        }
      }
    } catch {
      setApiError({
        status: 503,
        message: 'Network error while connecting to LearnMate AI Tutor. Please retry.',
      });
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const loadConversationMessages = useCallback(
    async (convId: string) => {
      setLoadingMessages(true);
      setApiError(null);
      try {
        const res = await fetch(`/api/v1/tutor/conversations/${convId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          setApiError(await parseApiErrorResponse(res, 'Failed to load conversation messages.'));
          return;
        }
        const json = await res.json();
        if (json.success) {
          const conv: ConversationItem = json.data.conversation;
          setMessages(json.data.messages ?? []);
          setChatLanguage(conv.language ?? 'en');
          setDepth(conv.explanationDepth ?? 'intermediate');
          setCustomSystemPrompt(conv.customSystemPrompt ?? '');
          if (conv.topicId) {
            setSelectedTopicId(conv.topicId);
            const matched = topics.find((t) => t.id === conv.topicId);
            setSelectedSubjectId(conv.subjectId ?? matched?.subjectId ?? '');
            setSelectedChapterId(conv.chapterId ?? matched?.chapterId ?? '');
          } else {
            setSelectedTopicId('');
            setSelectedSubjectId(conv.subjectId ?? '');
            setSelectedChapterId(conv.chapterId ?? '');
          }
        }
      } catch {
        setApiError({
          status: 503,
          message: 'Network error while loading conversation history.',
        });
      } finally {
        setLoadingMessages(false);
      }
    },
    [topics],
  );

  useEffect(() => {
    if (activeConversationId) {
      void loadConversationMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadConversationMessages]);

  function handleSelectSubject(subjectId: string) {
    setSelectedSubjectId(subjectId);
    setSelectedChapterId('');
    const firstTopicInSubject = topics.find((t) => !subjectId || t.subjectId === subjectId);
    setSelectedTopicId(subjectId && firstTopicInSubject ? firstTopicInSubject.id : '');
  }

  function handleSelectChapter(chapterId: string) {
    setSelectedChapterId(chapterId);
    const firstTopicInChapter = topics.find(
      (t) =>
        (!selectedSubjectId || t.subjectId === selectedSubjectId) &&
        (!chapterId || t.chapterId === chapterId),
    );
    if (chapterId && firstTopicInChapter) {
      setSelectedTopicId(firstTopicInChapter.id);
    }
  }

  async function handleSelectTopic(topicId: string) {
    setSelectedTopicId(topicId);
    const found = topics.find((t) => t.id === topicId);
    if (found) {
      setSelectedSubjectId(found.subjectId);
      setSelectedChapterId(found.chapterId);
    }
    if (activeConversationId) {
      await persistContextToActiveConversation({
        topicId: topicId || null,
        subjectId: found?.subjectId ?? (topicId ? selectedSubjectId || null : null),
        chapterId: found?.chapterId ?? (topicId ? selectedChapterId || null : null),
      });
    }
  }

  async function persistContextToActiveConversation(overrides?: {
    topicId?: string | null;
    subjectId?: string | null;
    chapterId?: string | null;
    customSystemPrompt?: string | null;
    language?: SupportedLanguage;
    explanationDepth?: ExplanationDepth;
  }) {
    if (!activeConversationId) {
      setContextSavedBanner(
        isBn
          ? 'প্রসঙ্গ সংরক্ষিত হয়েছে — পরবর্তী নতুন আলোচনায় ব্যবহৃত হবে।'
          : 'Context updated and ready for your next question.',
      );
      setTimeout(() => setContextSavedBanner(null), 2500);
      return;
    }

    setSavingContext(true);
    setContextSavedBanner(null);
    try {
      const payload = {
        topicId: overrides?.topicId !== undefined ? overrides.topicId : selectedTopicId || null,
        subjectId:
          overrides?.subjectId !== undefined ? overrides.subjectId : selectedSubjectId || null,
        chapterId:
          overrides?.chapterId !== undefined ? overrides.chapterId : selectedChapterId || null,
        customSystemPrompt:
          overrides?.customSystemPrompt !== undefined
            ? overrides.customSystemPrompt
            : customSystemPrompt.trim() || null,
        language: overrides?.language ?? chatLanguage,
        explanationDepth: overrides?.explanationDepth ?? depth,
      };
      const res = await fetch(`/api/v1/tutor/conversations/${activeConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setApiError(await parseApiErrorResponse(res, 'Could not update session context.'));
        return;
      }
      const json = await res.json();
      if (json.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? json.data.conversation : c)),
        );
        setContextSavedBanner(
          isBn
            ? 'পাঠ্যক্রম প্রসঙ্গ ও টিউটর নির্দেশনা সেশনে প্রয়োগ করা হয়েছে।'
            : 'Curriculum context & tutor instructions applied to this session.',
        );
        setTimeout(() => setContextSavedBanner(null), 2500);
      }
    } catch {
      setApiError({ status: 503, message: 'Network error while saving tutor context.' });
    } finally {
      setSavingContext(false);
    }
  }

  function handleStartFreshDraftChat() {
    setApiError(null);
    setActiveConversationId(null);
    setMessages([]);
    setStreamingContent(null);
    textareaRef.current?.focus();
  }

  async function sendQuestionText(rawText: string) {
    const trimmed = rawText.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setApiError(null);
    setPromptInput('');

    const optimisticUserMsg: MessageItem = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      isDocumentGrounded: false,
      sourceReferences: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setStreamingContent('');

    try {
      let targetConvId = activeConversationId;

      if (!targetConvId) {
        const createRes = await fetch('/api/v1/tutor/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: trimmed.slice(0, 64),
            topicId: selectedTopicId || undefined,
            subjectId: activeTopic?.subjectId ?? (selectedSubjectId || undefined),
            chapterId: activeTopic?.chapterId ?? (selectedChapterId || undefined),
            language: chatLanguage,
            explanationDepth: depth,
            customSystemPrompt: customSystemPrompt.trim() || undefined,
          }),
        });
        if (!createRes.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
          setStreamingContent(null);
          setApiError(await parseApiErrorResponse(createRes, 'Could not start tutor session.'));
          return;
        }
        const createJson = await createRes.json();
        const createdConv: ConversationItem = createJson.data.conversation;
        targetConvId = createdConv.id;
        setConversations((prev) => [createdConv, ...prev]);
        setActiveConversationId(createdConv.id);
      }

      const res = await fetch(`/api/v1/tutor/conversations/${targetConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: trimmed,
          topicId: selectedTopicId || null,
          subjectId: activeTopic?.subjectId ?? (selectedSubjectId || null),
          chapterId: activeTopic?.chapterId ?? (selectedChapterId || null),
          language: chatLanguage,
          explanationDepth: depth,
          customSystemPrompt: customSystemPrompt.trim() || null,
          responseStyle,
          stream: true,
        }),
      });

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
        setStreamingContent(null);
        setApiError(await parseApiErrorResponse(res, 'Failed to receive AI Tutor response.'));
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const evt of events) {
            const line = evt
              .split('\n')
              .find((l) => l.startsWith('data:'));
            if (!line) continue;
            const rawData = line.slice(5).trim();
            if (!rawData) continue;
            try {
              const payload = JSON.parse(rawData) as { chunk?: string; done?: boolean };
              if (payload.chunk) {
                accumulated += payload.chunk;
                setStreamingContent(accumulated);
              }
            } catch {
              // Ignore partial non-JSON lines
            }
          }
        }

        // Sync canonical saved messages + sourceReferences + IDs from server
        setStreamingContent(null);
        await loadConversationMessages(targetConvId);
        // Refresh sidebar counts/timestamps
        const convListRes = await fetch('/api/v1/tutor/conversations', {
          credentials: 'include',
        });
        if (convListRes.ok) {
          const listJson = await convListRes.json();
          if (listJson.success) setConversations(listJson.data.conversations ?? []);
        }
      } else {
        const json = await res.json();
        setStreamingContent(null);
        if (json.success) {
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== optimisticUserMsg.id),
            json.data.userMessage,
            json.data.assistantMessage,
          ]);
          if (json.data.conversation) {
            setConversations((prev) =>
              prev.map((c) => (c.id === targetConvId ? json.data.conversation : c)),
            );
          }
        }
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      setStreamingContent(null);
      setApiError({
        status: 503,
        message: 'Network interruption while streaming tutor response. Please try again.',
      });
    } finally {
      setSending(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendQuestionText(promptInput);
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendQuestionText(promptInput);
    }
  }

  async function handleSaveRename(convId: string) {
    if (!renameDraft.trim()) {
      setRenamingConvId(null);
      return;
    }
    const res = await fetch(`/api/v1/tutor/conversations/${convId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: renameDraft.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? json.data.conversation : c)),
        );
      }
    }
    setRenamingConvId(null);
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
        if (!remaining[0]) setMessages([]);
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
    if (res.ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedbackRating } : m)),
      );
    }
  }

  async function handleCopyMessage(msg: MessageItem) {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMessageId(msg.id);
      setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  }

  const activeTopicDisplayName = activeTopic
    ? isBn && activeTopic.titleBn
      ? activeTopic.titleBn
      : activeTopic.title
    : isBn
      ? 'সাধারণ একাডেমিক অধ্যয়ন'
      : 'General Academic Study';

  const starterPrompts = useMemo(() => {
    const topicLabel = activeTopic ? activeTopic.title : 'Newtonian Mechanics';
    return [
      {
        titleEn: `Explain ${topicLabel} intuitively`,
        titleBn: `${topicLabel} সহজভাবে উদাহরণসহ ব্যাখ্যা করো`,
        prompt:
          chatLanguage === 'bn'
            ? `${topicLabel} বিষয়টি একদম সহজ ভাষায় বাস্তব উদাহরণসহ ব্যাখ্যা করো।`
            : `Explain ${topicLabel} clearly from first principles with intuitive real-world examples.`,
      },
      {
        titleEn: 'Step-by-step formula derivation',
        titleBn: 'ধাপে ধাপে সূত্রের প্রতিপাদন',
        prompt:
          chatLanguage === 'bn'
            ? `${topicLabel}-এর মূল সূত্রগুলো ধাপে ধাপে প্রতিপাদন করে দেখাও।`
            : `Derive the key formulas and relationships in ${topicLabel} step by step with justifications.`,
      },
      {
        titleEn: '3 Exam-style practice problems',
        titleBn: 'পরীক্ষা উপযোগী ৩টি গাণিতিক সমস্যা',
        prompt:
          chatLanguage === 'bn'
            ? `${topicLabel} থেকে বোর্ড ও অ্যাডমিশন মানের ৩টি অনুশীলন সমস্যা ও সমাধান দাও।`
            : `Give me 3 progressively harder exam-style practice problems on ${topicLabel} with worked solutions.`,
      },
      {
        titleEn: 'Common mistakes & exam traps',
        titleBn: 'সাধারণ ভুল ও পরীক্ষার সতর্কতা',
        prompt:
          chatLanguage === 'bn'
            ? `${topicLabel} অধ্যায়ের পরীক্ষায় শিক্ষার্থীরা কী কী সাধারণ ভুল করে এবং কীভাবে এড়ানো যায়?`
            : `What are the most common conceptual mistakes and exam traps students make in ${topicLabel}, and how can I avoid them?`,
      },
    ];
  }, [activeTopic, chatLanguage]);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[640px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      {/* Collapsible Left ChatGPT-Style History Sidebar */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)]/70 transition-all duration-200',
          sidebarOpen ? 'w-72' : 'hidden w-0 overflow-hidden',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] p-3">
          <Button
            onClick={handleStartFreshDraftChat}
            className="flex-1 justify-start gap-2 rounded-xl"
            size="sm"
          >
            <Plus className="size-4" />
            <span>{isBn ? 'নতুন আলোচনা' : 'New Chat'}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            aria-label="Hide conversation sidebar"
            className="size-8 shrink-0"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>

        <div className="p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-[var(--muted-foreground)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? 'আলোচনা খুঁজুন...' : 'Search chats...'}
              className="h-8 rounded-lg bg-[var(--card)] pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
          {loadingWorkspace ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-11 animate-pulse rounded-xl bg-[var(--muted)]" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--muted-foreground)]">
              <MessageSquare className="mx-auto mb-2 size-5 opacity-60" />
              <p className="font-medium text-[var(--foreground)]">
                {isBn ? 'এখনো কোনো আলোচনা নেই' : 'No saved chats yet'}
              </p>
              <p className="mt-1 leading-relaxed">
                {isBn
                  ? 'ডানদিকে যেকোনো প্রশ্ন লিখলেই নতুন সেশন শুরু হবে।'
                  : 'Ask your first question on the right to begin a saved session.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === activeConversationId;
              const convTopic = topics.find((t) => t.id === conv.topicId);
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={cn(
                    'group flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs transition-colors',
                    isSelected
                      ? 'bg-[var(--accent)]/80 text-[var(--accent-foreground)] font-medium'
                      : 'text-[var(--foreground)] hover:bg-[var(--muted)]/70',
                  )}
                >
                  {renamingConvId === conv.id ? (
                    <div
                      className="flex flex-1 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveRename(conv.id);
                          if (e.key === 'Escape') setRenamingConvId(null);
                        }}
                        className="h-7 px-2 text-xs"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        onClick={() => void handleSaveRename(conv.id)}
                      >
                        <Check className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">{conv.title}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                          {convTopic ? (
                            <span className="truncate font-mono text-[10px]">{convTopic.code}</span>
                          ) : null}
                          <span>
                            {conv.language.toUpperCase()} · {conv.messageCount} msgs
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Rename conversation"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingConvId(conv.id);
                            setRenameDraft(conv.title);
                          }}
                          className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete conversation"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteConversation(conv.id);
                          }}
                          className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main ChatGPT / Gemini-Style Tutor Canvas */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Top Header Bar */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {!sidebarOpen ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open conversation sidebar"
                className="size-8"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            ) : null}

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-semibold">
                    {isBn ? 'LearnMate এআই টিউটর' : 'LearnMate AI Tutor'}
                  </h1>
                  <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                    {depth} · {chatLanguage.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <span
                    className={cn(
                      'inline-block size-2 rounded-full',
                      activeTopic ? 'bg-emerald-500' : 'bg-amber-400',
                    )}
                  />
                  <span className="truncate">
                    {activeSubject ? `${activeSubject.name} · ` : ''}
                    {activeTopicDisplayName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={contextPanelOpen ? 'default' : 'outline'}
              onClick={() => setContextPanelOpen((prev) => !prev)}
              className="gap-1.5 rounded-xl text-xs"
            >
              <SlidersHorizontal className="size-3.5" />
              <span>
                {isBn ? 'পাঠ্যক্রম ও সিস্টেম প্রম্পট' : 'Topic Context & System Prompt'}
              </span>
            </Button>
          </div>
        </header>

        {/* Collapsible Curriculum Context & Custom System Prompt Drawer */}
        {contextPanelOpen ? (
          <div className="border-b border-[var(--border)] bg-[var(--background)]/80 px-4 py-4">
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">
                    {isBn
                      ? 'পাঠ্যক্রম টপিক প্রসঙ্গ ও কাস্টম এআই টিউটর নির্দেশনা'
                      : 'Curriculum Topic Context & Custom AI Tutor Persona'}
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {isBn
                      ? 'নির্বাচিত টপিক ও কাস্টম নির্দেশনা সরাসরি এই আলোচনার সিস্টেম প্রম্পটে যুক্ত হয়।'
                      : 'Selected topic objectives and custom instructions are injected directly into the AI Tutor system prompt.'}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setContextPanelOpen(false)}
                  aria-label="Close context panel"
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* Cascading Subject -> Chapter -> Topic Context Selectors */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                    {isBn ? 'বিষয় (Subject)' : 'Subject'}
                  </label>
                  <select
                    aria-label="Curriculum Subject"
                    value={selectedSubjectId}
                    onChange={(e) => handleSelectSubject(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs"
                  >
                    <option value="">{isBn ? 'সব বিষয় / সাধারণ অধ্যয়ন' : 'All Subjects / General'}</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} — {isBn && sub.nameBn ? sub.nameBn : sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                    {isBn ? 'অধ্যায় (Chapter)' : 'Chapter'}
                  </label>
                  <select
                    aria-label="Curriculum Chapter"
                    value={selectedChapterId}
                    onChange={(e) => handleSelectChapter(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs"
                  >
                    <option value="">{isBn ? 'সব অধ্যায়' : 'All Chapters'}</option>
                    {filteredChapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        Ch {ch.chapterNumber}: {isBn && ch.titleBn ? ch.titleBn : ch.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                    {isBn ? 'টপিক প্রসঙ্গ (Topic)' : 'Curriculum Topic'}
                  </label>
                  <select
                    aria-label="Curriculum Topic Context"
                    value={selectedTopicId}
                    onChange={(e) => void handleSelectTopic(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs"
                  >
                    <option value="">{isBn ? 'সাধারণ একাডেমিক প্রশ্ন' : 'General Academic Inquiry'}</option>
                    {filteredTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {isBn && t.titleBn ? t.titleBn : t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Topic Syllabus Preview Card */}
              {activeTopic ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent" className="font-mono text-[10px]">
                      {activeTopic.code}
                    </Badge>
                    <span className="font-semibold text-[var(--foreground)]">
                      {activeTopicDisplayName}
                    </span>
                    {activeChapter ? (
                      <span className="text-[var(--muted-foreground)]">
                        · Ch {activeChapter.chapterNumber}: {activeChapter.title}
                      </span>
                    ) : null}
                  </div>
                  {activeTopic.keyConcepts && activeTopic.keyConcepts.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {activeTopic.keyConcepts.map((concept) => (
                        <Badge key={concept} variant="secondary" className="text-[10px]">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Custom Tutor System Prompt & Persona Presets */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                    {isBn
                      ? 'কাস্টম টিউটর সিস্টেম প্রম্পট / শিক্ষাদান নির্দেশনা'
                      : 'Custom AI Tutor System Instructions / Teaching Persona'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TUTOR_PERSONA_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setCustomSystemPrompt(preset.prompt)}
                        className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      >
                        {isBn ? preset.labelBn : preset.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={customSystemPrompt}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  placeholder={
                    isBn
                      ? 'যেমন: আমাকে ধাপে ধাপে প্রশ্ন করে শেখাও এবং শেষে ২টি বোর্ড প্রশ্ন দাও...'
                      : 'e.g., Act as a Socratic HSC Physics mentor. Derive every equation step by step and quiz me after each concept...'
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 text-xs leading-relaxed outline-none focus:border-[var(--primary)]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    {contextSavedBanner || ''}
                  </span>
                  <Button
                    size="sm"
                    disabled={savingContext}
                    onClick={() => void persistContextToActiveConversation()}
                    className="h-8 rounded-xl text-xs"
                  >
                    {savingContext
                      ? isBn
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : isBn
                        ? 'সেশনে প্রয়োগ করুন'
                        : 'Apply Context to Session'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Professional Status & Error Banner */}
        {apiError ? (
          <div
            role="alert"
            className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <div>
                <span className="font-semibold">
                  {apiError.status === 401
                    ? 'Authentication Required'
                    : apiError.status === 429
                      ? 'Rate / Daily Quota Limit'
                      : apiError.status === 503
                        ? 'Service Temporarily Unavailable'
                        : `Request Notice (${apiError.status})`}
                  :{' '}
                </span>
                <span>{apiError.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {apiError.status === 401 ? (
                <Link href="/login">
                  <Button size="sm" className="h-7 text-xs">
                    Sign In
                  </Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => void loadWorkspace()}
                >
                  <RefreshCw className="size-3" />
                  Retry
                </Button>
              )}
              <button
                type="button"
                aria-label="Dismiss notice"
                onClick={() => setApiError(null)}
                className="p-1 opacity-70 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Centered ChatGPT / Gemini Message Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {loadingMessages ? (
              <div className="space-y-4 py-8">
                {[1, 2].map((n) => (
                  <div key={n} className="h-24 animate-pulse rounded-2xl bg-[var(--muted)]/60" />
                ))}
              </div>
            ) : messages.length === 0 && streamingContent === null ? (
              /* ChatGPT / Gemini Centered Welcome Screen */
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--primary)]/15 text-[var(--primary)] shadow-xs">
                  <Sparkles className="size-7" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {isBn
                    ? 'আজ কোন বিষয়টি শিখতে চান?'
                    : 'What would you like to master today?'}
                </h2>
                <p className="mt-2 max-w-lg text-sm text-[var(--muted-foreground)]">
                  {isBn
                    ? 'পাঠ্যক্রমভিত্তিক ধাপে ধাপে ব্যাখ্যা, গাণিতিক সমাধান এবং পরীক্ষার প্রস্তুতির জন্য আপনার ব্যক্তিগত এআই টিউটর।'
                    : 'Curriculum-grounded explanations, step-by-step derivations, and personalized academic guidance.'}
                </p>

                {/* Active Topic Pill */}
                <button
                  type="button"
                  onClick={() => setContextPanelOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)]"
                >
                  <BookOpen className="size-3.5 text-[var(--primary)]" />
                  <span>
                    {activeSubject ? `${activeSubject.name} · ` : ''}
                    {activeTopicDisplayName}
                  </span>
                  <span className="text-[var(--primary)] underline-offset-2 hover:underline">
                    {isBn ? 'পরিবর্তন' : 'Change'}
                  </span>
                </button>

                {/* 4 Topic-Aware Starter Cards */}
                <div className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
                  {starterPrompts.map((starter, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={sending}
                      onClick={() => void sendQuestionText(starter.prompt)}
                      className="group rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 p-4 transition-all hover:border-[var(--primary)]/60 hover:bg-[var(--accent)]/30"
                    >
                      <p className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">
                        {isBn ? starter.titleBn : starter.titleEn}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                        {starter.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Active Message Stream */
              <>
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[82%] rounded-3xl rounded-br-md bg-[var(--secondary)] px-5 py-3 text-[15px] leading-relaxed text-[var(--secondary-foreground)] shadow-2xs">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex items-start gap-3.5">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]">
                        <Sparkles className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                          <span className="font-semibold text-[var(--foreground)]">
                            LearnMate AI Tutor
                          </span>
                          {msg.modelId ? (
                            <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 font-mono text-[10px]">
                              {msg.modelId}
                            </span>
                          ) : null}
                        </div>

                        <MarkdownRenderer content={msg.content} />

                        {msg.sourceReferences && msg.sourceReferences.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                              {isBn ? 'পাঠ্যক্রম সূত্র:' : 'Syllabus References:'}
                            </span>
                            {msg.sourceReferences.map((ref, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[11px]">
                                {ref.title}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        {/* ChatGPT-Style Subtle Message Action Bar */}
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(msg)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="size-3.5 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Copied
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label="Helpful"
                            onClick={() => void handleRateMessage(msg.id, 'helpful')}
                            className={cn(
                              'rounded-lg p-1.5 transition-colors hover:bg-[var(--muted)]',
                              msg.feedbackRating === 'helpful'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-[var(--muted-foreground)]',
                            )}
                          >
                            <ThumbsUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Unhelpful"
                            onClick={() => void handleRateMessage(msg.id, 'unhelpful')}
                            className={cn(
                              'rounded-lg p-1.5 transition-colors hover:bg-[var(--muted)]',
                              msg.feedbackRating === 'unhelpful'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-[var(--muted-foreground)]',
                            )}
                          >
                            <ThumbsDown className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Flag response"
                            onClick={() => void handleRateMessage(msg.id, 'flagged')}
                            className={cn(
                              'rounded-lg p-1.5 transition-colors hover:bg-[var(--muted)]',
                              msg.feedbackRating === 'flagged'
                                ? 'text-red-500'
                                : 'text-[var(--muted-foreground)]',
                            )}
                          >
                            <Flag className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )}

                {/* Live Streaming / Thinking Assistant Bubble */}
                {streamingContent !== null ? (
                  <div className="flex items-start gap-3.5">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]">
                      <Sparkles className="size-4 animate-pulse" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        LearnMate AI Tutor
                      </span>
                      {streamingContent ? (
                        <MarkdownRenderer content={streamingContent} />
                      ) : (
                        <div className="flex items-center gap-1.5 py-2">
                          <span className="size-2 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:-0.3s]" />
                          <span className="size-2 animate-bounce rounded-full bg-[var(--primary)] [animation-delay:-0.15s]" />
                          <span className="size-2 animate-bounce rounded-full bg-[var(--primary)]" />
                          <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                            {isBn ? 'উত্তর তৈরি হচ্ছে...' : 'Thinking...'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Sticky Bottom ChatGPT-Style Pill Composer */}
        <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:px-6">
          <form onSubmit={(e) => void handleFormSubmit(e)} className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-xs transition-colors focus-within:border-[var(--primary)]">
              <textarea
                ref={textareaRef}
                rows={2}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                disabled={sending}
                placeholder={
                  isBn
                    ? `${activeTopicDisplayName} সম্পর্কে যেকোনো প্রশ্ন লিখুন... (Enter পাঠাতে, Shift+Enter নতুন লাইন)`
                    : `Ask LearnMate AI Tutor about ${activeTopicDisplayName}... (Enter to send, Shift+Enter for new line)`
                }
                className="max-h-40 w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label="Pedagogical Style"
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value)}
                    className="h-7 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-[11px] font-medium"
                  >
                    {TUTOR_STYLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isBn ? opt.labelBn : opt.labelEn}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Explanation Depth"
                    value={depth}
                    onChange={(e) => setDepth(e.target.value as ExplanationDepth)}
                    className="h-7 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-[11px] font-medium"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>

                  <select
                    aria-label="Response Language"
                    value={chatLanguage}
                    onChange={(e) => setChatLanguage(e.target.value as SupportedLanguage)}
                    className="h-7 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-[11px] font-medium"
                  >
                    <option value="en">EN</option>
                    <option value="bn">বাংলা</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  size="icon"
                  disabled={sending || !promptInput.trim()}
                  aria-label="Send message"
                  className="size-8 rounded-xl"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-[var(--muted-foreground)]">
              {isBn
                ? 'এআই-উৎপন্ন শিক্ষাগত নির্দেশনা · গুরুত্বপূর্ণ বোর্ড ও পরীক্ষার নীতিমালা মূল পাঠ্যবই থেকে যাচাই করুন।'
                : 'AI-generated educational guidance · Verify critical exam formulas and official board rules.'}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
