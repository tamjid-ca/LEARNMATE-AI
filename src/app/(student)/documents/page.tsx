'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
import type {
  DocumentFormat,
  DocumentProcessingStatus,
  SupportedLanguage,
} from '@/types/domain';

interface TopicOption {
  id: string;
  code: string;
  title: string;
  titleBn?: string;
}

interface UploadedDocItem {
  id: string;
  title: string;
  originalFilename: string;
  format: DocumentFormat;
  mimeType: string;
  byteSize: number;
  processingStatus: DocumentProcessingStatus;
  extractionStatus: 'pending' | 'completed' | 'failed';
  chunkingStatus: 'pending' | 'completed' | 'failed';
  pageCount?: number;
  chunkCount: number;
  createdAt: string;
}

interface ChunkCitationItem {
  chunkId: string;
  chunkIndex: number;
  pageNumber: number;
  sectionHeading?: string;
  score: number;
  excerpt: string;
}

export default function StudentDocumentsPage() {
  const { language: uiLanguage } = useUIPreferences();
  const isBn = uiLanguage === 'bn';

  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [documents, setDocuments] = useState<UploadedDocItem[]>([]);
  const [retrievalMode, setRetrievalMode] = useState<'keyword' | 'vector_hybrid'>('keyword');
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Upload form state
  const [docTitle, setDocTitle] = useState<string>('');
  const [filename, setFilename] = useState<string>('hsc-physics-notes.txt');
  const [mimeType, setMimeType] = useState<
    | 'text/plain'
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  >('text/plain');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [rawContent, setRawContent] = useState<string>('');

  // Grounded Q&A & Derivative generation state
  const [qaQuestion, setQaQuestion] = useState<string>('');
  const [qaLanguage, setQaLanguage] = useState<SupportedLanguage>('en');
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<ChunkCitationItem[]>([]);
  const [generatedSummaryText, setGeneratedSummaryText] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDocumentsAndTopics = useCallback(async () => {
    try {
      const [docRes, currRes] = await Promise.all([
        fetch('/api/v1/documents'),
        fetch('/api/v1/curriculum?limit=40'),
      ]);

      if (docRes.ok) {
        const docJson = await docRes.json();
        const docList: UploadedDocItem[] = docJson.data?.documents ?? [];
        setDocuments(docList);
        if (docJson.data?.retrievalMode) {
          setRetrievalMode(docJson.data.retrievalMode);
        }
        if (docList.length > 0 && !selectedDocId) {
          setSelectedDocId(docList[0]!.id);
        }
      }

      if (currRes.ok) {
        const currJson = await currRes.json();
        const topicList: TopicOption[] = currJson.data?.topics ?? [];
        setTopics(topicList);
        if (topicList.length > 0 && !selectedTopicId) {
          setSelectedTopicId(topicList[0]!.id);
        }
      }
    } catch {
      // Non-fatal load error
    }
  }, [selectedDocId, selectedTopicId]);

  useEffect(() => {
    void loadDocumentsAndTopics();
  }, [loadDocumentsAndTopics]);

  const handleFilePickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    if (!docTitle.trim()) {
      setDocTitle(file.name.replace(/\.[^.]+$/, ''));
    }

    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) {
      setMimeType('application/pdf');
    } else if (lower.endsWith('.docx')) {
      setMimeType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    } else {
      setMimeType('text/plain');
    }

    const text = await file.text();
    setRawContent(text);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawContent.trim()) {
      setErrorMessage('Please select a file or paste document content to index.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const byteSize = new TextEncoder().encode(rawContent).length;
      const res = await fetch('/api/v1/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle.trim() || filename,
          originalFilename: filename,
          mimeType,
          byteSize,
          rawContent,
          ...(selectedTopicId ? { topicId: selectedTopicId } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Document upload failed');
        return;
      }

      const uploaded: UploadedDocItem = json.data.document;
      setSelectedDocId(uploaded.id);
      setDocTitle('');
      setRawContent('');
      await loadDocumentsAndTopics();
    } catch {
      setErrorMessage('Network error during document upload');
    } finally {
      setLoading(false);
    }
  };

  const handleAskDocumentQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !qaQuestion.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setGeneratedSummaryText(null);

    try {
      const res = await fetch(`/api/v1/documents/${selectedDocId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'qa',
          question: qaQuestion.trim(),
          language: qaLanguage,
          topK: 4,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || 'Document Q&A failed');
        return;
      }

      setQaAnswer(json.data.answer);
      setCitations(json.data.citations ?? []);
    } catch {
      setErrorMessage('Network error during document Q&A');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDerivative = async (
    target: 'summary' | 'notes' | 'quiz' | 'flashcards',
  ) => {
    if (!selectedDocId) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/documents/${selectedDocId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          target,
          language: qaLanguage,
          itemCount: 4,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || `Failed to generate ${target}`);
        return;
      }

      setCitations(json.data.citations ?? []);
      if (json.data.material) {
        setGeneratedSummaryText(
          `Saved "${json.data.material.title}" to your Study Materials Library.\n\n${json.data.material.contentMarkdown}`,
        );
      } else if (json.data.quiz) {
        setGeneratedSummaryText(
          `Created Quiz "${json.data.quiz.title}" (${json.data.questions?.length ?? 0} questions) in your Quizzes Arena.`,
        );
      } else if (json.data.deck) {
        setGeneratedSummaryText(
          `Created Flashcard Deck "${json.data.deck.title}" (${json.data.cards?.length ?? 0} cards) in your Flashcards Arena.`,
        );
      }
    } catch {
      setErrorMessage('Network error generating derivative study material');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedDocId === docId) {
          setSelectedDocId('');
          setQaAnswer(null);
          setCitations([]);
        }
        await loadDocumentsAndTopics();
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isBn
              ? 'ডকুমেন্ট আপলোড এবং গ্রাউন্ডেড RAG প্রশ্নোত্তর'
              : 'Document Upload & Grounded RAG Knowledge Base'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBn
              ? 'PDF, TXT বা DOCX হ্যান্ডনোট আপলোড করুন, পৃষ্ঠা-ভিত্তিক সাইটেশনসহ প্রশ্ন করুন এবং নোট/কুইজ/ফ্ল্যাশকার্ড তৈরি করুন।'
              : 'Upload PDF, TXT, or DOCX study materials, run citation-backed RAG Q&A, and generate notes, quizzes, or flashcards.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="accent">FR-DOC-001..011</Badge>
          <Badge variant="secondary">
            {retrievalMode === 'vector_hybrid'
              ? 'Vector + Keyword Hybrid RAG'
              : 'Keyword RAG Active (No Vector Config)'}
          </Badge>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Upload & Document Library */}
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isBn ? 'নতুন ডকুমেন্ট আপলোড ও ইনডেক্স করুন' : 'Upload & Index Study Document'}
              </CardTitle>
              <CardDescription>
                {isBn
                  ? 'অনুমোদিত ফরম্যাট: PDF, TXT, DOCX (সর্বোচ্চ ১৫ মেগাবাইট — FR-DOC-002..006)'
                  : 'Supported formats: PDF, TXT, DOCX up to 15 MB (FR-DOC-002..006)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUploadDocument} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {isBn ? 'ফাইল নির্বাচন করুন (.pdf, .txt, .docx)' : 'Select File (.pdf, .txt, .docx)'}
                  </label>
                  <Input
                    type="file"
                    accept=".pdf,.txt,.docx"
                    onChange={(e) => void handleFilePickerChange(e)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'ডকুমেন্ট শিরোনাম' : 'Document Title'}
                    </label>
                    <Input
                      required
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="e.g., HSC Physics Lecture Sheet"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {isBn ? 'ফাইল ফরম্যাট' : 'Format'}
                    </label>
                    <select
                      aria-label="Document Format"
                      value={mimeType}
                      onChange={(e) => {
                        const val = e.target.value as typeof mimeType;
                        setMimeType(val);
                        if (val === 'application/pdf') {
                          setFilename(filename.replace(/\.[^.]+$/, '.pdf'));
                        } else if (val === 'text/plain') {
                          setFilename(filename.replace(/\.[^.]+$/, '.txt'));
                        } else {
                          setFilename(filename.replace(/\.[^.]+$/, '.docx'));
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="text/plain">TXT (text/plain)</option>
                      <option value="application/pdf">PDF (application/pdf)</option>
                      <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                        DOCX (Word XML)
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {isBn ? 'সিলেবাস টপিক ট্যাগ' : 'Link to Syllabus Topic (Optional)'}
                  </label>
                  <select
                    aria-label="Syllabus Topic"
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{isBn ? 'সাধারণ ডকুমেন্ট' : 'General Study Document'}</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {isBn && t.titleBn ? t.titleBn : t.title} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium">
                    {isBn
                      ? 'ডকুমেন্ট টেক্সট / এক্সট্রাক্টেড কন্টেন্ট ([Page 1] মার্কার সমর্থিত)'
                      : 'Document Text / Extracted Content (supports [Page N] markers)'}
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="[Page 1] # 1. Newton's Laws of Motion&#10;An object at rest stays at rest unless acted upon by a net external force F = ma..."
                    className="w-full rounded-md border border-input bg-background p-3 text-xs"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? isBn
                      ? 'এক্সট্রাকশন ও চাঙ্কিং চলছে...'
                      : 'Extracting & Indexing Chunks...'
                    : isBn
                      ? 'ডকুমেন্ট আপলোড এবং ইনডেক্স করুন'
                      : 'Upload, Extract & Index Document'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Private Document Collection List (FR-DOC-004, FR-DOC-010, FR-DOC-011) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isBn ? 'আপনার ব্যক্তিগত ডকুমেন্ট সংগ্রহশালা' : 'Your Private Document Collection'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'এখনও কোনো ডকুমেন্ট আপলোড করা হয়নি।'
                    : 'No uploaded documents yet. Upload a PDF, TXT, or DOCX above.'}
                </p>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-xs ${
                      selectedDocId === doc.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className="text-left"
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span>{doc.title}</span>
                        <Badge variant="outline">{doc.format.toUpperCase()}</Badge>
                        <Badge
                          variant={
                            doc.processingStatus === 'ready' ? 'secondary' : 'destructive'
                          }
                        >
                          {doc.processingStatus}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">
                        {doc.pageCount ?? 1} page(s) · {doc.chunkCount} indexed chunks ·{' '}
                        {Math.max(1, Math.round(doc.byteSize / 1024))} KB
                      </p>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDeleteDocument(doc.id)}
                    >
                      {isBn ? 'মুছুন' : 'Delete'}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Grounded RAG Q&A, Citations & One-Click Derivative Generation */}
        <div className="space-y-6 lg:col-span-7">
          {!selectedDoc ? (
            <Card>
              <CardContent className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
                <Badge variant="secondary" className="mb-2">
                  Prompt-Injection Sandboxed RAG
                </Badge>
                <h2 className="text-lg font-semibold">
                  {isBn
                    ? 'প্রশ্নোত্তর ও নোট তৈরির জন্য একটি ডকুমেন্ট নির্বাচন করুন'
                    : 'Select or upload a document to start Grounded RAG Q&A'}
                </h2>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  {isBn
                    ? 'আপলোডকৃত ডকুমেন্টের প্রতিটি চাঙ্ক <untrusted_document_chunk> স্যান্ডবক্সে রাখা হয় এবং পৃষ্ঠা নম্বরসহ উত্তর প্রদান করা হয়।'
                    : 'All retrieved passages are wrapped in <untrusted_document_chunk> tags with page and section citations.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{selectedDoc.title}</CardTitle>
                      <CardDescription>
                        {selectedDoc.originalFilename} · {selectedDoc.chunkCount} chunks ·
                        Status: {selectedDoc.processingStatus}
                      </CardDescription>
                    </div>
                    <select
                      aria-label="Response Language"
                      value={qaLanguage}
                      onChange={(e) => setQaLanguage(e.target.value as SupportedLanguage)}
                      className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                    >
                      <option value="en">English</option>
                      <option value="bn">বাংলা</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* One-click Derivative Generators (FR-DOC-008) */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {isBn
                        ? 'এই ডকুমেন্ট থেকে এক-ক্লিকে তৈরি করুন (FR-DOC-008):'
                        : 'Generate directly from this document (FR-DOC-008):'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void handleGenerateDerivative('summary')}
                      >
                        {isBn ? 'সারসংক্ষেপ' : 'Summary'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void handleGenerateDerivative('notes')}
                      >
                        {isBn ? 'বিস্তারিত নোট' : 'Study Notes'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void handleGenerateDerivative('quiz')}
                      >
                        {isBn ? 'অনুশীলন কুইজ' : 'Practice Quiz'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void handleGenerateDerivative('flashcards')}
                      >
                        {isBn ? 'ফ্ল্যাশকার্ড ডেক' : 'Flashcards'}
                      </Button>
                    </div>
                  </div>

                  {/* Grounded Document Q&A Form (FR-DOC-007) */}
                  <form
                    onSubmit={handleAskDocumentQuestion}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <Input
                      required
                      value={qaQuestion}
                      onChange={(e) => setQaQuestion(e.target.value)}
                      placeholder={
                        isBn
                          ? 'এই ডকুমেন্টের তথ্য থেকে যেকোনো প্রশ্ন করুন...'
                          : 'Ask a question grounded in this uploaded document...'
                      }
                      className="flex-1"
                    />
                    <Button type="submit" disabled={loading}>
                      {isBn ? 'উত্তর খুঁজুন' : 'Ask Document'}
                    </Button>
                  </form>

                  {qaAnswer ? (
                    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge variant="accent">Grounded RAG Answer</Badge>
                        <span className="text-xs text-muted-foreground">
                          Mode: {retrievalMode}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{qaAnswer}</p>
                    </div>
                  ) : null}

                  {generatedSummaryText ? (
                    <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs whitespace-pre-wrap">
                      {generatedSummaryText}
                    </div>
                  ) : null}

                  {/* Source Page & Chunk Citations (FR-DOC-009) */}
                  {citations.length > 0 ? (
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-semibold">
                        {isBn
                          ? 'ডকুমেন্ট সোর্স সাইটেশন (পৃষ্ঠা ও অনুচ্ছেদ — FR-DOC-009):'
                          : 'Retrieved Source Citations (Page & Section — FR-DOC-009):'}
                      </p>
                      <div className="space-y-2">
                        {citations.map((cit) => (
                          <div
                            key={cit.chunkId}
                            className="rounded-md border border-border p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between font-medium">
                              <span>
                                Page {cit.pageNumber} · Chunk #{cit.chunkIndex + 1}
                                {cit.sectionHeading ? ` · ${cit.sectionHeading}` : ''}
                              </span>
                              <Badge variant="outline">Score: {cit.score}</Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground">{cit.excerpt}...</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
