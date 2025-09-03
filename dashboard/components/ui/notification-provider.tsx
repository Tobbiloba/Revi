'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 15);
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [...prev, newNotification]);

    // Auto remove notification after duration
    const duration = notification.duration || 5000;
    setTimeout(() => {
      removeNotification(id);
    }, duration);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

function NotificationContainer() {
  const context = useContext(NotificationContext);
  if (!context) return null;

  const { notifications, removeNotification } = context;

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationItem({ 
  notification, 
  onRemove 
}: { 
  notification: Notification; 
  onRemove: () => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <IconCheck className="size-5 text-green-600" />;
      case 'error':
        return <IconX className="size-5 text-red-600" />;
      case 'warning':
        return <IconAlertTriangle className="size-5 text-yellow-600" />;
      case 'info':
      default:
        return <IconInfoCircle className="size-5 text-blue-600" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-l-green-500';
      case 'error':
        return 'border-l-red-500';
      case 'warning':
        return 'border-l-yellow-500';
      case 'info':
      default:
        return 'border-l-blue-500';
    }
  };

  return (
    <div className={`bg-white border-l-4 ${getBorderColor()} rounded-r-lg shadow-lg p-4 animate-in slide-in-from-right-full`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 text-sm">
              {notification.title}
            </h4>
            {notification.message && (
              <p className="text-sm text-gray-600 mt-1">
                {notification.message}
              </p>
            )}
            {notification.action && (
              <button
                onClick={notification.action.onClick}
                className="text-sm text-primary hover:text-primary/80 mt-2 font-medium"
              >
                {notification.action.label}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-gray-600 ml-2"
        >
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}