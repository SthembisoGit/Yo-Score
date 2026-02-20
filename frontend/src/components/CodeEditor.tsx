// components/CodeEditor.tsx
import {
  useState,
  useEffect,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { Play, RotateCcw, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value?: string;
  language?: string;
  onChange?: (code: string) => void;
  onSubmit?: (code: string) => void;
  className?: string;
  readOnly?: boolean;
  showLanguageSelector?: boolean;
  availableLanguages?: string[];
  onLanguageChange?: (language: string) => void;
  disableClipboardActions?: boolean;
  onClipboardBlocked?: (action: 'copy' | 'cut' | 'paste' | 'drop' | 'shortcut') => void;
}

// Language-specific default code templates
const languageTemplates: Record<string, string> = {
  javascript: `// Write your solution in JavaScript
function solveChallenge(input) {
  // Your solution logic here
  
  return result;
}

// Example usage
const testInput = "example";
console.log(solveChallenge(testInput));`,
  
  typescript: `// Write your solution in TypeScript
function solveChallenge(input: string): any {
  // Your solution logic here
  
  return result;
}

// Example usage
const testInput = "example";
console.log(solveChallenge(testInput));`,
  
  python: `# Write your solution in Python
def solve_challenge(input_data):
    # Your solution logic here
    
    return result

# Example usage
test_input = "example"
print(solve_challenge(test_input))`,
  
  java: `// Write your solution in Java
public class Solution {
    public static Object solveChallenge(String input) {
        // Your solution logic here
        
        return result;
    }
    
    public static void main(String[] args) {
        // Example usage
        String testInput = "example";
        System.out.println(solveChallenge(testInput));
    }
}`,
  
  csharp: `// Write your solution in C#
using System;

public class Solution {
    public static object SolveChallenge(string input) {
        // Your solution logic here
        
        return result;
    }
    
    public static void Main(string[] args) {
        // Example usage
        string testInput = "example";
        Console.WriteLine(SolveChallenge(testInput));
    }
}`,
  
  go: `// Write your solution in Go
package main

import "fmt"

func solveChallenge(input string) interface{} {
    // Your solution logic here
    
    return result
}

func main() {
    // Example usage
    testInput := "example"
    fmt.Println(solveChallenge(testInput))
}`,
  
  rust: `// Write your solution in Rust
fn solve_challenge(input: &str) -> impl std::fmt::Debug {
    // Your solution logic here
    
    // Return result
}

fn main() {
    // Example usage
    let test_input = "example";
    println!("{:?}", solve_challenge(test_input));
}`,
  
  php: `<?php
// Write your solution in PHP
function solveChallenge($input) {
    // Your solution logic here
    
    return $result;
}

// Example usage
$testInput = "example";
echo solveChallenge($testInput);
?>`,
  
  ruby: `# Write your solution in Ruby
def solve_challenge(input)
  # Your solution logic here
  
  return result
end

# Example usage
test_input = "example"
puts solve_challenge(test_input)`,
  
  swift: `// Write your solution in Swift
import Foundation

func solveChallenge(_ input: String) -> Any {
    // Your solution logic here
    
    return result
}

// Example usage
let testInput = "example"
print(solveChallenge(testInput))`,
  
  kotlin: `// Write your solution in Kotlin
fun solveChallenge(input: String): Any {
    // Your solution logic here
    
    return result
}

fun main() {
    // Example usage
    val testInput = "example"
    println(solveChallenge(testInput))
}`
};

// Language display names
const languageDisplayNames: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin'
};

// Default template for unknown languages
const defaultTemplate = `// Write your solution here
function solution() {
  // Your code goes here
  
  return result;
}

// Test your solution
console.log(solution());`;

