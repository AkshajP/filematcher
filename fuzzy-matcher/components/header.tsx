// components/header.tsx - Updated with reference import and template download

import { useRef } from "react";
import { Button } from "./ui/button";

interface HeaderProps {
  onExport: () => void;
  onImportFiles?: (files: FileList) => void;    // For reference/mapping files
  onImportFolder?: (files: FileList) => void;   // For folder structure only
  onImportReferences?: (files: FileList) => void; // For CSV/Excel references
  onDownloadTemplate?: () => void;               // For template download
  onLoadFallbackData?: () => void;
}

export function Header({ 
  onExport, 
  onImportFiles, 
  onImportFolder, 
  onImportReferences,
  onDownloadTemplate,
  onLoadFallbackData 
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = () => {
    fileInputRef.current?.click();
  };

  const handleFolderImport = () => {
    folderInputRef.current?.click();
  };

  const handleReferenceImport = () => {
    referenceInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    onDownloadTemplate?.();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && onImportFiles) {
      onImportFiles(files);
    }
    // Reset the input
    event.target.value = '';
  };

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && onImportFolder) {
      onImportFolder(files);
    }
    // Reset the input
    event.target.value = '';
  };

  const handleReferenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && onImportReferences) {
      onImportReferences(files);
    }
    // Reset the input
    event.target.value = '';
  };

  return (
    <header className="bg-white border-b-2 border-emerald-700 px-8 py-4 shadow-sm">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-emerald-700">
          TERES File Mapper
        </h1>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReferenceImport}>
            Upload Index
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            Download Index Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleFolderImport}>
            Upload File Paths
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            Export Mappings
          </Button>
          <Button variant="default" size="sm" className="bg-emerald-700 hover:bg-emerald-600">
            Suggested Mappings
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        style={{ display: 'none' }}
        onChange={handleFolderChange}
      />
      <input
        ref={referenceInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleReferenceChange}
      />
    </header>
  );
}