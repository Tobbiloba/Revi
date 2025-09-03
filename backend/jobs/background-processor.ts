import { api } from "encore.dev/api";
import { processError } from "../intelligence/grouping";
import { cacheManager } from "../cache/redis-cache";

/**
 * Background job processing system for heavy operations
 * Offloads CPU-intensive tasks from the main request flow
 */

interface JobQueue<T> {
  id: string;
  type: string;
  data: T;
  priority: 'high' | 'medium' | 'low';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  error?: string;
}

interface ErrorGroupingJob {
  projectId: number;
  errorId: number;
  errorData: {
    message: string;
    stack_trace?: string;
    url?: string;
    user_agent?: string;
  };
  userId?: string;
  sessionId?: string;
}

interface StatsRecalculationJob {
  projectId: number;
  invalidateCache: boolean;
}

class BackgroundJobProcessor {
  private errorGroupingQueue: JobQueue<ErrorGroupingJob>[] = [];
  private statsQueue: JobQueue<StatsRecalculationJob>[] = [];
  private isProcessing = false;
  private readonly BATCH_SIZE = 10;
  private readonly PROCESSING_INTERVAL = 1000; // 1 second

  constructor() {
    this.startProcessing();
  }

  /**
   * Queue error grouping job for background processing
   */
  async queueErrorGrouping(job: ErrorGroupingJob, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<string> {
    const jobId = `error_grouping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueJob: JobQueue<ErrorGroupingJob> = {
      id: jobId,
      type: 'error_grouping',
      data: job,
      priority,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    this.errorGroupingQueue.push(queueJob);
    this.sortQueueByPriority(this.errorGroupingQueue);
    
    console.log(`[Background Job] Queued error grouping job ${jobId} with priority ${priority}`);
    return jobId;
  }

  /**
   * Queue stats recalculation job
   */
  async queueStatsRecalculation(job: StatsRecalculationJob, priority: 'high' | 'medium' | 'low' = 'low'): Promise<string> {
    const jobId = `stats_recalc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueJob: JobQueue<StatsRecalculationJob> = {
      id: jobId,
      type: 'stats_recalculation',
      data: job,
      priority,
      retryCount: 0,
      maxRetries: 2,
      createdAt: new Date()
    };

    this.statsQueue.push(queueJob);
    this.sortQueueByPriority(this.statsQueue);
    
    console.log(`[Background Job] Queued stats recalculation job ${jobId} with priority ${priority}`);
    return jobId;
  }

  /**
   * Start the background processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('[Background Job] Starting background job processor');
    
    setInterval(async () => {
      await this.processBatch();
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Process a batch of jobs from all queues
   */
  private async processBatch(): Promise<void> {
    try {
      // Process high-priority error grouping jobs first
      const errorGroupingBatch = this.errorGroupingQueue
        .filter(job => job.priority === 'high')
        .slice(0, this.BATCH_SIZE);
      
      if (errorGroupingBatch.length > 0) {
        await this.processErrorGroupingBatch(errorGroupingBatch);
      }

      // Process medium-priority jobs
      const mediumPriorityJobs = this.errorGroupingQueue
        .filter(job => job.priority === 'medium')
        .slice(0, Math.max(1, this.BATCH_SIZE - errorGroupingBatch.length));
      
      if (mediumPriorityJobs.length > 0) {
        await this.processErrorGroupingBatch(mediumPriorityJobs);
      }

      // Process stats recalculation jobs (lower priority)
      const statsBatch = this.statsQueue.slice(0, 2); // Limit stats jobs
      if (statsBatch.length > 0) {
        await this.processStatsRecalculationBatch(statsBatch);
      }

    } catch (error) {
      console.error('[Background Job] Error processing batch:', error);
    }
  }

  /**
   * Process a batch of error grouping jobs
   */
  private async processErrorGroupingBatch(jobs: JobQueue<ErrorGroupingJob>[]): Promise<void> {
    const promises = jobs.map(async (job) => {
      try {
        job.processingStartedAt = new Date();
        
        const result = await processError({
          project_id: job.data.projectId,
          error_id: job.data.errorId,
          error_data: job.data.errorData,
          user_id: job.data.userId,
          session_id: job.data.sessionId
        });

        job.completedAt = new Date();
        console.log(`[Background Job] Completed error grouping job ${job.id}`);
        
        // Remove completed job from queue
        this.removeJobFromQueue(this.errorGroupingQueue, job.id);
        
        return result;
      } catch (error) {
        job.retryCount++;
        job.error = error instanceof Error ? error.message : String(error);
        
        if (job.retryCount >= job.maxRetries) {
          console.error(`[Background Job] Failed job ${job.id} after ${job.maxRetries} retries:`, error);
          this.removeJobFromQueue(this.errorGroupingQueue, job.id);
        } else {
          console.warn(`[Background Job] Retrying job ${job.id} (attempt ${job.retryCount}/${job.maxRetries})`);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Process a batch of stats recalculation jobs
   */
  private async processStatsRecalculationBatch(jobs: JobQueue<StatsRecalculationJob>[]): Promise<void> {
    for (const job of jobs) {
      try {
        job.processingStartedAt = new Date();
        
        if (job.data.invalidateCache) {
          await cacheManager.invalidateProjectCaches(job.data.projectId);
        }

        job.completedAt = new Date();
        console.log(`[Background Job] Completed stats recalculation job ${job.id}`);
        
        this.removeJobFromQueue(this.statsQueue, job.id);
        
      } catch (error) {
        job.retryCount++;
        job.error = error instanceof Error ? error.message : String(error);
        
        if (job.retryCount >= job.maxRetries) {
          console.error(`[Background Job] Failed stats job ${job.id} after ${job.maxRetries} retries:`, error);
          this.removeJobFromQueue(this.statsQueue, job.id);
        } else {
          console.warn(`[Background Job] Retrying stats job ${job.id} (attempt ${job.retryCount}/${job.maxRetries})`);
        }
      }
    }
  }

  /**
   * Sort queue by priority (high -> medium -> low)
   */
  private sortQueueByPriority<T>(queue: JobQueue<T>[]): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Remove completed/failed job from queue
   */
  private removeJobFromQueue<T>(queue: JobQueue<T>[], jobId: string): void {
    const index = queue.findIndex(job => job.id === jobId);
    if (index > -1) {
      queue.splice(index, 1);
    }
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): {
    errorGrouping: { total: number; pending: number; processing: number };
    stats: { total: number; pending: number; processing: number };
  } {
    const errorGroupingPending = this.errorGroupingQueue.filter(j => !j.processingStartedAt).length;
    const errorGroupingProcessing = this.errorGroupingQueue.filter(j => j.processingStartedAt && !j.completedAt).length;
    
    const statsPending = this.statsQueue.filter(j => !j.processingStartedAt).length;
    const statsProcessing = this.statsQueue.filter(j => j.processingStartedAt && !j.completedAt).length;

    return {
      errorGrouping: {
        total: this.errorGroupingQueue.length,
        pending: errorGroupingPending,
        processing: errorGroupingProcessing
      },
      stats: {
        total: this.statsQueue.length,
        pending: statsPending,
        processing: statsProcessing
      }
    };
  }
}

// Export singleton instance
export const backgroundJobProcessor = new BackgroundJobProcessor();

// API endpoint to check job queue status
export const getJobQueueStatus = api(
  { expose: true, method: "GET", path: "/api/jobs/status" },
  async () => {
    const status = backgroundJobProcessor.getQueueStatus();
    
    return {
      success: true,
      queues: status,
      timestamp: new Date().toISOString()
    };
  }
);