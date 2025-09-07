# Security Policy

## Supported Versions

We actively support the following versions of Revi with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Active support  |
| 0.x.x   | ❌ No longer supported |

## Reporting a Vulnerability

The Revi team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### 🔒 How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities to us through one of these channels:

1. **Email**: Send details to **tobiloba.a.salau@gmail.com**
2. **GitHub Security Advisories**: Use our [private vulnerability reporting](https://github.com/Tobbiloba/Revi/security/advisories/new)

### 📝 What to Include

When reporting a vulnerability, please include as much of the following information as possible:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths** of source file(s) related to the manifestation of the issue
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Special configuration** required to reproduce the issue
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the issue, including how an attacker might exploit it

### ⏱️ Response Timeline

- **Initial Response**: We will acknowledge receipt of your vulnerability report within **48 hours**
- **Status Update**: We will provide a detailed response within **7 days** indicating next steps
- **Resolution**: We aim to resolve critical vulnerabilities within **30 days**

### 🛡️ Security Measures

#### Our Infrastructure

- **Encryption**: All data transmission uses TLS 1.3
- **Authentication**: Multi-factor authentication for all maintainer accounts
- **Access Control**: Principle of least privilege for all systems
- **Monitoring**: 24/7 security monitoring and alerting
- **Backups**: Regular encrypted backups with secure key management

#### Code Security

- **Static Analysis**: Automated security scanning on all commits
- **Dependency Scanning**: Regular vulnerability scanning of dependencies
- **Code Reviews**: All changes require security-focused peer review
- **Secrets Management**: No hardcoded secrets or credentials in code

#### Data Protection

- **Privacy by Design**: Minimal data collection with user consent
- **Data Encryption**: All sensitive data encrypted at rest and in transit
- **Data Retention**: Automatic deletion of old data per retention policies
- **GDPR Compliance**: Full compliance with data protection regulations

### 🔄 Disclosure Process

1. **Report Received**: Security team acknowledges your report
2. **Investigation**: We investigate and verify the vulnerability
3. **Assessment**: We assess the impact and assign a severity level
4. **Fix Development**: We develop and test a security patch
5. **Coordinated Disclosure**: We coordinate the disclosure timeline with you
6. **Public Release**: We release the fix and publish a security advisory
7. **Recognition**: We credit you in our security advisory (if desired)

### 🏆 Security Hall of Fame

We maintain a Security Hall of Fame to recognize security researchers who help improve Revi's security. With your permission, we'll list your name and the general nature of the issue you reported.

### 📋 Security Best Practices for Users

#### For Self-Hosted Deployments

- **Keep Updated**: Always use the latest stable version
- **Secure Configuration**: Follow our security configuration guide
- **Network Security**: Use firewalls and restrict access to necessary ports
- **Regular Backups**: Implement automated, encrypted backup solutions
- **Monitor Logs**: Set up log monitoring and alerting

#### For SDK Integration

- **API Key Security**: Store API keys securely, never in client-side code
- **Data Sanitization**: Sanitize sensitive data before sending to Revi
- **Privacy Settings**: Configure appropriate privacy controls for your users
- **HTTPS Only**: Always use HTTPS in production environments

#### For Dashboard Access

- **Strong Passwords**: Use strong, unique passwords for all accounts
- **Two-Factor Authentication**: Enable 2FA for all user accounts
- **Session Management**: Configure appropriate session timeouts
- **Access Reviews**: Regularly review and revoke unnecessary access

### 🚨 Known Security Considerations

#### Data Handling

- **Session Recordings**: May contain sensitive user data - configure masking appropriately
- **Error Context**: Error reports may include sensitive application state
- **Network Requests**: API calls may contain sensitive request/response data

#### Self-Hosting Security

- **Database Access**: Secure your PostgreSQL and Redis instances
- **API Endpoints**: Properly secure all API endpoints with authentication
- **File Permissions**: Set appropriate file system permissions
- **Reverse Proxy**: Use a reverse proxy with proper security headers

### 🔗 Security Resources

- **Security Documentation**: [https://revi-five.vercel.app/docs/security](https://revi-five.vercel.app/docs/security)
- **Configuration Guide**: [https://revi-five.vercel.app/docs/security/configuration](https://revi-five.vercel.app/docs/security/configuration)
- **Best Practices**: [https://revi-five.vercel.app/docs/security/best-practices](https://revi-five.vercel.app/docs/security/best-practices)

### 📞 Contact Information

- **Security Contact**: tobiloba.a.salau@gmail.com
- **General Contact**: tobiloba.a.salau@gmail.com
- **Emergency Contact**: For critical vulnerabilities, email tobiloba.a.salau@gmail.com with "URGENT - SECURITY" in the subject line

---

Thank you for helping keep Revi and our users safe! 🛡️