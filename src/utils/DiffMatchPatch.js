
const vscode = require('vscode'); 
const fs = require('fs'); 
const path = require('path');
/**
 * Simplified diff-match-patch implementation for CodeAlchemy
 * Based on the Google diff-match-patch library
 */
class DiffMatchPatch {
    constructor() {
      this.Diff_Timeout = 1.0;
      this.Diff_EditCost = 4;
    }
  
    /**
     * Find the differences between two texts.
     * @param {string} text1 Old text
     * @param {string} text2 New text
     * @return {Array} Array of diff tuples: [operation, text]
     *     where operation is -1 (deletion), 0 (unchanged), or 1 (insertion)
     */
    diff_main(text1, text2) {
      // Check for equality
      if (text1 === text2) {
        if (text1) {
          return [[0, text1]];
        }
        return [];
      }
  
      // Trim common prefix and suffix
      const commonPrefix = this.diff_commonPrefix(text1, text2);
      const commonSuffix = this.diff_commonSuffix(text1, text2);
      
      text1 = text1.substring(commonPrefix, text1.length - commonSuffix);
      text2 = text2.substring(commonPrefix, text2.length - commonSuffix);
  
      // Simple case - one of the strings is empty
      if (!text1) {
        return [[1, text2]];
      }
      if (!text2) {
        return [[-1, text1]];
      }
  
      // Convert to character-by-character diffs for simplicity
      const diffs = this.diff_computeSimple(text1, text2);
  
      // Add back common prefix and suffix
      if (commonPrefix) {
        diffs.unshift([0, text1.substring(0, commonPrefix)]);
      }
      if (commonSuffix) {
        diffs.push([0, text1.substring(text1.length - commonSuffix)]);
      }
  
      this.diff_cleanupMerge(diffs);
      return diffs;
    }
  
    /**
     * Find the common prefix of two strings
     * @param {string} text1 First string
     * @param {string} text2 Second string
     * @return {number} Length of common prefix
     */
    diff_commonPrefix(text1, text2) {
      const n = Math.min(text1.length, text2.length);
      for (let i = 0; i < n; i++) {
        if (text1.charAt(i) !== text2.charAt(i)) {
          return i;
        }
      }
      return n;
    }
  
    /**
     * Find the common suffix of two strings
     * @param {string} text1 First string
     * @param {string} text2 Second string
     * @return {number} Length of common suffix
     */
    diff_commonSuffix(text1, text2) {
      const text1Length = text1.length;
      const text2Length = text2.length;
      const n = Math.min(text1Length, text2Length);
      for (let i = 1; i <= n; i++) {
        if (text1.charAt(text1Length - i) !== text2.charAt(text2Length - i)) {
          return i - 1;
        }
      }
      return n;
    }
  
    /**
     * Simple character-by-character diff
     * @param {string} text1 Old text
     * @param {string} text2 New text
     * @return {Array} Array of diff tuples
     */
    diff_computeSimple(text1, text2) {
      // Simple implementation - just return deletion of text1 followed by insertion of text2
      // For a production implementation, you would use a proper diff algorithm here
      if (text1 && text2) {
        const diffs = [[-1, text1], [1, text2]];
        return diffs;
      }
      if (text1) {
        return [[-1, text1]];
      }
      if (text2) {
        return [[1, text2]];
      }
      return [];
    }
  
    /**
     * Cleanup diff by merging adjacent operations
     * @param {Array} diffs Array of diff tuples
     */
    diff_cleanupMerge(diffs) {
      if (!diffs.length) {
        return;
      }
      
      const stack = [];
      let i = 0;
      
      while (i < diffs.length) {
        if (stack.length && stack[stack.length - 1][0] === diffs[i][0]) {
          // Merge with previous entry if same operation
          stack[stack.length - 1][1] += diffs[i][1];
        } else {
          stack.push(diffs[i]);
        }
        i++;
      }
      
      // Clear the array and add merged operations back
      diffs.length = 0;
      for (const diff of stack) {
        diffs.push(diff);
      }
    }
  
    /**
     * Cleanup semantically - merge similar sections, eliminate tiny edits
     * @param {Array} diffs Array of diff tuples
     */
    diff_cleanupSemantic(diffs) {
      // Simplified version - just merge adjacent ops of the same type
      this.diff_cleanupMerge(diffs);
      return diffs;
    }
  }

module.exports = { DiffMatchPatch };