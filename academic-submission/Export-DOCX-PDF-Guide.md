# DOCX + PDF Export Guide (Free)

## Option A: LibreOffice (No extra install after LibreOffice)
1. Open each phase markdown in VS Code.
2. Copy into a LibreOffice Writer master document in this order:
   - `00-Index.md`
   - `Phase-1-Proposal.md`
   - `Phase-2-Modelling.md`
   - `Phase-3-UI.md`
   - `Phase-4-Database.md`
   - `Phase-5-Final-Deliverables.md`
3. Insert diagram PNG files from `diagrams/exports/`.
4. Save as `.docx`.
5. Export as PDF (`File -> Export As -> Export as PDF`).

## Option B: Pandoc (if installed)
```bash
pandoc academic-submission/Phase-1-Proposal.md \
       academic-submission/Phase-2-Modelling.md \
       academic-submission/Phase-3-UI.md \
       academic-submission/Phase-4-Database.md \
       academic-submission/Phase-5-Final-Deliverables.md \
       -o academic-submission/YoScore-Academic-Submission.docx
```
Then open DOCX and export PDF.

## Final Attachments Checklist
- DOCX file
- PDF file
- Source project zip
- SQL scripts (`academic-submission/sql`)
- Diagram source + PNG exports
- Test evidence document
- Demo video/link
