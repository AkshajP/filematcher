// data-loader.js - Data Loading and Parsing Functions

// Data sources - will be loaded from files (future API endpoints)
// Make these global so other modules can access them
window.fileReferences = [];
window.filePaths = [];

// Load data from files
async function loadDataSources() {
    // API Detection
    if (typeof window === "undefined" || !window.fs || !window.fs.readFile) {
        console.log("File reading API not available, using fallback data");
        return loadFallbackData();
    }

    try {
        // Load file references
        const referencesContent = await window.fs.readFile('Doc Description.txt', { encoding: 'utf8' });
        console.log("referencesContent:", referencesContent);
        window.fileReferences = parseFileReferences(referencesContent);
        
        // Load file paths  
        const pathsContent = await window.fs.readFile('matchings.txt', { encoding: 'utf8' });
        window.filePaths = parseFilePaths(pathsContent);
        
        console.log(`Loaded ${window.fileReferences.length} file references and ${window.filePaths.length} file paths`);
        return true;
    } catch (error) {
        console.error('Error loading data sources:', error);
        // Fallback to hardcoded data
        return loadFallbackData();
    }
}


// Parse file references from Doc Description.txt format
function parseFileReferences(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => line.trim());
}

// Parse file paths from matchings.txt format
function parseFilePaths(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => line.trim().replace(/^"|"$/g, '').replace(/",?$/, ''));
}

// Fallback data (existing hardcoded data)
function loadFallbackData() {
    window.fileReferences = [
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
        "Exhibit A5-04 - Claimant Letter",
        "Exhibit A5-05 - Claimant Letter",
        "Exhibit A5-06 - Claimant Letter",
        "Exhibit A5-08 - Claimant Letter",
        "Exhibit A5-09 - Claimant Letter",
        "Exhibit A5-10 - Claimant Letter",
        "Exhibit A5-11 - Claimant Letter",
        "Exhibit A5-12 - Claimant Letter",
        "Exhibit A5-13 - Claimant Letter",
        "Exhibit A5-14 - Claimant Letter",
        "Exhibit A5-15 - Claimant Letter",
        "Exhibit A5-16 - EL Claimant Letter",
        "Exhibit A5-17 - Claimant Letter",
        "Exhibit A5-18 - Claimant Letter",
        "Exhibit A5-19 - Claimant Letter",
        "Exhibit A5-20 - Claimant Letter",
        "Exhibit A5-21 - Claimant Letter",
        "Exhibit A5-22 - Claimant Letter",
        "Exhibit A5-23 - Claimant Letter",
        "Exhibit A5-24 - Claimant Letter",
        "Exhibit A5-25 - Claimant Letter",
        "Exhibit A5-26 - Claimant Letter",
        "Exhibit A5-27 - Claimant Letter",
        "Exhibit A5-28 - Claimant Letter",
        "Exhibit A5-29 - Claimant Letter",
        "Exhibit A5-30 - Claimant Letter",
        "Exhibit A5-31 - Claimant Letter",
        "Exhibit A5-32 - Claimant Letter",
        "Exhibit A5-33 - Claimant Letter",
        "Exhibit A5-34 - Claimant Letter",
        "Exhibit A5-37 - Claimant Letter",
        "Exhibit A5-38 - Claimant Letter",
        "Appendix 8 to Claimant's Statement of Claim – Claim No.10 – Quantum Calculation",
        "Appendix 9 to Claimant's Statement of Claim – Claim No.11 - Quantum Calculation",
        "Appendix 10 to Claimant's Statement of Claim – Claim No.27 - Quantum Calculation",
        "Appendix 11 to Claimant's Statement of Claim – Index of Supporting Documents and Evidence",
        "Claimant's Reply & Defence to Counterclaims (RDCC)",
        "Appendix 1 to RDCC – Finishes Codes - Design Changes and Engineering Issues",
        "Appendix 2 to RDCC – Issues, Allegations and Responses.pdf",
        "Appendix 2 to RDCC – 001 - Approved Method Statement for Screed Works",
        "Appendix 2 to RDCC – 002 - Approved Vanity Counter Shop Drawings",
        "Appendix 2 to RDCC – 003 - Claimant letter",
        "Appendix 2 to RDCC – 004 - Approved wet area waterproofing method statement",
        "Appendix 2 to RDCC – 005 - Approved wet area waterproofing MAR",
        "Appendix 2 to RDCC – 006 - Claimant Letter",
        "Appendix 2 to RDCC – 007 - Claimant Letter",
        "Appendix 2 to RDCC – 007 - Claimant Letter",
        "Appendix 2 to RDCC – 008 - Approved Method Statement for Installation of Wall Coverings",
        "Appendix 2 to RDCC – 009 - Claimant letter",
        "Appendix 2 to RDCC – 010 - Approved Method Statement for Installation of Wall Coverings",
        "Appendix 2 to RDCC – 011 - Claimant Letter",
        "Appendix 2 to RDCC – 011 - Claimant Letter",
        "Appendix 2 to RDCC – 011 - Claimant Letter",
        "Appendix 2 to RDCC – 012 - Claimant Letter",
        "Appendix 2 to RDCC – 012 - Claimant Letter",
        "Appendix 2 to RDCC – 013 - Claimant Letter",
        "Appendix 2 to RDCC – 013 - Claimant Letter",
        "Appendix 3 to RDCC – Index of Supporting Documents and Evidence",
        "Respondent's Answer and Counterclaim",
        "Respondent's Statement of Defence and Counterclaim",
        "Respondent's Statement of Rejoinder and Reply to Counterclaim Defence",
        "CW-1 - First Witness Statement of Mr. Chakib Nayfe",
        "CW-2 - First Witness Statement of Mr. Sami Zekeriya",
        "CW-3 - First Witness Statement of Mr. Manoj Patil",
        "CW-4 - First Witness Statement of Mr. Antonio Barretto",
        "CW-5 - First Witness Statement of Mr. Ahamadu Ashkar",
        "CW-6 - First Witness Statement of Mr. Erdem Cevirici",
        "CW-7 - Second Witness Statement of Mr. Chakib Nayfe",
        "CW-8 - Second Witness Statement of Mr. Sami Zekeriya",
        "CW-9 - Second Witness Statement of Mr. Manoj Patil",
        "CW-10 - Second Witness Statement of Mr. Antonio Barretto",
        "CW-11 - Second Witness Statement of Mr. Erdem Cevirici",
        "CW-12 - First Witness Statement of Mr. Bahtiyar Gelyagil",
        "RW-1 - First Witness Statement of Mr. Mostapha Alkhatib",
        "RW-2 - First Witness Statement of Mr. Nassr Zubaidi",
        "RW-3 - First Witness Statement of Mr. Eranga Alwis",
        "RW-4 - First Witness Statement of Mr. Omar Mohammad",
        "RW-5 – Second Witness Statement of Mr. Nassr Zubaidi",
        "RW-6 - Second Witness Statement of Mr. Eranga Alwis",
        "RW-7 - Second Witness Statement of Mr. Omar Mohammad",
        "CX-KK1 - First Quantum Expert Report of Kevin Kelly",
        "Appendix 1 - KK1 – Curriculum Vitae of Kevin Kelly, Ciaran Coates and Paul Kelly",
        "Appendix 2 - KK1 - Cl.8 - Prolongation Costs",
        "Appendix 3 - KK1 - Cl.12 & Cl.19 - Increased Manpower and Escalation in Labour Rates",
        "Appendix 4 - KK1 - Cl.13 - Idle Manpower due to Power Cuts"
    ];

    window.filePaths = [
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
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-03 - ELM-WAH-LTR-1110.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-04 - ELM-WAH-LTR-0907.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-05 - ELM-WAH-LTR-1032.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-06 - ELM-WAH-LTR-0544.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-08 - ELM-WAH-LTR-0865.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-09 - ELM-WAH-LTR-1033.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-10 - ELM-WAH-LTR-1038.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-11 - ELM-WAH-LTR-1063.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-12 - ELM-WAH-LTR-0803.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-13 - ELM-WAH-LTR-0953.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-14 - ELM-WAH-LTR-0968.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-15 - ELM-WAH-LTR-0971.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-16 - ELM-WAH-LTR-0749.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-17 - ELM-WAH-LTR-0750.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-18 - ELM-WAH-LTR-0772.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-19 - ELM-WAH-LTR-1014.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-20 - ELM-WAH-LTR-0728.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-21 - ELM-WAH-LTR-1047.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-22 - ELM-WAH-LTR-1048.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-23 - ELM-WAH-LTR-1081.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-24 - ELM-WAH-LTR-1081.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-25 - ELM-WAH-LTR-0718.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-26 - ELM-WAH-LTR-0859.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-27 - ELM-WAH-LTR-0922.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-28 - ELM-WAH-LTR-0807.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-29 - ELM-WAH-LTR-0816.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-30 - ELM-WAH-LTR-0879.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-31 - ELM-WAH-LTR-0952.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-32 - ELM-WAH-LTR-1050.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-33 - ELM-WAH-LTR-0741.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-34 - ELM-WAH-LTR-0845.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-37 - ELM-WAH-LTR-0817.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 7 - Other Delay Events/Exhibits to Appendix 7 - Other Delaying Events/A5-38 - ELM-WAH-LTR-0835.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 8 - Claim No.10 - Quantum Calculation/Appendix 8 - Claim No.10 - Quantum Calculation.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 9 - Claim No.11 - Quantum Calculation/Appendix 9 - Claim No.11 - Quantum Calculation.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 10 - Claim No.27 - Quantum Calculation/Appendix 10 - Claim No.27 - Quantum Calculation.pdf",
        "[A] Claimant Submissions/Appendices to Statement of Claim/Appendix 11 - Index of Supporting Documents and Evidence/Appendix 11 – Index of Supporting Documents and Evidence.pdf",
        "[A] Claimant Submissions/20250108. - ELM v La Jolla - RDCC (Submission).pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 1 - FInishes Codes - Design Changes and Engineering Issues_.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/Appendix 2 - Issues, Allegations and Responses.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-001 - Approved Method Statement for Screed Works dated 26 August 2020.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-002 - Approved Vanity Counter Shop Drawings.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-003 - Claimant letter ref. ELM-WAH-LTR-1033 dated 19 April 2023.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-004 - Approved wet area waterproofing method statement.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-005 - Approved wet area waterproofing MAR.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-006 - ELM-WAH-LTR-0880 dated 13 November 2022.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-007 - ELM-WAH-LTR-0770 dated 19 September 2.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-007 -  ELM-WAH-LTR-0810 dated 3 October 2022.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-008 - Approved Method Statement for Installation of Wall Coverings .pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-009 - Claimant letter ref. ELM-WAH-LTR-0370 dated 28 December 2020.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-010 - Approved Method Statement for Installation of Wall Coverings dated 26 August 2020.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-011 - ELM-WAH-LTR-0807.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-011 - ELM-WAH-LTR-0808.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-011 - ELM-WAH-LTR-0816.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-012 - ELM-WAH-LTR-0770 dated 19 September.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-012 - ELM-WAH-LTR-0810 dated 3 October 2022.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-013 - ELM-WAH-LTR-0867 dated 31 October 202.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 2 - Responses to Allegations regarding Quality/RDCC-APPENDIX-2-013 - ELM-WAH-LTR-0631 dated 8 June 2022.pdf",
        "[A] Claimant Submissions/Appendices to RDCC (Submission)/Appendix 3 – Index of Supporting Documents and Evidence.pdf",
        "[B] Respondent Submissions/B0001.pdf",
        "[B] Respondent Submissions/B0002.pdf",
        "[B] Respondent Submissions/B0003.pdf",
        "[C] Claimant Witness Statements/C0001.pdf",
        "[C] Claimant Witness Statements/C0002.pdf",
        "[C] Claimant Witness Statements/C0003.pdf",
        "[C] Claimant Witness Statements/C0004.pdf",
        "[C] Claimant Witness Statements/C0005.pdf",
        "[C] Claimant Witness Statements/C0006.pdf",
        "[C] Claimant Witness Statements/C0007.pdf",
        "[C] Claimant Witness Statements/C0008.pdf",
        "[C] Claimant Witness Statements/C0009.pdf",
        "[C] Claimant Witness Statements/C0010.pdf",
        "[C] Claimant Witness Statements/C0011.pdf",
        "[C] Claimant Witness Statements/C0012.pdf",
        "[D] Respondent Witness Statements/D0001.pdf",
        "[D] Respondent Witness Statements/D0002.pdf",
        "[D] Respondent Witness Statements/D0003.pdf",
        "[D] Respondent Witness Statements/D0004.pdf",
        "[D] Respondent Witness Statements/D0005.pdf",
        "[D] Respondent Witness Statements/D0006.pdf",
        "[D] Respondent Witness Statements/D0007.pdf",
        "[E] Claimant Expert Reports/CX-KK - 2024.05.01 - First Expert Quantum Report of Kevin Kelly.pdf",
        "[E] Claimant Expert Reports/Appendices to First Expert Quantum Report of Kevin Kelly/Appendix 1 - CV of Kevin Kelly, Ciaran Coates and Paul Kelly.pdf",
        "[E] Claimant Expert Reports/Appendices to First Expert Quantum Report of Kevin Kelly/Appendix 2 - KK1 - Cl.8 - Prolongation Costs.xlsx",
        "[E] Claimant Expert Reports/Appendices to First Expert Quantum Report of Kevin Kelly/Appendix 3 - KK1 - Cl.12 & Cl.19 - Increased Manpower and Escalation in Labour Rates.xlsx",
        "[E] Claimant Expert Reports/Appendices to First Expert Quantum Report of Kevin Kelly/Appendix 4 - KK1 - Cl.13 - Idle Manpower due to Power Cuts.xlsx"
    ];
    
    console.log('Using fallback data');
    return true;
}