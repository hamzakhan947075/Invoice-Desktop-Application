import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-status";
import type { InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";

const INK = "#111111";
const MUTED = "#6b6b6b";
const RULE = "#e2e2e2";
const PANEL = "#f6f6f6";
const DANGER = "#c0362c";

const STATUS_STYLES: Record<InvoiceStatus, { bg: string; color: string; borderColor?: string }> = {
  DRAFT: { bg: "#eeeeee", color: "#4b4b4b" },
  SENT: { bg: "#ffffff", color: INK, borderColor: "#c9c9c9" },
  PARTIALLY_PAID: { bg: "#ffffff", color: INK, borderColor: "#c9c9c9" },
  PAID: { bg: INK, color: "#ffffff" },
  OVERDUE: { bg: DANGER, color: "#ffffff" },
  CANCELLED: { bg: "#eeeeee", color: "#4b4b4b" },
};

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: INK, fontFamily: "Helvetica" },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 48, height: 48, marginBottom: 10, objectFit: "cover" },
  businessName: { fontSize: 15, fontWeight: 700, marginBottom: 3, letterSpacing: 0.2 },
  muted: { color: MUTED, fontSize: 9.5, lineHeight: 1.4 },

  docLabel: { fontSize: 9, color: MUTED, letterSpacing: 2, textAlign: "right", marginBottom: 4 },
  invoiceNumber: { fontSize: 20, fontWeight: 700, textAlign: "right", marginBottom: 8 },
  statusBadge: {
    alignSelf: "flex-end",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 10,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.3,
  },

  headerRule: { borderBottomWidth: 1.5, borderBottomColor: INK, marginTop: 20, marginBottom: 22 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  sectionLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", marginBottom: 6, letterSpacing: 1.2 },
  customerName: { fontSize: 12, fontWeight: 700, marginBottom: 3 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginBottom: 4 },
  metaLabel: { color: MUTED, fontSize: 9.5, width: 62, textAlign: "right" },
  metaValue: { fontSize: 9.5, width: 68, textAlign: "right", fontWeight: 700 },

  table: { marginBottom: 24 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: INK,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colDescription: { flex: 3 },
  colQty: { flex: 0.8, textAlign: "right" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTax: { flex: 0.9, textAlign: "right" },
  colTotal: { flex: 1.3, textAlign: "right" },
  headerCell: { fontSize: 8.5, color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 },
  cell: { fontSize: 9.5 },

  summaryWrap: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 24 },
  summary: { width: 240, backgroundColor: PANEL, borderRadius: 4, padding: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  summaryLabel: { color: MUTED, fontSize: 9.5 },
  summaryValue: { fontSize: 9.5 },
  summaryDivider: { borderBottomWidth: 1, borderBottomColor: "#d6d6d6", marginVertical: 6 },
  summaryTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  summaryTotalLabel: { fontSize: 10.5, fontWeight: 700 },
  summaryTotalValue: { fontSize: 10.5, fontWeight: 700 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#d6d6d6",
  },
  balanceLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 },
  balanceValue: { fontSize: 15, fontWeight: 700 },

  notes: { marginBottom: 24, paddingTop: 14, borderTopWidth: 0.75, borderTopColor: RULE },
  notesLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  notesBody: { color: "#333333", fontSize: 9.5, lineHeight: 1.5 },

  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 36,
    paddingTop: 12,
    borderTopWidth: 0.75,
    borderTopColor: RULE,
    alignItems: "center",
  },
  footerThanks: { fontSize: 9.5, fontWeight: 700, marginBottom: 2 },
  footerMeta: { fontSize: 8, color: MUTED },
});

export type InvoicePdfData = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: string;
  notes: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  business: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    logoPath: string | null;
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  items: {
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    lineTotal: string;
  }[];
  payments: {
    paymentDate: string;
    paymentMethod: PaymentMethod;
    reference: string | null;
    amount: string;
  }[];
};

function money(amount: string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const statusStyle = STATUS_STYLES[data.status];
  const hasBalance = Number(data.balanceDue) > 0;

  return (
    <Document title={data.invoiceNumber}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image has no alt prop; this isn't HTML. */}
            {data.business.logoPath && <Image src={data.business.logoPath} style={styles.logo} />}
            <Text style={styles.businessName}>{data.business.name}</Text>
            {data.business.email && <Text style={styles.muted}>{data.business.email}</Text>}
            {data.business.phone && <Text style={styles.muted}>{data.business.phone}</Text>}
            {data.business.address && <Text style={styles.muted}>{data.business.address}</Text>}
          </View>
          <View>
            <Text style={styles.docLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.color,
                  ...(statusStyle.borderColor
                    ? { borderWidth: 1, borderColor: statusStyle.borderColor }
                    : {}),
                },
              ]}
            >
              {INVOICE_STATUS_LABELS[data.status]}
            </Text>
          </View>
        </View>

        <View style={styles.headerRule} />

        <View style={styles.infoRow}>
          <View>
            <Text style={styles.sectionLabel}>Billed to</Text>
            <Text style={styles.customerName}>{data.customer.name}</Text>
            {data.customer.email && <Text style={styles.muted}>{data.customer.email}</Text>}
            {data.customer.phone && <Text style={styles.muted}>{data.customer.phone}</Text>}
            {data.customer.address && <Text style={styles.muted}>{data.customer.address}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Issue Date</Text>
              <Text style={styles.metaValue}>{data.issueDate}</Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Due Date</Text>
              <Text style={styles.metaValue}>{data.dueDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDescription, styles.headerCell]}>Description</Text>
            <Text style={[styles.colQty, styles.headerCell]}>Qty</Text>
            <Text style={[styles.colPrice, styles.headerCell]}>Price</Text>
            <Text style={[styles.colTax, styles.headerCell]}>Tax</Text>
            <Text style={[styles.colTotal, styles.headerCell]}>Total</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}>
              <Text style={[styles.colDescription, styles.cell]}>{item.description}</Text>
              <Text style={[styles.colQty, styles.cell]}>{item.quantity}</Text>
              <Text style={[styles.colPrice, styles.cell]}>{money(item.unitPrice, data.currency)}</Text>
              <Text style={[styles.colTax, styles.cell]}>{Number(item.taxRate).toFixed(2)}%</Text>
              <Text style={[styles.colTotal, styles.cell]}>{money(item.lineTotal, data.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryWrap}>
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{money(data.subtotal, data.currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={styles.summaryValue}>{money(data.discount, data.currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{money(data.tax, data.currency)}</Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>{money(data.total, data.currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid</Text>
              <Text style={styles.summaryValue}>{money(data.amountPaid, data.currency)}</Text>
            </View>

            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={[styles.balanceValue, hasBalance ? { color: DANGER } : {}]}>
                {money(data.balanceDue, data.currency)}
              </Text>
            </View>
          </View>
        </View>

        {data.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesBody}>{data.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerThanks}>Thank you for your business.</Text>
          <Text style={styles.footerMeta}>
            {data.business.name} · Invoice {data.invoiceNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
