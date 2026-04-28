import type { JSONDict } from './misc';

export const CAMPAIGN_NOTE_DOC_SCHEMA_VERSION = 'campaign_note_doc_v1' as const;

export type CampaignNoteLinkedRule = {
  content_id: string;
  label?: string | null;
  link_mode: 'live' | 'snapshot';
  pinned_version_num?: number | null;
};

export type CampaignNoteMarkType = 'bold' | 'italic';

export type CampaignNoteMark = {
  type: CampaignNoteMarkType;
};

export type CampaignNoteTextNode = {
  type: 'text';
  text: string;
  marks?: CampaignNoteMark[];
};

export type CampaignNoteHardBreakNode = {
  type: 'hard_break';
};

export type CampaignNoteInlineNode = CampaignNoteTextNode | CampaignNoteHardBreakNode;

export type CampaignNoteParagraphNode = {
  type: 'paragraph';
  content?: CampaignNoteInlineNode[];
};

export type CampaignNoteHeadingNode = {
  type: 'heading';
  attrs: {
    level: 1 | 2 | 3;
  };
  content?: CampaignNoteInlineNode[];
};

export type CampaignNoteBlockquoteNode = {
  type: 'blockquote';
  content?: CampaignNoteBlockNode[];
};

export type CampaignNoteListItemNode = {
  type: 'list_item';
  content?: CampaignNoteBlockNode[];
};

export type CampaignNoteBulletListNode = {
  type: 'bullet_list';
  content?: CampaignNoteListItemNode[];
};

export type CampaignNoteOrderedListNode = {
  type: 'ordered_list';
  content?: CampaignNoteListItemNode[];
};

export type CampaignNoteBlockNode =
  | CampaignNoteParagraphNode
  | CampaignNoteHeadingNode
  | CampaignNoteBlockquoteNode
  | CampaignNoteBulletListNode
  | CampaignNoteOrderedListNode;

export type CampaignNoteDocument = {
  schema_version: typeof CAMPAIGN_NOTE_DOC_SCHEMA_VERSION;
  type: 'doc';
  content: CampaignNoteBlockNode[];
  linked_rules?: CampaignNoteLinkedRule[];
};

export type LegacyRichTextHtmlNoteBody = JSONDict & {
  type: 'rich_text_html';
  html: string;
};

export type CampaignNoteBody = CampaignNoteDocument | JSONDict;
