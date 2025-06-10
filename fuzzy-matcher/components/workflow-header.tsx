// components/workflow-header.tsx - Workflow Header Component

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle, AlertCircle, Download, Upload, FolderOpen, Zap, FileText, Play } from "lucide-react";

interface WorkflowHeaderProps {
  indexStatus: { loaded: boolean; count?: number; fileName?: string };
  folderStatus: { loaded: boolean; count?: number; folderName?: string };
  currentMode: 'setup' | 'working';
  onUploadIndex: () => void;
  onUploadFolder: () => void;
  onDownloadTemplate: () => void;
  onStartAutoMatch: () => void;
  onImportMappings: () => void;
  onExport: () => void;
  mappingProgress?: { completed: number; total: number };
  unmappedCount?: number; // Add this to show auto match availability
}

export function WorkflowHeader({
  indexStatus,
  folderStatus,
  currentMode,
  onUploadIndex,
  onUploadFolder,
  onDownloadTemplate,
  onStartAutoMatch,
  onImportMappings,
  onExport,
  mappingProgress,
  unmappedCount = 0
}: WorkflowHeaderProps) {
  const bothLoaded = indexStatus.loaded && folderStatus.loaded;

  return (
    <div className="bg-white border-b-2 border-emerald-700 px-8 pt-4 shadow-sm">
      {/* Main Title */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-emerald-700">
          TERES File Mapper
        </h1>
        
        {/* Action buttons - show when working */}
        {currentMode === 'working' && (
          <div className="flex gap-2">
            <Button 
              onClick={onStartAutoMatch} 
              variant="outline" 
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              disabled={unmappedCount === 0}
            >
              <Zap className="w-4 h-4 mr-2" />
              Auto Match {unmappedCount > 0 ? `(${unmappedCount})` : ''}
            </Button>
            <Button 
              onClick={onImportMappings} 
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Session
            </Button>
            <Button onClick={onExport} className="bg-emerald-700 hover:bg-emerald-600">
              <Download className="w-4 h-4 mr-2" />
              Export Mappings
            </Button>
          </div>
        )}
      </div>

      {/* Setup Phase */}
      {currentMode === 'setup' && (
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Setup Required</h2>
              <p className="text-gray-600">Complete both uploads to continue</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Step 1: Upload Index */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {indexStatus.loaded ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">1</div>
                  )}
                  <h3 className="font-medium text-gray-800">Upload Client Index</h3>
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {indexStatus.loaded ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                      <div className="text-sm font-medium text-green-700">
                        ✅ {indexStatus.fileName}
                      </div>
                      <div className="text-xs text-green-600">
                        {indexStatus.count} references loaded
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <FileText className="w-8 h-8 text-gray-400 mx-auto" />
                      <Button 
                        onClick={onUploadIndex}
                        className="bg-emerald-700 hover:bg-emerald-600"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Index File
                      </Button>
                      <p className="text-xs text-gray-500">CSV or Excel file</p>
                    </div>
                  )}
                </div>
                
                {!indexStatus.loaded && (
                  <div className="text-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={onDownloadTemplate}
                      className="text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download Template
                    </Button>
                  </div>
                )}
              </div>

              {/* Step 2: Upload Folder */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {folderStatus.loaded ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">2</div>
                  )}
                  <h3 className="font-medium text-gray-800">Upload File Paths</h3>
                </div>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {folderStatus.loaded ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                      <div className="text-sm font-medium text-green-700">
                        ✅ {folderStatus.folderName}
                      </div>
                      <div className="text-xs text-green-600">
                        {folderStatus.count} files found
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <FolderOpen className="w-8 h-8 text-gray-400 mx-auto" />
                      <Button 
                        onClick={onUploadFolder}
                        className="bg-emerald-700 hover:bg-emerald-600"
                        disabled={!indexStatus.loaded}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Folder
                      </Button>
                      <p className="text-xs text-gray-500">Select entire folder</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!bothLoaded && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">
                    {!indexStatus.loaded && !folderStatus.loaded 
                      ? "Upload your client index first, then your folder structure"
                      : !indexStatus.loaded 
                      ? "Upload your client index to continue"
                      : "Upload your folder structure to continue"
                    }
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Working Mode Progress Bar */}
      {currentMode === 'working' && mappingProgress && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-gray-600">
              Mapping Progress: {mappingProgress.completed} of {mappingProgress.total} references mapped
            </div>
            <div className="text-sm font-medium text-emerald-700">
              {mappingProgress.total > 0 ? Math.round((mappingProgress.completed / mappingProgress.total) * 100) : 0}%
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${mappingProgress.total > 0 ? (mappingProgress.completed / mappingProgress.total) * 100 : 0}%` 
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}