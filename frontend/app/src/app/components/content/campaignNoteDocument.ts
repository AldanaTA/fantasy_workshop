import type { ReactNode } from 'react';

import {
  CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
  type CampaignNoteBlockNode,
  type CampaignNoteDocument,
  type CampaignNoteHardBreakNode,
  type CampaignNoteInlineNode,
  type CampaignNoteListItemNode,
  type CampaignNoteMark,
  type CampaignNoteTextNode,
} from '../../types/campaignNotes';

export function createEmptyCampaignNoteDocument(): CampaignNoteDocument {
  return {
    schema_version: CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
    type: 'doc',
    content: [],
  };
}

export function isCampaignNoteDocument(value: unknown): value is CampaignNoteDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CampaignNoteDocument>;
  return candidate.schema_version === CAMPAIGN_NOTE_DOC_SCHEMA_VERSION && candidate.type === 'doc' && Array.isArray(candidate.content);
}

export function normalizeCampaignNoteBody(body: unknown): CampaignNoteDocument {
  if (isCampaignNoteDocument(body)) {
    return normalizeDocument(body);
  }

  if (isRichTextHtmlBody(body)) {
    return htmlToCampaignNoteDocument(body.html);
  }

  if (isLegacyDocBody(body)) {
    return normalizeLegacyDocBody(body);
  }

  if (typeof body === 'string') {
    return plainTextToCampaignNoteDocument(body);
  }

  return createEmptyCampaignNoteDocument();
}

export function getCampaignNotePlainText(body: unknown): string {
  const document = normalizeCampaignNoteBody(body);
  const parts = document.content.map((node) => getBlockPlainText(node)).filter(Boolean);
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function campaignNoteDocumentToTiptapContent(document: CampaignNoteDocument) {
  return {
    type: 'doc',
    content: document.content,
  };
}

export function campaignNoteDocumentFromTiptapContent(content: unknown): CampaignNoteDocument {
  if (!content || typeof content !== 'object') {
    return createEmptyCampaignNoteDocument();
  }

  const candidate = content as { type?: string; content?: unknown[] };
  return normalizeDocument({
    schema_version: CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
    type: candidate.type === 'doc' ? 'doc' : 'doc',
    content: Array.isArray(candidate.content) ? candidate.content.map(normalizeBlockNode).filter(Boolean) : [],
  });
}

export function renderCampaignNoteInlineChildren(
  nodes: CampaignNoteInlineNode[] | undefined,
  renderText: (node: CampaignNoteTextNode, key: string) => ReactNode,
  renderBreak: (node: CampaignNoteHardBreakNode, key: string) => ReactNode,
  keyPrefix: string,
) {
  return (nodes ?? []).map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === 'text') {
      return renderText(node, key);
    }
    return renderBreak(node, key);
  });
}

function isRichTextHtmlBody(body: unknown): body is { type: 'rich_text_html'; html: string } {
  return Boolean(
    body &&
    typeof body === 'object' &&
    (body as { type?: unknown }).type === 'rich_text_html' &&
    typeof (body as { html?: unknown }).html === 'string',
  );
}

function isLegacyDocBody(body: unknown): body is { type?: string; content?: unknown[] } {
  return Boolean(body && typeof body === 'object' && Array.isArray((body as { content?: unknown[] }).content));
}

function normalizeDocument(document: CampaignNoteDocument): CampaignNoteDocument {
  return {
    schema_version: CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
    type: 'doc',
    content: (document.content ?? []).map(normalizeBlockNode).filter(Boolean),
  };
}

function normalizeLegacyDocBody(body: { content?: unknown[] }) {
  return normalizeDocument({
    schema_version: CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
    type: 'doc',
    content: (body.content ?? []).map(normalizeLegacyBlockNode).filter(Boolean),
  });
}

