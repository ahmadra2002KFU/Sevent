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

export type SupplierApprovedProps = {
  businessName: string;
  appUrl?: string;
};

export default function SupplierApproved({
  businessName,
  appUrl = "http://localhost:3000",
}: SupplierApprovedProps) {
  const profileUrl = `${appUrl}/supplier/dashboard`;

  return (
    <Html>
      <Head />
      <Preview>{businessName} is verified on Sevent</Preview>
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
                fontSize: 24,
                fontWeight: 700,
                margin: "8px 0 16px",
              }}
            >
              You&apos;re verified, {businessName}.
            </Heading>
            <Text style={{ fontSize: 16, lineHeight: 1.55, margin: 0 }}>
              Your business profile passed admin review and is now live on
              Sevent. Organizers can discover, request quotes, and book your
              services.
            </Text>
          </Section>

          <Hr style={{ borderColor: `${SEVENT_GREEN}22`, margin: "24px 0" }} />

          <Section>
            <Heading
              as="h2"
              style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}
            >
              Next steps
            </Heading>
            <Text style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              1. Review and refine your packages so &quot;from&quot; prices are
              accurate.
              <br />
              2. Add at least one of each pricing rule type that applies to
              your business.
              <br />
              3. Block any dates you are unavailable in your calendar.
            </Text>
          </Section>

          <Section style={{ marginTop: 24 }}>
            <Link
              href={profileUrl}
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
              Open your Sevent dashboard
            </Link>
          </Section>

          <Hr style={{ borderColor: `${SEVENT_GREEN}22`, margin: "24px 0" }} />

          <Text style={{ color: "#637087", fontSize: 12, margin: 0 }}>
            You&apos;re receiving this because your supplier account was
            approved on Sevent — the Saudi event marketplace.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
