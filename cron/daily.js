import cron from 'node-cron';
import { clearOldEvents } from '../controllers/eventController';

// DAILY Cron Jobs [Firing at 7:00am]

const clearOldEventsTask = cron.schedule('0 7 * * *', function() {
    // Event Clear
    // This will fire once a day to clear all events that are past.
    clearOldEvents();
  
  }, {
     scheduled: true,
     timezone: process.env.TZ
  });
  
  clearOldEventsTask.start();