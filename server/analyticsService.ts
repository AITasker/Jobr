import { storage } from "./storage";
import type { 
  Application, 
  User, 
  Job,
  EmailEvent,
  ApplicationHistory,
  ApplicationAnalytics,
  InsertApplicationAnalytics
} from "@shared/schema";

export interface SuccessRateAnalytics {
  overall: {
    totalApplications: number;
    successfulApplications: number;
    successRate: number;
    averageTimeToOffer: number;
  };
  byIndustry: Array<{
    industry: string;
    totalApplications: number;
    successfulApplications: number;
    successRate: number;
    averageTimeToResponse: number;
  }>;
  byJobLevel: Array<{
    level: string;
    totalApplications: number;
    successfulApplications: number;
    successRate: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    applications: number;
    successes: number;
    successRate: number;
  }>;
}

export interface ResponseTimeAnalytics {
  average: number;
  median: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  byCompanySize: Array<{
    size: string;
    averageResponseTime: number;
    responseRate: number;
  }>;
  byIndustry: Array<{
    industry: string;
    averageResponseTime: number;
    responseRate: number;
  }>;
}

export interface ApplicationInsightsReport {
  userId: string;
  dateRange: { start: Date; end: Date };
  totalApplications: number;
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  successMetrics: SuccessRateAnalytics;
  responseTimeMetrics: ResponseTimeAnalytics;
  engagementMetrics: {
    averageEngagementScore: number;
    emailOpenRate: number;
    emailClickRate: number;
    emailResponseRate: number;
  };
  recommendations: Array<{
    type: string;
    priority: 'low' | 'medium' | 'high';
    suggestion: string;
    impact: string;
    actionItems: string[];
  }>;
  comparisonMetrics: {
    vsIndustryAverage: number;
    vsUserHistory: number;
    improvementAreas: string[];
  };
}

export interface A_BTestResults {
  testId: string;
  testName: string;
  hypothesis: string;
  variants: Array<{
    name: string;
    description: string;
    applicationCount: number;
    successRate: number;
    averageResponseTime: number;
    engagementScore: number;
  }>;
  statisticalSignificance: boolean;
  confidence: number;
  recommendation: string;
  insights: string[];
}

/**
 * Comprehensive Analytics and Reporting Service
 * Provides detailed insights into application performance and success patterns
 */
export class AnalyticsService {

