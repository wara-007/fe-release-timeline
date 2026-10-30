import Dashboard from '@/components/dashboard';
import { getTimeline } from '@/lib/source';
export const dynamic = 'force-dynamic';
export default async function Page() {
  return <Dashboard initialData={await getTimeline()} />;
}
