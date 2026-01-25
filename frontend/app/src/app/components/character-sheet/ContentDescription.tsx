import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Content } from '../../types/game';

interface ContentDescriptionProps {
  contentDef: Content;
}

export function ContentDescription({ contentDef }: ContentDescriptionProps) {
  if (!contentDef.description) return null;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-xs mb-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {contentDef.description}
      </ReactMarkdown>
    </div>
  );
}
