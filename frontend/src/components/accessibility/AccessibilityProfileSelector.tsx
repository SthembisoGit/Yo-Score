import React from 'react';
import { 
  Brain, 
  Ear, 
  Eye, 
  MousePointer2, 
  ShieldCheck, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { useAccessibility, AccessibilityProfile } from '@/context/AccessibilityContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const PROFILES: {
  id: AccessibilityProfile;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  benefits: string[];
}[] = [
  {
    id: 'none',
    title: 'Standard Profile',
    description: 'No specific accommodations enabled. Standard proctoring rules apply.',
    icon: ShieldCheck,
    color: 'slate',
    benefits: ['Full scoring transparency', 'Standard certification'],
  },
  {
    id: 'neurodiverse',
    title: 'Cognitive Focus',
    description: 'Optimized for ADHD, dyslexia, and social anxiety.',
    icon: Brain,
    color: 'purple',
    benefits: [
      'Gaze violations disabled',
      'AI Coach simplification mode',
      'Reduced UI distractions',
      'Anxiety-reducing alerts'
    ],
  },
  {
    id: 'mobility',
    title: 'Adaptive Mobility',
    description: 'Designed for developers using head-tracking or alternative inputs.',
    icon: MousePointer2,
    color: 'blue',
    benefits: [
      'Head-tilt navigation enabled',
      'Movement violations waived',
      'Extended inactivity timers',
      'Dwell-click support'
    ],
  },
  {
    id: 'silent',
    title: 'Silent Assessment',
    description: 'For those with speech impairments or high social anxiety.',
    icon: Ear,
    color: 'emerald',
    benefits: [
      'Speech detection disabled',
      'Text-only AI interaction',
      'No verbal verification required',
      'Inclusive behavior scoring'
    ],
  },
  {
    id: 'visual',
    title: 'Visual Support',
    description: 'High contrast and screen-reader optimized experience.',
    icon: Eye,
    color: 'orange',
    benefits: [
      'High contrast UI enabled',
      'Focus-tracking proctoring',
      'Waived visual alignment checks',
      'Screen-reader friendly alerts'
    ],
  },
];

export const AccessibilityProfileSelector: React.FC = () => {
  const { settings, setProfile } = useAccessibility();
  const [isOpen, setIsOpen] = React.useState(false);

  const activeProfile = PROFILES.find(p => p.id === settings.profile) || PROFILES[0];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/20 hover:border-primary/50 transition-all duration-300">
          <activeProfile.icon className={cn("h-4 w-4", `text-${activeProfile.color}-500`)} />
          <span>Profile: {activeProfile.title}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-primary h-6 w-6" />
            Inclusive talent Assessment
          </DialogTitle>
          <DialogDescription className="text-base">
            Choose an accessibility profile to tailor your assessment environment. 
            Your score will be normalized based on your selected accommodations to ensure fair hiring.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {PROFILES.map((profile) => (
            <Card 
              key={profile.id}
              className={cn(
                "relative cursor-pointer transition-all duration-300 hover:shadow-md border-2",
                settings.profile === profile.id ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
              )}
              onClick={() => {
                setProfile(profile.id);
                setIsOpen(false);
              }}
            >
              {settings.profile === profile.id && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    `bg-${profile.color}-500/10 text-${profile.color}-500`
                  )}>
                    <profile.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{profile.title}</CardTitle>
                </div>
                <CardDescription className="pt-2 line-clamp-2">
                  {profile.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {profile.benefits.slice(0, 3).map((benefit, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] py-0 font-normal">
                      {benefit}
                    </Badge>
                  ))}
                  {profile.benefits.length > 3 && (
                    <Badge variant="secondary" className="text-[10px] py-0 font-normal">
                      +{profile.benefits.length - 3} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-2 p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Fair Hiring Commitment</p>
              <p className="text-muted-foreground leading-relaxed">
                By selecting an accessibility profile, your Trust Score will be calculated with 
                <strong> fairness offsets</strong>. This means you will not be penalized for behaviors related 
                to your disability, ensuring recruiters see your true technical potential.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={() => setIsOpen(false)}>Confirm Profile</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
