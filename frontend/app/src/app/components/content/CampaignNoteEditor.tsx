import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import type { CampaignNoteDocument } from '../../types/campaignNotes';
import {
  campaignNoteDocumentFromTiptapContent,
  campaignNoteDocumentToTiptapContent,
} from './campaignNoteDocument';
import { cn } from '../ui/utils';

type CampaignNoteEditorProps = {
  id?: string;
  value: CampaignNoteDocument;
  onChange: (value: CampaignNoteDocument) => void;
  readOnly?: boolean;
  className?: string;
  editorClassName?: string;
  helperText?: string;
};

type ToolbarState = {
  isBold: boolean;
  isItalic: boolean;
  isHeading1: boolean;
  isHeading2: boolean;
  isHeading3: boolean;
  isBlockquote: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isParagraph: boolean;
  hasContent: boolean;
};

const defaultToolbarState: ToolbarState = {
  isBold: false,
  isItalic: false,
  isHeading1: false,
  isHeading2: false,
  isHeading3: false,
  isBlockquote: false,
  isBulletList: false,
  isOrderedList: false,
  isParagraph: true,
  hasContent: false,
};

export function CampaignNoteEditor({
  id,
  value,
  onChange,
  readOnly = false,
  className,
  editorClassName,
  helperText,
}: CampaignNoteEditorProps) {
  const lastEmittedValueRef = useRef<string>(JSON.stringify(campaignNoteDocumentToTiptapContent(value)));
  const normalizedValue = useMemo(() => campaignNoteDocumentToTiptapContent(value), [value]);
  const [toolbarState, setToolbarState] = useState<ToolbarState>(defaultToolbarState);
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: true,
        horizontalRule: false,
        strike: false,
      }),
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        id: id ?? undefined,
        class: cn(
          'min-h-[260px] max-h-[48dvh] overflow-y-auto rounded-b-2xl bg-input-background px-4 py-4 text-sm leading-7 outline-none',
          'touch-pan-y overscroll-contain focus-visible:outline-none',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-tight',
          '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight',
          '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight',
          '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2',
          '[&_p]:min-h-[1.75rem]',
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2',
          editorClassName,
        ),
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      const nextValue = campaignNoteDocumentFromTiptapContent(nextEditor.getJSON());
      lastEmittedValueRef.current = JSON.stringify(campaignNoteDocumentToTiptapContent(nextValue));
      onChange(nextValue);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = JSON.stringify(normalizedValue);
    if (next === lastEmittedValueRef.current) {
      return;
    }
    const current = JSON.stringify(editor.getJSON());
    if (current !== next) {
      editor.commands.setContent(normalizedValue, false);
    }
    lastEmittedValueRef.current = next;
  }, [editor, normalizedValue]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) {
      setToolbarState(defaultToolbarState);
      return;
    }

    const updateToolbarState = () => {
      setToolbarState({
        isBold: editor.isActive('bold'),
        isItalic: editor.isActive('italic'),
        isHeading1: editor.isActive('heading', { level: 1 }),
        isHeading2: editor.isActive('heading', { level: 2 }),
        isHeading3: editor.isActive('heading', { level: 3 }),
        isBlockquote: editor.isActive('blockquote'),
        isBulletList: editor.isActive('bulletList'),
        isOrderedList: editor.isActive('orderedList'),
        isParagraph: editor.isActive('paragraph'),
        hasContent: editor.getText().trim().length > 0 || editor.state.doc.childCount > 1,
      });
    };

    updateToolbarState();
    editor.on('selectionUpdate', updateToolbarState);
    editor.on('transaction', updateToolbarState);
    editor.on('focus', updateToolbarState);
    editor.on('blur', updateToolbarState);

    return () => {
      editor.off('selectionUpdate', updateToolbarState);
      editor.off('transaction', updateToolbarState);
      editor.off('focus', updateToolbarState);
      editor.off('blur', updateToolbarState);
    };
  }, [editor]);

  const hasContent = toolbarState.hasContent;
  const runToolbarCommand = (
    event: React.PointerEvent<HTMLButtonElement>,
    command: () => boolean,
  ) => {
    event.preventDefault();
    if (!editor || readOnly) return;
    command();
    editor.commands.focus();
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="overflow-hidden rounded-2xl border border-input bg-background">
        <div
          role="toolbar"
          aria-label="Campaign note formatting"
          className="flex gap-1 overflow-x-auto border-b border-border bg-muted/50 p-1.5"
        >
          <ToolbarTool
            label="Bold"
            active={toolbarState.isBold}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleBold().run() ?? false)}
            disabled={!editor || readOnly}
          >
            <Bold className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Italic"
            active={toolbarState.isItalic}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleItalic().run() ?? false)}
            disabled={!editor || readOnly}
          >
            <Italic className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Heading 1"
            active={toolbarState.isHeading1}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleHeading({ level: 1 }).run() ?? false)}
            disabled={!editor || readOnly}
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Heading 2"
            active={toolbarState.isHeading2}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleHeading({ level: 2 }).run() ?? false)}
            disabled={!editor || readOnly}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Heading 3"
            active={toolbarState.isHeading3}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleHeading({ level: 3 }).run() ?? false)}
            disabled={!editor || readOnly}
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Quote"
            active={toolbarState.isBlockquote}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleBlockquote().run() ?? false)}
            disabled={!editor || readOnly}
          >
            <Quote className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Bulleted list"
            active={toolbarState.isBulletList}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleBulletList().run() ?? false)}
            disabled={!editor || readOnly}
          >
            <List className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Numbered list"
            active={toolbarState.isOrderedList}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().toggleOrderedList().run() ?? false)}
            disabled={!editor || readOnly}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarTool>
          <ToolbarTool
            label="Paragraph"
            active={Boolean(
              toolbarState.isParagraph &&
              !toolbarState.isBlockquote &&
              !toolbarState.isBulletList &&
              !toolbarState.isOrderedList,
            )}
            onPointerDown={(event) => runToolbarCommand(event, () => editor?.chain().focus().setParagraph().run() ?? false)}
            disabled={!editor || readOnly}
          >
            <RemoveFormatting className="h-4 w-4" />
          </ToolbarTool>
        </div>

        <div className={cn(!hasContent && !readOnly ? 'relative' : '')}>
          <EditorContent editor={editor} />
          {!hasContent && !readOnly ? (
            <p className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground">
              Start writing campaign notes...
            </p>
          ) : null}
        </div>
      </div>

      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

function ToolbarTool({
  children,
  label,
  active = false,
  ...props
}: React.ComponentProps<'button'> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-transparent px-3 text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        active ? 'border-border bg-accent text-accent-foreground shadow-sm' : '',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
      {...props}
    >
      {children}
    </button>
  );
}
