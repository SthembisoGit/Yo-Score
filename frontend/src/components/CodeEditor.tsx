import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { Loader2, Play, RotateCcw, Save, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CODE_TO_DISPLAY,
  MONACO_LANGUAGE_IDS,
  normalizeLanguageCode,
  type SupportedLanguageCode,
} from '@/constants/languages';

interface CodeEditorProps {
  value?: string;
  language?: string;
  onChange?: (code: string) => void;
  onSubmit?: (code: string) => void;
  onRun?: (payload: {
    language: SupportedLanguageCode;
    code: string;
    stdin: string;
  }) => Promise<{
    stdout: string;
    stderr: string;
    exit_code: number;
    timed_out: boolean;
    runtime_ms: number;
    memory_kb: number;
    truncated: boolean;
    provider: 'local' | 'onecompiler';
    error_class?: 'compile' | 'runtime' | 'timeout' | 'infrastructure';
  }>;
  className?: string;
  readOnly?: boolean;
  showLanguageSelector?: boolean;
  availableLanguages?: string[];
  onLanguageChange?: (language: string) => void;
  disableClipboardActions?: boolean;
  onClipboardBlocked?: (action: 'copy' | 'cut' | 'paste' | 'drop' | 'shortcut') => void;
}

const languageTemplates: Record<SupportedLanguageCode, string> = {
  javascript: `function solve(input) {
  // parse input and return output
  return input.trim();
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');
process.stdout.write(String(solve(input)));`,
  python: `def solve(input_data):
    # parse input and return output
    return input_data.strip()

if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`,
  java: `import java.io.*;

public class Main {
    static String solve(String input) {
        // parse input and return output
        return input.trim();
    }

    public static void main(String[] args) throws Exception {
        String input = new String(System.in.readAllBytes());
        System.out.print(solve(input));
    }
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

string solve(const string& input) {
    // parse input and return output
    return input;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    cout << solve(input);
    return 0;
}`,
  go: `package main

import (
    "fmt"
    "io"
    "os"
)

func solve(input string) string {
    // parse input and return output
    return input
}

func main() {
    data, _ := io.ReadAll(os.Stdin)
    fmt.Print(solve(string(data)))
}`,
  csharp: `using System;
using System.IO;

public class Program
{
    static string Solve(string input)
    {
        // parse input and return output
        return input.Trim();
    }

    public static void Main()
    {
        string input = Console.In.ReadToEnd();
        Console.Write(Solve(input));
    }
}`,
};

const toDisplay = (code: SupportedLanguageCode): string => CODE_TO_DISPLAY[code];
const DEFAULT_EDITOR_HEIGHT = 560;
const MIN_EDITOR_HEIGHT = 420;
const MAX_EDITOR_HEIGHT = 920;
const EDITOR_HEIGHT_STORAGE_KEY = 'yoscore:editor-height';

