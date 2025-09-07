import { api } from "encore.dev/api";
import { db } from "./db";

/**
 * Enhanced notification request interface
 */
export interface EnhancedNotificationRequest {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'discord';
  config: Record<string, any>;
  subject: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Enhanced notification sending with retry logic and comprehensive logging
 */
export async function sendEnhancedNotification(request: EnhancedNotificationRequest): Promise<{
  success: boolean;
  error?: string;
  response?: any;
}> {
  try {
    let result;
    
    switch (request.type) {
      case 'email':
        result = await sendEnhancedEmailNotification(request);
        break;
      case 'slack':
        result = await sendEnhancedSlackNotification(request);
        break;
      case 'webhook':
        result = await sendEnhancedWebhookNotification(request);
        break;
      case 'sms':
        result = await sendEnhancedSMSNotification(request);
        break;
      case 'discord':
        result = await sendEnhancedDiscordNotification(request);
        break;
      default:
        throw new Error(`Unsupported notification type: ${request.type}`);
    }

    // Log successful notification
    await logNotificationAttempt({
      notification_type: request.type,
      notification_config: request.config,
      status: 'sent',
      response_data: result,
      escalation_instance_id: request.metadata?.escalation_id,
      alert_history_id: request.metadata?.alert_history_id
    });

    return { success: true, response: result };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed notification
    await logNotificationAttempt({
      notification_type: request.type,
      notification_config: request.config,
      status: 'failed',
      error_message: errorMessage,
      escalation_instance_id: request.metadata?.escalation_id,
      alert_history_id: request.metadata?.alert_history_id
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Enhanced email notification with templates and rich formatting
 */
async function sendEnhancedEmailNotification(request: EnhancedNotificationRequest): Promise<any> {
  const config = request.config;
  
  if (!config.to) {
    throw new Error('Email configuration missing "to" field');
  }

  const emailPayload = {
    to: config.to,
    cc: config.cc,
    bcc: config.bcc,
    subject: request.subject,
    html: formatEnhancedEmailMessage(request.message, request.metadata),
    text: request.message,
    template: config.template,
    priority: config.priority || 'normal',
    metadata: request.metadata
  };

  console.log(`📧 Enhanced: Sending email notification to ${config.to}: ${request.subject}`);
  
  // Simulate enhanced email sending with better formatting
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        messageId: `enhanced-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'sent',
        timestamp: new Date().toISOString(),
        enhanced: true
      });
    }, 100);
  });
}

/**
 * Enhanced Slack notification with rich blocks and interactive elements
 */
async function sendEnhancedSlackNotification(request: EnhancedNotificationRequest): Promise<any> {
  const config = request.config;
  
  if (!config.webhook_url && !config.channel) {
    throw new Error('Slack configuration missing "webhook_url" or "channel" field');
  }

  const severityEmojis: Record<string, string> = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️'
  };
  const severityEmoji = severityEmojis[request.metadata?.severity || 'medium'] || '📢';

  const slackMessage = {
    text: `${severityEmoji} ${request.subject}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} ${request.subject}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: request.message
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Time:* ${new Date().toLocaleString()} | *System:* Revi Alert`
          }
        ]
      }
    ],
    channel: config.channel,
    username: config.username || 'Revi Alert Bot',
    icon_emoji: config.icon_emoji || ':rotating_light:'
  };

  // Add metadata section
  if (request.metadata && Object.keys(request.metadata).length > 0) {
    const metadataFields = Object.entries(request.metadata)
      .filter(([key]) => key !== 'escalation_id' && key !== 'alert_history_id')
      .slice(0, 10) // Limit fields
      .map(([key, value]) => `*${key}:* ${value}`)
      .join(' | ');

    if (metadataFields) {
      slackMessage.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: metadataFields
        }
      });
    }
  }

  // Add action buttons if configured
  if (config.enable_actions && request.metadata?.alert_history_id) {
    slackMessage.blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✅ Acknowledge'
          },
          style: 'primary',
          action_id: 'acknowledge_alert',
          value: request.metadata.alert_history_id.toString()
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '👀 View Details'
          },
          url: `${config.dashboard_url || ''}/alerts/${request.metadata.alert_history_id}`
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔇 Snooze'
          },
          action_id: 'snooze_alert',
          value: request.metadata.alert_history_id.toString()
        }
      ]
    } as any);
  }

  const response = await fetch(config.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(slackMessage)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enhanced Slack webhook failed: ${response.status} - ${errorText}`);
  }

  console.log(`💬 Enhanced: Sent Slack notification to ${config.channel || 'webhook'}`);
  
  return {
    status: 'sent',
    timestamp: new Date().toISOString(),
    channel: config.channel,
    response_status: response.status,
    enhanced: true
  };
}

/**
 * Enhanced webhook notification with retry logic and authentication
 */
async function sendEnhancedWebhookNotification(request: EnhancedNotificationRequest): Promise<any> {
  const config = request.config;
  
  if (!config.url) {
    throw new Error('Webhook configuration missing "url" field');
  }

  const payload = {
    alert: {
      subject: request.subject,
      message: request.message,
      severity: request.metadata?.severity || 'medium',
      timestamp: new Date().toISOString(),
      source: 'revi-alert-system'
    },
    metadata: request.metadata || {},
    escalation: request.metadata?.escalation_level ? {
      level: request.metadata.escalation_level,
      escalation_id: request.metadata.escalation_id
    } : undefined,
    ...config.additional_data
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Revi-Alert-System/2.0',
    'X-Alert-Timestamp': new Date().toISOString(),
    'X-Alert-Source': 'revi'
  };

  // Add authentication
  if (config.auth_type === 'bearer' && config.auth_token) {
    headers['Authorization'] = `Bearer ${config.auth_token}`;
  } else if (config.auth_type === 'api_key' && config.api_key) {
    headers[config.api_key_header || 'X-API-Key'] = config.api_key;
  } else if (config.auth_type === 'basic' && config.username && config.password) {
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  // Add custom headers
  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  // Retry logic
  const maxRetries = config.max_retries || 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json().catch(() => ({}));
      
      console.log(`🔗 Enhanced: Sent webhook notification to ${config.url} (attempt ${attempt})`);
      
      return {
        status: 'sent',
        timestamp: new Date().toISOString(),
        url: config.url,
        response_status: response.status,
        response_data: responseData,
        attempt: attempt,
        enhanced: true
      };

    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.log(`Webhook attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Enhanced webhook failed after ${maxRetries} attempts: ${lastError}`);
}

/**
 * Enhanced SMS notification with better formatting
 */
async function sendEnhancedSMSNotification(request: EnhancedNotificationRequest): Promise<any> {
  const config = request.config;
  
  if (!config.phone_number) {
    throw new Error('SMS configuration missing "phone_number" field');
  }

  const severityIcons: Record<string, string> = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️'
  };
  const severityIcon = severityIcons[request.metadata?.severity || 'medium'] || '📢';

  const smsMessage = `${severityIcon} ${request.subject}\n\n${request.message}${
    request.metadata?.project_id ? `\n\nProject: ${request.metadata.project_id}` : ''
  }${
    request.metadata?.escalation_level ? `\nEscalation: Level ${request.metadata.escalation_level}` : ''
  }\n\nTime: ${new Date().toLocaleString()}`.substring(0, 1600);
  
  console.log(`📱 Enhanced: Sending SMS notification to ${config.phone_number}: ${request.subject}`);
  
  // Simulate enhanced SMS sending
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        messageId: `enhanced-sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'sent',
        timestamp: new Date().toISOString(),
        phone_number: config.phone_number,
        enhanced: true
      });
    }, 200);
  });
}

/**
 * Enhanced Discord notification with rich embeds and mentions
 */
async function sendEnhancedDiscordNotification(request: EnhancedNotificationRequest): Promise<any> {
  const config = request.config;
  
  if (!config.webhook_url) {
    throw new Error('Discord configuration missing "webhook_url" field');
  }

  const embed = {
    title: request.subject,
    description: request.message.substring(0, 2048),
    color: getEnhancedDiscordColor(request.metadata?.severity),
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Revi Alert System • Enhanced Notifications',
      icon_url: config.footer_icon
    },
    fields: [] as Array<{name: string; value: string; inline: boolean}>,
    thumbnail: config.thumbnail_url ? { url: config.thumbnail_url } : undefined
  };

  // Add metadata fields
  if (request.metadata) {
    const metadataEntries = Object.entries(request.metadata)
      .filter(([key]) => !['escalation_id', 'alert_history_id'].includes(key))
      .slice(0, 25); // Discord limit

    metadataEntries.forEach(([key, value]) => {
      embed.fields.push({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: String(value).substring(0, 1024),
        inline: true
      });
    });
  }

  const discordMessage = {
    content: config.mention_everyone ? '@everyone' : 
             config.mention_here ? '@here' :
             config.mention_role ? `<@&${config.mention_role}>` : 
             undefined,
    username: config.username || 'Revi Alert Bot',
    avatar_url: config.avatar_url,
    embeds: [embed],
    components: config.enable_components && request.metadata?.alert_history_id ? [{
      type: 1,
      components: [{
        type: 2,
        style: 3,
        label: 'View Alert',
        url: `${config.dashboard_url || ''}/alerts/${request.metadata.alert_history_id}`
      }]
    }] : undefined
  };

  const response = await fetch(config.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(discordMessage)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enhanced Discord webhook failed: ${response.status} - ${errorText}`);
  }

