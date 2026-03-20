import {
  Button,
  Column,
  Row,
  Section,
  Text,
} from '@react-email/components';

import { BaseLayout } from './BaseLayout';

interface Product {
  name: string;
  price: string;
  url?: string;
}

interface DiscountEmailProps {
  subject: string;
  previewText: string;
  body: string;
  cta: string;
  ctaUrl: string;
  storeName: string;
  unsubscribeUrl: string;
  discountCode?: string;
  expiryDate?: string;
  products?: Product[];
}

export function DiscountEmail({
  previewText,
  body,
  cta,
  ctaUrl,
  storeName,
  unsubscribeUrl,
  discountCode,
  expiryDate,
  products,
}: DiscountEmailProps) {
  const paragraphs = body.split('\n').filter(Boolean);

  return (
    <BaseLayout
      previewText={previewText}
      storeName={storeName}
      unsubscribeUrl={unsubscribeUrl}
    >
      {/* Body paragraphs */}
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={bodyText}>
          {paragraph}
        </Text>
      ))}

      {/* Discount Code Block */}
      {discountCode && (
        <Section style={discountSection}>
          <Text style={discountLabel}>Your discount code</Text>
          <Text style={discountCode_style}>{discountCode}</Text>
          {expiryDate && (
            <Text style={expiryText}>Expires {expiryDate}</Text>
          )}
        </Section>
      )}

      {/* CTA Button */}
      <Section style={ctaSection}>
        <Button style={ctaButton} href={ctaUrl}>
          {cta}
        </Button>
      </Section>

      {/* Product Recommendations */}
      {products && products.length > 0 && (
        <Section style={productsSection}>
          <Text style={productsSectionTitle}>Shop these deals</Text>
          <Row>
            {products.slice(0, 3).map((product, index) => (
              <Column key={index} style={productColumn}>
                <Text style={productName}>{product.name}</Text>
                <Text style={productPrice}>{product.price}</Text>
              </Column>
            ))}
          </Row>
        </Section>
      )}
    </BaseLayout>
  );
}

const bodyText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
};

const discountSection = {
  backgroundColor: '#fafafa',
  border: '2px dashed #d1d5db',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const discountLabel = {
  color: '#6B7280',
  fontSize: '12px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 8px',
};

const discountCode_style = {
  color: '#111827',
  fontSize: '28px',
  fontWeight: '700' as const,
  fontFamily: '"Courier New", Courier, monospace',
  margin: '0 0 8px',
  letterSpacing: '2px',
};

const expiryText = {
  color: '#9CA3AF',
  fontSize: '13px',
  margin: '0',
};

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const ctaButton = {
  backgroundColor: '#4F46E5',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600' as const,
  lineHeight: '100%',
  padding: '14px 28px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const productsSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0 0',
};

const productsSectionTitle = {
  color: '#111827',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0 0 16px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const productColumn = {
  textAlign: 'center' as const,
  padding: '8px',
  width: '33.33%',
};

const productName = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: '500' as const,
  margin: '0 0 4px',
};

const productPrice = {
  color: '#6B7280',
  fontSize: '14px',
  margin: '0',
};
