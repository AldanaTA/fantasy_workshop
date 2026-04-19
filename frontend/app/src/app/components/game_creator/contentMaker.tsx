import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ContentCategory, ContentPack } from '../../api/models';
import { contentApi } from '../../api/contentApi';
import { useToast } from '../ui/toastProvider';

interface ContentFormState {
  name: string;
  summary: string;
}

const emptyContentForm: ContentFormState = {
  name: '',
  summary: '',
};

type Props = {
  pack: ContentPack;
  category: ContentCategory;
  onCreated?: () => Promise<void> | void;
};

export function ContentMaker({ pack, category, onCreated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ContentFormState>(emptyContentForm);
  const [error, setError] = useState<string | null>(null);
  const { toastPromise } = useToast();

  const closeDialog = () => {
    setIsOpen(false);
    setForm(emptyContentForm);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('A content name is required.');
      return;
    }

    setError(null);

    try {
      await toastPromise(contentApi.create({
        pack_id: pack.id,
        category_id: category.id,
        name: form.name.trim(),
        summary: form.summary.trim() || null,
      }), {
        loading: 'Creating content...',
        success: 'Content created successfully.',
        error: (e) =>
        (e as any)?.response?.data?.detail ||
        (e as Error)?.message ||
        'Failed to create content.',
      });

      closeDialog();
      await onCreated?.();
    } catch (err) {
    }
  };

  return (
    <>
      <div className="rounded-md border border-dashed border-border p-4">
        <Button variant="outline" onClick={() => setIsOpen(true)} className="w-full min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" />
          Add Content
        </Button>
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsOpen(true);
          } else {
            closeDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Content</DialogTitle>
            <DialogDescription>
              Add new content to {category.name}.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor={`content_name_${category.id}`}>Name</Label>
              <Input
                id={`content_name_${category.id}`}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ancient Door"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`content_summary_${category.id}`}>Summary</Label>
              <Textarea
                id={`content_summary_${category.id}`}
                value={form.summary}
                onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder="Short notes for this content."
              />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">
                Add Content
              </Button>
              <Button variant="outline" type="button" onClick={closeDialog} className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