  /**
   * Generate comprehensive application insights report for a user
   */
  static async generateApplicationInsights(
    userId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<ApplicationInsightsReport> {
    try {
      const endDate = dateRange?.end || new Date();
      const startDate = dateRange?.start || new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      // Get user's applications in date range
      const applications = await this.getUserApplicationsInRange(userId, startDate, endDate);
      const totalApplications = applications.length;

      // Calculate status breakdown
      const statusBreakdown = this.calculateStatusBreakdown(applications);

      // Calculate success metrics
      const successMetrics = await this.calculateSuccessRateAnalytics(applications);

      // Calculate response time metrics
      const responseTimeMetrics = await this.calculateResponseTimeAnalytics(applications);

      // Calculate engagement metrics
      const engagementMetrics = await this.calculateEngagementMetrics(applications);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(userId, applications, {
        successMetrics,
        responseTimeMetrics,
        engagementMetrics
      });

      // Calculate comparison metrics
      const comparisonMetrics = await this.calculateComparisonMetrics(userId, applications);

      return {
        userId,
        dateRange: { start: startDate, end: endDate },
        totalApplications,
        statusBreakdown,
        successMetrics,
        responseTimeMetrics,
        engagementMetrics,
        recommendations,
        comparisonMetrics
      };

    } catch (error) {
      console.error('AnalyticsService: Failed to generate application insights:', error);
      throw error;
    }
  }

  /**
   * Track application success rates across different dimensions
   */
  static async trackSuccessRates(
    userId?: string,
    filters?: {
      industry?: string;
      jobLevel?: string;
      company?: string;
      location?: string;
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<SuccessRateAnalytics> {
    try {
      const applications = await this.getFilteredApplications(userId, filters);

      const overall = this.calculateOverallSuccessRate(applications);
      const byIndustry = await this.calculateSuccessRateByIndustry(applications);
      const byJobLevel = this.calculateSuccessRateByJobLevel(applications);
      const timeSeriesData = this.calculateTimeSeriesSuccessRate(applications);

      return {
        overall,
        byIndustry,
        byJobLevel,
        timeSeriesData
      };

    } catch (error) {
      console.error('AnalyticsService: Failed to track success rates:', error);
      throw error;
    }
  }

  /**
   * Analyze response times from employers
   */
  static async analyzeResponseTimes(
    userId?: string,
    filters?: { industry?: string; companySize?: string }
  ): Promise<ResponseTimeAnalytics> {
    try {
      const applications = await this.getFilteredApplications(userId, filters);
      
      // Filter applications that have response data
      const applicationsWithResponses = applications.filter(app => 
        app.emailSentAt && (app.emailRepliedAt || app.viewedByEmployerAt)
      );

      if (applicationsWithResponses.length === 0) {
        return {
          average: 0,
          median: 0,
          percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 },
          byCompanySize: [],
          byIndustry: []
        };
      }

      // Calculate response times
      const responseTimes = applicationsWithResponses.map(app => {
        const sentDate = new Date(app.emailSentAt!);
        const responseDate = new Date(app.emailRepliedAt || app.viewedByEmployerAt!);
        return Math.floor((responseDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)); // Days
      }).filter(time => time >= 0);

      responseTimes.sort((a, b) => a - b);

      const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const median = responseTimes[Math.floor(responseTimes.length / 2)];

      const percentiles = {
        p25: responseTimes[Math.floor(responseTimes.length * 0.25)],
        p50: median,
        p75: responseTimes[Math.floor(responseTimes.length * 0.75)],
        p90: responseTimes[Math.floor(responseTimes.length * 0.90)]
      };

      const byIndustry = await this.calculateResponseTimesByIndustry(applicationsWithResponses);
      const byCompanySize = this.calculateResponseTimesByCompanySize(applicationsWithResponses);

      return {
        average,
        median,
        percentiles,
        byCompanySize,
        byIndustry
      };

    } catch (error) {
      console.error('AnalyticsService: Failed to analyze response times:', error);
      throw error;
    }
  }

  /**
   * Generate industry and role-specific insights
   */
  static async generateIndustryInsights(
    industry: string,
    role?: string
  ): Promise<{
    industry: string;
    role?: string;
    benchmarks: {
      averageSuccessRate: number;
      averageResponseTime: number;
      commonSkillsRequired: string[];
      salaryRanges: { min: number; max: number; average: number };
      applicationVolume: number;
    };
    trends: {
      demandTrend: 'increasing' | 'decreasing' | 'stable';
      competitionLevel: 'low' | 'medium' | 'high';
      seasonalPatterns: string[];
    };
    recommendations: string[];
  }> {
    try {
      // This would typically query external market data APIs
      // For now, we'll calculate based on our application data

      const applications = await this.getApplicationsByIndustryAndRole(industry, role);
      
      const averageSuccessRate = this.calculateOverallSuccessRate(applications).successRate;
      
      const responseTimeAnalytics = await this.analyzeResponseTimes(undefined, { industry });
      const averageResponseTime = responseTimeAnalytics.average;

      // Extract common skills from job descriptions (simplified)
      const commonSkills = this.extractCommonSkills(applications);

      // Calculate salary ranges
      const salaryRanges = this.calculateSalaryRanges(applications);

      // Determine trends (simplified heuristics)
      const trends = this.determineTrends(applications, industry);

      // Generate industry-specific recommendations
      const recommendations = this.generateIndustryRecommendations(industry, role, {
        successRate: averageSuccessRate,
        responseTime: averageResponseTime,
        competition: trends.competitionLevel
      });

      return {
        industry,
        role,
        benchmarks: {
          averageSuccessRate,
          averageResponseTime,
          commonSkillsRequired: commonSkills,
          salaryRanges,
          applicationVolume: applications.length
        },
        trends,
        recommendations
      };

    } catch (error) {
      console.error('AnalyticsService: Failed to generate industry insights:', error);
      throw error;
    }
  }

  /**
   * Run A/B tests for application optimization
   */
  static async runA_BTest(
    testConfig: {
      testId: string;
      testName: string;
      hypothesis: string;
      variants: Array<{
        name: string;
        description: string;
        config: any;
      }>;
      userId: string;
      duration: number; // days
    }
  ): Promise<{ success: boolean; message: string; testId?: string }> {
    try {
      // Store A/B test configuration
      await storage.createApplicationAnalytics({
        applicationId: '', // Not tied to specific application
        userId: testConfig.userId,
        metric: 'ab_test_config',
        value: 1,
        metadata: {
          testId: testConfig.testId,
          testName: testConfig.testName,
          hypothesis: testConfig.hypothesis,
          variants: testConfig.variants,
          startDate: new Date(),
          endDate: new Date(Date.now() + testConfig.duration * 24 * 60 * 60 * 1000),
          status: 'running'
        }
      });

      return {
        success: true,
        message: 'A/B test started successfully',
        testId: testConfig.testId
      };

    } catch (error: any) {
      console.error('AnalyticsService: Failed to start A/B test:', error);
      return {
        success: false,
        message: error.message || 'Failed to start A/B test'
      };
    }
  }

  /**
   * Analyze A/B test results
   */
  static async analyzeA_BTestResults(testId: string): Promise<A_BTestResults | null> {
    try {
      // Get test configuration
      const testConfigAnalytics = await storage.getApplicationAnalyticsByUserId('', 'ab_test_config');
      const testConfig = testConfigAnalytics.find(a => a.metadata?.testId === testId);
      
      if (!testConfig) {
        return null;
      }

      const metadata = testConfig.metadata;
      
      // Get applications created during test period
      const testApplications = await this.getApplicationsDuringPeriod(
        testConfig.userId,
        new Date(metadata.startDate),
        new Date(metadata.endDate)
      );

      // Analyze performance by variant
      const variantResults = [];
      
      for (const variant of metadata.variants) {
        const variantApplications = testApplications.filter(app => 
          app.preparationMetadata?.abTestVariant === variant.name
        );

        const successRate = this.calculateOverallSuccessRate(variantApplications).successRate;
        const responseTimeAnalytics = await this.analyzeResponseTimes(testConfig.userId);
        const engagementMetrics = await this.calculateEngagementMetrics(variantApplications);

        variantResults.push({
          name: variant.name,
          description: variant.description,
          applicationCount: variantApplications.length,
          successRate,
          averageResponseTime: responseTimeAnalytics.average,
          engagementScore: engagementMetrics.averageEngagementScore
        });
      }

      // Calculate statistical significance (simplified)
      const statisticalSignificance = this.calculateStatisticalSignificance(variantResults);
      
      // Generate recommendation
      const bestVariant = variantResults.reduce((best, current) => 
        current.successRate > best.successRate ? current : best
      );

      const recommendation = `Based on the test results, "${bestVariant.name}" performed best with a ${bestVariant.successRate.toFixed(1)}% success rate.`;

      const insights = this.generateA_BTestInsights(variantResults, metadata.hypothesis);

      return {
        testId,
        testName: metadata.testName,
        hypothesis: metadata.hypothesis,
        variants: variantResults,
        statisticalSignificance,
        confidence: statisticalSignificance ? 95 : 75, // Simplified
        recommendation,
        insights
      };

    } catch (error) {
      console.error('AnalyticsService: Failed to analyze A/B test results:', error);
      return null;
    }
  }

  /**
   * Calculate ROI for different application strategies
   */
  static async calculateApplicationROI(
    userId: string,
    timeframe: { start: Date; end: Date }
  ): Promise<{
    totalInvestment: {
      timeSpent: number; // hours
      monetaryValue: number; // estimated value of time
      toolsCost: number;
      totalROI: number;
    };
    returns: {
      offersReceived: number;
      averageOfferValue: number;
      totalPotentialValue: number;
      actualAcceptedValue: number;
    };
    roiByStrategy: Array<{
      strategy: string;
      investment: number;
      returns: number;
      roiPercentage: number;
      recommendation: string;
    }>;
    optimizationSuggestions: string[];
  }> {
    try {
      const applications = await this.getUserApplicationsInRange(userId, timeframe.start, timeframe.end);
      
      // Calculate investment
      const averageTimePerApplication = 2; // hours (configurable)
      const timeSpent = applications.length * averageTimePerApplication;
      const hourlyRate = 50; // estimated hourly rate (could be user-configurable)
      const monetaryValue = timeSpent * hourlyRate;
      const toolsCost = 50; // monthly subscription cost estimate

      // Calculate returns
      const offersReceived = applications.filter(app => app.status === 'offered').length;
      const averageOfferValue = 75000; // This would ideally come from actual offer data
      const totalPotentialValue = offersReceived * averageOfferValue;
      const acceptedOffers = applications.filter(app => app.status === 'accepted').length;
      const actualAcceptedValue = acceptedOffers * averageOfferValue;

      const totalROI = totalPotentialValue > 0 ? 
        ((totalPotentialValue - monetaryValue - toolsCost) / (monetaryValue + toolsCost)) * 100 : 0;

      // Analyze ROI by strategy
      const strategies = [
        'direct_application',
        'referral',
        'networking',
        'recruiter',
        'job_board'
      ];

      const roiByStrategy = strategies.map(strategy => {
        const strategyApplications = applications.filter(app => 
          app.applicationSource === strategy
        );
        
        const strategyOffers = strategyApplications.filter(app => app.status === 'offered').length;
        const strategyInvestment = strategyApplications.length * averageTimePerApplication * hourlyRate;
        const strategyReturns = strategyOffers * averageOfferValue;
        const roiPercentage = strategyInvestment > 0 ? 
          ((strategyReturns - strategyInvestment) / strategyInvestment) * 100 : 0;

        return {
          strategy,
          investment: strategyInvestment,
          returns: strategyReturns,
          roiPercentage,
          recommendation: this.generateROIRecommendation(strategy, roiPercentage, strategyApplications.length)
        };
      }).filter(s => s.investment > 0); // Only include strategies that were used

      // Generate optimization suggestions
      const optimizationSuggestions = this.generateROIOptimizationSuggestions({
        applications,
        roiByStrategy,
        totalROI
      });

      return {
        totalInvestment: {
          timeSpent,
          monetaryValue,
          toolsCost,
          totalROI
        },
        returns: {
          offersReceived,
          averageOfferValue,
          totalPotentialValue,
          actualAcceptedValue
        },
        roiByStrategy,
        optimizationSuggestions
      };

    } catch (error) {
      console.error('AnalyticsService: Failed to calculate application ROI:', error);
      throw error;
    }
  }

  /**
   * Store analytics data for future reference
   */
  static async storeAnalyticsData(
    userId: string,
    metric: string,
    value: number,
    metadata?: any
  ): Promise<void> {
    try {
      await storage.createApplicationAnalytics({
        applicationId: '', // May not be tied to specific application
        userId,
        metric,
        value,
        metadata
      });
    } catch (error) {
      console.error('AnalyticsService: Failed to store analytics data:', error);
      throw error;
    }
  }

  // Private helper methods

  private static async getUserApplicationsInRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Application[]> {
    const allApplications = await storage.getApplicationsByUserId(userId);
    return allApplications.filter(app => {
      const appliedDate = new Date(app.appliedDate);
      return appliedDate >= startDate && appliedDate <= endDate;
    });
  }

  private static calculateStatusBreakdown(applications: Application[]): Array<{
    status: string;
    count: number;
    percentage: number;
  }> {
    const statusCounts = applications.reduce((counts, app) => {
      counts[app.status] = (counts[app.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const total = applications.length;
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));
  }

  private static calculateOverallSuccessRate(applications: Application[]): {
    totalApplications: number;
    successfulApplications: number;
    successRate: number;
    averageTimeToOffer: number;
  } {
    const totalApplications = applications.length;
    const successfulApplications = applications.filter(app => 
      ['offered', 'accepted'].includes(app.status)
    ).length;
    const successRate = totalApplications > 0 ? (successfulApplications / totalApplications) * 100 : 0;

    // Calculate average time to offer
    const offeredApplications = applications.filter(app => app.offerReceivedAt);
    const averageTimeToOffer = offeredApplications.length > 0 ? 
      offeredApplications.reduce((sum, app) => {
        const appliedDate = new Date(app.appliedDate);
        const offerDate = new Date(app.offerReceivedAt!);
        return sum + Math.floor((offerDate.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));
      }, 0) / offeredApplications.length : 0;

    return {
      totalApplications,
      successfulApplications,
      successRate,
      averageTimeToOffer
    };
  }

  private static async calculateSuccessRateByIndustry(applications: Application[]): Promise<Array<{
    industry: string;
    totalApplications: number;
    successfulApplications: number;
    successRate: number;
    averageTimeToResponse: number;
  }>> {
    // Group by industry (extract from job company or industry field)
    const industryGroups = applications.reduce((groups, app) => {
      const industry = this.extractIndustry(app.job);
      if (!groups[industry]) {
        groups[industry] = [];
      }
      groups[industry].push(app);
      return groups;
    }, {} as Record<string, Application[]>);

    return Object.entries(industryGroups).map(([industry, apps]) => {
      const overall = this.calculateOverallSuccessRate(apps);
      
      // Calculate average time to response
      const appsWithResponse = apps.filter(app => 
        app.emailSentAt && (app.emailRepliedAt || app.viewedByEmployerAt)
      );
      
      const averageTimeToResponse = appsWithResponse.length > 0 ? 
        appsWithResponse.reduce((sum, app) => {
          const sentDate = new Date(app.emailSentAt!);
          const responseDate = new Date(app.emailRepliedAt || app.viewedByEmployerAt!);
          return sum + Math.floor((responseDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / appsWithResponse.length : 0;

      return {
        industry,
        totalApplications: overall.totalApplications,
        successfulApplications: overall.successfulApplications,
        successRate: overall.successRate,
        averageTimeToResponse
      };
    });
  }

  private static calculateSuccessRateByJobLevel(applications: Application[]): Array<{
    level: string;
    totalApplications: number;
    successfulApplications: number;
    successRate: number;
  }> {
    const levelGroups = applications.reduce((groups, app) => {
      const level = this.extractJobLevel(app.job);
      if (!groups[level]) {
        groups[level] = [];
      }
      groups[level].push(app);
      return groups;
    }, {} as Record<string, Application[]>);

    return Object.entries(levelGroups).map(([level, apps]) => {
      const overall = this.calculateOverallSuccessRate(apps);
      return {
        level,
        totalApplications: overall.totalApplications,
        successfulApplications: overall.successfulApplications,
        successRate: overall.successRate
      };
    });
  }

  private static calculateTimeSeriesSuccessRate(applications: Application[]): Array<{
    date: string;
    applications: number;
    successes: number;
    successRate: number;
  }> {
    // Group applications by week
    const weeklyGroups = applications.reduce((groups, app) => {
      const appliedDate = new Date(app.appliedDate);
      const weekStart = new Date(appliedDate);
      weekStart.setDate(appliedDate.getDate() - appliedDate.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!groups[weekKey]) {
        groups[weekKey] = [];
      }
      groups[weekKey].push(app);
      return groups;
    }, {} as Record<string, Application[]>);

    return Object.entries(weeklyGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, apps]) => {
        const total = apps.length;
        const successes = apps.filter(app => ['offered', 'accepted'].includes(app.status)).length;
        const successRate = total > 0 ? (successes / total) * 100 : 0;

        return {
          date,
          applications: total,
          successes,
          successRate
        };
      });
  }

  private static async calculateEngagementMetrics(applications: Application[]): Promise<{
    averageEngagementScore: number;
    emailOpenRate: number;
    emailClickRate: number;
    emailResponseRate: number;
  }> {
    const averageEngagementScore = applications.length > 0 ?
      applications.reduce((sum, app) => sum + (app.employerInteractionScore || 0), 0) / applications.length : 0;

    const emailSentCount = applications.filter(app => app.emailSentAt).length;
    const emailOpenedCount = applications.filter(app => app.emailOpened).length;
    const emailClickedCount = applications.filter(app => app.employerInteractionScore && app.employerInteractionScore > 25).length;
    const emailRepliedCount = applications.filter(app => app.emailRepliedAt).length;

    return {
      averageEngagementScore,
      emailOpenRate: emailSentCount > 0 ? (emailOpenedCount / emailSentCount) * 100 : 0,
      emailClickRate: emailSentCount > 0 ? (emailClickedCount / emailSentCount) * 100 : 0,
      emailResponseRate: emailSentCount > 0 ? (emailRepliedCount / emailSentCount) * 100 : 0
    };
  }

  private static async generateRecommendations(
    userId: string,
    applications: Application[],
    metrics: any
  ): Promise<Array<{
    type: string;
    priority: 'low' | 'medium' | 'high';
    suggestion: string;
    impact: string;
    actionItems: string[];
  }>> {
    const recommendations = [];

    // Success rate recommendations
    if (metrics.successMetrics.overall.successRate < 10) {
      recommendations.push({
        type: 'success_rate',
        priority: 'high' as const,
        suggestion: 'Your application success rate is below industry average. Focus on application quality over quantity.',
        impact: 'Could improve success rate by 5-15%',
        actionItems: [
          'Spend more time tailoring each application',
          'Research companies thoroughly before applying',
          'Improve CV and cover letter templates',
          'Focus on roles that closely match your skills'
        ]
      });
    }

    // Response time recommendations
    if (metrics.responseTimeMetrics.average > 14) {
      recommendations.push({
        type: 'response_time',
        priority: 'medium' as const,
        suggestion: 'Long response times may indicate poor application targeting. Consider applying to more relevant positions.',
        impact: 'Could reduce average response time by 5-10 days',
        actionItems: [
          'Focus on jobs posted within the last 7 days',
          'Apply to smaller companies with faster hiring processes',
          'Use referrals and networking to speed up the process'
        ]
      });
    }

    // Engagement recommendations
    if (metrics.engagementMetrics.emailOpenRate < 30) {
      recommendations.push({
        type: 'engagement',
        priority: 'high' as const,
        suggestion: 'Low email open rates suggest subject lines or timing need improvement.',
        impact: 'Could improve email open rates by 10-20%',
        actionItems: [
          'A/B test different subject line approaches',
          'Send applications on Tuesday-Thursday mornings',
          'Personalize email subject lines with company names',
          'Follow up with a different approach if no response'
        ]
      });
    }

    return recommendations;
  }

  private static async calculateComparisonMetrics(
    userId: string,
    applications: Application[]
  ): Promise<{
    vsIndustryAverage: number;
    vsUserHistory: number;
    improvementAreas: string[];
  }> {
    // Get user's historical performance (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const historicalApps = await this.getUserApplicationsInRange(userId, sixMonthsAgo, new Date());
    
    const currentSuccessRate = this.calculateOverallSuccessRate(applications).successRate;
    const historicalSuccessRate = this.calculateOverallSuccessRate(historicalApps).successRate;
    
    // Industry average (would come from broader dataset in production)
    const industryAverage = 15; // 15% average success rate
    
    const vsIndustryAverage = currentSuccessRate - industryAverage;
    const vsUserHistory = currentSuccessRate - historicalSuccessRate;

    const improvementAreas = [];
    if (currentSuccessRate < industryAverage) {
      improvementAreas.push('Overall success rate below industry average');
    }
    if (vsUserHistory < 0) {
      improvementAreas.push('Success rate declining compared to previous period');
    }

    return {
      vsIndustryAverage,
      vsUserHistory,
      improvementAreas
    };
  }

  // Additional helper methods
  private static extractIndustry(job: Job): string {
    // Extract industry from job data - this is simplified
    // In production, this would use company data or job classification
    const company = job.company.toLowerCase();
    if (company.includes('tech') || company.includes('software')) return 'Technology';
    if (company.includes('bank') || company.includes('finance')) return 'Finance';
    if (company.includes('health') || company.includes('medical')) return 'Healthcare';
    if (company.includes('retail') || company.includes('shop')) return 'Retail';
    return 'Other';
  }

  private static extractJobLevel(job: Job): string {
    const title = job.title.toLowerCase();
    if (title.includes('senior') || title.includes('lead') || title.includes('principal')) return 'Senior';
    if (title.includes('junior') || title.includes('entry') || title.includes('associate')) return 'Junior';
    if (title.includes('manager') || title.includes('director')) return 'Management';
    return 'Mid-level';
  }

  private static async getFilteredApplications(
    userId?: string,
    filters?: any
  ): Promise<Application[]> {
    // This would implement complex filtering logic
    // For now, return basic filtered results
    if (userId) {
      return await storage.getApplicationsByUserId(userId);
    }
    return []; // Would implement global filtering in production
  }

  private static async getApplicationsByIndustryAndRole(
    industry: string,
    role?: string
  ): Promise<Application[]> {
    // This would query applications by industry and role
    // For now, return empty array as placeholder
    return [];
  }

  private static extractCommonSkills(applications: Application[]): string[] {
    // Extract skills from job requirements
    const allSkills: string[] = [];
    applications.forEach(app => {
      if (app.job.requirements) {
        // Simple skill extraction - in production would use NLP
        const skills = app.job.requirements.toLowerCase()
          .match(/(javascript|python|react|node\.js|sql|aws|docker|kubernetes)/g) || [];
        allSkills.push(...skills);
      }
    });

    // Count frequency and return top skills
    const skillCounts = allSkills.reduce((counts, skill) => {
      counts[skill] = (counts[skill] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(skillCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([skill]) => skill);
  }

  private static calculateSalaryRanges(applications: Application[]): { min: number; max: number; average: number } {
    // Extract salary information from job data
    // This is simplified - in production would parse salary strings
    return {
      min: 50000,
      max: 150000,
      average: 85000
    };
  }

  private static determineTrends(applications: Application[], industry: string): {
    demandTrend: 'increasing' | 'decreasing' | 'stable';
    competitionLevel: 'low' | 'medium' | 'high';
    seasonalPatterns: string[];
  } {
    // Simplified trend analysis
    return {
      demandTrend: 'stable',
      competitionLevel: 'medium',
      seasonalPatterns: ['Q4 hiring surge', 'Summer slowdown']
    };
  }

  private static generateIndustryRecommendations(
    industry: string,
    role?: string,
    metrics?: any
  ): string[] {
    return [
      `Focus on ${industry}-specific skills and certifications`,
      'Network with professionals in the industry',
      'Follow industry publications and trends',
      'Consider specialized job boards for the industry'
    ];
  }

  private static async calculateResponseTimesByIndustry(applications: Application[]): Promise<Array<{
    industry: string;
    averageResponseTime: number;
    responseRate: number;
  }>> {
    // Implementation for response times by industry
    return [];
  }

  private static calculateResponseTimesByCompanySize(applications: Application[]): Array<{
    size: string;
    averageResponseTime: number;
    responseRate: number;
  }> {
    // Implementation for response times by company size
    return [];
  }

  private static async getApplicationsDuringPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Application[]> {
    return this.getUserApplicationsInRange(userId, startDate, endDate);
  }

  private static calculateStatisticalSignificance(variants: any[]): boolean {
    // Simplified statistical significance calculation
    // In production, would use proper statistical tests
    return variants.length >= 2 && variants[0].applicationCount > 30;
  }

  private static generateA_BTestInsights(variants: any[], hypothesis: string): string[] {
    const bestVariant = variants.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    );

    return [
      `${bestVariant.name} achieved the highest success rate`,
      `Hypothesis "${hypothesis}" was ${bestVariant.successRate > variants[0].successRate ? 'supported' : 'not supported'}`,
      'Consider implementing the winning variant for future applications'
    ];
  }

  private static generateROIRecommendation(
    strategy: string,
    roiPercentage: number,
    applicationCount: number
  ): string {
    if (roiPercentage > 50) {
      return `Excellent ROI - increase focus on ${strategy}`;
    } else if (roiPercentage > 0) {
      return `Positive ROI - maintain current ${strategy} efforts`;
    } else {
      return `Negative ROI - reconsider ${strategy} approach`;
    }
  }

  private static generateROIOptimizationSuggestions(data: {
    applications: Application[];
    roiByStrategy: any[];
    totalROI: number;
  }): string[] {
    const suggestions = [];

    const bestStrategy = data.roiByStrategy.reduce((best, current) => 
      current.roiPercentage > best.roiPercentage ? current : best
    );

    suggestions.push(`Focus more on ${bestStrategy.strategy} - your highest ROI strategy`);

    if (data.totalROI < 50) {
      suggestions.push('Consider reducing application volume and increasing application quality');
    }

    suggestions.push('Track offer acceptance rates to improve ROI calculations');
    suggestions.push('Consider negotiating salaries to increase actual returns');

    return suggestions;
  }
}