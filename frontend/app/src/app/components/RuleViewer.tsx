import { useState, useMemo } from 'react';
import { Content } from '../types/game';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RuleViewerProps {
  content: Content;
  compact?: boolean; // For use in modals/sheets
}

interface RuleSection {
  id: string;
  title: string;
  content: string;
  level: number;
}

export function RuleViewer({ content, compact = false }: RuleViewerProps) {
  // Parse markdown content to extract headings and create sections
  const sections = useMemo(() => {
    const text = content.description;
    if (!text) return [];

    const lines = text.split('\n');
    const parsed: RuleSection[] = [];
    let currentSection: RuleSection | null = null;
    let sectionContent: string[] = [];

    lines.forEach((line, index) => {
      const h1Match = line.match(/^#\s+(.+)$/);
      const h2Match = line.match(/^##\s+(.+)$/);

      if (h1Match || h2Match) {
        // Save previous section
        if (currentSection) {
          currentSection.content = sectionContent.join('\n').trim();
          parsed.push(currentSection);
        }

        // Start new section
        const title = h1Match ? h1Match[1] : h2Match![1];
        const level = h1Match ? 1 : 2;
        currentSection = {
          id: `section-${index}`,
          title,
          content: '',
          level,
        };
        sectionContent = [];
      } else if (currentSection) {
        sectionContent.push(line);
      }
    });

    // Save last section
    if (currentSection) {
      currentSection.content = sectionContent.join('\n').trim();
      parsed.push(currentSection);
    }

    return parsed;
  }, [content.description]);

  const [activeSection, setActiveSection] = useState(sections[0]?.id || 'overview');

  // If no sections found, show entire content
  if (sections.length === 0) {
    return (
      <div className={compact ? '' : 'space-y-4'}>
        {!compact && (
          <div>
            <h2 className="text-2xl font-bold">{content.name}</h2>
          </div>
        )}
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {content.description ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.description}
            </ReactMarkdown>
          ) : (
            <p className="text-muted-foreground">No content available.</p>
          )}
        </div>
      </div>
    );
  }

  // Render with tabs for sections
  return (
    <div className={compact ? '' : 'space-y-4'}>
      {!compact && (
        <div>
          <h2 className="text-2xl font-bold">{content.name}</h2>
        </div>
      )}

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          {sections.map((section) => (
            <TabsTrigger 
              key={section.id} 
              value={section.id}
              className="text-xs sm:text-sm"
            >
              {section.title}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content.description}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {sections.map((section) => (
          <TabsContent key={section.id} value={section.id} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {section.content}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}