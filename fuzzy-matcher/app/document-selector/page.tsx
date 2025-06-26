"use client";
import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { Button } from "@/components/ui/button";
import { ModuleRegistry } from 'ag-grid-community'; 
import { AllEnterpriseModule } from 'ag-grid-enterprise';

// Register all Community and Enterprise features
ModuleRegistry.registerModules([AllEnterpriseModule]);

const fileData = [
  { path: "/contracts/legal/service-agreement-2024.pdf", type: "pdf", size: 1024000 },
  { path: "/contracts/legal/nda-template.docx", type: "docx", size: 512000 },
  { path: "/contracts/vendor/software-license.pdf", type: "pdf", size: 768000 },
  { path: "/exhibits/evidence/witness-statement-1.pdf", type: "pdf", size: 2048000 },
  { path: "/exhibits/evidence/witness-statement-2.pdf", type: "pdf", size: 1536000 },
  { path: "/exhibits/photos/accident-scene.jpg", type: "jpg", size: 3072000 },
  { path: "/exhibits/photos/damage-assessment.jpg", type: "jpg", size: 2560000 },
  { path: "/reports/financial/quarterly-report-q1.xlsx", type: "xlsx", size: 768000 },
  { path: "/reports/financial/quarterly-report-q2.xlsx", type: "xlsx", size: 832000 },
  { path: "/reports/technical/system-analysis.docx", type: "docx", size: 1024000 },
  { path: "/correspondence/client/agreement-draft.docx", type: "docx", size: 256000 },
  { path: "/correspondence/client/agreement-final.pdf", type: "pdf", size: 1280000 },
  { path: "/correspondence/vendor/proposal-request.pdf", type: "pdf", size: 640000 },
  { path: "/discovery/documents/exhibit-a-contract.pdf", type: "pdf", size: 1792000 },
  { path: "/discovery/documents/exhibit-b-correspondence.pdf", type: "pdf", size: 640000 },
  { path: "/discovery/documents/exhibit-c-financial.xlsx", type: "xlsx", size: 896000 },
  { path: "/discovery/depositions/witness-a.pdf", type: "pdf", size: 3200000 },
  { path: "/pleadings/motions/motion-to-dismiss.pdf", type: "pdf", size: 1152000 },
  { path: "/pleadings/briefs/opening-brief.docx", type: "docx", size: 2304000 },
  { path: "/transcripts/depositions/witness-deposition-smith.pdf", type: "pdf", size: 4096000 },
  { path: "/transcripts/hearings/preliminary-hearing.pdf", type: "pdf", size: 3584000 },
];

function buildTreeData() {
  return fileData.map(({ path, ...rest }) => {
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop() || ""; // Ensure it's never undefined
    return {
      fileName,
      folderHierarchy: parts,
      ...rest,
    };
  });
}


export default function FileTreeGrid() {
  const rowData = useMemo(() => buildTreeData(), []);

  const columnDefs: ColDef<typeof rowData[number]>[] = useMemo(() => [
  {
    field: "fileName",
    headerName: "Name",
    cellRenderer: "agGroupCellRenderer",
    flex: 2,
  },
  { field: "type", flex: 1 },
  {
    field: "size",
    flex: 1,
    valueFormatter: ({ value }) => `${(value / 1024 / 1024).toFixed(2)} MB`,
  },
  {
    headerName: "Action",
    field: "action", // dummy field to satisfy typing
    cellRenderer: (params) =>
      params.node.group ? "" : <Button>Select</Button>,
    flex: 1,
  },
], []);


  const autoGroupColumnDef = useMemo(() => {
    return {
      headerName: "Path",
      cellRendererParams: {
        suppressCount: true,
      },
    };
  }, []);

  return (
    <div className=" ag-theme-alpine w-full h-[800px]">
      <AgGridReact
        theme='legacy'
        rowData={rowData}
        columnDefs={columnDefs}
        groupDefaultExpanded={-1}
        treeData={true}
        animateRows={true}
        autoGroupColumnDef={autoGroupColumnDef}
        getDataPath={(data) => [...data.folderHierarchy, data.fileName]}
      />
    </div>
  );
}
