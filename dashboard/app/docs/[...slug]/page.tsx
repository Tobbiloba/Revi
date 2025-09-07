import { allDocs } from 'contentlayer2/generated';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Mdx } from '../_components/mdx-components';
import Breadcrumb from '../_components/bread-crumb';
import Toc from '../_components/toc';

type tParams = Promise<{ slug: string[] }>;

export const generateStaticParams = async () => {
  return allDocs.map((doc) => {
    // For a path like "getting-started/introduction",
    // this creates { slug: ['getting-started', 'introduction'] }
    const slugArray = doc._raw.flattenedPath.split('/');
    return { slug: slugArray };
  });
};

export const generateMetadata = async ({ params }: { params: tParams }) => {
  // Join the slug array back into a path string
  const awaitedParams = await params;
  const path = awaitedParams.slug.join('/');
  const doc = allDocs.find((doc) => doc._raw.flattenedPath === path);

  if (!doc) throw new Error(`Doc not found for slug: ${path}`);
  return {
    title: doc.title,
    description: doc.description || 'A detailed guide to the topic.',
    openGraph: {
      title: doc.title,
      description: doc.description || 'A detailed guide to the topic.',
    },
  };
};

const DocsPage = async ({ params }: { params: tParams }) => {
  const awaitedParams = await params;
  // Join the slug array back into a path string
  const path = awaitedParams.slug.join('/');
  const doc = allDocs.find((doc) => doc._raw.flattenedPath === path);

  if (!doc) notFound();
  return (
    <div className="py-8 px-6 md:px-8">
    <div className="max-w-7xl mx-auto">
      <div className={`grid xl:grid xl:grid-cols-[1fr_280px] gap-16`}>
        <article className="min-w-0 max-w-4xl">
          <header className="mb-8 border-b border-gray-700 pb-6">
            <div className="mb-4">
              <Breadcrumb path={doc.url} />
            </div>
            {doc.date && (
              <time dateTime={doc.date} className="mb-4 text-sm font-medium text-blue-400 block tracking-wide uppercase">
                {new Date(doc.date).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </time>
            )}
            <div className="space-y-3">
              <h1 className="font-edu text-3xl md:text-4xl font-medium text-white tracking-tight leading-tight">
                {doc.title}
              </h1>
              {doc.description && (
                <p className="text-base text-gray-400 leading-relaxed font-normal max-w-3xl">
                  {doc.description}
                </p>
              )}
            </div>
          </header>
          <div className="prose-content">
            <Mdx code={doc.body.code} />
          </div>
        </article>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
            <Toc doc={{
              title: doc.title,
              slug: doc._raw.flattenedPath
            }} />
          </Suspense>
        </aside>
      </div>
    </div>
    </div>
  );
};

export default DocsPage;
