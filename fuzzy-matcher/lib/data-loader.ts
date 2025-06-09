// lib/data-loader.ts - Data Loading Functions

export interface DataSources {
  fileReferences: string[];
  filePaths: string[];
}

// Parse file references from Doc Description.txt format
function parseFileReferences(content: string): string[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => line.trim());
}

// Parse file paths from matchings.txt format
function parseFilePaths(content: string): string[] {
  const lines = content.split('\n').filter(line => line.trim());
  return lines.map(line => line.trim().replace(/^"|"$/g, '').replace(/",?$/, ''));
}

// Fallback data (existing hardcoded data)
function getFallbackData(): DataSources {
  const fileReferences = [
    "Claimant's Request for Arbitration",
    "Claimant's Reply to Respondent's Answer to the Request for Arbitration",
    "Claimant's Statement of Claim",
    "Appendix 1 to Claimant's Statement of Claim – The Sub-Contract Agreement",
    "Appendix 2 to Claimant's Statement of Claim – Amendment #1 to The Sub-Contract Agreement",
    "Appendix 3 to Claimant's Statement of Claim – Key Qatar Law Provisions",
    "Appendix 4 to Claimant's Statement of Claim – Summary of The Final Account",
    "Appendix 5 to Claimant's Statement of Claim – Claim No.1 – Quantum Calculation",
    "Appendix 6 to Claimant's Statement of Claim – Claim No.2 - Quantum Calculation",
    "Appendix 7 to Claimant's Statement of Claim – Other Delaying Events",
    "Exhibit A5-01 - Clearance to Proceed for Fit-Out Works",
    "Exhibit A5-02 - Claimant Letter",
    "Exhibit A5-03 - Claimant Letter",
    "CW-1 - First Witness Statement of Mr. Chakib Nayfe",
    "CW-2 - First Witness Statement of Mr. Sami Zekeriya",
    "RW-1 - First Witness Statement of Mr. Mostapha Alkhatib",
    "RW-2 - First Witness Statement of Mr. Nassr Zubaidi"
  ];

  const filePaths = [
    "[A] Claimant Submissions/2023.08.10 - Request for Arbitration - ELM v La Jolla.pdf",
    "[A] Claimant Submissions/2023.11.23 - Elm v La Jolla - Reply.pdf",
    "[A] Claimant Submissions/20240501 - ELM v La Jolla - WAP - Statement of Claim.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 1 - The Sub-Contract Agreement/Appendix 1 -  The Sub-Contract Agreement.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 2 - Amendment #1 to the Sub-Contract Agreement/Appendix 2 -  Amendment #1.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 3 - Key Qatar Law Provisions/Appendix 3 -  Key Qatar Law Provisions.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 4 - Summary of the Final Account/Appendix 4 - Summary of Final Account.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 5 - Claim No.1 - Quantum Calculation/Appendix 5 - Claim No.1 - Quantum Calculation.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 6 - Claim No.2 - Quantum Calculation/Appendix 6 - Claim No.2 - Quantum Calculation.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Appendix 7 - Other Delay Events.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-01 -C010-CLP HANDOVER-FITOUT-802.pdf",
    "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-02 - ELM-WAH-LTR-1110.pdf",
    "[C] Claimant Witness Statements/C0001.pdf",
    "[C] Claimant Witness Statements/C0002.pdf",
    "[D] Respondent Witness Statements/D0001.pdf",
    "[D] Respondent Witness Statements/D0002.pdf"
  ];

  return { fileReferences, filePaths };
}

// Load data from files or return fallback
export async function loadDataSources(): Promise<DataSources> {
  // Check if we can use file system API (won't work in browser)
  if (typeof window !== 'undefined') {
    console.log('Browser environment detected, using fallback data');
    return getFallbackData();
  }

  try {
    // In a real Next.js app, you'd load from API routes or static files
    // For now, return fallback data
    console.log('Using fallback data');
    return getFallbackData();
  } catch (error) {
    console.error('Error loading data sources:', error);
    return getFallbackData();
  }
}