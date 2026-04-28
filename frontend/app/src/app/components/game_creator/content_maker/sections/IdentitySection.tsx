import type React from 'react';
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { Textarea } from '../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import type { ContentType } from '../../../../types/contentFields';
import type { ContentFormState } from '../editorTypes';
import { EditorSection } from '../shared';

const contentTypeOptions: Array<{ value: ContentType; label: string }> = [
  { value: 'spell', label: 'Spell' },
  { value: 'item', label: 'Item' },
  { value: 'rule', label: 'Rule' },
  { value: 'class', label: 'Class' },
  { value: 'creature', label: 'Creature' },
  { value: 'monster', label: 'Monster' },
  { value: 'ability', label: 'Ability' },
  { value: 'feat', label: 'Feat' },
  { value: 'condition', label: 'Condition' },
  { value: 'resource', label: 'Resource' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'encounter', label: 'Encounter' },
  { value: 'table', label: 'Table' },
  { value: 'character_sheet_template', label: 'Character Sheet Template' },
  { value: 'custom', label: 'Custom' },
];

export function IdentitySection({
  form,
  systemIdPreview,
  setForm,
}: {
  form: ContentFormState;
  systemIdPreview: string;
  setForm: React.Dispatch<React.SetStateAction<ContentFormState>>;
}) {
  return (
    <EditorSection
      value="identity"
      title="Identity"
      description="Name the content, choose the category, and review the generated system id."
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="content_name">Display Title</Label>
            <Input
              id="content_name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Frostbite Lance"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="content_type">Content Type</Label>
            <Select
              value={form.content_type}
              onValueChange={(value) => setForm((prev) => ({ ...prev, content_type: value as ContentType }))}
            >
              <SelectTrigger id="content_type">
                <SelectValue placeholder="Choose a content type" />
              </SelectTrigger>
              <SelectContent>
                {contentTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="content_subtitle">Display Subtitle</Label>
            <Input
              id="content_subtitle"
              value={form.subtitle}
              onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))}
              placeholder="A shard of killing winter"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="content_tags">Tags</Label>
            <Input
              id="content_tags"
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="cold, ice, attack"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="content_system_id">System ID</Label>
            <Input id="content_system_id" value={systemIdPreview} readOnly className="bg-muted/40" />
            <p className="text-xs text-muted-foreground">
              This id is generated from the content type and title.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="system_version">System Version</Label>
            <Input
              id="system_version"
              value={form.system_version}
              onChange={(event) => setForm((prev) => ({ ...prev, system_version: event.target.value }))}
              placeholder="0.3"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="content_summary">Summary</Label>
          <Textarea
            id="content_summary"
            value={form.summary}
            onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            placeholder="Short list text for this content."
          />
        </div>
      </div>
    </EditorSection>
  );
}
