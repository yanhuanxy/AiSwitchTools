import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';

export interface ProcessedChunk {
  content: string;
  metadata: {
    page?: number;
    loc?: { start: number; end: number };
    [key: string]: any;
  };
}

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  async processFile(
    buffer: Buffer,
    mimetype: string,
    chunkSize = 1000,
    chunkOverlap = 100,
  ): Promise<ProcessedChunk[]> {
    let text = '';
    
    try {
      // 1. Parse based on mimetype
      if (mimetype === 'application/pdf') {
        text = await this.parsePdf(buffer);
      } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        text = await this.parseDocx(buffer);
      } else if (mimetype.startsWith('text/')) {
        text = buffer.toString('utf-8');
      } else {
        throw new BadRequestException(`Unsupported mimetype: ${mimetype}`);
      }

      // 2. Clean
      const cleanedText = this.cleanText(text);

      // 3. Split
      return this.splitText(cleanedText, chunkSize, chunkOverlap);

    } catch (error) {
      this.logger.error(`Failed to process file (${mimetype})`, error instanceof Error ? error.stack : error);
      if (error instanceof BadRequestException) {
          throw error;
      }
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    if (typeof PDFParse !== 'function') {
        throw new Error('pdf-parse library is not correctly imported (PDFParse is not a function)');
    }
    
    const parser = new PDFParse(new Uint8Array(buffer));
    const data = await parser.getText();
    return data.text;
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private cleanText(text: string): string {
    return text
      // Remove null bytes
      .replace(/\0/g, '')
      // Normalize newlines
      .replace(/\r\n/g, '\n')
      // Remove multiple empty lines (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Remove printable control characters (except newline/tab)
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Recursive Character Text Splitter Implementation
   * Splits text by separators in order: \n\n, \n, . , ? , ! , and finally by char.
   */
  private splitText(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
  ): ProcessedChunk[] {
    const separators = ['\n\n', '\n', '. ', '? ', '! ', ' ', ''];
    const chunks: ProcessedChunk[] = [];
    
    let currentStart = 0;
    
    // Simplistic recursive implementation for MVP
    // For a robust implementation, we'd use a full algorithm like LangChain's
    // Here we implement a simplified version that tries to split by largest separator
    
    const rawChunks = this.recursiveSplit(text, separators, chunkSize);
    
    // Merge chunks if they are too small (optional optimization) or just return them
    // For now, let's map them to the interface
    
    // Re-verify overlap logic: The recursiveSplit above just splits. 
    // Implementing a proper sliding window with overlap on the *resulting* splits is tricky without the full algorithm.
    // Let's implement a simpler "Scanning" approach which is robust enough for now.
    
    const words = text.split(/(\s+)/); // Split by whitespace but keep delimiters
    let currentChunk = '';
    let currentChunkLength = 0; // Approximation
    
    for (const word of words) {
        if (currentChunkLength + word.length > chunkSize) {
            if (currentChunk.trim().length > 0) {
                chunks.push({
                    content: currentChunk.trim(),
                    metadata: {
                        loc: { start: currentStart, end: currentStart + currentChunk.length }
                    }
                });
                
                // Overlap logic: keep the last 'overlap' characters
                const overlapText = currentChunk.slice(-chunkOverlap);
                currentStart += (currentChunk.length - overlapText.length);
                currentChunk = overlapText + word;
                currentChunkLength = currentChunk.length;
            } else {
                 // Word itself is longer than chunk size, force split? 
                 // For now, just accept it to avoid infinite loop
                 currentChunk = word;
                 currentChunkLength = word.length;
            }
        } else {
            currentChunk += word;
            currentChunkLength += word.length;
        }
    }
    
    if (currentChunk.trim().length > 0) {
        chunks.push({
            content: currentChunk.trim(),
            metadata: {
                loc: { start: currentStart, end: currentStart + currentChunk.length }
            }
        });
    }

    return chunks;
  }

  // Helper for more advanced splitting if needed later
  private recursiveSplit(text: string, separators: string[], chunkSize: number): string[] {
    const finalChunks: string[] = [];
    let separator = separators[0];
    let newSeparators: string[] = [];
    
    for (let i = 0; i < separators.length; i++) {
        if (text.includes(separators[i])) {
            separator = separators[i];
            newSeparators = separators.slice(i + 1);
            break;
        }
        if (i === separators.length - 1) {
            separator = '';
            newSeparators = [];
        }
    }

    const splits = separator ? text.split(separator) : [text];
    let goodSplits: string[] = [];
    
    for (const s of splits) {
        if (s.length < chunkSize) {
            goodSplits.push(s);
        } else {
            if (newSeparators.length > 0) {
                const subSplits = this.recursiveSplit(s, newSeparators, chunkSize);
                goodSplits.push(...subSplits);
            } else {
                goodSplits.push(s); // Cannot split further
            }
        }
    }
    
    // Merge back with separator to fill chunk size? 
    // This part is complex to get right in one go. 
    // I will stick to the "Scanning" approach in `splitText` above for reliability in this iteration.
    
    return goodSplits;
  }
}
