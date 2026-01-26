// components/challenge-detail/LanguageSelector.tsx
import { Code } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  availableLanguages: string[];
  className?: string;
  label?: string;
  size?: 'default' | 'sm' | 'lg';
}

export const LanguageSelector = ({
  selectedLanguage,
  onLanguageChange,
  availableLanguages,
  className = '',
  label = 'Programming Language',
  size = 'default'
}: LanguageSelectorProps) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium flex items-center gap-2">
        <Code className="h-4 w-4" />
        {label}
      </label>
      
      <Select value={selectedLanguage} onValueChange={onLanguageChange}>
        <SelectTrigger className={size === 'lg' ? 'h-11' : size === 'sm' ? 'h-9' : ''}>
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {availableLanguages.map((language) => (
            <SelectItem key={language} value={language}>
              {language}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedLanguage && (
        <p className="text-xs text-muted-foreground">
          Solutions will be evaluated in {selectedLanguage}
        </p>
      )}
    </div>
  );
};