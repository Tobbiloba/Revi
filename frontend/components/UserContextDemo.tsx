import React, { useState } from 'react';

interface Props {
  revi: any;
}

const UserContextDemo: React.FC<Props> = ({ revi }) => {
  const [userId, setUserId] = useState('react-demo-user-123');
  const [userEmail, setUserEmail] = useState('demo@example.com');
  const [userName, setUserName] = useState('React Demo User');
  const [status, setStatus] = useState<string>('');

  const handleSetUserContext = () => {
    revi.setUserContext({
      id: userId,
      email: userEmail,
      username: userName
    });
    setStatus('User context updated successfully');
    
    // Clear status after 3 seconds
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div className="demo-section">
      <h2>User Context</h2>
      <p>Set user information for error tracking:</p>
      
      <div className="input-group">
        <label>User ID:</label>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID"
        />
      </div>

      <div className="input-group">
        <label>Email:</label>
        <input
          type="email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          placeholder="Email"
        />
      </div>

      <div className="input-group">
        <label>Name:</label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Name"
        />
      </div>

      <button className="button" onClick={handleSetUserContext}>
        Set User Context
      </button>

      {status && (
        <div className="status success">
          {status}
        </div>
      )}
    </div>
  );
};

export default UserContextDemo;
