import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, PageHero } from "@/components/site/marketing";

const SECTIONS = [
  { t: "1. Information we collect", b: "We collect the information you provide when you create an account and register a business: your name, email address, business name, contact details and the operational records you enter (sales, inventory, customers, expenses and so on). We also collect basic technical information such as your IP address and browser type for security and audit purposes." },
  { t: "2. How we use your information", b: "Your information is used to operate the platform: to authenticate you, to display your business data back to you, to generate reports and documents, to send you notifications you have enabled, and to keep the service secure. We do not sell your personal information." },
  { t: "3. Business data isolation", b: "Every record you create is associated with your business. Access is enforced on the server, so one business can never read or modify another business's data. Staff members within your business only see what their role permits." },
  { t: "4. Data storage and security", b: "Data is stored in a managed PostgreSQL database. Passwords are hashed and never stored in plain text. Sessions are protected with signed cookies. File uploads are stored in secure cloud storage. We apply input validation, access control and audit logging to protect your data." },
  { t: "5. Payment information", b: "Online payments are processed by our payment provider. We do not store your full card details on our servers. Payment status is verified independently on our server before any transaction is marked as successful." },
  { t: "6. Data retention", b: "We retain your business records for as long as your account is active. If you close your account, you may request an export of your data. We may retain limited records where required by law." },
  { t: "7. Your rights", b: "You may access, correct or export the data you have entered at any time from within the platform. You may also request deletion of your account and associated data by contacting us." },
  { t: "8. Cookies", b: "We use a single session cookie to keep you signed in. We do not use third-party advertising cookies." },
  { t: "9. Changes to this policy", b: "We may update this policy from time to time. Material changes will be communicated through the platform. Continued use after a change constitutes acceptance." },
  { t: "10. Contact us", b: "For any privacy question or request, contact us through the Contact page or at privacy@coregridafrica.com." },
];

export default function Privacy() {
  return (
    <PublicLayout>
      <PageHero eyebrow="Legal" title="Privacy Policy" subtitle="How Core Grid Africa collects, uses and protects your information." />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
          <div className="mt-8 space-y-8">
            {SECTIONS.map((s) => (
              <div key={s.t}>
                <h2 className="text-lg font-semibold text-navy">{s.t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
