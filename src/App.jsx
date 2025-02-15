import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles) => {
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    
    newFiles.forEach(file => {
      simulateFileUpload(file);
    });
  };

  const simulateFileUpload = (file) => {
    let progress = 0;
    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(prev => ({ ...prev, [file.name]: progress }));

      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 500);
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="upload-container">
      <div className="upload-box">
        <h1 className="upload-title">Document Compressor</h1>
        <p className="upload-subtitle">Upload your trending data to continue</p>
        
        <div 
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            style={{ display: 'none' }}
            multiple
          />
          <button className="add-files-button" onClick={handleButtonClick}>
            Add files
          </button>
          <p className="drag-text">or drag stuff here</p>
          
          {files.length > 0 && (
            <div className="file-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-info">
                    <span>{file.name}</span>
                    <span className="file-size">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  {uploadProgress[file.name] !== undefined && (
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar"
                        style={{ width: `${uploadProgress[file.name]}%` }}
                      />
                      <span className="progress-text">
                        {uploadProgress[file.name]}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dropbox-footer">
          <div className="logo-container">
            {/* You can add your logo here */}
          </div>
          <p className="footer-text">
            Your data will be processed securely. More about <a href="#">how to best utilize this program</a> and our <a href="#">privacy policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App