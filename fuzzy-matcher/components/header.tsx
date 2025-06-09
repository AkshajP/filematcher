// components/header.tsx - Header Component

import { Button } from '@/components/ui/button';

interface HeaderProps {
  onExport: () => void;
}

export function Header({ onExport }: HeaderProps) {
  return (
    <header className="bg-white border-b-2 border-emerald-700 px-8 py-4 shadow-sm">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-emerald-700">
          TERES File Mapper
        </h1>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Import Mappings
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            Export Mappings
          </Button>
          <Button variant="default" size="sm" className="bg-emerald-700 hover:bg-emerald-600">
            Suggested Mappings
          </Button>
        </div>
      </div>
    </header>
  );
}