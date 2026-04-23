import type { ReactNode } from 'react';

import type {
  CampaignNoteBlockNode,
  CampaignNoteDocument,
  CampaignNoteInlineNode,
  CampaignNoteTextNode,
} from '../../types/campaignNotes';
import { normalizeCampaignNoteBody } from './campaignNoteDocument';
import { cn } from '../ui/utils';

type CampaignNoteRendererProps = {
  body: CampaignNoteDocument | unknown;
  className?: string;
  emptyState?: ReactNode;
};

export function CampaignNoteRenderer({
  body,
  className,
  emptyState = null,
}: CampaignNoteRendererProps) {
  const document = normalizeCampaignNoteBody(body);

  if (!document.content.length) {
    return emptyState ? <div className={className}>{emptyState}</div> : null;
  }

  return (
    <article
      className={cn(
        'space-y-4 text-sm leading-7',
        '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic',
        '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-tight',
        '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight',
        '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight',
        '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2',
        '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2',
        className,
      )}
    >
      {document.content.map((node, index) => renderBlockNode(node, `block-${index}`))}
    </article>
  );
}

function renderBlockNode(node: CampaignNoteBlockNode, key: string): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{renderInlineNodes(node.content, key)}</p>;
    case 'heading': {
      const Tag = `h${node.attrs.level}` as 'h1' | 'h2' | 'h3';
      return <Tag key={key}>{renderInlineNodes(node.content, key)}</Tag>;
    }
    case 'blockquote':
      return (
        <blockquote key={key}>
          {(node.content ?? []).map((child, index) => renderBlockNode(child, `${key}-${index}`))}
        </blockquote>
      );
    case 'bullet_list':
      return (
        <ul key={key}>
          {(node.content ?? []).map((item, index) => (
            <li key={`${key}-${index}`}>
              {(item.content ?? []).map((child, childIndex) => renderBlockNode(child, `${key}-${index}-${childIndex}`))}
            </li>
          ))}
        </ul>
      );
    case 'ordered_list':
      return (
        <ol key={key}>
          {(node.content ?? []).map((item, index) => (
            <li key={`${key}-${index}`}>
              {(item.content ?? []).map((child, childIndex) => renderBlockNode(child, `${key}-${index}-${childIndex}`))}
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

function renderInlineNodes(nodes: CampaignNoteInlineNode[] | undefined, keyPrefix: string) {
  return (nodes ?? []).map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === 'hard_break') {
      return <br key={key} />;
    }
    return renderTextNode(node, key);
  });
}

function renderTextNode(node: CampaignNoteTextNode, key: string) {
  return node.marks?.reduce<ReactNode>((content, mark) => {
    if (mark.type === 'bold') {
      return <strong key={`${key}-bold`}>{content}</strong>;
    }
    if (mark.type === 'italic') {
      return <em key={`${key}-italic`}>{content}</em>;
    }
    return content;
  }, <span key={key}>{node.text}</span>) ?? <span key={key}>{node.text}</span>;
}