function normalizeBlockNode(node: unknown): CampaignNoteBlockNode | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { type?: string; attrs?: { level?: unknown }; content?: unknown[] };

  switch (candidate.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        content: normalizeInlineChildren(candidate.content),
      };
    case 'heading':
      return {
        type: 'heading',
        attrs: {
          level: normalizeHeadingLevel(candidate.attrs?.level),
        },
        content: normalizeInlineChildren(candidate.content),
      };
    case 'blockquote':
      return {
        type: 'blockquote',
        content: (candidate.content ?? []).map(normalizeBlockNode).filter(Boolean),
      };
    case 'bullet_list':
      return {
        type: 'bullet_list',
        content: (candidate.content ?? []).map(normalizeListItemNode).filter(Boolean),
      };
    case 'ordered_list':
      return {
        type: 'ordered_list',
        content: (candidate.content ?? []).map(normalizeListItemNode).filter(Boolean),
      };
    default:
      return null;
  }
}

function normalizeLegacyBlockNode(node: unknown): CampaignNoteBlockNode | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { type?: string; attrs?: { level?: unknown }; content?: unknown[]; text?: unknown };

  switch (candidate.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        content: normalizeLegacyInlineChildren(candidate.content),
      };
    case 'heading':
      return {
        type: 'heading',
        attrs: {
          level: normalizeHeadingLevel(candidate.attrs?.level),
        },
        content: normalizeLegacyInlineChildren(candidate.content),
      };
    case 'blockquote':
      return {
        type: 'blockquote',
        content: (candidate.content ?? []).map(normalizeLegacyBlockNode).filter(Boolean),
      };
    case 'bullet_list':
    case 'bulletList':
      return {
        type: 'bullet_list',
        content: (candidate.content ?? []).map(normalizeLegacyListItemNode).filter(Boolean),
      };
    case 'ordered_list':
    case 'orderedList':
      return {
        type: 'ordered_list',
        content: (candidate.content ?? []).map(normalizeLegacyListItemNode).filter(Boolean),
      };
    case 'list_item':
    case 'listItem':
      return {
        type: 'bullet_list',
        content: [normalizeLegacyListItemNode(candidate)].filter(Boolean) as CampaignNoteListItemNode[],
      };
    case 'text':
      return textToParagraph(typeof candidate.text === 'string' ? candidate.text : '');
    default:
      return textToParagraph(getLegacyNodeText(candidate));
  }
}

function normalizeListItemNode(node: unknown): CampaignNoteListItemNode | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { type?: string; content?: unknown[] };
  if (candidate.type !== 'list_item') return null;
  return {
    type: 'list_item',
    content: normalizeListItemContent(candidate.content),
  };
}

function normalizeLegacyListItemNode(node: unknown): CampaignNoteListItemNode | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { type?: string; content?: unknown[] };
  if (!['list_item', 'listItem'].includes(candidate.type ?? '')) return null;
  return {
    type: 'list_item',
    content: normalizeLegacyListItemContent(candidate.content),
  };
}

function normalizeListItemContent(content: unknown[] | undefined) {
  const blocks = (content ?? []).map(normalizeBlockNode).filter(Boolean);
  return blocks.length ? blocks : [{ type: 'paragraph', content: [] }];
}

function normalizeLegacyListItemContent(content: unknown[] | undefined) {
  const blocks = (content ?? []).map(normalizeLegacyBlockNode).flatMap((node) => {
    if (!node) return [];
    if (node.type === 'bullet_list' || node.type === 'ordered_list') {
      return [{ type: 'paragraph', content: [{ type: 'text', text: getBlockPlainText(node) }] } satisfies CampaignNoteBlockNode];
    }
    return [node];
  });
  return blocks.length ? blocks : [{ type: 'paragraph', content: [] }];
}

function normalizeInlineChildren(content: unknown[] | undefined) {
  return (content ?? []).map(normalizeInlineNode).filter(Boolean);
}

function normalizeLegacyInlineChildren(content: unknown[] | undefined) {
  return (content ?? []).map(normalizeLegacyInlineNode).filter(Boolean);
}

