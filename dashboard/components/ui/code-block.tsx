"use client";
import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, CheckCheck } from "lucide-react";

type CodeBlockProps = {
  language: string;
  filename: string;
  highlightLines?: number[];
} & (
  | {
      code: string;
      tabs?: never;
    }
  | {
      code?: never;
      tabs: Array<{
        name: string;
        code: string;
        language?: string;
        highlightLines?: number[];
      }>;
    }
);

export const CodeBlock = ({
  language,
  filename,
  code,
  highlightLines = [],
  tabs = [],
}: CodeBlockProps) => {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);

  const tabsExist = tabs.length > 0;

  const copyToClipboard = async () => {
    const textToCopy = tabsExist ? tabs[activeTab].code : code;
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeCode = tabsExist ? tabs[activeTab].code : code;
  const activeLanguage = tabsExist
    ? tabs[activeTab].language || language
    : language;
  const activeHighlightLines = tabsExist
    ? tabs[activeTab].highlightLines || []
    : highlightLines;

  return (
    <div style={{
        "opacity": 1, "filter": "blur(0px)", "transform": "none"
    }} className="relative w-full bg-white/10 backdrop-blur-md rounded-lg p-4 text-sm border border-gray-700/30 shadow-lg">
      <div className="flex flex-col gap-2">
        {tabsExist && (
          <div className="flex overflow-x-auto border-b border-gray-700/30 pb-2 mb-3">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`px-3 py-2 text-xs transition-colors font-light rounded-md mr-1 ${
                  activeTab === index
                    ? "text-white bg-white/10"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        )}
        {!tabsExist && filename && (
          <div className="flex justify-between items-center py-2 border-b border-gray-700/30 pb-3 mb-3">
            <div className="text-sm text-gray-400 font-light">{filename}</div>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors font-light px-2 py-1 rounded hover:bg-white/5"
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}
        {tabsExist && (
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors font-light px-2 py-1 rounded hover:bg-white/5"
            >
              {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
              <span className="ml-1">{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>
      <SyntaxHighlighter
        language={activeLanguage}
        style={atomDark}
        customStyle={{
          margin: 0,
          padding: 0,
          background: "transparent",
          fontSize: "0.875rem", // text-sm equivalent
        }}
        wrapLines={true}
        showLineNumbers={true}
        lineProps={(lineNumber) => ({
          style: {
            backgroundColor: activeHighlightLines.includes(lineNumber)
              ? "rgba(255,255,255,0.1)"
              : "transparent",
            display: "block",
            width: "100%",
          },
        })}
        PreTag="div"
      >
        {String(activeCode)}
      </SyntaxHighlighter>
    </div>
  );
};
