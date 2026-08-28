import { z } from 'zod';

export const DEFAULT_NOC_DESCRIPTION = `
<p>To Whom It May Concern,</p>
<p><strong>Subject: No Objection Certificate for Nikah</strong></p>
<p>
  This is to certify that <strong>Mr. [Groom's Full Name]</strong>, son of Mr. [Groom's Father's Name], and
  <strong>Ms. [Bride's Full Name]</strong>, daughter of Mr. [Bride's Father's Name], have approached our Mahall
  for the purpose of solemnizing their marriage through the Islamic Nikah ceremony.
</p>
<p>
  We, the undersigned members of the Mahall committee, hereby declare that we have no objections to the
  aforementioned union, and we consider it in compliance with Islamic customs and teachings. We have
  conducted the necessary due diligence, reviewed the documentation, and ensured that both parties meet
  the requirements for marriage in accordance with Islamic law.
</p>
<p>
  Furthermore, we have performed all required religious and legal checks and verifications, and it is our
  firm belief that the union between <strong>Mr. [Groom's Full Name]</strong> and <strong>Ms. [Bride's Full Name]</strong>
  is permissible under Islamic law.
</p>
<p>The current marital status of the parties is as follows:</p>
<ul>
  <li><strong>Mr. [Groom's Full Name]</strong> - [Current Marital Status] - [Number of Marriages]</li>
  <li><strong>Ms. [Bride's Full Name]</strong> - [Current Marital Status] - [Number of Marriages]</li>
</ul>
<p>
  This No Objection Certificate is issued to facilitate the Nikah ceremony and to confirm that the Mahall
  does not raise any objections to this marriage. We wish the couple a blessed and harmonious marital life.
</p>
<p>
  For any further inquiries or information, please feel free to contact our Mahall office at
  [Contact Information].
</p>
<p>Yours faithfully,</p>
<p>[Signature of the Mahall Committee Member]</p>
<p>[Printed Name of the Mahall Committee Member]</p>
`.trim();

export const createNocSchema = z.object({
  applicantId: z.string().optional(),
  applicantName: z.string().min(2, 'Applicant name must be between 2 and 100 characters').max(100, 'Applicant name must be between 2 and 100 characters'),
  applicantNameMl: z.string().optional(),
  applicantPhone: z
    .string()
    .optional()
    .refine((v) => !v || /^[0-9]{10}$/.test(v), 'Applicant phone must be exactly 10 digits'),
  purposeTitle: z.string().min(2, 'Purpose title must be between 2 and 200 characters').max(200, 'Purpose title must be between 2 and 200 characters'),
  purposeTitleMl: z.string().optional(),
  purposeDescription: z.string().min(1, 'Purpose description is required'),
  type: z.enum(['common', 'nikah']),
});

export type CreateNocFormData = z.infer<typeof createNocSchema>;
