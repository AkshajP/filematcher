// components/header.tsx - Updated Header Component with Folder Upload

import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import { processFolderUpload, validateFolderUpload } from '@/lib/folder-processor';

interface HeaderProps {
  onExport: () => void;
  onFolderUpload?: (filePaths: string[], folderName: string) => void;
  isProcessingFolder?: boolean;
}

export function Header({ onExport, onFolderUpload, isProcessingFolder = false }: HeaderProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !onFolderUpload) return;

    console.log('Files selected:', files.length); // Debug log
    setUploadStatus('Processing folder...');

    try {
      // Validate the upload
      const validation = validateFolderUpload(files);
      if (!validation.isValid) {
        setUploadStatus(`Error: ${validation.error}`);
        setTimeout(() => setUploadStatus(''), 3000);
        return;
      }

      // Process the folder
      const result = processFolderUpload(files);
      console.log('Processing result:', result); // Debug log
      
      setUploadStatus(`Loaded ${result.totalFiles} files from "${result.folderName}"`);
      
      // Call the callback with the processed data
      onFolderUpload(result.filePaths, result.folderName);
      
      // Clear the success message after 3 seconds
      setTimeout(() => setUploadStatus(''), 3000);
      
    } catch (error) {
      console.error('Error processing folder:', error);
      setUploadStatus('Error processing folder');
      setTimeout(() => setUploadStatus(''), 3000);
    }

    // Reset the input
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const triggerFolderUpload = () => {
    folderInputRef.current?.click();
  };

  return (
    <header className="bg-white border-b-2 border-emerald-700 px-8 py-4 shadow-sm">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-emerald-700">
          TERES File Mapper
        </h1>
        
        <div className="flex items-center gap-2">
          {/* Upload Status */}
          {uploadStatus && (
            <div className={`text-sm px-3 py-1 rounded ${
              uploadStatus.startsWith('Error') 
                ? 'bg-red-100 text-red-700' 
                : uploadStatus.startsWith('Loaded')
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {uploadStatus}
            </div>
          )}
          
          {/* Hidden file input for folder selection */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore - webkitdirectory is not in standard types but is widely supported
            webkitdirectory=""
            directory=""
            multiple
            style={{ display: 'none' }}
            onChange={handleFolderUpload}
            accept="*/*"
          />
          
          {/* Upload Folder Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={triggerFolderUpload}
            disabled={isProcessingFolder}
            className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
          >
            {isProcessingFolder ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                📁 Upload Folder
              </>
            )}
          </Button>
          
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