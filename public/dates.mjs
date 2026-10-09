const DAY_FORMAT=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
export const day=(date=new Date())=>DAY_FORMAT.format(date);
export const addDays=(dateString,days)=>day(new Date(Date.parse(dateString+'T03:00:00Z')+days*86400000));
export function weekStart(date=new Date()) {
  const current=day(date),weekday=new Date(current+'T03:00:00Z').getUTCDay();
  return addDays(current,-((weekday+6)%7));
}