function normalizeInlineNode(node: unknown): CampaignNoteInlineNode | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { type?: string; text?: unknown; marks?: unknown[] };

  if (candidate.type === 'text') {
    return {
      type: 'text',
      text: typeof candidate.text === 'string' ? candidate.text : '',
      marks: normalizeMarks(candidate.marks),
    };
  }

  if (candidate.type === 'hard_break') {
    return { type: 'hard_break' };
  }

  return null;
}

function normalizeLegacyInlineNode(node: unknown): CampaignNoteInlineNode | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { type?: string; text?: unknown; marks?: unknown[] };

  if (candidate.type === 'text') {
    return {
      type: 'text',
      text: typeof candidate.text === 'string' ? candidate.text : '',
      marks: normalizeMarks(candidate.marks),
    };
  }

  if (candidate.type === 'hard_break' || candidate.type === 'hardBreak') {
    return { type: 'hard_break' };
  }

  return null;
}

function normalizeMarks(marks: unknown[] | undefined): CampaignNoteMark[] | undefined {
  const normalized = (marks ?? []).flatMap((mark) => {
    if (!mark || typeof mark !== 'object') return [];
    const type = (mark as { type?: unknown }).type;
    if (type === 'bold' || type === 'italic') {
      return [{ type }];
    }
    if (type === 'strong') {
      return [{ type: 'bold' as const }];
    }
    if (type === 'em') {
      return [{ type: 'italic' as const }];
    }
    return [];
  });

  if (!normalized.length) return undefined;

  const deduped: CampaignNoteMark[] = [];
  for (const mark of normalized) {
    if (!deduped.some((entry) => entry.type === mark.type)) {
      deduped.push(mark);
    }
  }
  return deduped;
}

function normalizeHeadingLevel(level: unknown): 1 | 2 | 3 {
  return level === 1 || level === 2 || level === 3 ? level : 1;
}

function htmlToCampaignNoteDocument(html: string): CampaignNoteDocument {
  if (typeof window === 'undefined') {
    return plainTextToCampaignNoteDocument(stripHtml(html));
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  if (!root) {
    return createEmptyCampaignNoteDocument();
  }

  const blocks = Array.from(root.childNodes).flatMap((node) => parseHtmlBlockNode(node)).filter(Boolean);
  return normalizeDocument({
    schema_version: CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
    type: 'doc',
    content: blocks,
  });
}

function parseHtmlBlockNode(node: Node): CampaignNoteBlockNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    return text.trim() ? [textToParagraph(text)] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  switch (element.tagName.toUpperCase()) {
    case 'P':
      return [{ type: 'paragraph', content: parseHtmlInlineNodes(element.childNodes) }];
    case 'H1':
      return [{ type: 'heading', attrs: { level: 1 }, content: parseHtmlInlineNodes(element.childNodes) }];
    case 'H2':
      return [{ type: 'heading', attrs: { level: 2 }, content: parseHtmlInlineNodes(element.childNodes) }];
    case 'H3':
      return [{ type: 'heading', attrs: { level: 3 }, content: parseHtmlInlineNodes(element.childNodes) }];
    case 'BLOCKQUOTE':
      return [{
        type: 'blockquote',
        content: flattenHtmlContainerChildren(element.childNodes),
      }];
    case 'UL':
      return [{
        type: 'bullet_list',
        content: Array.from(element.children)
          .filter((child): child is HTMLLIElement => child.tagName.toUpperCase() === 'LI')
          .map((child) => htmlListItemToNode(child)),
      }];
    case 'OL':
      return [{
        type: 'ordered_list',
        content: Array.from(element.children)
          .filter((child): child is HTMLLIElement => child.tagName.toUpperCase() === 'LI')
          .map((child) => htmlListItemToNode(child)),
      }];
    case 'DIV':
      return flattenHtmlContainerChildren(element.childNodes);
    default:
      return [textToParagraph(element.textContent ?? '')];
  }
}

function flattenHtmlContainerChildren(children: NodeListOf<ChildNode> | ChildNode[]) {
  return Array.from(children).flatMap((child) => parseHtmlBlockNode(child)).filter(Boolean);
}

