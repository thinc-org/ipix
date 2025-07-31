import type { FileType } from "../types/file";
import type { FolderType } from "../types/folder";

export const mockFolders: FolderType[] = [
  { id: "root", name: "root", parent: null, imageCount: 0 },
  { id: "1", name: "Documents", parent: "root", imageCount: 0 },
  { id: "2", name: "Images", parent: "root", imageCount: 2 },
  { id: "3", name: "Work", parent: "root", imageCount: 0 },
  { id: "8", name: "Presentations", parent: "3", imageCount: 0 },
];
export const mockFiles: FileType[] = [
  {
    id: "4",
    name: "Resume.pdf",
    url: "/files/resume.pdf",
    parent: "root",
    size: "1.2 MB",
    uploadDate: new Date("2024-06-01"),
  },
  {
    id: "5",
    name: "Project Proposal.docx",
    url: "/files/proposal.docx",
    parent: "root",
    size: "2.5 MB",
    uploadDate: new Date("2024-06-02"),
  },
  {
    id: "6",
    name: "Vacation.jpg",
    url: "/files/vacation.jpg",
    parent: "2",
    size: "3.7 MB",
    uploadDate: new Date("2024-06-03"),
  },
  {
    id: "7",
    name: "Profile Picture.png",
    url: "/files/profile.png",
    parent: "2",
    size: "1.8 MB",
    uploadDate: new Date("2024-06-04"),
  },
  {
    id: "9",
    name: "Q4 Report.pptx",
    url: "/files/q4-report.pptx",
    parent: "8",
    size: "5.2 MB",
    uploadDate: new Date("2024-06-05"),
  },
  {
    id: "10",
    name: "Budget.xlsx",
    url: "/files/budget.xlsx",
    parent: "3",
    size: "1.5 MB",
    uploadDate: new Date("2024-06-06"),
  },
];