  console.log(`🎮 Enhanced: Sent Discord notification`);
  
  return {
    status: 'sent',
    timestamp: new Date().toISOString(),
    response_status: response.status,
    enhanced: true
  };
}

/**
 * Enhanced Discord color mapping
 */
function getEnhancedDiscordColor(severity?: string): number {
  switch (severity) {
    case 'critical':
      return 15158332; // Bright red
    case 'high':
      return 16753920; // Orange  
    case 'medium':
      return 16776960; // Yellow
    case 'low':
      return 5763719;  // Blue
    default:
      return 9936031;  // Light blue
  }
}

/**
 * Enhanced email formatting with better HTML templates
 */
function formatEnhancedEmailMessage(message: string, metadata?: Record<string, any>): string {
  const severity = metadata?.severity || 'medium';
  const severityColors: Record<string, string> = {
    critical: '#dc3545',
    high: '#fd7e14', 
    medium: '#ffc107',
    low: '#28a745'
  };
  const severityColor = severityColors[severity] || '#6c757d';

  const htmlMessage = message.replace(/\n/g, '<br>');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Revi Alert</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${severityColor}, ${severityColor}dd); padding: 20px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
            🚨 Revi Alert
          </h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
            ${severity.toUpperCase()} Priority Alert
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid ${severityColor};">
            ${htmlMessage}
          </div>
          
          ${metadata && Object.keys(metadata).length > 0 ? `
            <div style="margin-top: 25px;">
              <h3 style="margin: 0 0 15px 0; color: #495057; font-size: 16px;">Alert Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                ${Object.entries(metadata)
                  .filter(([key]) => !['escalation_id', 'alert_history_id'].includes(key))
                  .map(([key, value]) => `
                    <tr style="border-bottom: 1px solid #dee2e6;">
                      <td style="padding: 8px 0; font-weight: 500; color: #6c757d; width: 30%;">
                        ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </td>
                      <td style="padding: 8px 0 8px 15px; color: #495057;">
                        ${String(value)}
                      </td>
                    </tr>
                  `).join('')}
              </table>
            </div>
          ` : ''}

          <div style="margin-top: 25px; text-align: center;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              Time: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 15px 20px; text-align: center; border-top: 1px solid #dee2e6;">
          <p style="margin: 0; color: #6c757d; font-size: 12px;">
            This is an automated alert from Revi Error Monitoring System<br>
            <span style="color: #adb5bd;">Enhanced notifications enabled</span>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Log enhanced notification attempts
 */
