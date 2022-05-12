import cron from 'node-cron';
import moment from 'moment';
import db from '../controllers/databaseController'

// DAILY Cron Jobs [Firing at 7:00am]

const clearOldEventsTask = cron.schedule('0 7 * * *', function() {
    // Event Clear
    // This will fire once a day to clear all events that are past.
    db.query (`DELETE FROM events WHERE eventdatetime < "${moment().format('YYYY-MM-DD HH:mm:ss')}"`, function (err, results) {
      if (err) {
        throw err;
      } else {
        console.log(`[CONSOLE] [CRON] Old Events have been cleared.`);
      }
    });
  
  
  }, {
     scheduled: true,
     timezone: "Australia/Sydney"
  });
  
  clearOldEventsTask.start();