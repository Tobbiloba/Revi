# Contributing to Revi

Thank you for your interest in contributing to Revi! We're excited to work with you to make error monitoring better for everyone. This guide will help you get started.

## 🌟 Ways to Contribute

- **🐛 Report bugs** - Help us identify and fix issues
- **💡 Suggest features** - Share ideas for new functionality
- **📝 Improve documentation** - Make our guides clearer and more comprehensive
- **🔧 Submit code** - Fix bugs, add features, or improve performance
- **🎨 Design contributions** - UI/UX improvements and design assets
- **🧪 Testing** - Help us test new features and find edge cases
- **🌍 Translations** - Help make Revi accessible worldwide

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **Bun** (recommended)
- **PostgreSQL** 14+ and **Redis** 6+
- **Git** for version control
- **Encore CLI** for backend development

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/Tobbiloba/Revi.git
   cd Revi
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   # Backend
   cd backend && cp .env.example .env
   
   # Dashboard
   cd ../dashboard && cp .env.example .env
   ```

4. **Set up databases**
   ```bash
   createdb revi_dev
   cd backend && encore db migrate
   cd ../dashboard && npx drizzle-kit push
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Backend
   cd backend && encore run
   
   # Terminal 2: Dashboard
   cd dashboard && bun dev
   
   # Terminal 3: SDK (if contributing to SDK)
   cd sdk && bun run build:watch
   ```

## 📋 Development Workflow

### Branch Strategy

- **`main`** - Production-ready code
- **`develop`** - Integration branch for features
- **`feature/[name]`** - New features
- **`bugfix/[name]`** - Bug fixes
- **`docs/[name]`** - Documentation updates

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-new-feature
   ```

2. **Make your changes**
   - Follow our coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run all tests
   bun test
   
   # Test specific components
   cd sdk && bun test
   cd backend && encore test
   cd dashboard && bun test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/amazing-new-feature
   # Create PR on GitHub
   ```

## 📏 Coding Standards

### General Guidelines

- **TypeScript** for all new code
- **ESLint** and **Prettier** for code formatting
- **Conventional Commits** for commit messages
- **80+ character line limit** where reasonable
- **Clear, descriptive naming** for variables and functions

### Code Quality

```bash
# Format code
bun run format

# Lint code
bun run lint

# Type checking
bun run typecheck

# Run all quality checks
bun run qa
```

### Commit Message Format

We use [Conventional Commits](https://conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no functional changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(sdk): add session replay pause/resume functionality
fix(dashboard): resolve memory leak in error list component
docs(readme): update installation instructions
```

## 🧪 Testing Guidelines

### Test Coverage Requirements

- **New features**: Must include comprehensive tests
- **Bug fixes**: Must include regression tests
- **Minimum 80% coverage** for new code
- **E2E tests** for critical user flows

### Testing Stack

- **SDK**: Vitest + jsdom
- **Backend**: Encore test framework
- **Dashboard**: Jest + React Testing Library
- **E2E**: Playwright

### Writing Tests

```typescript
// Example SDK test
describe('ErrorHandler', () => {
  it('should capture JavaScript errors', () => {
    const handler = new ErrorHandler(mockConfig);
    const error = new Error('Test error');
    
    handler.captureException(error);
    
    expect(mockApiCall).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error',
        type: 'javascript'
      })
    );
  });
});
```

## 📚 Documentation Standards

### What to Document

- **New features** - Add usage examples and API documentation
- **Breaking changes** - Update migration guides
- **Configuration options** - Document all new settings
- **Integration guides** - Framework-specific instructions

### Documentation Style

- **Clear, concise language**
- **Code examples** for all features
- **Screenshots** for UI changes
- **Update table of contents** when adding sections

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** - Your bug might already be reported
2. **Test on latest version** - Ensure the bug still exists
3. **Minimal reproduction** - Create the smallest possible example

### Bug Report Template

```markdown
## Bug Description
[Clear description of what went wrong]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [etc.]

## Expected Behavior
[What you expected to happen]

## Actual Behavior
[What actually happened]

## Environment
- **Revi Version**: [e.g., 1.0.0]
- **Browser**: [e.g., Chrome 91.0]
- **OS**: [e.g., macOS 12.0]
- **Framework**: [e.g., React 18.0]

## Additional Context
[Screenshots, logs, or other relevant information]
```

## 💡 Feature Requests

### Before Requesting

1. **Check roadmap** - Feature might already be planned
2. **Search discussions** - Similar ideas might exist
3. **Consider alternatives** - Can existing features solve your need?

### Feature Request Template

```markdown
## Feature Summary
[One-sentence description]

## Problem/Use Case
[What problem does this solve?]

## Proposed Solution
[Detailed description of your solution]

## Alternatives Considered
[Other solutions you've considered]

## Additional Context
[Mockups, examples, or references]
```

## 🎨 UI/UX Contributions

### Design Guidelines

- **Consistent** with existing design system
- **Accessible** (WCAG 2.1 AA compliance)
- **Responsive** across all device sizes
- **Dark/light mode** support

### Design Tools

- **Figma** for design files
- **Tailwind CSS** for styling
- **Radix UI** for component primitives
- **Lucide** for icons

## 🌍 Internationalization

We welcome translations to make Revi accessible worldwide.

### Adding a New Language

1. **Create locale file** in `dashboard/locales/[lang].json`
2. **Translate all strings** maintaining context and tone
3. **Test UI layout** - Some languages need more space
4. **Update language selector** in dashboard settings

## 📦 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **Major (x.0.0)** - Breaking changes
- **Minor (0.x.0)** - New features, backward compatible
- **Patch (0.0.x)** - Bug fixes, backward compatible

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] Changelog entries added
- [ ] Version numbers bumped
- [ ] Security review completed
- [ ] Performance regression testing

## 🏆 Recognition

We appreciate all contributions! Contributors will be:

- **Listed in README** - All contributors are recognized
- **Mentioned in releases** - Significant contributions highlighted
- **Invited to maintainer team** - Outstanding contributors may join the core team

## ❓ Getting Help

### Community Support

- **GitHub Discussions**: [Ask questions](https://github.com/Tobbiloba/Revi/discussions)
- **GitHub Issues**: [Report bugs and request features](https://github.com/Tobbiloba/Revi/issues)
- **Email**: [Contact maintainer](mailto:tobiloba.a.salau@gmail.com)
- **Stack Overflow**: Tag questions with `revi-monitoring`

### Maintainer Contact

- **Technical questions**: Create a GitHub discussion
- **Security issues**: See [SECURITY.md](SECURITY.md)
- **General inquiries**: Email tobiloba.a.salau@gmail.com

## 📄 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to creating a welcoming and inclusive environment for all contributors.

## 📜 License

By contributing to Revi, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to Revi! Your efforts help make error monitoring better for developers everywhere. 🚀

**Questions?** Start a [GitHub discussion](https://github.com/Tobbiloba/Revi/discussions) or email [tobiloba.a.salau@gmail.com](mailto:tobiloba.a.salau@gmail.com).