async function logNotificationAttempt(logData: {
  notification_type: string;
  notification_config: Record<string, any>;
  status: 'sent' | 'failed' | 'pending' | 'delivered';
  error_message?: string;
  response_data?: any;
  escalation_instance_id?: number;
  alert_history_id?: number;
}): Promise<void> {
  try {
    await db.exec`
      INSERT INTO notification_logs (
        escalation_instance_id, alert_history_id, notification_type,
        notification_config, status, error_message, response_data
      ) VALUES (
        ${logData.escalation_instance_id}, ${logData.alert_history_id}, 
        ${logData.notification_type}, ${JSON.stringify(logData.notification_config)},
        ${logData.status}, ${logData.error_message}, 
        ${logData.response_data ? JSON.stringify(logData.response_data) : null}
      )
    `;
  } catch (error) {
    console.error('Failed to log enhanced notification:', error);
  }
}

export interface NotificationChannel {
  id: number;
  project_id: number;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'discord';
  configuration: Record<string, any>;
  is_active: boolean;
  test_successful: boolean;
  last_test_at?: Date;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationChannelParams {
  project_id: number;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'discord';
  configuration: Record<string, any>;
  created_by?: string;
}

/**
 * Create a notification channel
 */
export const createNotificationChannel = api<CreateNotificationChannelParams, NotificationChannel>(
  { expose: true, method: "POST", path: "/api/alerts/channels" },
  async (params) => {
    // Validate configuration based on type
    validateChannelConfiguration(params.type, params.configuration);

    const channel = await db.queryRow<NotificationChannel>`
      INSERT INTO notification_channels (
        project_id, name, type, configuration, created_by
      ) VALUES (
        ${params.project_id}, ${params.name}, ${params.type},
        ${JSON.stringify(params.configuration)}, ${params.created_by}
      )
      RETURNING *
    `;

    if (!channel) {
      throw new Error("Failed to create notification channel");
    }

    return {
      ...channel,
      configuration: typeof channel.configuration === 'string' 
        ? JSON.parse(channel.configuration) 
        : channel.configuration
    };
  }
);

/**
 * List notification channels
 */
export const listNotificationChannels = api<
  { project_id: number }, 
  { channels: NotificationChannel[] }
>(
  { expose: true, method: "GET", path: "/api/alerts/channels/:project_id" },
  async (params) => {
    const channels = await db.queryAll<NotificationChannel>`
      SELECT * FROM notification_channels 
      WHERE project_id = ${params.project_id}
      ORDER BY created_at DESC
    `;

    return {
      channels: channels.map(channel => ({
        ...channel,
        configuration: typeof channel.configuration === 'string' 
          ? JSON.parse(channel.configuration) 
          : channel.configuration
      }))
    };
  }
);

/**
 * Test a notification channel
 */
export const testNotificationChannel = api<
  { channel_id: number }, 
  { success: boolean; message: string }
>(
  { expose: true, method: "POST", path: "/api/alerts/channels/:channel_id/test" },
  async (params) => {
    const channel = await db.queryRow<NotificationChannel>`
      SELECT * FROM notification_channels WHERE id = ${params.channel_id}
    `;

    if (!channel) {
      throw new Error("Notification channel not found");
    }

    const configuration = typeof channel.configuration === 'string' 
      ? JSON.parse(channel.configuration) 
      : channel.configuration;

    try {
      const result = await sendTestNotification(channel.type, configuration);
      
      // Update test status
      await db.exec`
        UPDATE notification_channels 
        SET test_successful = ${result.success}, last_test_at = NOW()
        WHERE id = ${params.channel_id}
      `;

      return result;
    } catch (error) {
      await db.exec`
        UPDATE notification_channels 
        SET test_successful = false, last_test_at = NOW()
        WHERE id = ${params.channel_id}
      `;

      throw error;
    }
  }
);

/**
 * Send notification
 */
export interface SendNotificationParams {
  channel_ids: number[];
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  alert_id?: number;
  metadata?: Record<string, any>;
}

export const sendNotification = api<SendNotificationParams, { sent: number; failed: number }>(
  { expose: true, method: "POST", path: "/api/alerts/notify" },
  async (params) => {
    const channels = await db.queryAll<NotificationChannel>`
      SELECT * FROM notification_channels 
      WHERE id = ANY(${params.channel_ids}) AND is_active = true
    `;

    let sent = 0;
    let failed = 0;

    const promises = channels.map(async (channel) => {
      try {
        const configuration = typeof channel.configuration === 'string' 
          ? JSON.parse(channel.configuration) 
          : channel.configuration;

        await sendChannelNotification(
          channel.type, 
          configuration, 
          params.title, 
          params.message, 
          params.severity,
          params.metadata
        );
        sent++;
      } catch (error) {
        failed++;
        console.error(`Failed to send notification to channel ${channel.id}:`, error);
      }
    });

    await Promise.all(promises);

    return { sent, failed };
  }
);

/**
 * Validate channel configuration
 */
function validateChannelConfiguration(type: string, config: Record<string, any>): void {
  switch (type) {
    case 'email':
      if (!config.recipients || !Array.isArray(config.recipients) || config.recipients.length === 0) {
        throw new Error("Email channel requires recipients array");
      }
      break;

    case 'slack':
      if (!config.webhook_url) {
        throw new Error("Slack channel requires webhook_url");
      }
      break;

    case 'webhook':
      if (!config.url) {
        throw new Error("Webhook channel requires url");
      }
      break;

    case 'sms':
      if (!config.phone_numbers || !Array.isArray(config.phone_numbers) || config.phone_numbers.length === 0) {
        throw new Error("SMS channel requires phone_numbers array");
      }
      if (!config.api_key) {
        throw new Error("SMS channel requires api_key");
      }
      break;

    case 'discord':
      if (!config.webhook_url) {
        throw new Error("Discord channel requires webhook_url");
      }
      break;

    default:
      throw new Error(`Unsupported channel type: ${type}`);
  }
}

/**
 * Send test notification
 */
async function sendTestNotification(
  type: string, 
  config: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  const testTitle = "Revi Test Alert";
  const testMessage = "This is a test notification from Revi. If you receive this, your notification channel is working correctly.";

  try {
    await sendChannelNotification(type, config, testTitle, testMessage, 'low');
    return { success: true, message: "Test notification sent successfully" };
  } catch (error) {
    return { 
      success: false, 
      message: `Test notification failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Send notification to specific channel type
 */
async function sendChannelNotification(
  type: string,
  config: Record<string, any>,
  title: string,
  message: string,
  severity: string,
  metadata?: Record<string, any>
): Promise<void> {
  switch (type) {
    case 'email':
      await sendEmailNotification(config, title, message, severity);
      break;

    case 'slack':
      await sendSlackNotification(config, title, message, severity, metadata);
      break;

    case 'webhook':
      await sendWebhookNotification(config, title, message, severity, metadata);
      break;

    case 'sms':
      await sendSMSNotification(config, title, message, severity);
      break;

    case 'discord':
      await sendDiscordNotification(config, title, message, severity, metadata);
      break;

    default:
      throw new Error(`Unsupported notification type: ${type}`);
  }
}

/**
 * Email notification implementation
 */
async function sendEmailNotification(
  config: Record<string, any>,
  title: string,
  message: string,
  severity: string
): Promise<void> {
  // This would integrate with an email service like SendGrid, AWS SES, etc.
  // For now, we'll simulate the email sending
  
  const emailData = {
    to: config.recipients,
    subject: `[${severity.toUpperCase()}] ${title}`,
    html: `
      <h2>${title}</h2>
      <p>${message}</p>
      <p><strong>Severity:</strong> ${severity}</p>
      <hr>
      <p><small>Sent by Revi Error Monitoring</small></p>
    `
  };

  // Simulate API call to email service
  if (config.simulate) {
    console.log('Email notification would be sent:', emailData);
    return;
  }

  // In production, use actual email service
  throw new Error("Email service not configured");
}

/**
 * Slack notification implementation
 */
async function sendSlackNotification(
  config: Record<string, any>,
  title: string,
  message: string,
  severity: string,
  metadata?: Record<string, any>
): Promise<void> {
  const color = getSeverityColor(severity);
  
  const slackPayload = {
    text: title,
    attachments: [{
      color: color,
      title: title,
      text: message,
      fields: [
        {
          title: "Severity",
          value: severity,
          short: true
        },
        {
          title: "Time",
          value: new Date().toISOString(),
          short: true
        }
      ],
      footer: "Revi Error Monitoring",
      ts: Math.floor(Date.now() / 1000)
    }]
  };

  const response = await fetch(config.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload)
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.statusText}`);
  }
}

/**
 * Webhook notification implementation
 */
async function sendWebhookNotification(
  config: Record<string, any>,
  title: string,
  message: string,
  severity: string,
  metadata?: Record<string, any>
): Promise<void> {
  const payload = {
    title,
    message,
    severity,
    timestamp: new Date().toISOString(),
    metadata: metadata || {}
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Add custom headers if provided
  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook notification failed: ${response.statusText}`);
  }
}

/**
 * SMS notification implementation
 */
async function sendSMSNotification(
  config: Record<string, any>,
  title: string,
  message: string,
  severity: string
): Promise<void> {
  // This would integrate with an SMS service like Twilio
  // For now, we'll simulate the SMS sending
  
  const smsText = `[${severity.toUpperCase()}] ${title}: ${message}`;
  
  if (config.simulate) {
    console.log('SMS would be sent to:', config.phone_numbers, 'Message:', smsText);
    return;
  }

  // In production, use actual SMS service
  throw new Error("SMS service not configured");
}

/**
 * Discord notification implementation
 */
async function sendDiscordNotification(
  config: Record<string, any>,
  title: string,
  message: string,
  severity: string,
  metadata?: Record<string, any>
): Promise<void> {
  const color = getSeverityColorDecimal(severity);
  
  const discordPayload = {
    embeds: [{
      title: title,
      description: message,
      color: color,
      fields: [
        {
          name: "Severity",
          value: severity,
          inline: true
        },
        {
          name: "Time",
          value: new Date().toISOString(),
          inline: true
        }
      ],
      footer: {
        text: "Revi Error Monitoring"
      },
      timestamp: new Date().toISOString()
    }]
  };

  const response = await fetch(config.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordPayload)
  });

  if (!response.ok) {
    throw new Error(`Discord notification failed: ${response.statusText}`);
  }
}

/**
 * Get color for severity (hex)
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#FF0000';
    case 'high':
      return '#FF8C00';
    case 'medium':
      return '#FFD700';
    case 'low':
      return '#32CD32';
    default:
      return '#808080';
  }
}

/**
 * Get color for severity (decimal for Discord)
 */
function getSeverityColorDecimal(severity: string): number {
  switch (severity) {
    case 'critical':
      return 16711680; // Red
    case 'high':
      return 16753920; // Orange
    case 'medium':
      return 16766720; // Yellow
    case 'low':
      return 3329330;  // Green
    default:
      return 8421504;  // Gray
  }
}