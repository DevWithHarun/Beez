import { queryOptions } from '@tanstack/react-query';
import { getMerchantDashboard } from './merchant.functions';
export const merchantQuery = queryOptions({ queryKey: ['merchant-dashboard'], queryFn: () => getMerchantDashboard(), staleTime: 0 });