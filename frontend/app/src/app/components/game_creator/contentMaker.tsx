import { CircleArrowLeft } from 'lucide-react';
import { Accordion } from '../ui/accordion';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useToast } from '../ui/toastProvider';
import type { Content, ContentCategory, ContentPack } from '../../api/models';
import { buildPreviewFields, contentMakerDefaults, formatSystemIdPreview } from './content_maker/schema';
import { useContentMakerForm } from './content_maker/useContentMakerForm';
import { IdentitySection } from './content_maker/sections/IdentitySection';
import { PreviewSection } from './content_maker/sections/PreviewSection';
import { SheetTemplateSectionEditor } from './content_maker/sections/SheetTemplateSectionEditor';
import {
  CustomSectionsSection,
  MechanicsSection,
  NotesSection,
  RequirementsSection,
  ScalingSection,
  SystemTargetingSection,
  TraitsSection,
} from './content_maker/sections/TtrpgSections';

type Props = {
  pack: ContentPack;
  category: ContentCategory;
  content?: Content;
  onCreated?: () => Promise<void> | void;
  onCancel?: () => void;
};

export function ContentMaker({ pack, category, content, onCreated, onCancel }: Props) {
  const { toastPromise } = useToast();
  const {
    form,
    setForm,
    error,
    isLoadingVersion,
    isEditing,
    updateArrayItem,
    removeArrayItem,
    moveArrayItem,
    handleSubmit,
  } = useContentMakerForm({
    pack,
    category,
    content,
    onCreated,
    toastPromise,
  });

  const isSheetTemplate = form.content_type === 'character_sheet_template';
  const preview = buildPreviewFields(form);
  const systemIdPreview = formatSystemIdPreview(form);
  const defaultOpenSections = isSheetTemplate
    ? ['identity', 'sheet-sections', 'notes', 'preview']
    : ['identity', 'system-targeting', 'traits', 'requirements', 'custom-sections', 'mechanics', 'scaling', 'notes', 'preview'];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{isEditing ? 'Edit content' : `Create content in ${category.name}`}</h2>
            <p className="text-sm text-muted-foreground">
              Define the rules document for {pack.pack_name}.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onCancel} className="min-h-[44px] w-full sm:w-auto">
            <CircleArrowLeft className="h-4 w-4 shrink-0" />
            Back to Categories
          </Button>
        </div>
        <Separator />

        {isLoadingVersion ? (
          <p className="text-sm text-muted-foreground">Loading content...</p>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Accordion key={form.content_type} type="multiple" defaultValue={defaultOpenSections} className="space-y-4">
              <IdentitySection form={form} setForm={setForm} systemIdPreview={systemIdPreview} />

              {isSheetTemplate ? (
                <SheetTemplateSectionEditor
                  form={form}
                  setForm={setForm}
                  defaultSheetSection={contentMakerDefaults.defaultSheetSection}
                  defaultSheetField={contentMakerDefaults.defaultSheetField}
                />
              ) : (
                <>
                  <SystemTargetingSection form={form} setForm={setForm} />
                  <TraitsSection
                    form={form}
                    setForm={setForm}
                    updateArrayItem={updateArrayItem}
                    removeArrayItem={removeArrayItem}
                    moveArrayItem={moveArrayItem}
                    emptyTrait={contentMakerDefaults.emptyTrait}
                  />
                  <RequirementsSection
                    form={form}
                    setForm={setForm}
                    updateArrayItem={updateArrayItem}
                    removeArrayItem={removeArrayItem}
                    emptyRequirement={contentMakerDefaults.emptyRequirement}
                  />
                  <CustomSectionsSection
                    form={form}
                    setForm={setForm}
                    updateArrayItem={updateArrayItem}
                    removeArrayItem={removeArrayItem}
                    moveArrayItem={moveArrayItem}
                    emptySection={contentMakerDefaults.emptyContentSection}
                    emptyEntry={contentMakerDefaults.emptyContentSectionEntry}
                  />
                  <MechanicsSection
                    form={form}
                    setForm={setForm}
                    updateArrayItem={updateArrayItem}
                    removeArrayItem={removeArrayItem}
                    emptyMechanic={contentMakerDefaults.emptyMechanic}
                  />
                  <ScalingSection
                    form={form}
                    setForm={setForm}
                    updateArrayItem={updateArrayItem}
                    removeArrayItem={removeArrayItem}
                    emptyScaling={contentMakerDefaults.emptyScaling}
                  />
                </>
              )}

              <NotesSection
                form={form}
                setForm={setForm}
                updateArrayItem={updateArrayItem}
                removeArrayItem={removeArrayItem}
                emptyNote={contentMakerDefaults.emptyNote}
              />

              <PreviewSection
                fields={preview.fields}
                error={preview.error}
                contentName={form.name.trim() || undefined}
                summary={form.summary.trim() || null}
              />
            </Accordion>

            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                {isEditing ? 'Save Content' : 'Create Content'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
