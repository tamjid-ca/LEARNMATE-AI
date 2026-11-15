'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Languages, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useUIPreferences } from '@/components/providers/app-providers';

export function ThemeLanguageControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const { language, toggleLanguage } = useUIPreferences();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <div className="flex items-center gap-2">
      <Tooltip
        label={
          language === 'en' ? 'Switch interface to বাংলা (Bangla)' : 'Switch interface to English'
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          aria-label="Toggle language between English and Bangla"
          className="font-medium"
        >
          <Languages className="size-4" />
          <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
        </Button>
      </Tooltip>

      <Tooltip label={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle dark and light theme"
        >
          {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
        </Button>
      </Tooltip>
    </div>
  );
}
