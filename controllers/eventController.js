import moment from 'moment';
import db from './databaseController';

/*
    Clears old events from the database by running a SQL query that 
    deletes events with a datetime earlier than the current moment. 
    If an error occurs, it is thrown and logged to the console. 
    If the function completes successfully, 
    a message is logged to the console indicating that old events have been cleared.
*/
export function clearOldEvents() {    
    try {        
        db.query(`DELETE FROM events WHERE eventdatetime < "${moment().format('YYYY-MM-DD HH:mm:ss')}"`, function (err, results) {
            if (err) {
                throw err;
            } else {
                console.log(`[CONSOLE] [CRON] Old Events have been cleared.`);
            }
        });
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}

export function isEventPublished() {
    try {
        db.query(`SELECT * FROM events where eventId=? AND published=?;`, function (err, results) {
            
        });
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}