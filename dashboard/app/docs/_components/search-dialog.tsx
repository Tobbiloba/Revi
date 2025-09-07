'use client';

import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import SearchButton from './search-button';
import { Text, Search } from 'lucide-react';
import Link from 'next/link';

export interface DocType {
  title: string;
  body: { raw?: string };
  _raw: { flattenedPath: string };
}

export interface SearchDialogProps {
  searchData: DocType[];
}

export interface SearchDialogHandle {
  close: () => void;
  open: () => void;
}

function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded font-medium">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

function getSnippet(
  text: string,
  searchTerm: string,
  contextLength: number = 40
): React.ReactNode {
  if (!searchTerm) return text;
  const regex = new RegExp(searchTerm, 'i');
  const match = regex.exec(text);
  if (!match) return text;
  const start = Math.max(0, match.index - contextLength);
  const end = Math.min(
    text.length,
    match.index + match[0].length + contextLength
  );
  const snippet = text.substring(start, end);
  return (
    <>
      {start > 0 && '…'}
      {highlightText(snippet, searchTerm)}
      {end < text.length && '…'}
    </>
  );
}

const SearchDialog = forwardRef<SearchDialogHandle, SearchDialogProps>(
  ({ searchData }, ref) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    useImperativeHandle(ref, () => ({
      close: () => setOpen(false),
      open: () => setOpen(true),
    }));

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setOpen(true);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const filteredDocs = useMemo(() => {
      if (!query) return [];
      const q = query.toLowerCase();
      return searchData.filter((doc) => {
        const title = doc.title.toLowerCase();
        const description = (doc.body.raw || '').toLowerCase();
        return title.includes(q) || description.includes(q);
      });
    }, [query, searchData]);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className='hidden sm:block'>
          <SearchButton
            size="sm"
            placeholder="Search documentation.."
          />
        </DialogTrigger>
        <DialogContent className="fixed h-auto sm:max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl p-0 top-32 rounded-xl">
        {/* Close Button */}
        {/* <DialogCloseTrigger asChild>
          <button
            className="cursor-pointer border border-border text-lg absolute -top-2 -right-2 bg-muted text-black dark:text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
            aria-label="Close"
          >
            &times;
          </button>
        </DialogCloseTrigger> */}
          {/* <DialogHeader>
            <DialogTitle>Search Documentation</DialogTitle>
            <DialogDescription>Type below to search your docs.</DialogDescription>
          </DialogHeader> */}
          <div className="relative border-b border-gray-200 dark:border-gray-700">
            <Input
              type="text"
              className="w-full bg-transparent focus:outline-none border-0 focus:ring-0 pl-12 pr-4 py-4 text-lg placeholder:text-gray-400 dark:placeholder:text-gray-500"
              placeholder="Search the docs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="text-gray-400 dark:text-gray-500" size={20} />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {filteredDocs.length > 0 ? (
              <ul className="list-none p-0">
                {filteredDocs.map((doc) => (
                  <li key={doc._raw.flattenedPath}>
                    <Link
                      href={`/docs/${doc._raw.flattenedPath}`}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition-colors duration-150"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1.5 rounded-md bg-blue-50 dark:bg-blue-950">
                          <Text className="text-blue-600 dark:text-blue-400" size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {highlightText(doc.title, query)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {getSnippet(doc.body.raw || 'No description', query)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                  <Search size={32} className="mx-auto mb-3 opacity-50" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {query.length > 0 ? 'No results found.' : 'Type to search documentation...'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

SearchDialog.displayName = 'SearchDialog';

export default SearchDialog;