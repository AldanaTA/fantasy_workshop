import { useEffect, useState, type FormEvent } from 'react';
import type { Content, ContentCategory, ContentPack } from '../../../api/models';
import { contentApi, invalidateContentCategoryCaches } from '../../../api/contentApi';
import type { CharacterSheetTemplateFieldsV1, ContentFields, TtrpgContentFieldsV1 } from '../../../types/contentFields';
import { isCharacterSheetTemplateFieldsV1, isTtrpgContentFieldsV1 } from '../../../types/contentFields';
import type { ContentFormState } from './editorTypes';
import { buildFields, emptyContentForm, formFromContentFields } from './schema';

type UseContentMakerFormArgs = {
  pack: ContentPack;
  category: ContentCategory;
  content?: Content;
  onCreated?: () => Promise<void> | void;
  toastPromise: <T>(promise: Promise<T>, messages: {
    loading: string;
    success: string;
    error: (error: unknown) => string;
  }) => Promise<T>;
};

export function useContentMakerForm({
  pack,
  category,
  content,
  onCreated,
  toastPromise,
}: UseContentMakerFormArgs) {
  const [form, setForm] = useState<ContentFormState>(() => emptyContentForm());
  const [error, setError] = useState<string | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(Boolean(content));
  const isEditing = Boolean(content);

  useEffect(() => {
    let isCancelled = false;

    const loadExistingContent = async () => {
      if (!content) {
        setForm(emptyContentForm());
        setIsLoadingVersion(false);
        return;
      }

      setIsLoadingVersion(true);
      setError(null);

      try {
        let fields: ContentFields | undefined;

        try {
          const activeVersion = await contentApi.getActive(content.id);
          fields = isTtrpgContentFieldsV1(activeVersion.fields) || isCharacterSheetTemplateFieldsV1(activeVersion.fields)
            ? activeVersion.fields
            : undefined;
        } catch {
          const versions = await contentApi.listVersions(content.id);
          const latestVersion = versions.sort((a, b) => b.version_num - a.version_num)[0];
          fields = latestVersion && (isTtrpgContentFieldsV1(latestVersion.fields) || isCharacterSheetTemplateFieldsV1(latestVersion.fields))
            ? latestVersion.fields
            : undefined;
        }

        if (!isCancelled) {
          setForm(formFromContentFields(content, fields));
        }
      } catch (err) {
        if (!isCancelled) {
          setForm(formFromContentFields(content));
          setError((err as Error)?.message || 'Unable to load content fields.');
        }
      } finally {
        if (!isCancelled) setIsLoadingVersion(false);
      }
    };

    void loadExistingContent();

    return () => {
      isCancelled = true;
    };
  }, [content?.id]);

  const updateArrayItem = <T,>(
    key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'sections' | 'notes',
    index: number,
    patch: Partial<T>,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: (prev[key] as T[]).map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  };

  const removeArrayItem = (
    key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'sections' | 'notes',
    index: number,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const moveArrayItem = (
    key: 'traits' | 'requirements' | 'mechanics' | 'scaling' | 'sections' | 'notes',
    index: number,
    direction: 'up' | 'down',
  ) => {
    setForm((prev) => {
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      const nextItems = [...prev[key]];
      if (nextIndex < 0 || nextIndex >= nextItems.length) return prev;
      [nextItems[index], nextItems[nextIndex]] = [nextItems[nextIndex], nextItems[index]];
      return { ...prev, [key]: nextItems };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('A content name is required.');
      return;
    }

    setError(null);

    try {
      const fields = buildFields(form) as TtrpgContentFieldsV1 | CharacterSheetTemplateFieldsV1;
      await toastPromise((async () => {
        const savedContent = content
          ? await contentApi.patch(content.id, {
              name: form.name.trim(),
              summary: form.summary.trim() || null,
            })
          : await contentApi.create({
              pack_id: pack.id,
              category_id: category.id,
              name: form.name.trim(),
              summary: form.summary.trim() || null,
            });

        const createdVersion = await contentApi.createVersion(savedContent.id, { fields });
        await contentApi.upsertActive(savedContent.id, {
          content_id: savedContent.id,
          active_version_num: createdVersion.version_num,
          deleted_at: null,
        });

        invalidateContentCategoryCaches(category.id);

        return savedContent;
      })(), {
        loading: isEditing ? 'Saving content...' : 'Creating content...',
        success: isEditing ? 'Content saved successfully.' : 'Content created successfully.',
        error: (e) =>
          (e as any)?.response?.data?.detail ||
          (e as Error)?.message ||
          (isEditing ? 'Failed to save content.' : 'Failed to create content.'),
      });

      setForm(emptyContentForm());
      await onCreated?.();
    } catch (err) {
      setError((err as Error)?.message || (isEditing ? 'Failed to save content.' : 'Failed to create content.'));
    }
  };

  return {
    form,
    setForm,
    error,
    setError,
    isLoadingVersion,
    isEditing,
    updateArrayItem,
    removeArrayItem,
    moveArrayItem,
    handleSubmit,
  };
}
