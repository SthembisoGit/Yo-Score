import { MonitorSmartphone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DesktopRequiredPanelProps {
  reasons: string[];
  onBack: () => void;
}

export function DesktopRequiredPanel({ reasons, onBack }: DesktopRequiredPanelProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
      <div className="w-full rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MonitorSmartphone className="h-7 w-7" />
        </div>
        <div className="mb-6 flex items-start gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-2xl font-semibold">Desktop Required For Challenge Sessions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You can browse challenges on any device, but starting or resuming a proctored attempt
              now requires a desktop or laptop browser with fullscreen support.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium">Why this session is blocked</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={onBack}>Back To Challenges</Button>
          <p className="text-xs text-muted-foreground">
            Recommended setup: Chrome or Edge on a laptop/desktop, camera and microphone enabled,
            fullscreen allowed.
          </p>
        </div>
      </div>
    </div>
  );
}

