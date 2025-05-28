
import React, { useRef, useState } from 'react';
import { FaUpload } from 'react-icons/fa';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  label: string;
  acceptedFileType?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, label, acceptedFileType = ".csv" }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileUpload(file);
      // Reset input value to allow re-uploading the same file
      if(fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
    } else {
      setFileName(null);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mb-4 p-4 border border-dashed border-gray-300 rounded-lg bg-white hover:border-primary transition-colors">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={acceptedFileType}
        className="hidden"
        id={`file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`}
      />
      <button
        onClick={triggerFileInput}
        className="w-full flex flex-col items-center justify-center px-4 py-6 text-gray-600 rounded-lg cursor-pointer hover:text-primary"
      >
        <FaUpload className="text-3xl mb-2" />
        <span className="font-medium">{label}</span>
        {fileName && <span className="text-sm text-gray-500 mt-1">{fileName}</span>}
        {!fileName && <span className="text-sm text-gray-500 mt-1">Trascina qui o clicca per selezionare</span>}
      </button>
    </div>
  );
};

export default FileUpload;
    