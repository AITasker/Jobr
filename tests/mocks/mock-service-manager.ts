import { MockOpenAIService } from './mock-openai-service';
import { MockSendGridService } from './mock-sendgrid-service';
import { MockStripeService } from './mock-stripe-service';
import { MockPhonePeService } from './mock-phonepe-service';

/**
 * Mock Service Manager
 * Coordinates all mock services for testing
 */
export class MockServiceManager {
  private static services: Array<{
    name: string;
    service: { start: () => Promise<void>; stop: () => Promise<void> };
  }> = [];

  /**
   * Start all mock services
   */
  static async startAll(): Promise<void> {
    console.log('🎭 Starting all mock services...');

    // Initialize services
    this.services = [
      {
        name: 'OpenAI',
        service: MockOpenAIService
      },
      {
        name: 'SendGrid',
        service: MockSendGridService
      },
      {
        name: 'Stripe',
        service: MockStripeService
      },
      {
        name: 'PhonePe',
        service: MockPhonePeService
      }
    ];

    // Start all services
    const startPromises = this.services.map(async ({ name, service }) => {
      try {
        await service.start();
        console.log(`✅ ${name} mock service started`);
      } catch (error) {
        console.error(`❌ Failed to start ${name} mock service:`, error);
        throw error;
      }
    });

    await Promise.all(startPromises);
    console.log('🎉 All mock services started successfully');
  }

  /**
   * Stop all mock services
   */
  static async stopAll(): Promise<void> {
    console.log('🛑 Stopping all mock services...');

    const stopPromises = this.services.map(async ({ name, service }) => {
      try {
        await service.stop();
        console.log(`✅ ${name} mock service stopped`);
      } catch (error) {
        console.error(`❌ Failed to stop ${name} mock service:`, error);
        // Don't throw in cleanup
      }
    });

    await Promise.allSettled(stopPromises);
    console.log('🎉 All mock services stopped');
  }

  /**
   * Reset all mock services to initial state
   */
  static async resetAll(): Promise<void> {
    console.log('🔄 Resetting all mock services...');
    
    await this.stopAll();
    await this.startAll();
    
    console.log('✅ All mock services reset');
  }

  /**
   * Get mock service status
   */
  static getStatus(): Record<string, boolean> {
    return {
      openai: MockOpenAIService.isActive(),
      sendgrid: MockSendGridService.isActive(),
      stripe: MockStripeService.isActive(),
      phonepe: MockPhonePeService.isActive()
    };
  }
}