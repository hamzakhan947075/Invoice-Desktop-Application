import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payment";
import type { PaymentMethod } from "@/generated/prisma/enums";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#111111", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 56, height: 56, marginBottom: 8, objectFit: "cover" },
  businessName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  muted: { color: "#666666" },
  title: { fontSize: 18, fontWeight: 700, textAlign: "right" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  sectionLabel: { fontSize: 8, color: "#666666", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  summary: { flexDirection: "row", gap: 16, marginBottom: 20 },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#eeeeee",
    borderRadius: 4,
    padding: 8,
  },
  summaryLabel: { fontSize: 8, color: "#666666", marginBottom: 4 },
  summaryValue: { fontSize: 13, fontWeight: 700 },
  table: { marginBottom: 20 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eeeeee",
    paddingVertical: 5,
  },
  colDate: { flex: 1.2 },
  colInvoice: { flex: 1.5 },
  colMethod: { flex: 1.5 },
  colReference: { flex: 1.5 },
  colAmount: { flex: 1, textAlign: "right" },
  headerCell: { fontSize: 9, color: "#666666" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    paddingTop: 6,
    marginTop: 2,
    fontWeight: 700,
  },
});

export type CustomerStatementPdfData = {
  generatedOn: string;
  currency: string;
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
  totals: {
    invoiced: string;
    paid: string;
    outstanding: string;
  };
  payments: {
    paymentDate: string;
    invoiceNumber: string;
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

export function CustomerStatementPdfDocument({ data }: { data: CustomerStatementPdfData }) {
  const totalPayments = data.payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Document title={`${data.customer.name} — Payment Statement`}>
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
            <Text style={styles.title}>Payment Statement</Text>
            <Text style={[styles.muted, { textAlign: "right", marginTop: 4 }]}>
              Generated {data.generatedOn}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View>
            <Text style={styles.sectionLabel}>Customer</Text>
            <Text style={{ fontWeight: 700, marginBottom: 2 }}>{data.customer.name}</Text>
            {data.customer.email && <Text style={styles.muted}>{data.customer.email}</Text>}
            {data.customer.phone && <Text style={styles.muted}>{data.customer.phone}</Text>}
            {data.customer.address && <Text style={styles.muted}>{data.customer.address}</Text>}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Invoiced</Text>
            <Text style={styles.summaryValue}>{money(data.totals.invoiced, data.currency)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>{money(data.totals.paid, data.currency)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={styles.summaryValue}>{money(data.totals.outstanding, data.currency)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDate, styles.headerCell]}>Date</Text>
            <Text style={[styles.colInvoice, styles.headerCell]}>Invoice</Text>
            <Text style={[styles.colMethod, styles.headerCell]}>Method</Text>
            <Text style={[styles.colReference, styles.headerCell]}>Reference</Text>
            <Text style={[styles.colAmount, styles.headerCell]}>Amount</Text>
          </View>
          {data.payments.length === 0 ? (
            <Text style={[styles.muted, { paddingVertical: 12 }]}>No payments recorded yet.</Text>
          ) : (
            data.payments.map((payment, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.colDate}>{payment.paymentDate}</Text>
                <Text style={styles.colInvoice}>{payment.invoiceNumber}</Text>
                <Text style={styles.colMethod}>{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</Text>
                <Text style={styles.colReference}>{payment.reference ?? "—"}</Text>
                <Text style={styles.colAmount}>{money(payment.amount, data.currency)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text>Total Payments</Text>
            <Text>{money(totalPayments.toFixed(2), data.currency)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
