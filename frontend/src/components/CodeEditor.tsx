import { useState } from 'react';
import { Play, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  initialCode?: string;
  language?: string;
  onSubmit?: (code: string) => void;
  className?: string;
}

const defaultCode = `// Write your solution here
function solution() {
  // Your code goes here
  
  return result;
}

// Test your solution
console.log(solution());
`;

export function CodeEditor({
  initialCode = defaultCode,
  language = 'javascript',
  onSubmit,
  className,
}: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string>('');

  const handleRun = () => {
    // Simulated output
    setOutput('> Running code...\n> Output: Success!');
  };

  const handleReset = () => {
    setCode(initialCode);
    setOutput('');
  };

  const handleSubmit = () => {
    onSubmit?.(code);
  };

  return (
    <div className={cn('flex flex-col bg-card border border-border rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-muted-foreground">{language}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRun} className="gap-2">
            <Play className="h-4 w-4" />
            Run
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSubmit} className="gap-2">
            <Save className="h-4 w-4" />
            Submit
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative min-h-[400px]">
        <div className="absolute inset-0 flex">
          {/* Line numbers */}
          <div className="w-12 bg-muted border-r border-border py-4 text-right pr-2 select-none">
            {code.split('\n').map((_, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground leading-6">
                {i + 1}
              </div>
            ))}
          </div>
          
          {/* Code input */}
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 p-4 font-mono text-sm bg-transparent resize-none focus:outline-none leading-6"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Output Panel */}
      {output && (
        <div className="border-t border-border bg-muted">
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            Output
          </div>
          <pre className="p-4 font-mono text-sm whitespace-pre-wrap max-h-32 overflow-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
