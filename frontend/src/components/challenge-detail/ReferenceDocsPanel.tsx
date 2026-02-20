// components/challenge-detail/ReferenceDocsPanel.tsx
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReferenceDoc {
  doc_id: string;
  title: string;
  content: string;
}

interface ReferenceDocsPanelProps {
  docs: ReferenceDoc[];
  error?: string | null;
  onRetry?: (() => void) | undefined;
}

export const ReferenceDocsPanel = ({ docs, error, onRetry }: ReferenceDocsPanelProps) => {
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">Reference Documentation Unavailable</h3>
        <p className="text-sm text-muted-foreground mb-3">
          {error || 'This challenge does not currently have reference documentation.'}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const activeDoc = docs[activeDocIndex];

  return (
    <div className="h-full flex flex-col">
      {/* Document Navigation */}
      <div className="flex flex-wrap gap-2 mb-4">
        {docs.map((doc, index) => (
          <button
            key={doc.doc_id}
            onClick={() => setActiveDocIndex(index)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              activeDocIndex === index
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
            )}
          >
            {doc.title}
          </button>
        ))}
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-auto">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h3 className="font-semibold mb-3 text-foreground">{activeDoc.title}</h3>
          <div 
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: activeDoc.content }}
          />
        </div>
      </div>
    </div>
  );
};
