const { supabase } = require('../config/supabase');
const { env } = require('../config/env');

const insertAuditLog = async ({
  tableName,
  recordId,
  action,
  changedBy,
  beforeData,
  afterData,
  organizationId,
}) => {
  await supabase.schema(env.supabaseSchema).from('audit_logs').insert({
    table_name: tableName,
    record_id: recordId,
    action,
    changed_by: changedBy || null,
    organization_id: organizationId || null,
    before_data: JSON.stringify(beforeData || null),
    after_data: JSON.stringify(afterData || null),
  });
};

module.exports = { insertAuditLog };
