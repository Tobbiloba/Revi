import { Rocket, Code2 } from 'lucide-react';

export const sidebarNav = [
  {
    title: 'Getting Started',
    icon: <Rocket className="h-5 w-5" />,
    defaultOpen: true,
    pages: [
      {
        title: 'Introduction',
        href: '/docs/getting-started/introduction',
      },
      {
        title: 'Installation',
        href: '/docs/getting-started/installation',
      },
      {
        title: 'Quick Start',
        href: '/docs/getting-started/quick-start',
      },
    ],
  },
  {
    title: 'Framework Integration',
    icon: <Code2 className="h-5 w-5" />,
    defaultOpen: false,
    pages: [
      {
        title: 'Next.js',
        href: '/docs/integrations/nextjs',
      },
      {
        title: 'React',
        href: '/docs/integrations/react',
      },
      {
        title: 'Vue.js',
        href: '/docs/integrations/vuejs',
      },
      {
        title: 'Angular',
        href: '/docs/integrations/angular',
      },
      {
        title: 'Svelte',
        href: '/docs/integrations/svelte',
      },
      {
        title: 'Vanilla JavaScript',
        href: '/docs/integrations/vanilla',
      },
    ],
  },
];
