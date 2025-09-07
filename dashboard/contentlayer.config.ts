import { defineDocumentType, makeSource } from 'contentlayer2/source-files';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

/** @type {import('contentlayer2/source-files').ComputedFields} */
const computedFields = {
  url: {
    type: 'string' as const,
    resolve: (doc: any) => `/docs/${doc._raw.flattenedPath}`,
  },
  urlPath: {
    type: 'string' as const,
    resolve: (doc: any) => doc._raw.flattenedPath,
  },
};

export const Doc = defineDocumentType(() => ({
  name: 'Doc',
  filePathPattern: `**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: {
      type: 'string',
      description: 'The title of the document',
      required: true,
    },
    description: {
      type: 'string',
      description: 'The description of the document',
      required: false,
    },
    date: {
      type: 'date',
      description: 'The date the document was published',
      required: false,
    },
  },
  computedFields,
}));

export default makeSource({
  contentDirPath: './docs',
  documentTypes: [Doc],
  mdx: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypePrettyCode,
        {
          theme: 'github-dark',
          keepBackground: false,
          onVisitLine(node: any) {
            // Prevent lines from collapsing in `display: grid` mode, and allow empty
            // lines to be copy/pasted
            if (node.children.length === 0) {
              node.children = [{ type: 'text', value: ' ' }];
            }
          },
          onVisitHighlightedLine(node: any) {
            node.properties.className.push('line--highlighted');
          },
          onVisitHighlightedWord(node: any) {
            node.properties.className = ['word--highlighted'];
          },
        },
      ],
      [
        rehypeAutolinkHeadings,
        {
          properties: {
            className: ['anchor'],
          },
        },
      ],
    ],
  },
});