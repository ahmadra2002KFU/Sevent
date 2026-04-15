import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const SEVENT_GREEN = "#006C35";
const SEVENT_GOLD = "#C8993A";
const SEVENT_DARK = "#0B1E12";
const SEVENT_BG = "#F0FAF4";
const REJECT_RED = "#9F1A1A";

export type SupplierRejectedProps = {
  businessName: string;
  notes: string | null;
  appUrl?: string;
};

export default function SupplierRejected({
  businessName,
  notes,
  appUrl = "http://localhost:3000",
}: SupplierRejectedProps) {
  const onboardingUrl = `${appUrl}/supplier/onboarding`;

  return (
    <Html>
      <Head />
      <Preview>{businessName} — verification needs follow-up</Preview>
      <Body
        style={{
          backgroundColor: SEVENT_BG,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "32px 0",
          color: SEVENT_DARK,
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            margin: "0 auto",
            maxWidth: 560,
            padding: 32,
            border: `1px solid ${SEVENT_GREEN}22`,
          }}
        >
          <Section>
            <Text
              style={{
                color: SEVENT_GOLD,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.5,
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Sevent · Supplier verification
            </Text>
            <Heading
              as="h1"
              style={{
                color: SEVENT_GREEN,
                fontSize: 22,
                fontWeight: 700,
                margin: "8px 0 16px",
              }}
            >
              {businessName}: we need a few changes before we can verify you.
            </Heading>
            <Text style={{ fontSize: 16, lineHeight: 1.55, margin: 0 }}>
              Our team reviewed your application but couldn&apos;t approve it
              yet. Please address the notes below and resubmit.
            </Text>
          </Section>

          <Hr style={{ borderColor: `${SEVENT_GREEN}22`, margin: "24px 0" }} />

          <Section>
            <Heading
              as="h2"
              style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}
            >
              Reviewer notes
            </Heading>
            <Text
              style={{
                backgroundColor: "#FFF6F6",
                borderLeft: `3px solid ${REJECT_RED}`,
                borderRadius: 6,
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
                padding: "12px 14px",
                whiteSpace: "pre-wrap",
              }}
            >
              {notes && notes.trim().length > 0
                ? notes
                : "No specific notes were left. Please double-check your documents and business details, then resubmit."}
            </Text>
          </Section>

          <Section style={{ marginTop: 24 }}>
            <Link
              href={onboardingUrl}
              style={{
                backgroundColor: SEVENT_GREEN,
                borderRadius: 8,
                color: "#ffffff",
                display: "inline-block",
                fontSize: 14,
                fontWeight: 600,
                padding: "10px 18px",
                textDecoration: "none",
              }}
            >
              Update your application
            </Link>
          </Section>

          <Hr style={{ borderColor: `${SEVENT_GREEN}22`, margin: "24px 0" }} />

          <Text style={{ color: "#637087", fontSize: 12, margin: 0 }}>
            Replies to this email reach the Sevent admin team. We&apos;re happy
            to help you get verified.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