export function CodeEditor({
  value,
  language = 'javascript',
  onChange,
  onSubmit,
  className,
  readOnly = false,
  showLanguageSelector = false,
  availableLanguages = Object.keys(languageTemplates),
  onLanguageChange,
  disableClipboardActions = false,
  onClipboardBlocked
}: CodeEditorProps) {
  const [code, setCode] = useState(value || languageTemplates[language] || defaultTemplate);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update code when language changes externally
  useEffect(() => {
    if (value !== undefined) {
      setCode(value);
    }
  }, [value]);

  // Update language when prop changes
  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  // Handle code changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    onChange?.(newCode);
  };

  // Handle language selection
  const handleLanguageChange = (newLanguage: string) => {
    setSelectedLanguage(newLanguage);
    onLanguageChange?.(newLanguage);
    
    // Optionally switch to language template when language changes
    if (!value && languageTemplates[newLanguage]) {
      const template = languageTemplates[newLanguage];
      setCode(template);
      onChange?.(template);
    }
  };

  // Simulate code execution
  const handleRun = () => {
    if (readOnly) return;
    
    setIsRunning(true);
    setOutput('Running code...\n');
    
    // Simulate async execution
    setTimeout(() => {
      const lines = code.split('\n').length;
      const chars = code.length;
      
      setOutput(prev => prev + 
        `✓ Code executed successfully\n` +
        `  Lines: ${lines}\n` +
        `  Characters: ${chars}\n` +
        `  Language: ${languageDisplayNames[selectedLanguage] || selectedLanguage}\n\n` +
        `Note: In production, this would execute in a secure sandbox.`
      );
      setIsRunning(false);
    }, 1000);
  };

  const handleReset = () => {
    if (readOnly) return;
    
    const template = languageTemplates[selectedLanguage] || defaultTemplate;
    setCode(template);
    onChange?.(template);
    setOutput('');
  };

  const handleSubmit = () => {
    if (readOnly) return;
    onSubmit?.(code);
  };

  const blockClipboardAction = (action: 'copy' | 'cut' | 'paste' | 'drop' | 'shortcut') => {
    onClipboardBlocked?.(action);
  };

  const handleClipboardEvent = (
    event: ClipboardEvent<HTMLTextAreaElement>,
    action: 'copy' | 'cut' | 'paste',
  ) => {
    if (!disableClipboardActions || readOnly) return;
    event.preventDefault();
    blockClipboardAction(action);
  };

  const handleDropEvent = (event: DragEvent<HTMLTextAreaElement>) => {
    if (!disableClipboardActions || readOnly) return;
    event.preventDefault();
    blockClipboardAction('drop');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!disableClipboardActions || readOnly) return;

    const key = event.key.toLowerCase();
    const isClipboardShortcut =
      ((event.ctrlKey || event.metaKey) && (key === 'c' || key === 'x' || key === 'v')) ||
      (event.shiftKey && key === 'insert');

    if (isClipboardShortcut) {
      event.preventDefault();
      blockClipboardAction('shortcut');
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    adjustHeight();
    // Optional: Adjust on window resize
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [code]);

  // Calculate line numbers
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className={cn('flex flex-col bg-card border border-border rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 bg-muted border-b border-border gap-2">
        <div className="flex items-center gap-3">
          {showLanguageSelector ? (
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {languageDisplayNames[lang] || lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-mono font-medium text-foreground">
              {languageDisplayNames[selectedLanguage] || selectedLanguage}
            </span>
          )}
          
          <div className="hidden sm:flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs text-muted-foreground">Ready</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRun} 
            disabled={isRunning || readOnly}
            className="gap-2 h-8"
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleReset} 
            disabled={readOnly}
            className="gap-2 h-8"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          
          {onSubmit && (
            <Button 
              size="sm" 
              onClick={handleSubmit} 
              disabled={readOnly}
              className="gap-2 h-8"
            >
              <Save className="h-3.5 w-3.5" />
              Submit
            </Button>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative min-h-[300px] bg-editor-background">
        <div className="absolute inset-0 flex overflow-auto">
          {/* Line numbers */}
          <div className="w-12 bg-editor-sidebar border-r border-border py-3 select-none flex-shrink-0">
            <div className="text-right pr-2">
              {lineNumbers.map((num) => (
                <div 
                  key={num} 
                  className="text-xs font-mono text-muted-foreground leading-6 hover:text-foreground"
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
          
          {/* Code input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onCopy={(e) => handleClipboardEvent(e, 'copy')}
              onCut={(e) => handleClipboardEvent(e, 'cut')}
              onPaste={(e) => handleClipboardEvent(e, 'paste')}
              onDrop={handleDropEvent}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 p-3 pl-4 font-mono text-sm bg-transparent resize-none focus:outline-none leading-6 text-foreground whitespace-pre overflow-hidden"
              spellCheck={false}
              readOnly={readOnly}
              placeholder={`Write your ${languageDisplayNames[selectedLanguage] || selectedLanguage} code here...`}
              style={{
                fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", monospace'
              }}
            />
            
            {/* Syntax highlighting overlay (simplified) */}
            {!readOnly && (
              <div className="absolute inset-0 p-3 pl-4 pointer-events-none overflow-hidden">
                <pre className="font-mono text-sm leading-6 text-transparent whitespace-pre">
                  {code}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1.5 bg-muted border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
          <span className="text-muted-foreground">
            {code.length} character{code.length !== 1 ? 's' : ''}
          </span>
          {readOnly && (
            <span className="text-amber-600 dark:text-amber-400">
              Read-only mode
            </span>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          UTF-8
        </div>
      </div>

      {/* Output Panel */}
      {output && (
        <div className="border-t border-border">
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/50 flex items-center justify-between">
            <span>Output</span>
            <button 
              onClick={() => setOutput('')}
              className="text-xs hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <pre className="p-4 font-mono text-sm whitespace-pre-wrap max-h-48 overflow-auto bg-muted/30">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
