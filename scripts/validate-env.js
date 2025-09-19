#!/usr/bin/env node

/**
 * Production Environment Validation Script
 * 
 * This script validates all required environment variables before application startup.
 * It implements fail-fast behavior to prevent production deployment failures.
 * 
 * Usage:
 *   node scripts/validate-env.js
 * 
 * Exit codes:
 *   0: All validations passed
 *   1: Critical validation failures (prevents startup)
 */

const chalk = require('chalk');
const process = require('process');

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.validationResults = {};
  }

  // Log with colors and formatting
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [ENV-VALIDATOR]`;
    
    switch (type) {
      case 'error':
        console.error(`${colors.red}${colors.bold}${prefix} ERROR:${colors.reset} ${message}`);
        break;
      case 'warning':
        console.warn(`${colors.yellow}${colors.bold}${prefix} WARNING:${colors.reset} ${message}`);
        break;
      case 'success':
        console.log(`${colors.green}${colors.bold}${prefix} SUCCESS:${colors.reset} ${message}`);
        break;
      case 'info':
      default:
        console.log(`${colors.blue}${prefix}${colors.reset} ${message}`);
        break;
    }
  }

  // Critical environment variables - application cannot start without these
  getCriticalVariables() {
    return {
      'DATABASE_URL': {
        description: 'PostgreSQL database connection string',
        validator: (value) => {
          if (!value) return 'Database URL is required';
          if (!value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
            return 'DATABASE_URL must be a valid PostgreSQL connection string';
          }
          return null;
        }
      },
      'JWT_SECRET': {
        description: 'JWT signing secret key',
        validator: (value) => {
          if (!value) return 'JWT secret is required for authentication';
          if (value.length < 32) return 'JWT secret must be at least 32 characters long for security';
          if (value === 'dev-jwt-secret-change-in-production') {
            return 'JWT secret must be changed from default value in production';
          }
          return null;
        }
      },
      'SESSION_SECRET': {
        description: 'Session encryption secret',
        validator: (value) => {
          if (!value) return 'Session secret is required';
          if (value.length < 32) return 'Session secret must be at least 32 characters long';
          return null;
        }
      },
      'NODE_ENV': {
        description: 'Application environment',
        validator: (value) => {
          if (!value) return 'NODE_ENV must be set';
          if (!['development', 'production', 'test'].includes(value)) {
            return 'NODE_ENV must be one of: development, production, test';
          }
          return null;
        }
      }
    };
  }

  // Feature-specific environment variables
  getFeatureVariables() {
    return {
      'AI_SERVICES': {
        variables: {
          'OPENAI_API_KEY': {
            description: 'OpenAI API key for AI features',
            validator: (value) => {
              if (!value) return 'OpenAI API key required for AI functionality';
              if (!value.startsWith('sk-')) return 'OpenAI API key format appears invalid';
              return null;
            }
          }
        }
      },
      'EMAIL_SERVICES': {
        variables: {
          'SENDGRID_API_KEY': {
            description: 'SendGrid API key for email services',
            validator: (value) => {
              if (!value) return 'SendGrid API key required for email functionality';
              if (!value.startsWith('SG.')) return 'SendGrid API key format appears invalid';
              return null;
            }
          },
          'EMAIL_FROM': {
            description: 'From email address for notifications',
            validator: (value) => {
              if (!value) return 'From email address is required';
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) return 'EMAIL_FROM must be a valid email address';
              return null;
            }
          }
        }
      },
      'PAYMENT_PROCESSING': {
        variables: {
          'STRIPE_SECRET_KEY': {
            description: 'Stripe secret key for international payments',
            validator: (value) => {
              if (value && !value.startsWith('sk_')) return 'Stripe secret key format appears invalid';
              return null;
            }
          },
          'STRIPE_WEBHOOK_SECRET': {
            description: 'Stripe webhook signing secret',
            validator: (value) => {
              if (process.env.STRIPE_SECRET_KEY && !value) {
                return 'Stripe webhook secret required when Stripe is configured';
              }
              return null;
            }
          },
          'PHONEPE_MERCHANT_ID': {
            description: 'PhonePe merchant ID for Indian payments',
            validator: (value) => null // Optional
          },
          'PHONEPE_SALT_KEY': {
            description: 'PhonePe salt key for payment security',
            validator: (value) => {
              if (process.env.PHONEPE_MERCHANT_ID && !value) {
                return 'PhonePe salt key required when merchant ID is configured';
              }
              return null;
            }
          }
        }
      },
      'OAUTH_PROVIDERS': {
        variables: {
          'GOOGLE_CLIENT_ID': {
            description: 'Google OAuth client ID',
            validator: (value) => {
              if (value && !value.includes('.apps.googleusercontent.com')) {
                return 'Google client ID format appears invalid';
              }
              return null;
            }
          },
          'GOOGLE_CLIENT_SECRET': {
            description: 'Google OAuth client secret',
            validator: (value) => {
              if (process.env.GOOGLE_CLIENT_ID && !value) {
                return 'Google client secret required when client ID is configured';
              }
              return null;
            }
          }
        }
      }
    };
  }

  // Security-specific validations
  validateSecurityConfiguration() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Production-specific security checks
      if (process.env.JWT_SECRET === 'dev-jwt-secret-change-in-production') {
        this.errors.push('JWT_SECRET must be changed from default value in production');
      }
      
      if (!process.env.CORS_ORIGINS) {
        this.warnings.push('CORS_ORIGINS not set - defaulting to allow all origins (security risk)');
      }
      
      if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
        this.errors.push('NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed in production');
      }
    }
    
    // Check for dangerous development settings
    if (process.env.DEBUG === '*') {
      this.warnings.push('DEBUG=* may leak sensitive information in logs');
    }
  }

  // Validate critical variables
  validateCriticalVariables() {
    this.log('Validating critical environment variables...');
    
    const criticalVars = this.getCriticalVariables();
    let criticalFailures = 0;
    
    for (const [varName, config] of Object.entries(criticalVars)) {
      const value = process.env[varName];
      const error = config.validator(value);
      
      if (error) {
        this.errors.push(`${varName}: ${error}`);
        criticalFailures++;
        this.log(`✗ ${varName} - ${error}`, 'error');
      } else {
        this.log(`✓ ${varName} - Valid`, 'success');
      }
      
      this.validationResults[varName] = {
        valid: !error,
        description: config.description,
        error: error
      };
    }
    
    return criticalFailures === 0;
  }

  // Validate feature-specific variables
  validateFeatureVariables() {
    this.log('Validating feature-specific environment variables...');
    
    const featureVars = this.getFeatureVariables();
    
    for (const [featureName, featureConfig] of Object.entries(featureVars)) {
      this.log(`\nValidating ${featureName}:`);
      
      let featureAvailable = true;
      const featureResults = {};
      
      for (const [varName, config] of Object.entries(featureConfig.variables)) {
        const value = process.env[varName];
        const error = config.validator(value);
        
        if (error) {
          this.warnings.push(`${featureName}: ${varName} - ${error}`);
          this.log(`  ⚠ ${varName} - ${error}`, 'warning');
          featureAvailable = false;
        } else if (value) {
          this.log(`  ✓ ${varName} - Available`, 'success');
        } else {
          this.log(`  - ${varName} - Not configured (feature disabled)`);
          featureAvailable = false;
        }
        
        featureResults[varName] = {
          valid: !error,
          configured: !!value,
          description: config.description,
          error: error
        };
      }
      
      this.validationResults[featureName] = {
        available: featureAvailable,
        variables: featureResults
      };
    }
  }

  // Generate validation report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      validation_results: this.validationResults,
      summary: {
        critical_errors: this.errors.length,
        warnings: this.warnings.length,
        production_ready: this.errors.length === 0 && process.env.NODE_ENV === 'production'
      },
      errors: this.errors,
      warnings: this.warnings,
      features_available: {}
    };
    
    // Calculate available features
    const featureVars = this.getFeatureVariables();
    for (const featureName of Object.keys(featureVars)) {
      report.features_available[featureName] = this.validationResults[featureName]?.available || false;
    }
    
    return report;
  }

  // Main validation method
  async validate() {
    this.log(`${colors.bold}Starting Environment Validation${colors.reset}`);
    this.log(`Environment: ${process.env.NODE_ENV || 'unknown'}`);
    this.log('=' * 60);
    
    // Validate critical variables (fail-fast)
    const criticalValid = this.validateCriticalVariables();
    
    // Validate feature variables (warnings only)
    this.validateFeatureVariables();
    
    // Security configuration checks
    this.validateSecurityConfiguration();
    
    // Generate and display report
    const report = this.generateReport();
    
    this.log('\n' + '=' * 60);
    this.log(`${colors.bold}VALIDATION SUMMARY${colors.reset}`);
    this.log(`Critical Errors: ${report.summary.critical_errors}`);
    this.log(`Warnings: ${report.summary.warnings}`);
    this.log(`Production Ready: ${report.summary.production_ready ? 'YES' : 'NO'}`);
    
    this.log('\nFeature Availability:');
    for (const [feature, available] of Object.entries(report.features_available)) {
      const status = available ? '✓ Available' : '✗ Unavailable';
      const color = available ? 'success' : 'warning';
      this.log(`  ${feature}: ${status}`, color);
    }
    
    // Display errors and warnings
    if (this.errors.length > 0) {
      this.log('\nCRITICAL ERRORS (must be fixed):', 'error');
      this.errors.forEach(error => this.log(`  • ${error}`, 'error'));
    }
    
    if (this.warnings.length > 0) {
      this.log('\nWARNINGS (recommended fixes):', 'warning');
      this.warnings.forEach(warning => this.log(`  • ${warning}`, 'warning'));
    }
    
    // Return validation result
    return {
      success: criticalValid,
      report: report
    };
  }
}

// Main execution
async function main() {
  const validator = new EnvironmentValidator();
  
  try {
    const result = await validator.validate();
    
    if (result.success) {
      validator.log('Environment validation passed!', 'success');
      process.exit(0);
    } else {
      validator.log('Environment validation failed - cannot start application', 'error');
      validator.log('Please fix critical errors and try again', 'error');
      process.exit(1);
    }
  } catch (error) {
    console.error('Environment validation script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { EnvironmentValidator };