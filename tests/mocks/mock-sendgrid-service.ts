/**
 * Mock SendGrid Service
 * Provides email sending simulation and webhook testing
 */
export class MockSendGridService {
  private static isRunning = false;
  private static sentEmails: Array<any> = [];
  private static webhookEvents: Array<any> = [];

  /**
   * Start the mock service
   */
  static async start(): Promise<void> {
    console.log('📧 Starting SendGrid mock service...');
    
    this.interceptSendGridRequests();
    this.isRunning = true;
    
    console.log('✅ SendGrid mock service active');
  }

  /**
   * Stop the mock service
   */
  static async stop(): Promise<void> {
    this.isRunning = false;
    this.sentEmails = [];
    this.webhookEvents = [];
    console.log('🛑 SendGrid mock service stopped');
  }

  /**
   * Check if service is active
   */
  static isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Intercept SendGrid API requests
   */
  private static interceptSendGridRequests(): void {
    const originalFetch = global.fetch;
    
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      
      // Intercept SendGrid API calls
      if (url.includes('api.sendgrid.com')) {
        return this.handleSendGridMockRequest(url, init);
      }
      
      // Pass through other requests
      return originalFetch(input, init);
    };
  }

  /**
   * Handle mock SendGrid API requests
   */
  private static async handleSendGridMockRequest(url: string, init?: RequestInit): Promise<Response> {
    console.log('📧 Intercepted SendGrid API request:', url);
    
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

    // Handle send email requests
    if (url.includes('/mail/send')) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      
      // Generate mock message ID
      const messageId = `mock-sg-${Math.random().toString(36).substr(2, 9)}`;
      
      // Store sent email for test verification
      const emailData = {
        messageId,
        to: body.personalizations?.[0]?.to || [],
        from: body.from || {},
        subject: body.subject || '',
        content: body.content || [],
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      
      this.sentEmails.push(emailData);
      
      // Simulate webhook events
      setTimeout(() => {
        this.simulateWebhookEvents(messageId, emailData);
      }, 1000);
      
      return new Response('', {
        status: 202,
        headers: {
          'Content-Type': 'application/json',
          'X-Message-Id': messageId
        }
      });
    }

    // Handle other SendGrid API endpoints
    return new Response(JSON.stringify({
      error: 'Mock SendGrid: Endpoint not implemented'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Simulate webhook events for sent emails
   */
  private static simulateWebhookEvents(messageId: string, emailData: any): void {
    const events = [
      {
        event: 'delivered',
        email: emailData.to[0]?.email,
        timestamp: Math.floor(Date.now() / 1000),
        'sg_message_id': messageId,
        smtp_id: `<${messageId}@sendgrid.me>`
      }
    ];

    // Randomly simulate email opens for realistic testing
    if (Math.random() > 0.3) { // 70% chance of email being opened
      setTimeout(() => {
        events.push({
          event: 'open',
          email: emailData.to[0]?.email,
          timestamp: Math.floor(Date.now() / 1000) + 300, // 5 minutes later
          'sg_message_id': messageId,
          useragent: 'Mozilla/5.0 (Test User Agent)',
          ip: '192.168.1.100'
        });
        
        this.webhookEvents.push(...events);
      }, 2000);
    }

    // Simulate clicks for some emails
    if (Math.random() > 0.7) { // 30% chance of email being clicked
      setTimeout(() => {
        events.push({
          event: 'click',
          email: emailData.to[0]?.email,
          timestamp: Math.floor(Date.now() / 1000) + 600, // 10 minutes later
          'sg_message_id': messageId,
          url: 'https://example.com/job-link',
          useragent: 'Mozilla/5.0 (Test User Agent)',
          ip: '192.168.1.100'
        });
        
        this.webhookEvents.push(...events);
      }, 5000);
    }

    this.webhookEvents.push(...events);
  }

  /**
   * Get all sent emails for test verification
   */
  static getSentEmails(): Array<any> {
    return [...this.sentEmails];
  }

  /**
   * Get sent email by message ID
   */
  static getSentEmail(messageId: string): any {
    return this.sentEmails.find(email => email.messageId === messageId);
  }

  /**
   * Get webhook events
   */
  static getWebhookEvents(): Array<any> {
    return [...this.webhookEvents];
  }

  /**
   * Get webhook events for a specific message
   */
  static getWebhookEventsForMessage(messageId: string): Array<any> {
    return this.webhookEvents.filter(event => event.sg_message_id === messageId);
  }

  /**
   * Clear all stored emails and events
   */
  static clearAll(): void {
    this.sentEmails = [];
    this.webhookEvents = [];
  }

  /**
   * Simulate webhook endpoint for testing
   */
  static async triggerWebhook(events: Array<any>): Promise<void> {
    this.webhookEvents.push(...events);
    console.log(`📧 SendGrid webhook triggered with ${events.length} events`);
  }

  /**
   * Simulate email delivery failure
   */
  static simulateDeliveryFailure(shouldFail = true): void {
    if (shouldFail) {
      const originalFetch = global.fetch;
      global.fetch = async (input: RequestInfo | URL, init?: RequestInfo): Promise<Response> => {
        const url = input.toString();
        if (url.includes('api.sendgrid.com/mail/send')) {
          return new Response(JSON.stringify({
            errors: [{
              message: 'Mail send failed in test mode',
              field: 'from',
              help: 'Test failure simulation'
            }]
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return originalFetch(input, init);
      };
    } else {
      // Reset to normal mock behavior
      this.interceptSendGridRequests();
    }
  }

  /**
   * Get email statistics for test validation
   */
  static getEmailStats(): {
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;
    clickRate: number;
  } {
    const totalSent = this.sentEmails.length;
    const delivered = this.webhookEvents.filter(e => e.event === 'delivered').length;
    const opened = this.webhookEvents.filter(e => e.event === 'open').length;
    const clicked = this.webhookEvents.filter(e => e.event === 'click').length;

    return {
      totalSent,
      totalDelivered: delivered,
      totalOpened: opened,
      totalClicked: clicked,
      openRate: totalSent > 0 ? (opened / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (clicked / totalSent) * 100 : 0
    };
  }
}