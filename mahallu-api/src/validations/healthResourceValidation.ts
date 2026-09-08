import { validCategoryValue } from './categoryValueValidation';

/**
 * bloodGroup used to be a hardcoded Mongoose enum on HealthResource. It now
 * shares the 'blood_group' Category with Member.bloodGroup, so a Super Admin
 * adding a group in Categories makes it saveable on blood donors too.
 */
export const healthResourceValidation = [validCategoryValue('blood_group', 'bloodGroup')];
