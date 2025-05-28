
// Utility to get current timestamp in DDMMMYYYYHHMM format
// e.g., 03AUG20231405
export const getFormattedTimestamp = (date: Date = new Date()): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}${month}${year}${hours}${minutes}`;
};
