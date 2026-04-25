const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const salesTable = () => supabase.schema(env.supabaseSchema).from('sales');

const markSaleVoided = async ({ saleId, organizationId }) => {
  let query = salesTable().update({ status: 'voided' }).eq('id', saleId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { error } = await query;
  if (error) {
    throw new HttpError(500, 'Unable to void sale');
  }
};

module.exports = { markSaleVoided };
