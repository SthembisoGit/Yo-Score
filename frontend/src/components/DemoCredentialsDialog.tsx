import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STORAGE_KEY = 'yoscore_demo_credentials_dismissed';

export function DemoCredentialsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Demo Account Available</AlertDialogTitle>
          <AlertDialogDescription>
            Use the following credentials to explore the platform quickly:
            <div className="mt-4 space-y-1 text-sm">
              <div>
                <span className="font-semibold">Email:</span> test@yoscore.com
              </div>
              <div>
                <span className="font-semibold">Password:</span> test_pass@1
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction onClick={handleClose}>Got it</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