export function CodeEditor({
  value,
  language = 'javascript',
  onChange,
  onSubmit,
  onRun,
  className,
  readOnly = false,
  showLanguageSelector = false,
  availableLanguages = Object.values(CODE_TO_DISPLAY),
  onLanguageChange,
  disableClipboardActions = false,
  onClipboardBlocked,
}: CodeEditorProps) {
  const initialLanguage = normalizeLanguageCode(language);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageCode>(initialLanguage);
  const [code, setCode] = useState<string>(value ?? languageTemplates[initialLanguage]);
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [editorHeight, setEditorHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_EDITOR_HEIGHT;
    const raw = window.localStorage.getItem(EDITOR_HEIGHT_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_EDITOR_HEIGHT;
    return Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, parsed));
  });
  const disposersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (value !== undefined) {
      setCode(value);
    }
  }, [value]);

  useEffect(() => {
    const normalized = normalizeLanguageCode(language);
    setSelectedLanguage(normalized);
  }, [language]);

  const availableLanguageCodes = useMemo(
    () =>
      availableLanguages.map((item) => {
        const normalized = normalizeLanguageCode(item);
        return {
          code: normalized,
          label: toDisplay(normalized),
        };
      }),
    [availableLanguages],
  );

  const clearEditorDisposers = () => {
    for (const dispose of disposersRef.current) {
      dispose();
    }
    disposersRef.current = [];
  };

  useEffect(() => clearEditorDisposers, []);

  const blockClipboardAction = (action: 'copy' | 'cut' | 'paste' | 'drop' | 'shortcut') => {
    onClipboardBlocked?.(action);
  };

  const handleLanguageChange = (newLanguageRaw: string) => {
    const newLanguage = normalizeLanguageCode(newLanguageRaw);
    setSelectedLanguage(newLanguage);
    onLanguageChange?.(toDisplay(newLanguage));

    if (!value) {
      const template = languageTemplates[newLanguage];
      setCode(template);
      onChange?.(template);
    }
  };

  const handleRun = async () => {
    if (readOnly || isRunning) return;
    if (!onRun) {
      setOutput('Run endpoint is not configured.');
      return;
    }

    setIsRunning(true);
    setOutput('Running...\n');
    try {
      const result = await onRun({
        language: selectedLanguage,
        code,
        stdin,
      });

      const stdout = String(result.stdout ?? '');
      const stderr = String(result.stderr ?? '');
      const sections: string[] = [];

      if (stdout.length > 0) {
        sections.push(stdout.trimEnd());
      } else if (stdin.trim().length === 0) {
        sections.push(
          '(No stdout output. Add input in the stdin box and run again if the program expects input.)',
        );
      } else {
        sections.push('(Program completed with no stdout output.)');
      }

      if (stderr.length > 0) {
        sections.push(`stderr:\n${stderr}`);
      }
      if (result.timed_out) {
        sections.push('Execution timed out.');
      }
      if (result.truncated) {
        sections.push('Output was truncated to protect performance limits.');
      }
      sections.push(
        `[meta] exit_code=${result.exit_code} runtime=${result.runtime_ms}ms memory=${result.memory_kb}KB provider=${result.provider}`,
      );

      setOutput(sections.join('\n\n'));
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Code execution failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    if (readOnly) return;
    const template = languageTemplates[selectedLanguage];
    setCode(template);
    setOutput('');
    onChange?.(template);
  };

  const handleSubmit = () => {
    if (readOnly) return;
    onSubmit?.(code);
  };

  const handleEditorHeightChange = (next: number) => {
    const clamped = Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, next));
    setEditorHeight(clamped);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EDITOR_HEIGHT_STORAGE_KEY, String(clamped));
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    clearEditorDisposers();

    if (!disableClipboardActions || readOnly) return;

    const keyDisposable = editor.onKeyDown((event) => {
      const keyCode = event.keyCode;
      const isClipboardShortcut =
        (event.ctrlKey || event.metaKey) &&
        [monaco.KeyCode.KeyC, monaco.KeyCode.KeyV, monaco.KeyCode.KeyX].includes(keyCode);
      if (isClipboardShortcut) {
        event.preventDefault();
        event.stopPropagation();
        blockClipboardAction('shortcut');
      }
    });
    disposersRef.current.push(() => keyDisposable.dispose());

    const pasteDisposable = editor.onDidPaste(() => {
      editor.trigger('yoscore', 'undo', null);
      blockClipboardAction('paste');
    });
    disposersRef.current.push(() => pasteDisposable.dispose());

    const domNode = editor.getDomNode();
    if (!domNode) return;

    const copyHandler = (event: Event) => {
      event.preventDefault();
      blockClipboardAction('copy');
    };
    const cutHandler = (event: Event) => {
      event.preventDefault();
      blockClipboardAction('cut');
    };
    const dropHandler = (event: Event) => {
      event.preventDefault();
      blockClipboardAction('drop');
    };

    domNode.addEventListener('copy', copyHandler);
    domNode.addEventListener('cut', cutHandler);
    domNode.addEventListener('drop', dropHandler);

    disposersRef.current.push(() => {
      domNode.removeEventListener('copy', copyHandler);
      domNode.removeEventListener('cut', cutHandler);
      domNode.removeEventListener('drop', dropHandler);
    });
  };

  return (
    <div className={cn('flex flex-col bg-card border border-border rounded-lg overflow-hidden', className)}>
      <div className="flex flex-col gap-2 border-b border-border bg-muted px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {showLanguageSelector ? (
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableLanguageCodes.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium">{toDisplay(selectedLanguage)}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground md:flex">
            <span>Editor Height</span>
            <input
              type="range"
              min={MIN_EDITOR_HEIGHT}
              max={MAX_EDITOR_HEIGHT}
              step={10}
              value={editorHeight}
              onChange={(event) => handleEditorHeightChange(Number(event.target.value))}
              disabled={readOnly}
              className="h-3 w-24"
              aria-label="Editor height"
            />
            <span>{editorHeight}px</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void handleRun()} disabled={isRunning || readOnly}>
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={readOnly}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          {onSubmit && (
            <Button size="sm" onClick={handleSubmit} disabled={readOnly}>
              <Save className="h-3.5 w-3.5" />
              Submit
            </Button>
          )}
        </div>
      </div>

      <div className="bg-editor-background" style={{ height: `${editorHeight}px` }}>
        <Editor
          height={`${editorHeight}px`}
          language={MONACO_LANGUAGE_IDS[selectedLanguage]}
          value={code}
          onChange={(next) => {
            const updated = next ?? '';
            setCode(updated);
            onChange?.(updated);
          }}
          onMount={handleEditorMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 21,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            contextmenu: !disableClipboardActions,
            scrollBeyondLastLine: false,
            fontFamily: '"Fira Code","JetBrains Mono","Cascadia Code",monospace',
          }}
          theme="vs-dark"
        />
      </div>

      <div className="border-t border-border bg-muted/40 p-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">stdin (optional)</label>
        <textarea
          className="min-h-[68px] w-full rounded border border-border bg-background p-2 font-mono text-xs"
          placeholder="Type input used by your program..."
          value={stdin}
          onChange={(event) => setStdin(event.target.value)}
          disabled={readOnly || isRunning}
        />
      </div>

      <div className="border-t border-border h-5">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5" />
            Terminal
          </span>
          <button type="button" className="hover:text-foreground" onClick={() => setOutput('')}>
            Clear
          </button>
        </div>
        <pre className="max-h-52 overflow-auto bg-background p-4 font-mono text-xs whitespace-pre-wrap">
          {output || 'Run your code to see real output.'}
        </pre>
      </div>
    </div>
  );
}
