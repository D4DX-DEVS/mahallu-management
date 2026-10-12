import { adminRoutes } from './adminRoutes';
import { communityRoutes } from './communityRoutes';
import { financeRoutes } from './financeRoutes';
import { memberRoutes } from './memberRoutes';
import { serviceRoutes } from './serviceRoutes';
import { phaseARoutes } from './phaseARoutes';
import { phaseBRoutes } from './phaseBRoutes';

export const appRoutes = [
  ...memberRoutes,
  ...adminRoutes,
  ...communityRoutes,
  ...financeRoutes,
  ...serviceRoutes,
  ...phaseARoutes,
  ...phaseBRoutes,
];
