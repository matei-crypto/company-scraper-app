/**
 * Document-related utility functions
 */

import { ACCOUNT_DOCUMENT_CATEGORY, ACCOUNT_DOCUMENT_TYPE } from '../config/constants.js';

/**
 * Filter filing history items for account documents
 * 
 * @param filings - Array of filing history items
 * @returns Filtered array containing only account documents (category: "accounts", type: "AA")
 * 
 * @example
 * const accountDocs = filterAccountDocuments(filingHistory.items);
 */
export function filterAccountDocuments(filings: any[]): any[] {
  return filings.filter(
    (filing: any) =>
      filing.category === ACCOUNT_DOCUMENT_CATEGORY &&
      filing.type === ACCOUNT_DOCUMENT_TYPE &&
      filing.transaction_id
  );
}

/**
 * Check if a filing is an account document
 * 
 * @param filing - Filing history item
 * @returns True if the filing is an account document
 */
export function isAccountDocument(filing: any): boolean {
  return (
    filing.category === ACCOUNT_DOCUMENT_CATEGORY &&
    filing.type === ACCOUNT_DOCUMENT_TYPE &&
    !!filing.transaction_id
  );
}

