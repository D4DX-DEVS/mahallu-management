import { collectibleService } from '@/services/collectibleService';
import { downloadInvoicePdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

/**
 * Download a receipt PDF and log the print on the server. The server decides whether this is the
 * original or a duplicate, so a reprint always gets the DUPLICATE watermark, whichever screen it came from.
 */
export async function printReceipt(details: InvoiceDetails, opts: { forceDuplicate?: boolean } = {}) {
  let duplicate = Boolean(opts.forceDuplicate) || Boolean(details.duplicate);
  if (details.receiptRef) {
    try {
      const log = await collectibleService.recordReceiptPrint(details.receiptRef.type, details.receiptRef.id);
      duplicate = duplicate || log.isDuplicate;
    } catch (err: any) {
      // Never block the treasurer from printing, but do not pass a possible reprint off as an original.
      duplicate = true;
      toast.warning('We could not log this print, so the copy is marked DUPLICATE.');
    }
  }
  await downloadInvoicePdf({ ...details, duplicate });
}
