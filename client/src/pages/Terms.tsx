import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, PageHero } from "@/components/site/marketing";

const SECTIONS = [
  { t: "1. Acceptance of terms", b: "By creating an account or using Core Grid Africa, you agree to these Terms and Conditions. If you do not agree, please do not use the platform." },
  { t: "2. Your account", b: "You are responsible for keeping your login credentials secure and for all activity that occurs under your account. You must provide accurate information when registering your business." },
  { t: "3. Acceptable use", b: "You agree to use the platform only for lawful business purposes. You must not attempt to access another business's data, interfere with the service, or use the platform to store unlawful content." },
  { t: "4. Your data", b: "You own the business records you enter. We store and process them on your behalf to provide the service. You are responsible for the accuracy of the data you enter." },
  { t: "5. Subscriptions and billing", b: "Paid plans are billed monthly or annually. Subscription payments are processed through our payment provider. You may change or cancel your plan at any time; access continues until the end of the paid period." },
  { t: "6. Service availability", b: "We aim to keep the platform available at all times but do not guarantee uninterrupted service. We may perform maintenance and will give notice where practical." },
  { t: "7. Limitation of liability", b: "The platform is provided as a business tool. We are not liable for business decisions made using the platform, nor for indirect or consequential losses, to the fullest extent permitted by law." },
  { t: "8. Termination", b: "We may suspend or terminate an account that breaches these terms or is used unlawfully. You may close your account at any time." },
  { t: "9. Changes to these terms", b: "We may update these terms from time to time. Continued use of the platform after changes are posted constitutes acceptance of the updated terms." },
  { t: "10. Governing law", b: "These terms are governed by the laws of the Federal Republic of Nigeria." },
];

export default function Terms() {
  return (
    <PublicLayout>
      <PageHero eyebrow="Legal" title="Terms and Conditions" subtitle="The rules that govern your use of Core Grid Africa." />
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
