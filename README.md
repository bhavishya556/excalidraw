<!-- 108108 -->

# EXCALIDRAW   
Thank you for giving me this opportunity. I have chosen to develop an 'Export as PDF' with annotation feature.

**Live Demo Link(deploy)**: [EXCALIDRAW](https://excalidraw-madelineandco.netlify.app/)   

![madline](https://github.com/user-attachments/assets/f2976c8f-0a6b-416d-ab7d-b32918c5539a)

## Installation  

To run this project locally, follow these steps:  


1. Clone the repository:  
   ```bash  
   git clone https://github.com/bhavishya556/excalidraw.git
2. Install dependencies:
(in root directory of the project) 
   ```bash  
   yarn install  
3. Navigate to the project directory:
 (for windows)
   ```bash  
   cd excalidraw-app
 4. Start Project:  (project start on port 3001)
     (make sure you run this command in excalidraw-app directory)
      ```bash  
     yarn start --port 3001
     
   ## Features  

- **Export PDF Button**:  
  This feature allows users to export the current content as a PDF file for easy sharing and offline access.  
   

  ![export](https://github.com/user-attachments/assets/ac20016b-37bf-4d49-b507-4ad2165c1352)


- **Background**:  
  Switches between light and dark modes, changing the background color accordingly.
  ![back](https://github.com/user-attachments/assets/7b844eab-8f16-4250-99da-90b905777099)

- **Dark Mode**:  
  Enables dark mode with a black background for better low-light viewing.  
![dark](https://github.com/user-attachments/assets/289ed9e6-9fa1-489a-8f09-59d284ed8943)

- **Scale**:  
  Provides zoom options with 1x, 2x, and 3x scaling.  
![scale](https://github.com/user-attachments/assets/24429a61-7ba2-4976-980a-a401fbe52cf7)

- **Annotation**:  
  Displays annotations at the end of the PDF when enabled.  
![annotation](https://github.com/user-attachments/assets/66cec21a-c3c0-413c-961e-2b019935836f)



## Limitations  

- If the canvas (whiteboard) is too large, the content cut off and not fully exported to the PDF.  
- The annotation feature is basic and limited in functionality.  

## Code Review  

Although I contributed to many files in the codebase, this was the where I contributed the most. 
(click here to see the file on github)
- [export.ts](https://github.com/bhavishya556/excalidraw/blob/main/packages/utils/export.ts)
- [PdfExportDialog.tsx](https://github.com/bhavishya556/excalidraw/blob/main/packages/excalidraw/components/PdfExportDialog.tsx) 
- [LayerUI.tsx](https://github.com/bhavishya556/excalidraw/blob/main/packages/excalidraw/components/LayerUI.tsx) 

## 

### Thanks Again

Bhavishya Verma  
vermabhavi7890@gmail.com 
(+91) 8766255927
[LinkedIn](https://www.linkedin.com/in/bhavishy/) 






