import React, { useState } from 'react';

interface Props {
  revi: any;
}

const FormDemo: React.FC<Props> = ({ revi }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    message: '',
    agreeToTerms: false
  });
  const [status, setStatus] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Add breadcrumb for form interactions
    revi.addBreadcrumb({
      message: `Form field changed: ${name}`,
      category: 'ui',
      level: 'info',
      data: {
        field: name,
        hasValue: !!value,
        component: 'FormDemo'
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate form validation
    if (!formData.username || !formData.email) {
      const error = new Error('Username and email are required');
      revi.captureException(error, {
        level: 'warning',
        tags: { type: 'validation', form: 'demo-form' },
        extra: { formData: { ...formData, password: '[MASKED]' } }
      });
      setStatus('Form validation failed');
      return;
    }

    // Simulate successful form submission
    revi.addBreadcrumb({
      message: 'Form submitted successfully',
      category: 'ui',
      level: 'info',
      data: {
        fields: Object.keys(formData),
        component: 'FormDemo'
      }
    });

    setStatus('Form submitted successfully!');
    
    // Clear form
    setFormData({
      username: '',
      email: '',
      password: '',
      message: '',
      agreeToTerms: false
    });

    setTimeout(() => setStatus(''), 3000);
  };

  const triggerValidationError = () => {
    const error = new Error('Form validation failed: Invalid email format');
    revi.captureException(error, {
      level: 'warning',
      tags: { type: 'validation', field: 'email' },
      extra: { 
        email: formData.email,
        component: 'FormDemo'
      }
    });
    setStatus('Validation error captured');
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div className="demo-section">
      <h2>Form Interactions</h2>
      <p>Form interactions are automatically captured for session replay:</p>
      
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            placeholder="Enter username"
          />
        </div>

        <div className="input-group">
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter email"
          />
        </div>

        <div className="input-group">
          <label>Password (will be masked):</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter password"
          />
        </div>

        <div className="input-group">
          <label>Message:</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            placeholder="Enter your message"
            rows={4}
          />
        </div>

        <div className="input-group">
          <label>
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleInputChange}
            />
            I agree to the terms and conditions
          </label>
        </div>

        <div>
          <button type="submit" className="button">
            Submit Form
          </button>
          <button 
            type="button" 
            className="button"
            onClick={triggerValidationError}
          >
            Trigger Validation Error
          </button>
        </div>
      </form>

      {status && (
        <div className={`status ${status.includes('failed') || status.includes('error') ? 'error' : 'success'}`}>
          {status}
        </div>
      )}
    </div>
  );
};

export default FormDemo;
