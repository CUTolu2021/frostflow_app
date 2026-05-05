const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const salesTable = () => supabase.schema(env.supabaseSchema).from('sales');

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
  };

  const { data, error } = await salesTable().insert(payload).select('*').single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to record sale');
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
