import type { ContentFields } from '../../../../types/contentFields';
import { ContentRender } from '../../../content/ContentRender';
import { EditorSection } from '../shared';

export function PreviewSection({
  fields,
  error,
  contentName,
  summary,
}: {
  fields?: ContentFields;
  error?: string;
  contentName?: string;
  summary?: string | null;
}) {
  return (
    <EditorSection
      value="preview"
      title="Preview"
      description="Review how this content will appear when rendered from its structured fields."
    >
      {fields ? (
        <ContentRender
          fields={fields}
          contentName={contentName}
          summary={summary}
          mode="full"
          visibility="gm"
        />
      ) : (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </EditorSection>
  );
}
