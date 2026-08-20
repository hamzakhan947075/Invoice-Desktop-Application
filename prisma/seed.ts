import "dotenv/config";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

// Canonical line-item calculation, mirrored by the Phase 5 invoice service:
//   net     = quantity * unitPrice - discount
//   tax     = net * (taxRate / 100)
//   lineTotal = net + tax
function calculateLine(quantity: number, unitPrice: number, taxRate: number, discount = 0) {
  const net = quantity * unitPrice - discount;
  const tax = net * (taxRate / 100);
  return {
    net: new Prisma.Decimal(net.toFixed(2)),
    tax: new Prisma.Decimal(tax.toFixed(2)),
    lineTotal: new Prisma.Decimal((net + tax).toFixed(2)),
  };
}

async function main() {
  const business = await prisma.business.create({
    data: {
      name: "Acme Design Studio",
      email: "hello@acmedesign.test",
      phone: "+92 300 1234567",
      address: "Suite 12, Gulberg III, Lahore, Pakistan",
      currency: "PKR",
    },
  });

  const [customerA, customerB, customerC] = await Promise.all([
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Beta Retailers",
        email: "accounts@betaretailers.test",
        phone: "+92 21 1112233",
        address: "45 Tariq Road, Karachi, Pakistan",
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Gamma Traders",
        email: "finance@gammatraders.test",
        phone: "+92 42 4455667",
        address: "12 Mall Road, Lahore, Pakistan",
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        name: "Coastal Cafe",
        email: "owner@coastalcafe.test",
        phone: "+92 300 7788990",
      },
    }),
  ]);

  const [websiteDesign, logoDesign, businessCards, hosting] = await Promise.all([
    prisma.product.create({
      data: {
        businessId: business.id,
        name: "Website Design",
        sku: "SVC-WEB-001",
        description: "Custom website design and development",
        type: "SERVICE",
        price: "50000.00",
        taxRate: "0",
      },
    }),
    prisma.product.create({
      data: {
        businessId: business.id,
        name: "Logo Design",
        sku: "SVC-LOGO-001",
        description: "Brand identity and logo design package",
        type: "SERVICE",
        price: "15000.00",
        taxRate: "0",
      },
    }),
    prisma.product.create({
      data: {
        businessId: business.id,
        name: "Business Cards (500pcs)",
        sku: "PRD-CARD-500",
        description: "Premium double-sided business cards, printed",
        type: "PRODUCT",
        price: "3500.00",
        taxRate: "17",
      },
    }),
    prisma.product.create({
      data: {
        businessId: business.id,
        name: "Monthly Website Hosting",
        sku: "SVC-HOST-001",
        description: "Managed hosting, backups, and uptime monitoring",
        type: "SERVICE",
        price: "2500.00",
        taxRate: "17",
      },
    }),
  ]);

  // Invoice 1 — fully paid
  const line1 = calculateLine(2, 50000, 0);
  const line2 = calculateLine(1, 15000, 0);
  const invoice1Subtotal = line1.net.plus(line2.net);
  const invoice1Tax = line1.tax.plus(line2.tax);
  const invoice1Total = invoice1Subtotal.plus(invoice1Tax);

  const invoice1 = await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customerA.id,
      invoiceNumber: "INV-2026-0001",
      issueDate: new Date("2026-06-01"),
      dueDate: new Date("2026-06-15"),
      status: "PAID",
      currency: "PKR",
      subtotal: invoice1Subtotal,
      discount: 0,
      tax: invoice1Tax,
      total: invoice1Total,
      amountPaid: invoice1Total,
      balanceDue: 0,
      notes: "Thank you for your business!",
      items: {
        create: [
          {
            productId: websiteDesign.id,
            description: websiteDesign.name,
            quantity: 2,
            unitPrice: 50000,
            taxRate: 0,
            discount: 0,
            lineTotal: line1.lineTotal,
          },
          {
            productId: logoDesign.id,
            description: logoDesign.name,
            quantity: 1,
            unitPrice: 15000,
            taxRate: 0,
            discount: 0,
            lineTotal: line2.lineTotal,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      businessId: business.id,
      invoiceId: invoice1.id,
      amount: invoice1Total,
      paymentDate: new Date("2026-06-10"),
      paymentMethod: "BANK_TRANSFER",
      reference: "TXN-100234",
    },
  });

  // Invoice 2 — partially paid
  const line3 = calculateLine(10, 3500, 17);
  const invoice2Subtotal = line3.net;
  const invoice2Tax = line3.tax;
  const invoice2Total = invoice2Subtotal.plus(invoice2Tax);
  const invoice2Paid = new Prisma.Decimal("20000.00");

  const invoice2 = await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customerB.id,
      invoiceNumber: "INV-2026-0002",
      issueDate: new Date("2026-07-01"),
      dueDate: new Date("2026-07-15"),
      status: "PARTIALLY_PAID",
      currency: "PKR",
      subtotal: invoice2Subtotal,
      discount: 0,
      tax: invoice2Tax,
      total: invoice2Total,
      amountPaid: invoice2Paid,
      balanceDue: invoice2Total.minus(invoice2Paid),
      items: {
        create: [
          {
            productId: businessCards.id,
            description: businessCards.name,
            quantity: 10,
            unitPrice: 3500,
            taxRate: 17,
            discount: 0,
            lineTotal: line3.lineTotal,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      businessId: business.id,
      invoiceId: invoice2.id,
      amount: invoice2Paid,
      paymentDate: new Date("2026-07-05"),
      paymentMethod: "EASYPAISA",
      reference: "TXN-100987",
    },
  });

  // Invoice 3 — overdue, unpaid
  const line4 = calculateLine(1, 2500, 17);
  const invoice3Total = line4.net.plus(line4.tax);

  await prisma.invoice.create({
    data: {
      businessId: business.id,
      customerId: customerC.id,
      invoiceNumber: "INV-2026-0003",
      issueDate: new Date("2026-06-20"),
      dueDate: new Date("2026-07-05"),
      // Stays SENT — "Overdue" is a derived display status (see src/lib/invoice-status.ts),
      // never written to the database, so a past due date + open balance is what makes it overdue.
      status: "SENT",
      currency: "PKR",
      subtotal: line4.net,
      discount: 0,
      tax: line4.tax,
      total: invoice3Total,
      amountPaid: 0,
      balanceDue: invoice3Total,
      notes: "Monthly hosting — July",
      items: {
        create: [
          {
            productId: hosting.id,
            description: hosting.name,
            quantity: 1,
            unitPrice: 2500,
            taxRate: 17,
            discount: 0,
            lineTotal: line4.lineTotal,
          },
        ],
      },
    },
  });

  console.log("Seed data created:");
  console.log(`  Business:  ${business.name}`);
  console.log(`  Customers: ${customerA.name}, ${customerB.name}, ${customerC.name}`);
  console.log(`  Products:  ${websiteDesign.name}, ${logoDesign.name}, ${businessCards.name}, ${hosting.name}`);
  console.log(`  Invoices:  INV-2026-0001 (paid), INV-2026-0002 (partially paid), INV-2026-0003 (overdue)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
