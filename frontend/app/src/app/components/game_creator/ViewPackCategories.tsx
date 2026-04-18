import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Eye, Edit3, Plus, CircleArrowLeft,Trash2,} from 'lucide-react';
import { ContentCategory, ContentPack} from '../../api/models';
import {contentCategoriesApi} from '../../api/contentCategoriesApi';
import { get_userId } from '../../api/authStorage';
import { VISIBILITY,Visibility } from '../../types/visibility';
import { STATUS, Status } from '../../types/status';
import { useToast } from '../ui/toastProvider';

interface FormState {
    name: string;
    sort_key?: number;
}
const emptyForm: FormState = {
  name: '',
  sort_key: undefined,
};

type Props = {
  pack: ContentPack;
  onBackToPacks?: () => void;
  onGoToDashboard?: () => void;
};

export function ViewPackCategories({ pack, onBackToPacks, onGoToDashboard }: Props) {
  const [contentCategories, setContentCategories] = useState<ContentCategory[]>([]);
  const [isloading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activeCategory, setActiveCategory] = useState<ContentCategory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewTarget, setViewTarget] = useState<ContentCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentCategory | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const {toastPromise} = useToast();

  const loadPacks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const contentCategories = await contentCategoriesApi.listByPack(pack.id, 100, 0);
      setContentCategories(contentCategories);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load content categories.');
      setContentCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, []);


  const openCreateDialog = () => {
    setDialogMode('create');
    setForm(emptyForm);
    setActiveCategory(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (contentCategory: ContentCategory) => {
    setDialogMode('edit');
    setActiveCategory(contentCategory);
    setForm({
      name: contentCategory.name,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setActiveCategory(null);
    setError(null);
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('A content category name is required.');
      return;
    }

    setError(null);

    try {
      if (dialogMode === 'create') {
        await toastPromise(contentCategoriesApi.create({
          pack_id: pack.id,
          name: form.name.trim(),
          sort_key: form.sort_key,
        }), {
          loading: "Creating content category...",
          success: "Content category created successfully.",
          error: "Failed to create content category."
        });
      } else if (activeCategory) {
        await toastPromise(contentCategoriesApi.patch(activeCategory.id, {
          name: form.name.trim(),
          sort_key: form.sort_key,
        }), {
          loading: "Updating content category...",
          success: "Content category updated successfully.",
          error: "Failed to update content category."
        });
      }
      closeDialog();
      await loadPacks();
    } catch (err) {
    }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await toastPromise(contentCategoriesApi.delete(deleteTarget.id), {
        loading: "Deleting content category...",
        success: "Content category deleted successfully.",
        error: "Failed to delete content category."
      });

      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadPacks();


    } catch (err) {
  
    }
  };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">View content categories in {pack.pack_name}</h2>
            <p className="text-sm text-muted-foreground">
              This is where you can view the game content packs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          <Button onClick={onBackToPacks}
            
            className="min-h-[44px]"
          >
            <CircleArrowLeft className="h-4 w-4" />
            Back to Pack List
          </Button> 
            <Button onClick={onGoToDashboard}
            
            className="min-h-[44px]"
          >
            <CircleArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>                                                                                                                  
          <Button
            onClick={openCreateDialog}
            className="min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            Make Content Pack
          </Button>
          </div>
        </div>
        <Separator />
        {isloading ? (
          <p>Loading content packs...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : contentCategories.length === 0 ? (
          <p>No content categories found. Create one to get started!</p>
        ) : (
          <div className="space-y-4">
            {contentCategories.map((category) => (
              <Card key={category.id} className="border">
                <CardHeader>
                  <CardTitle>{category.name}</CardTitle>
                  <CardDescription>{category.sort_key}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewTarget(category)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openEditDialog(category)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => {setDeleteTarget(category); setIsDeleteOpen(true);}}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create Content Category' : 'Edit Content Category'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Add a new content category to your game.'
                : 'Update the content category details and save your changes.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDialogSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="category_name">Name</Label>
              <Input
                id="category_name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="My Adventure System"
                required
              />
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto">
                {dialogMode === 'create' ? 'Create Content Category' : 'Save Changes'}
              </Button>
              <Button variant="outline" type="button" onClick={closeDialog} className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a content category is permanent. This will remove the content category from your editable list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteTarget(null);
                setIsDeleteOpen(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}