function htmlListItemToNode(element: HTMLLIElement): CampaignNoteListItemNode {
  const blocks: CampaignNoteBlockNode[] = [];
  const inlineContent: CampaignNoteInlineNode[] = [];

  Array.from(element.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = (child as HTMLElement).tagName.toUpperCase();
      if (['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'DIV'].includes(tagName)) {
        if (inlineContent.length) {
          blocks.push({ type: 'paragraph', content: [...inlineContent] });
          inlineContent.length = 0;
        }
        blocks.push(...parseHtmlBlockNode(child));
        return;
      }
    }

    inlineContent.push(...parseHtmlInlineNode(child));
  });

  if (inlineContent.length || !blocks.length) {
    blocks.unshift({ type: 'paragraph', content: inlineContent });
  }

  return {
    type: 'list_item',
    content: blocks,
  };
}

function parseHtmlInlineNodes(nodes: NodeListOf<ChildNode> | ChildNode[]) {
  return Array.from(nodes).flatMap((node) => parseHtmlInlineNode(node));
}

function parseHtmlInlineNode(node: Node, inheritedMarks: CampaignNoteMark[] = []): CampaignNoteInlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [{
      type: 'text',
      text,
      marks: inheritedMarks.length ? inheritedMarks : undefined,
    }];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toUpperCase();
  const nextMarks = [...inheritedMarks];

  if (tagName === 'BR') {
    return [{ type: 'hard_break' }];
  }

  if (tagName === 'STRONG' || tagName === 'B') {
    nextMarks.push({ type: 'bold' });
  } else if (tagName === 'EM' || tagName === 'I') {
    nextMarks.push({ type: 'italic' });
  } else if (['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'DIV'].includes(tagName)) {
    return [{
      type: 'text',
      text: element.textContent ?? '',
      marks: inheritedMarks.length ? inheritedMarks : undefined,
    }];
  }

  return Array.from(element.childNodes).flatMap((child) => parseHtmlInlineNode(child, dedupeMarks(nextMarks)));
}

function dedupeMarks(marks: CampaignNoteMark[]) {
  return marks.filter((mark, index) => marks.findIndex((candidate) => candidate.type === mark.type) === index);
}

function plainTextToCampaignNoteDocument(text: string): CampaignNoteDocument {
  const normalizedText = text.replace(/\r\n/g, '\n');
  const content = normalizedText.split('\n').map((line) => textToParagraph(line));
  return normalizeDocument({
    schema_version: CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
    type: 'doc',
    content,
  });
}

function textToParagraph(text: string): CampaignNoteBlockNode {
  return {
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ');
}

function getLegacyNodeText(node: { content?: unknown[]; text?: unknown }) {
  const text = typeof node.text === 'string' ? node.text : '';
  if (text) return text;
  return (node.content ?? [])
    .map((child) => {
      if (!child || typeof child !== 'object') return '';
      return getLegacyNodeText(child as { content?: unknown[]; text?: unknown });
    })
    .join('');
}

function getBlockPlainText(node: CampaignNoteBlockNode): string {
  switch (node.type) {
    case 'paragraph':
      return getInlinePlainText(node.content);
    case 'heading':
      return getInlinePlainText(node.content);
    case 'blockquote':
      return (node.content ?? []).map((child) => getBlockPlainText(child)).join('\n');
    case 'bullet_list':
    case 'ordered_list':
      return (node.content ?? []).map((item) => getListItemPlainText(item)).join('\n');
    default:
      return '';
  }
}

function getListItemPlainText(node: CampaignNoteListItemNode) {
  return (node.content ?? []).map((child) => getBlockPlainText(child)).join(' ').trim();
}

function getInlinePlainText(nodes: CampaignNoteInlineNode[] | undefined) {
  return (nodes ?? [])
    .map((node) => (node.type === 'text' ? node.text : '\n'))
    .join('')
    .trim();
}
