"use client";
import React from "react";

import {
  useUpload,
  useHandleStreamResponse,
} from "../utilities/runtime-helpers";

function MainComponent() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef(null);
  const handleFinish = useCallback((message) => {
    setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    setStreamingMessage("");
    setIsProcessing(false);
  }, []);
  const handleStreamResponse = useHandleStreamResponse({
    onChunk: setStreamingMessage,
    onFinish: handleFinish,
  });
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [fileUploads, setFileUploads] = useState({});
  const [upload, { loading }] = useUpload();
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    setIsProcessing(true);
    setMessages((prev) => [...prev, { role: "user", content: inputMessage }]);
    setInputMessage("");

    try {
      const response = await fetch(
        "/integrations/anthropic-claude-sonnet-3-5/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, { role: "user", content: inputMessage }],
            stream: true,
          }),
        }
      );
      handleStreamResponse(response);
    } catch (error) {
      console.error("Error:", error);
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (files) => {
    for (const file of files) {
      try {
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 0,
        }));

        const { url, error } = await upload({
          file,
          onProgress: (progress) => {
            setUploadProgress((prev) => ({
              ...prev,
              [file.name]: progress,
            }));
          },
        });

        if (error) throw new Error(error);

        if (file.type.startsWith("image/")) {
          setFileUploads((prev) => ({
            ...prev,
            [file.name]: { url, type: "image" },
          }));

          const response = await fetch("/integrations/gpt-vision/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyze this image and describe what you see.",
                    },
                    {
                      type: "image_url",
                      image_url: { url },
                    },
                  ],
                },
              ],
            }),
          });

          if (!response.ok) throw new Error("Failed to analyze image");

          const result = await response.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "user",
              content: "Uploaded image for analysis",
              image: url,
            },
            {
              role: "assistant",
              content: result.choices[0].message.content,
            },
          ]);
        } else {
          setFileUploads((prev) => ({
            ...prev,
            [file.name]: { url, type: "file" },
          }));
          setMessages((prev) => [
            ...prev,
            {
              role: "user",
              content: `Uploaded file: ${file.name}`,
            },
          ]);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setUploadError(`Failed to upload ${file.name}: ${error.message}`);
        setTimeout(() => setUploadError(null), 5000);
      } finally {
        setUploadProgress((prev) => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] text-white font-inter p-4">
      <div className="max-w-4xl mx-auto relative">
        <div className="mb-8 flex items-center justify-between bg-[#1C2128] rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full bg-[#29B6F6] ${
                isProcessing ? "animate-pulse" : ""
              }`}
            ></div>
            <span className="text-[#29B6F6]">IGRIS Online</span>
          </div>
        </div>
        <div className="relative mb-8 flex items-center justify-center">
          <div className="logo-container">
            <div className="outer-ring"></div>
            <div
              className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#29B6F6] to-[#0288D1] rounded-full ${
                isProcessing ? "processing" : ""
              }`}
            >
              <div className="inner-symbol"></div>
              <div className="center-dot"></div>
            </div>
          </div>
          <div className="absolute -bottom-8 text-[#29B6F6] text-xl font-light tracking-wider">
            IGRIS
          </div>
        </div>

        <div
          className={`bg-[#1C2128] rounded-lg p-4 mb-4 h-[400px] overflow-y-auto relative ${
            isDragging ? "border-2 border-[#29B6F6] border-dashed" : ""
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const droppedFiles = [...e.dataTransfer.files];
            await handleFileUpload(droppedFiles);
          }}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-[#29B6F6] bg-opacity-10 flex items-center justify-center">
              <div className="text-[#29B6F6] text-xl">Drop files here</div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 ${
                message.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-[#29B6F6] bg-opacity-20"
                    : "bg-[#2D333B]"
                }`}
              >
                {message.image ? (
                  <div className="mb-2">
                    <img
                      src={message.image}
                      alt="Uploaded"
                      className="max-w-[200px] rounded-lg"
                    />
                  </div>
                ) : null}
                {message.content}
              </div>
            </div>
          ))}
          {streamingMessage && (
            <div className="text-left">
              <div className="inline-block p-3 rounded-lg bg-[#2D333B]">
                {streamingMessage}
              </div>
            </div>
          )}
          <div ref={messagesEndRef}></div>
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="w-full bg-[#1C2128] rounded-lg p-4 pr-24 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#29B6F6]"
            placeholder="Type your message..."
            disabled={isProcessing}
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-2">
            <label className="cursor-pointer text-[#29B6F6] hover:text-[#4FC3F7] transition-colors">
              <input
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  await handleFileUpload(files);
                }}
              />
              <i className="fas fa-paperclip"></i>
            </label>
            <button
              type="submit"
              disabled={isProcessing}
              className="text-[#29B6F6] hover:text-[#4FC3F7] transition-colors"
            >
              <i
                className={`fas fa-paper-plane ${
                  isProcessing ? "opacity-50" : ""
                }`}
              ></i>
            </button>
          </div>
        </form>

        {Object.entries(uploadProgress).map(([fileName, progress]) => (
          <div
            key={fileName}
            className="fixed bottom-20 right-4 bg-[#1C2128] p-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-file-upload text-[#29B6F6]"></i>
              <div className="flex-1">
                <div className="text-sm text-gray-300 truncate">{fileName}</div>
                <div className="w-full bg-[#2D333B] h-2 rounded-full mt-1">
                  <div
                    className="bg-[#29B6F6] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {uploadError && (
          <div className="fixed bottom-20 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg">
            {uploadError}
            <button
              onClick={() => setUploadError(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .animate-pulse {
    animation: pulse 1.5s infinite;
  }

  .logo-container {
    position: relative;
    width: 6rem;
    height: 6rem;
  }

  .outer-ring {
    position: absolute;
    inset: 0;
    border: 2px solid rgba(41, 182, 246, 0.2);
    border-radius: 50%;
  }

  .outer-ring::before {
    content: '';
    position: absolute;
    inset: -2px;
    border: 2px solid #29B6F6;
    border-radius: 50%;
    border-left-color: transparent;
    animation: rotate 8s linear infinite;
  }

  .inner-symbol {
    position: absolute;
    width: 50%;
    height: 50%;
    border: 2px solid rgba(255, 255, 255, 0.9);
    clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
  }

  .center-dot {
    position: absolute;
    width: 10px;
    height: 10px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    filter: blur(2px);
    animation: glow 2s ease-in-out infinite;
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes glow {
    0% { 
      opacity: 0.5;
      transform: scale(0.8);
      filter: blur(2px);
    }
    50% { 
      opacity: 1;
      transform: scale(1.2);
      filter: blur(3px);
    }
    100% { 
      opacity: 0.5;
      transform: scale(0.8);
      filter: blur(2px);
    }
  }

  .processing .center-dot {
    animation: glow 1s ease-in-out infinite;
    filter: blur(4px);
  }

  .processing .outer-ring::before {
    border-width: 3px;
    animation: rotate 4s linear infinite;
  }

  .file-drop-zone {
    transition: all 0.3s ease;
  }

  .file-preview {
    transition: transform 0.2s ease;
  }

  .file-preview:hover {
    transform: scale(1.05);
  }
`}</style>
    </div>
  );
}

export default MainComponent;