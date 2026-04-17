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
import { Eye, Edit3, Plus, Trash2 } from 'lucide-react';
import { ContentPack, Game } from '../../api/models';
import {contentPacksApi} from '../../api/contentPacksApi';
import { get_userId } from '../../api/authStorage';
import { VISIBILITY,Visibility } from '../../types/visibility';
import { STATUS, Status } from '../../types/status';

interface FormState {
  pack_name: string;
  pack_descirption: string;
  visibility: Visibility;
  status: Status
}
const emptyForm: FormState = {
  pack_name: '',
  pack_descirption: '',
  visibility: 'private',
  status: 'draft'
};

type Props = {
  game: Game;
};

export function ViewGamePacks({ game }: Props) {
  const [contentpacks, setContentPacks] = useState<ContentPack[]>([]);
  const [isloading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [activePack, setActivePack] = useState<ContentPack | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewTarget, setViewTarget] = useState<ContentPack | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentPack | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeSummaryTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const loadPacks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const contentPacks = await contentPacksApi.listByGame(game.id, 100, 0);
      setContentPacks(contentPacks);
    } catch (err) {
      setError((err as Error)?.message || 'Unable to load content packs.');
      setContentPacks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, []);

  useEffect(() => {
    resizeSummaryTextarea(summaryRef.current);
  }, [form.pack_descirption, isDialogOpen]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setForm(emptyForm);
    setActivePack(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (contentPack: ContentPack) => {
    setDialogMode('edit');
    setActivePack(contentPack);
    setForm({
      pack_name: contentPack.pack_name,
      pack_descirption: contentPack.description ?? '',
      visibility: contentPack.visibility || VISIBILITY.PRIVATE,
      status: contentPack.status || STATUS.DRAFT
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setActivePack(null);
    setError(null);
  };

  const handleDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.pack_name.trim()) {
      setError('A content pack name is required.');
      return;
    }

    setError(null);

    try {
      if (dialogMode === 'create') {
        await contentPacksApi.create({
          owner_id: get_userId(),
          game_id: game.id,
          pack_name: form.pack_name.trim(),
          description: form.pack_descirption.trim() || undefined,
          visibility: form.visibility,
        });
      } else if (activePack) {
        await contentPacksApi.patch(activePack.id, {
          pack_name: form.pack_name.trim(),
          description: form.pack_descirption.trim() || undefined,
          visibility: form.visibility,
        });
      }
      closeDialog();
      await loadPacks();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to save content pack.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setError(null);

    try {
      await contentPacksApi.delete(deleteTarget.id);
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await loadPacks();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to delete content pack.');
    }
  };
  return (
    <div>
      <h1>View {game.game_name} content packs</h1>
      <p>This is where you can view the game content packs.</p>
    </div>
  );

}