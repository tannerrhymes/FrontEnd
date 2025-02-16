import { useState, useRef, useCallback } from 'react'
import { s3Client } from './config/aws-config'
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import './App.css'
import * as ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { validateFileOnServer } from './utils/serverValidation';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['csv', 'xlsx', 'xls'];

function App() {
  const [files, setFiles] = useState([]);
  const [uploadStatus, setUploadStatus] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState({});
  const [globalError, setGlobalError] = useState(null);
  const [uploadCount, setUploadCount] = useState(0);

  // Remove or comment out the test console.logs since we know they work
  // console.log('AWS Region:', import.meta.env.VITE_AWS_REGION);
  // console.log('S3 Bucket:', import.meta.env.VITE_AWS_S3_BUCKET);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const newFiles = [...e.dataTransfer.files];
    await handleFiles(newFiles);
  };

  const handleFileSelect = async (e) => {
    const newFiles = [...e.target.files];
    await handleFiles(newFiles);
  };

  const validateFile = (file) => {
    const errors = [];
    
    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File ${file.name} is too large. Maximum size is 5MB`);
    }

    // Type validation
    const fileType = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(fileType)) {
      errors.push(`File ${file.name} is not supported. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
    }

    return errors;
  };

  const validateData = (data) => {
    // Add your data validation rules here
    const errors = [];
    
    // Example: Check if data has required columns
    const requiredColumns = ['date', 'value'];
    const columns = Object.keys(data[0] || {});
    
    requiredColumns.forEach(col => {
      if (!columns.includes(col)) {
        errors.push(`Missing required column: ${col}`);
      }
    });

    // Example: Check for empty rows
    data.forEach((row, index) => {
      if (Object.values(row).every(val => !val)) {
        errors.push(`Empty row detected at line ${index + 1}`);
      }
    });

    return errors;
  };

  const handleFiles = async (newFiles) => {
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    
    for (const file of newFiles) {
      try {
        setUploadStatus(prev => ({
          ...prev,
          [file.name]: { status: 'validating', progress: 0 }
        }));

        // Client and server validation
        const clientErrors = validateFile(file);
        if (clientErrors.length > 0) {
          setUploadStatus(prev => ({
            ...prev,
            [file.name]: { status: 'error', errors: clientErrors }
          }));
          continue;
        }

        // Upload to S3
        setUploadStatus(prev => ({
          ...prev,
          [file.name]: { status: 'uploading', progress: 0 }
        }));

        await uploadToS3WithProgress(file, (progress) => {
          setUploadStatus(prev => ({
            ...prev,
            [file.name]: { status: 'uploading', progress }
          }));
        });

        setUploadStatus(prev => ({
          ...prev,
          [file.name]: { status: 'complete', progress: 100 }
        }));

      } catch (error) {
        setUploadStatus(prev => ({
          ...prev,
          [file.name]: { status: 'error', errors: [error.message] }
        }));
      }
    }
  };

  const simulateFileUpload = (file) => {
    let progress = 0;
    setProgress(prev => ({ ...prev, [file.name]: 0 }));

    const interval = setInterval(() => {
      progress += 10;
      setProgress(prev => ({ ...prev, [file.name]: progress }));

      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 500);
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const uploadToS3WithProgress = async (file, onProgress) => {
    try {
      const fileName = `trending-data/${Date.now()}-${file.name}`;
      
      // Create pre-signed POST data
      const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: import.meta.env.VITE_AWS_S3_BUCKET,
        Key: fileName,
        Conditions: [
          ["content-length-range", 0, MAX_FILE_SIZE],
        ],
        Expires: 3600,
      });

      // Create form data
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      return new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 204) {
            resolve({
              key: fileName,
              url: `https://${import.meta.env.VITE_AWS_S3_BUCKET}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${fileName}`
            });
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('POST', url, true);
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error in uploadToS3WithProgress:', error);
      throw error;
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-box">
        <h1 className="upload-title">Screw Compressor Trending Data</h1>
        <p className="upload-subtitle">Upload trending data to continue</p>
        
        <div 
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
          />
          
          <div className="upload-content">
            <button className="add-files-button" onClick={handleButtonClick}>
              Add files
            </button>
            <p className="drag-text">or drag stuff here</p>
          </div>

          {/* File Status Display */}
          <div className="file-list">
            {Object.entries(uploadStatus).map(([fileName, status]) => (
              <div key={fileName} className="file-item">
                <div className="file-info">
                  <span className="filename">{fileName}</span>
                  <span className="status">{status.status}</span>
                </div>
                {status.status === 'uploading' && (
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${status.progress}%` }}
                    />
                  </div>
                )}
                {status.status === 'error' && (
                  <div className="error-message">
                    {status.errors.join(', ')}
                  </div>
                )}
                {status.status === 'complete' && (
                  <div className="success-icon">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="dropbox-footer">
          <p className="footer-text">
            Your files will be uploaded and processed securely. More about{' '}
            <a href="#" className="footer-link">how to best utilize this tool</a> and our{' '}
            <a href="#" className="footer-link">privacy policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;