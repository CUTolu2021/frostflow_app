const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const salesTable = () => supabase.schema(env.supabaseSchema).from('sales');
const salePaymentsTable = () => supabase.schema(env.supabaseSchema).from('sale_payments');

const createSale = async ({
  organizationId,
  productId,
  quantity,
  sellingPrice,
  totalPrice,
  paymentMethod,
  recordedBy,
  customerType,
  unitType,
  boxWeight,
  status,
  invoiceId,
  payments,
}) => {
  const payload = {
    organization_id: organizationId,
    product_id: productId,
    quantity,
    selling_price: sellingPrice,
    total_price: totalPrice,
    payment_method: paymentMethod,
    recorded_by: recordedBy,
    customer_type: customerType || null,
    unit_type: unitType,
    box_weight: Number.isFinite(Number(boxWeight)) ? Number(boxWeight) : null,
    status: status || 'completed',
    invoice_id: invoiceId || null,
  };

  const { data, error } = await salesTable().insert(payload).select('*').single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to record sale');
  }

  if (Array.isArray(payments) && payments.length > 0) {
    const paymentPayload = payments.map((payment) => ({
      sale_id: data.id,
      organization_id: organizationId,
      method: payment.method,
      amount: payment.amount,
      reference_note: payment.reference_note || null,
    }));

    const { error: paymentsError } = await salePaymentsTable().insert(paymentPayload);
    if (paymentsError) {
      throw new HttpError(500, 'Unable to record sale payment breakdown');
    }

    const { data: paymentRows, error: paymentSelectError } = await salePaymentsTable()
      .select('*')
      .eq('sale_id', data.id)
      .order('created_at', { ascending: true });

    if (paymentSelectError) {
      throw new HttpError(500, 'Unable to load sale payment breakdown');
    }

    data.sale_payments = paymentRows || [];
  }

  return data;
};

const markSaleVoided = async ({ saleId, organizationId }) => {
  let query = salesTable()
    .update({
      status: 'voided',
      updated_at: new Date().toISOString(),
    })
    .eq('id', saleId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { error } = await query;
  if (error) {
    throw new HttpError(500, 'Unable to void sale');
  }
};

module.exports = {
  createSale,
  markSaleVoided,
};
