// Prints a single greeting for anyone who opens the console instead of
// letting our own dev-time logging pile up. Imported once for its side
// effect, first thing, before anything else has a chance to log.
const REWARD_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1'

console.log(
  '%cHello there! I see you are stalking the logs? watch this video: %s',
  'font-size: 14px; font-weight: bold; color: #f5a742;',
  REWARD_URL
)
