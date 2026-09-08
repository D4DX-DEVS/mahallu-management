// Kerala Districts List
export const KERALA_DISTRICTS = [
  { value: 'Alappuzha', label: 'Alappuzha' },
  { value: 'Ernakulam', label: 'Ernakulam' },
  { value: 'Idukki', label: 'Idukki' },
  { value: 'Kannur', label: 'Kannur' },
  { value: 'Kasaragod', label: 'Kasaragod' },
  { value: 'Kollam', label: 'Kollam' },
  { value: 'Kottayam', label: 'Kottayam' },
  { value: 'Kozhikode', label: 'Kozhikode' },
  { value: 'Malappuram', label: 'Malappuram' },
  { value: 'Palakkad', label: 'Palakkad' },
  { value: 'Pathanamthitta', label: 'Pathanamthitta' },
  { value: 'Thiruvananthapuram', label: 'Thiruvananthapuram' },
  { value: 'Thrissur', label: 'Thrissur' },
  { value: 'Wayanad', label: 'Wayanad' },
];

// States (currently only Kerala)
export const STATES = [{ value: 'Kerala', label: 'Kerala' }];

// District mapping by state (for future expansion)
export const DISTRICTS_BY_STATE: Record<string, Array<{ value: string; label: string }>> = {
  Kerala: KERALA_DISTRICTS,
};

// Get districts for a specific state
export const getDistrictsByState = (state: string): Array<{ value: string; label: string }> => {
  return DISTRICTS_BY_STATE[state] || [];
};
