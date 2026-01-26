// components/TestResultsPanel.tsx
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  message?: string;
  details?: string;
  duration?: number;
}

interface TestResultsPanelProps {
  results: TestResult[];
  isRunning: boolean;
  category: string;
  className?: string;
}

export const TestResultsPanel = ({ 
  results, 
  isRunning, 
  category, 
  className 
}: TestResultsPanelProps) => {
  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const totalCount = results.length;

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-amber-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCategorySpecificInfo = () => {
    switch (category.toLowerCase()) {
      case 'frontend':
        return {
          title: 'Frontend Tests',
          description: 'Tests include UI rendering, DOM validation, and browser compatibility'
        };
      case 'backend':
        return {
          title: 'API Tests',
          description: 'Tests include endpoint responses, database operations, and business logic'
        };
      case 'security':
        return {
          title: 'Security Tests',
          description: 'Tests include vulnerability scanning, input validation, and security headers'
        };
      default:
        return {
          title: 'Test Results',
          description: 'Running test suite against your solution'
        };
    }
  };

  const categoryInfo = getCategorySpecificInfo();

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-muted px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{categoryInfo.title}</h3>
            <p className="text-sm text-muted-foreground">{categoryInfo.description}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-green-600 font-medium">{passedCount} passed</span>
              {' / '}
              <span className="text-red-600 font-medium">{failedCount} failed</span>
              {' / '}
              <span className="text-muted-foreground">{totalCount} total</span>
            </div>
            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running tests...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Results List */}
      <div className="divide-y max-h-96 overflow-auto">
        {results.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No tests have been run yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Run Tests" to execute your solution.
            </p>
          </div>
        ) : (
          results.map((test) => (
            <div 
              key={test.id} 
              className={cn(
                'p-4 hover:bg-muted/50 transition-colors',
                test.status === 'passed' && 'test-result-pass',
                test.status === 'failed' && 'test-result-fail',
                test.status === 'running' && 'test-result-running'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getStatusIcon(test.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{test.name}</h4>
                    {test.duration && (
                      <span className="text-xs text-muted-foreground">
                        {test.duration}ms
                      </span>
                    )}
                  </div>
                  
                  {test.message && (
                    <p className={cn(
                      'text-sm mt-1',
                      test.status === 'passed' ? 'text-green-700 dark:text-green-400' :
                      test.status === 'failed' ? 'text-red-700 dark:text-red-400' :
                      'text-muted-foreground'
                    )}>
                      {test.message}
                    </p>
                  )}
                  
                  {test.details && test.status === 'failed' && (
                    <pre className="mt-2 p-2 bg-black/5 dark:bg-white/5 rounded text-xs overflow-auto">
                      {test.details}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Category-specific instructions */}
      <div className="border-t p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground">
          {category === 'frontend' && (
            <>
              <strong>Frontend Testing:</strong> Tests will check HTML structure, CSS styling, 
              JavaScript functionality, and responsive design.
            </>
          )}
          {category === 'backend' && (
            <>
              <strong>Backend Testing:</strong> Tests will verify API endpoints, database operations, 
              error handling, and performance.
            </>
          )}
          {category === 'security' && (
            <>
              <strong>Security Testing:</strong> Tests will check for common vulnerabilities like 
              XSS, SQL injection, CSRF, and improper authentication.
            </>
          )}
        </div>
      </div>
    </div>
  );
};