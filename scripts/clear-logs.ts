import { OrganiserService } from '../server/src/services/organiser.service.js';

async function main() {
  console.log('[RailNova] Clearing all previous booking records and audit logs...');
  const res = await OrganiserService.clearAllBookingLogs('admin');
  console.log('[RailNova] Result:', res.message);
  
  const audit = await OrganiserService.getAuditLogs({ limit: 5 });
  console.log('[RailNova] Current Audit Log entries count:', audit.length);
  if (audit.length > 0) {
    console.log('[RailNova] Latest Audit Entry:', {
      action: audit[0].action,
      entity: audit[0].entity_type,
      time: audit[0].formattedDate,
      actor: audit[0].actor_name,
      metadata: audit[0].metadata
    });
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[RailNova Error]', err);
  process.exit(1);
});
