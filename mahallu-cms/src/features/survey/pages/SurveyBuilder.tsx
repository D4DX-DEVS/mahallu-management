import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiEye, FiPlus, FiSave, FiSend, FiTrash2, FiX, FiAlertTriangle } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Tabs from '@/components/ui/Tabs';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import { surveyFormService, SurveyBuilderData } from '@/services/surveyFormService';
import { toast } from '@/store/toastStore';
import { errorMessage, isConflict, loadErrorMessage } from '@/utils/errors';
import {
  SurveyField,
  SurveyFieldType,
  SurveyFormContent,
  SurveyPage,
  maxIds,
  normalizeFormContent,
} from '../formEngine';
import { dropFieldReferences, moveItem, newField, referencesTo } from '../builderOps';
import FieldEditorCard from '../components/FieldEditorCard';
import AddFieldDialog from '../components/AddFieldDialog';
import FormPreviewModal from '../components/FormPreviewModal';

/**
 * The form builder. The whole draft lives in this page's state and is saved in one request; the
 * server refuses a save made against an older revision, so two admins never overwrite each other.
 * Publishing freezes what is saved as a new version for survey workers.
 */
export default function SurveyBuilder() {
  const { id = '' } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<SurveyBuilderData | null>(null);
  const [content, setContent] = useState<SurveyFormContent>({ pages: [], instructions: [] });
  const [nextIds, setNextIds] = useState({ field: 1, page: 1 });
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ pageId: number; afterIndex: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteField, setDeleteField] = useState<{ pageId: number; field: SurveyField } | null>(null);
  const [deletePage, setDeletePage] = useState<SurveyPage | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const hydrate = useCallback((data: SurveyBuilderData) => {
    const draft = normalizeFormContent(data.draft);
    const used = maxIds(draft);
    setSurvey(data);
    setContent(draft);
    setNextIds({ field: Math.max(data.nextFieldId, used.field + 1), page: Math.max(data.nextPageId, used.page + 1) });
    setActivePageId((current) => (current && draft.pages.some((p) => p.id === current) ? current : draft.pages[0]?.id ?? null));
    setDirty(false);
  }, []);

  const load = useCallback(() => {
    setLoadError(null);
    surveyFormService
      .getBuilder(id)
      .then(hydrate)
      .catch((err) => setLoadError(loadErrorMessage(err, 'form builder')));
  }, [id, hydrate]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const apply = (updater: (prev: SurveyFormContent) => SurveyFormContent) => {
    setContent(updater);
    setDirty(true);
    setProblems([]);
  };

  const updatePage = (pageId: number, patch: Partial<SurveyPage>) =>
    apply((prev) => ({ ...prev, pages: prev.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) }));

  const updateField = (pageId: number, field: SurveyField) =>
    apply((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => (p.id === pageId ? { ...p, fields: p.fields.map((f) => (f.id === field.id ? field : f)) } : p)),
    }));

  const save = async (): Promise<SurveyBuilderData | null> => {
    if (!survey) return null;
    try {
      setSaving(true);
      const data = await surveyFormService.saveBuilder(id, {
        draft: normalizeFormContent(content),
        revision: survey.revision,
        nextFieldId: nextIds.field,
        nextPageId: nextIds.page,
      });
      hydrate(data);
      setSavedAt(new Date());
      return data;
    } catch (err) {
      toast.error(isConflict(err) ? errorMessage(err) : errorMessage(err, { action: 'save the form' }));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (await save()) toast.success('Form saved');
  };

  const handlePublish = async () => {
    if (!survey) return;
    let current: SurveyBuilderData | null = survey;
    if (dirty) current = await save();
    if (!current) return;
    try {
      setPublishing(true);
      const result = await surveyFormService.publish(id, current.revision);
      hydrate(result.data);
      setProblems([]);
      toast.success(result.message || 'Form published');
    } catch (err) {
      const list = (err as { response?: { data?: { problems?: unknown } } })?.response?.data?.problems;
      if (Array.isArray(list) && list.length) {
        setProblems(list);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      toast.error(errorMessage(err, { action: 'publish the form' }));
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !saving) void handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addPage = () => {
    const pageId = nextIds.page;
    setNextIds((ids) => ({ ...ids, page: ids.page + 1 }));
    apply((prev) => ({ ...prev, pages: [...prev.pages, { id: pageId, title: `Page ${prev.pages.length + 1}`, fields: [] }] }));
    setActivePageId(pageId);
  };

  const addField = (type: SurveyFieldType) => {
    if (!adding) return;
    const field = newField(type, nextIds.field);
    setNextIds((ids) => ({ ...ids, field: ids.field + 1 }));
    apply((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== adding.pageId) return p;
        const fields = [...p.fields];
        fields.splice(adding.afterIndex + 1, 0, field);
        return { ...p, fields };
      }),
    }));
    setExpandedId(field.id);
    setAdding(null);
  };

  const duplicateField = (pageId: number, field: SurveyField) => {
    const copy: SurveyField = JSON.parse(JSON.stringify({ ...field, id: nextIds.field, label: `${field.label} (copy)` }));
    setNextIds((ids) => ({ ...ids, field: ids.field + 1 }));
    apply((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const at = p.fields.findIndex((f) => f.id === field.id);
        const fields = [...p.fields];
        fields.splice(at + 1, 0, copy);
        return { ...p, fields };
      }),
    }));
    setExpandedId(copy.id);
  };

  const moveFieldToPage = (fromPageId: number, field: SurveyField, toPageId: number) => {
    if (fromPageId === toPageId) return;
    apply((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id === fromPageId) return { ...p, fields: p.fields.filter((f) => f.id !== field.id) };
        if (p.id === toPageId) return { ...p, fields: [...p.fields, field] };
        return p;
      }),
    }));
    setActivePageId(toPageId);
  };

  const confirmDeleteField = () => {
    if (!deleteField) return;
    const { pageId, field } = deleteField;
    apply((prev) =>
      dropFieldReferences(
        { ...prev, pages: prev.pages.map((p) => (p.id === pageId ? { ...p, fields: p.fields.filter((f) => f.id !== field.id) } : p)) },
        field.id
      )
    );
    setDeleteField(null);
  };

  const confirmDeletePage = () => {
    if (!deletePage) return;
    const removed = deletePage.fields.map((f) => f.id);
    apply((prev) => {
      let next: SurveyFormContent = { ...prev, pages: prev.pages.filter((p) => p.id !== deletePage.id) };
      for (const fid of removed) next = dropFieldReferences(next, fid);
      return next;
    });
    setActivePageId(content.pages.find((p) => p.id !== deletePage.id)?.id ?? null);
    setDeletePage(null);
  };

  const pageIndex = content.pages.findIndex((p) => p.id === activePageId);
  const page = pageIndex >= 0 ? content.pages[pageIndex] : null;
  const pageList = useMemo(() => content.pages.map((p) => ({ id: p.id, title: p.title })), [content.pages]);
  const questionCount = content.pages.reduce((n, p) => n + p.fields.filter((f) => f.type !== 'heading').length, 0);

  if (loadError) {
    return <EmptyState variant="error" entity="form builder" description={loadError} action={{ label: 'Try again', onClick: load }} />;
  }
  if (!survey) return <PageSkeleton variant="section" />;

  const status =
    survey.publishedVersion === 0
      ? { tone: 'text-amber-700 dark:text-amber-400', text: "Not published yet. Survey workers can't see this survey until you publish it." }
      : survey.hasUnpublishedChanges
        ? { tone: 'text-amber-700 dark:text-amber-400', text: `Version ${survey.publishedVersion} is live. Your saved edits are not published yet.` }
        : { tone: 'text-muted-foreground', text: `Version ${survey.publishedVersion} is live.` };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Form builder"
        title={survey.title}
        description={`${content.pages.length} page${content.pages.length === 1 ? '' : 's'} · ${questionCount} question${questionCount === 1 ? '' : 's'}`}
        actions={
          <>
            <Link to={`/survey/${id}`}>
              <Button variant="ghost" icon={<FiArrowLeft />} collapseLabel>
                Survey
              </Button>
            </Link>
            <Button variant="outline" icon={<FiEye />} collapseLabel onClick={() => setPreviewOpen(true)}>
              Preview
            </Button>
          </>
        }
      />

      {problems.length > 0 && (
        <Card className="border-l-4 border-destructive">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Fix these before publishing</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setProblems([])}>
              <FiX />
            </Button>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Instructions</h2>
            <p className="text-xs text-muted-foreground">Shown to the surveyor before the form starts. Optional.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<FiPlus />}
            disabled={content.instructions.length >= 30}
            onClick={() => apply((prev) => ({ ...prev, instructions: [...prev.instructions, ''] }))}
          >
            Add point
          </Button>
        </div>
        {content.instructions.length > 0 && (
          <ol className="mt-3 space-y-2">
            {content.instructions.map((line, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <input
                  aria-label={`Instruction ${i + 1}`}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input/40 bg-card px-2 text-sm focus-visible:border-primary focus-visible:outline-none"
                  value={line}
                  maxLength={500}
                  placeholder="e.g. Keep the ration card ready"
                  onChange={(e) => apply((prev) => ({ ...prev, instructions: prev.instructions.map((l, j) => (j === i ? e.target.value : l)) }))}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove instruction"
                  onClick={() => apply((prev) => ({ ...prev, instructions: prev.instructions.filter((_, j) => j !== i) }))}
                >
                  <FiX />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Pages */}
      <div className="flex flex-wrap items-end gap-2 border-b border-border">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <Tabs
            ariaLabel="Form pages"
            value={activePageId ? String(activePageId) : ''}
            onChange={(v) => {
              setActivePageId(Number(v));
              setExpandedId(null);
            }}
            items={content.pages.map((p, i) => ({ value: String(p.id), label: `${i + 1}. ${p.title || 'Untitled'}`, count: p.fields.length }))}
          />
        </div>
        <Button variant="ghost" size="sm" icon={<FiPlus />} className="mb-1" onClick={addPage} disabled={content.pages.length >= 30}>
          Add page
        </Button>
      </div>

      {!page ? (
        <EmptyState title="No pages yet" description="A form is made of pages, and each page holds questions." action={{ label: 'Add first page', onClick: addPage }} />
      ) : (
        <div className="space-y-3">
          <Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <Input label="Page title" value={page.title} maxLength={300} onChange={(e) => updatePage(page.id, { title: e.target.value })} />
              <Input
                label="Page description"
                value={page.description || ''}
                placeholder="Optional"
                maxLength={1000}
                onChange={(e) => updatePage(page.id, { description: e.target.value || undefined })}
              />
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move page left"
                  disabled={pageIndex === 0}
                  onClick={() => apply((prev) => ({ ...prev, pages: moveItem(prev.pages, pageIndex, pageIndex - 1) }))}
                >
                  <FiArrowLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move page right"
                  disabled={pageIndex === content.pages.length - 1}
                  onClick={() => apply((prev) => ({ ...prev, pages: moveItem(prev.pages, pageIndex, pageIndex + 1) }))}
                >
                  <FiArrowRight />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete page" disabled={content.pages.length <= 1} onClick={() => setDeletePage(page)}>
                  <FiTrash2 />
                </Button>
              </div>
            </div>
          </Card>

          {page.fields.length === 0 ? (
            <EmptyState
              title="No questions on this page"
              description="Add the first question for this page."
              action={{ label: 'Add question', onClick: () => setAdding({ pageId: page.id, afterIndex: -1 }) }}
            />
          ) : (
            <div className="space-y-2">
              {page.fields.map((field, index) => (
                <FieldEditorCard
                  key={field.id}
                  field={field}
                  index={index}
                  count={page.fields.length}
                  content={content}
                  respondentType={survey.respondentType}
                  pages={pageList}
                  pageId={page.id}
                  expanded={expandedId === field.id}
                  onToggle={() => setExpandedId((cur) => (cur === field.id ? null : field.id))}
                  onChange={(next) => updateField(page.id, next)}
                  onMove={(dir) => updatePage(page.id, { fields: moveItem(page.fields, index, index + dir) })}
                  onMoveToPage={(to) => moveFieldToPage(page.id, field, to)}
                  onDuplicate={() => duplicateField(page.id, field)}
                  onDelete={() => setDeleteField({ pageId: page.id, field })}
                  onInsertAfter={() => setAdding({ pageId: page.id, afterIndex: index })}
                />
              ))}
              <Button variant="outline" icon={<FiPlus />} className="w-full" onClick={() => setAdding({ pageId: page.id, afterIndex: page.fields.length - 1 })}>
                Add question
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Sticky save bar */}
      <div className="sticky bottom-20 z-20 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur md:bottom-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs ${dirty ? 'font-medium text-amber-700 dark:text-amber-400' : status.tone}`}>
            {dirty ? 'You have unsaved changes.' : status.text}
            {!dirty && savedAt ? ` Saved at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" icon={<FiSave />} onClick={handleSave} disabled={!dirty || saving || publishing} isLoading={saving} loadingText="Saving">
              Save
            </Button>
            <Button
              icon={<FiSend />}
              onClick={handlePublish}
              disabled={saving || publishing || (!dirty && survey.publishedVersion > 0 && !survey.hasUnpublishedChanges)}
              isLoading={publishing}
              loadingText="Publishing"
            >
              {dirty ? 'Save and publish' : survey.publishedVersion > 0 ? 'Publish changes' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      <AddFieldDialog isOpen={adding !== null} onClose={() => setAdding(null)} onPick={addField} />
      <FormPreviewModal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title={survey.title} content={content} />
      <ConfirmDialog
        isOpen={deleteField !== null}
        title="Delete this question?"
        message={`"${deleteField?.field.label || 'Untitled'}" will be removed from the form when you save.`}
        consequence={
          deleteField
            ? [
                referencesTo(content, deleteField.field.id).length
                  ? `It is used by: ${referencesTo(content, deleteField.field.id).join(', ')}. Those links will be removed.`
                  : '',
                survey.publishedVersion > 0 ? 'Responses already submitted keep their answer to it.' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined
            : undefined
        }
        confirmLabel="Delete question"
        variant="danger"
        onConfirm={confirmDeleteField}
        onCancel={() => setDeleteField(null)}
      />
      <ConfirmDialog
        isOpen={deletePage !== null}
        title="Delete this page?"
        message={`"${deletePage?.title || 'Untitled'}" and its ${deletePage?.fields.length || 0} question(s) will be removed when you save.`}
        confirmLabel="Delete page"
        variant="danger"
        onConfirm={confirmDeletePage}
        onCancel={() => setDeletePage(null)}
      />
    </div>
  );
}
