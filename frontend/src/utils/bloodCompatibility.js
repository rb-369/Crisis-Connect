/**
 * CrisisConnect — Medical Blood Donor-to-Recipient Compatibility Matrix
 * Follows international clinical transfusion compatibility standards.
 */

export const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

// Given a recipient's blood group, which donor groups can safely donate red blood cells?
export const RECIPIENT_CAN_RECEIVE_FROM = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'], // Universal Recipient
};

// Given a donor's blood group, which recipient groups can safely receive their donation?
export const DONOR_CAN_DONATE_TO = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // Universal Donor
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

/**
 * Checks if a donor with donorGroup can donate to a recipient with recipientGroup.
 */
export function isDonorCompatible(donorGroup, recipientGroup) {
  if (!donorGroup || !recipientGroup) return true; // fallback
  const cleanDonor = donorGroup.trim().toUpperCase();
  const cleanRecipient = recipientGroup.trim().toUpperCase();
  const allowedDonors = RECIPIENT_CAN_RECEIVE_FROM[cleanRecipient];
  if (!allowedDonors) return true;
  return allowedDonors.includes(cleanDonor);
}

/**
 * Gets list of compatible donor groups for a given recipient blood group.
 */
export function getCompatibleDonorsForRecipient(recipientGroup) {
  if (!recipientGroup) return BLOOD_GROUPS;
  const cleanRecipient = recipientGroup.trim().toUpperCase();
  return RECIPIENT_CAN_RECEIVE_FROM[cleanRecipient] || BLOOD_GROUPS;
}

/**
 * Gets list of compatible recipient groups for a given donor blood group.
 */
export function getCompatibleRecipientsForDonor(donorGroup) {
  if (!donorGroup) return BLOOD_GROUPS;
  const cleanDonor = donorGroup.trim().toUpperCase();
  return DONOR_CAN_DONATE_TO[cleanDonor] || BLOOD_GROUPS;
}

/**
 * Helper to get badge visual styling for a blood group.
 */
export function getBloodGroupTheme(group) {
  switch (group) {
    case 'O-':
      return { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', tag: 'Universal Donor' };
    case 'AB+':
      return { bg: '#EDE9FE', border: '#C4B5FD', text: '#5B21B6', tag: 'Universal Recipient' };
    case 'O+':
      return { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', tag: 'Common Donor' };
    default:
      return { bg: '#FFE4E6', border: '#FDA4AF', text: '#BE123C', tag: 'Blood Match' };
  }
}
