function CreateRecurringTimer(context) {
    log('From CreateRecurringTimer: creating timer', context.mode, context.id);
    
    // Create timestamp for next minute 
    var nextMinute = new Date(); 
    const currentSeconds = nextMinute.getSeconds();

    if (currentSeconds !== 0) {
        nextMinute.setSeconds(0);
        nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    }
   
    // Create a document to use as out for our context
    createTimer(RecurringTimerCallback, nextMinute, context.id, context);
}


function RecurringTimerCallback(context) {
    log('From RecurringTimerCallback: timer fired', context);
    // rearm the timer ASAP, to ensure timer keeps running in the event
    // of later  errors or script timeouts in later "recurring work".
    CreateRecurringTimer({ "id": context.id, "mode": "via_callback" });
    // do any sort of recurring work here, just update a date_stamp in a doc
    
    // run the aggregation query
    var results = 
    with n as (trunc(now_millis()/1000))
        ,o as (n%60)
        ,e as (n-o)
        ,s as (e-60)
    SELECT
        DATE_TRUNC_STR(DATE_ADD_STR(NOW_STR(),-1,"minute"),"minute") AS start_time_fmt,
        DATE_TRUNC_STR(NOW_STR(),"second") AS trigger_time_fmt,
        trunc(now_millis()/1000) AS trigger_time,
        trunc(now_millis()/1000) - trunc(now_millis()/1000)%60 - 60 AS start_time,
        COUNT(1) AS count,
        AVG(`amount`) AS average_amt,
        SUM(`amount`) AS total_amt,
        {"silver": SUM(CASE WHEN cust_type = "silver" THEN 1 ELSE 0 END) ,
        "gold": SUM(CASE WHEN cust_type = "gold" THEN 1 ELSE 0 END),
        "platinum": SUM(CASE WHEN cust_type = "platinum" THEN 1 ELSE 0 END)
        } AS category
    FROM `main`.`data`.`data`
    WHERE `time_unix` BETWEEN s AND e;
    

    for (var item of results) {   // Stream results using 'for' iterator.
        minute_collection[item.start_time_fmt] = item
    }
    
    results.close()
    
}

function OnUpdate(doc, meta) {
    // You would typically filter to mutations of interest
    if (doc.active === false) {
        if (cancelTimer(RecurringTimerCallback, meta.id)) {
            log('From OnUpdate: canceled active Timer, doc.active',
                doc.active, meta.id);
        } else {
            log('From OnUpdate: no active Timer to cancel, doc.active',
                doc.active, meta.id);
        }
    } else {
        log('From OnUpdate: create/overwrite doc.active', doc.active, meta.id);
        CreateRecurringTimer({  "id": meta.id, "mode": "via_onupdate" });
    }
}