// Reusable email templates with placeholders (SPEC §7 Phase 3). Client-safe.

export type EmailTemplateId = "outreach" | "rejection";

export interface TemplateVars {
  candidateName: string;
  jobTitle: string;
  senderName?: string;
}

export interface RenderedTemplate {
  subject: string;
  body: string; // plain text; converted to HTML on send
}

export const EMAIL_TEMPLATES: {
  id: EmailTemplateId;
  label: string;
  render: (v: TemplateVars) => RenderedTemplate;
}[] = [
  {
    id: "outreach",
    label: "Outreach",
    render: ({ candidateName, jobTitle, senderName }) => ({
      subject: `Opportunity: ${jobTitle}`,
      body: `Hi ${candidateName},

I came across your profile and think you could be a strong fit for our ${jobTitle} role. I'd love to tell you more and hear about what you're looking for.

Would you be open to a short call this week?

Best regards,
${senderName ?? "The hiring team"}`,
    }),
  },
  {
    id: "rejection",
    label: "Rejection",
    render: ({ candidateName, jobTitle, senderName }) => ({
      subject: `Update on your application for ${jobTitle}`,
      body: `Hi ${candidateName},

Thank you for taking the time to apply for the ${jobTitle} role and for sharing your background with us.

After careful consideration, we've decided to move forward with other candidates at this stage. This was a difficult decision, and we genuinely appreciate your interest. We'll keep your details on file and reach out should a suitable role open up.

We wish you all the best in your search.

Kind regards,
${senderName ?? "The hiring team"}`,
    }),
  },
];

export function renderTemplate(
  id: EmailTemplateId,
  vars: TemplateVars,
): RenderedTemplate {
  const t = EMAIL_TEMPLATES.find((x) => x.id === id) ?? EMAIL_TEMPLATES[0];
  return t.render(vars);
}
