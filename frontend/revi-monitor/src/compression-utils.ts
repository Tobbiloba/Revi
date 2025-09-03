// Simple compression utilities for data transmission

// Basic gzip-like compression using built-in compression APIs
export async function compressData(data: any): Promise<{ data: string; compressed: boolean }> {
  const jsonString = JSON.stringify(data);
  
  // Only compress if the data is large enough to benefit
  if (jsonString.length < 1024) {
    return { data: jsonString, compressed: false };
  }

  try {
    // Use CompressionStream if available (modern browsers)
    if (typeof CompressionStream !== 'undefined') {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      // Write the JSON string as UTF-8 bytes
      const encoder = new TextEncoder();
      const bytes = encoder.encode(jsonString);
      
      await writer.write(bytes);
      await writer.close();
      
      // Read compressed data
      const compressed = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          compressed.push(value);
        }
      }
      
      // Combine all chunks and convert to base64
      const compressedBytes = new Uint8Array(
        compressed.reduce((acc, chunk) => acc + chunk.length, 0)
      );
      
      let offset = 0;
      for (const chunk of compressed) {
        compressedBytes.set(chunk, offset);
        offset += chunk.length;
      }
      
      const base64 = btoa(String.fromCharCode(...compressedBytes));
      
      // Only return compressed if it's actually smaller
      if (base64.length < jsonString.length * 0.8) {
        return { data: base64, compressed: true };
      }
    }
  } catch (error) {
    console.warn('[Revi] Compression failed, sending uncompressed data:', error);
  }
  
  // Fallback to uncompressed data
  return { data: jsonString, compressed: false };
}

// Simple string compression for older browsers
export function compressString(str: string): string {
  // Simple run-length encoding for repeated patterns
  let compressed = '';
  let i = 0;
  
  while (i < str.length) {
    let count = 1;
    const char = str[i];
    
    // Count consecutive characters
    while (i + count < str.length && str[i + count] === char && count < 99) {
      count++;
    }
    
    if (count > 3) {
      compressed += `${char}${count}`;
    } else {
      compressed += char.repeat(count);
    }
    
    i += count;
  }
  
  return compressed.length < str.length ? compressed : str;
}

// Deduplicate arrays of objects with similar keys
export function deduplicateEvents<T extends Record<string, any>>(events: T[]): {
  events: T[];
  compressionRatio: number;
} {
  if (events.length === 0) return { events, compressionRatio: 1 };
  
  const originalSize = JSON.stringify(events).length;
  
  // Group events by type/structure
  const grouped = new Map<string, T[]>();
  
  for (const event of events) {
    const keys = Object.keys(event).sort().join(',');
    if (!grouped.has(keys)) {
      grouped.set(keys, []);
    }
    grouped.get(keys)!.push(event);
  }
  
  // Compress each group separately
  const compressed: T[] = [];
  
  for (const [keys, groupedEvents] of grouped) {
    if (groupedEvents.length === 1) {
      compressed.push(groupedEvents[0]);
      continue;
    }
    
    // Extract common values
    const commonValues: Record<string, any> = {};
    const keyArray = keys.split(',');
    
    for (const key of keyArray) {
      const values = groupedEvents.map(e => e[key]);
      const firstValue = values[0];
      
      if (values.every(v => 
        JSON.stringify(v) === JSON.stringify(firstValue)
      )) {
        commonValues[key] = firstValue;
      }
    }
    
    // Create compressed events
    for (const event of groupedEvents) {
      const compressedEvent: any = { ...event };
      
      // Remove common values (they're implicit)
      for (const key of Object.keys(commonValues)) {
        if (JSON.stringify(event[key]) === JSON.stringify(commonValues[key])) {
          delete compressedEvent[key];
        }
      }
      
      // Add common values reference if significant compression
      if (Object.keys(commonValues).length > 2) {
        compressedEvent._common = commonValues;
      }
      
      compressed.push(compressedEvent);
    }
  }
  
  const compressedSize = JSON.stringify(compressed).length;
  const compressionRatio = compressedSize / originalSize;
  
  return { events: compressed, compressionRatio };
}

// Batch events intelligently based on size and type
export function createOptimalBatches<T>(
  events: T[],
  maxBatchSize: number,
  maxBatchBytes: number = 64 * 1024 // 64KB default
): T[][] {
  if (events.length === 0) return [];
  
  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentBatchSize = 0;
  
  for (const event of events) {
    const eventSize = JSON.stringify(event).length;
    
    // Start new batch if current would exceed limits
    if (
      currentBatch.length >= maxBatchSize ||
      currentBatchSize + eventSize > maxBatchBytes
    ) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }
    }
    
    currentBatch.push(event);
    currentBatchSize += eventSize;
  }
  
  // Don't forget the last batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
}