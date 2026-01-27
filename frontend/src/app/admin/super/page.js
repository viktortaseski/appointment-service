import { notFound } from 'next/navigation';

import SuperAdminClient from './SuperAdminClient';

export default function SuperAdminPage() {
  if (process.env.SUPER_ADMIN_ENABLED !== 'true') {
    notFound();
  }

  return <SuperAdminClient />;
}
